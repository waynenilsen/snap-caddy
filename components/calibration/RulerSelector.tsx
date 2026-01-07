"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

interface RulerSelectorProps {
  imageUrl: string;
  line: [Point, Point] | null;
  onLineChange: (point1: Point, point2: Point) => void;
}

export function RulerSelector({
  imageUrl,
  line,
  onLineChange,
}: RulerSelectorProps) {
  const [points, setPoints] = useState<[Point?, Point?]>(
    line || [undefined, undefined],
  );
  const [isDragging, setIsDragging] = useState<0 | 1 | null>(null);
  const [hoveredEndpoint, setHoveredEndpoint] = useState<0 | 1 | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const distance = (p1: Point, p2: Point): number => {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !image || !ctx || !isImageLoaded) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw line
    if (points[0] && points[1]) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();

      // Draw measurement label
      const midX = (points[0].x + points[1].x) / 2;
      const midY = (points[0].y + points[1].y) / 2;
      const dist = distance(points[0], points[1]);

      // Background for text
      ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
      const text = `${Math.round(dist)}px`;
      ctx.font = "bold 14px sans-serif";
      const metrics = ctx.measureText(text);
      const padding = 6;
      ctx.fillRect(
        midX - metrics.width / 2 - padding,
        midY - 20,
        metrics.width + padding * 2,
        20,
      );

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, midX, midY - 10);
    } else if (points[0]) {
      // Draw single point with dashed guide
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
    }

    // Draw endpoints
    [points[0], points[1]].forEach((point, idx) => {
      if (!point) return;

      const isHovered = hoveredEndpoint === idx;
      const radius = isHovered ? 8 : 6;

      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    });
  }, [points, hoveredEndpoint, isImageLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleImageLoad = () => {
    const image = imageRef.current;
    const canvas = canvasRef.current;

    if (!image || !canvas) return;

    // Set canvas size to match image natural dimensions
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    setIsImageLoaded(true);
  };

  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const clickPoint = getCanvasCoordinates(e);

    // Check if clicking near an existing endpoint to drag it
    if (points[0] && points[1]) {
      const dist0 = distance(clickPoint, points[0]);
      const dist1 = distance(clickPoint, points[1]);

      if (dist0 < 15 || dist1 < 15) {
        // Don't reset if clicking on an endpoint (handled by drag)
        return;
      }

      // Reset if clicking elsewhere
      setPoints([clickPoint, undefined]);
    } else if (!points[0]) {
      setPoints([clickPoint, undefined]);
    } else {
      const newPoints: [Point, Point] = [points[0], clickPoint];
      setPoints(newPoints);

      onLineChange(newPoints[0], newPoints[1]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const clickPoint = getCanvasCoordinates(e);

    // Check if clicking near an existing endpoint to drag it
    if (points[0] && distance(clickPoint, points[0]) < 15) {
      setIsDragging(0);
      e.preventDefault();
    } else if (points[1] && distance(clickPoint, points[1]) < 15) {
      setIsDragging(1);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const currentPoint = getCanvasCoordinates(e);

    if (isDragging !== null) {
      const newPoints = [...points] as [Point?, Point?];
      newPoints[isDragging] = currentPoint;
      setPoints(newPoints);

      if (newPoints[0] && newPoints[1]) {
        onLineChange(newPoints[0], newPoints[1]);
      }
    } else {
      // Check hover
      if (points[0] && distance(currentPoint, points[0]) < 15) {
        setHoveredEndpoint(0);
      } else if (points[1] && distance(currentPoint, points[1]) < 15) {
        setHoveredEndpoint(1);
      } else {
        setHoveredEndpoint(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const pixelDistance =
    points[0] && points[1] ? distance(points[0], points[1]) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Ruler Reference</CardTitle>
        <CardDescription>
          Click two points on a ruler or known measurement to set the scale
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={containerRef} className="relative">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={cn(
              "w-full h-auto border rounded-lg",
              isDragging !== null ? "cursor-grabbing" : "cursor-crosshair",
            )}
          />

          <img
            ref={imageRef}
            src={imageUrl}
            alt="Calibration reference"
            className="hidden"
            onLoad={handleImageLoad}
          />
        </div>

        {pixelDistance && (
          <Alert>
            <Ruler className="h-4 w-4" />
            <AlertDescription>
              Pixel distance: {Math.round(pixelDistance)}px
              <br />
              Now enter the real-world measurement this represents.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
