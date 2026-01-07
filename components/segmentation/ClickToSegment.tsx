"use client";

import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SegmentPoint {
  x: number;
  y: number;
  label: 0 | 1; // 0 = background (exclude), 1 = foreground (include)
  id: string;
}

interface ClickToSegmentProps {
  imageUrl: string;
  points: SegmentPoint[];
  onPointAdd: (point: SegmentPoint) => void;
  onPointRemove: (index: number) => void;
}

export function ClickToSegment({
  imageUrl,
  points,
  onPointAdd,
  onPointRemove,
}: ClickToSegmentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [_dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isRightClick, setIsRightClick] = useState(false);

  // Draw the canvas with image and points
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !image || !ctx || !image.complete) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw points
    points.forEach((point) => {
      const isHovered = hoveredPointId === point.id;
      const radius = isHovered ? 10 : 7;

      // Point background (green for include, red for exclude)
      ctx.fillStyle = point.label === 1 ? "#22c55e" : "#ef4444";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Point border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Add inner ring for better visibility
      ctx.strokeStyle = point.label === 1 ? "#16a34a" : "#dc2626";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius - 2, 0, 2 * Math.PI);
      ctx.stroke();

      // Point label on hover
      if (isHovered) {
        ctx.fillStyle = "#000000";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "left";
        const text = point.label === 1 ? "Include" : "Exclude";
        const textWidth = ctx.measureText(text).width;

        // Background for text
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.fillRect(point.x + 14, point.y - 20, textWidth + 10, 24);

        // Text
        ctx.fillStyle = point.label === 1 ? "#16a34a" : "#dc2626";
        ctx.fillText(text, point.x + 19, point.y - 2);
      }
    });
  }, [points, hoveredPointId]);

  // Load and draw image
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const handleLoad = () => {
      setDimensions({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        drawCanvas();
      }
    };

    if (image.complete) {
      handleLoad();
    } else {
      image.addEventListener("load", handleLoad);
      return () => image.removeEventListener("load", handleLoad);
    }
  }, [drawCanvas]);

  // Redraw when points or hover state changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicking on existing point to remove it
    const clickedPoint = points.find((p) => {
      const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      return distance < 15;
    });

    if (clickedPoint) {
      const index = points.findIndex((p) => p.id === clickedPoint.id);
      onPointRemove(index);
      return;
    }

    // Add new point
    const newPoint: SegmentPoint = {
      x,
      y,
      label: isRightClick ? 0 : 1, // Right click = exclude, left click = include
      id: crypto.randomUUID(),
    };

    onPointAdd(newPoint);
  };

  // Handle right-click for exclude points
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsRightClick(true);
    handleCanvasClick(e);
    setIsRightClick(false);
  };

  // Handle mouse move for hover detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find hovered point
    const hovered = points.find((p) => {
      const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      return distance < 15;
    });

    setHoveredPointId(hovered?.id || null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Click to Select Object</CardTitle>
        <CardDescription>
          <span className="font-medium text-green-600">Left-click</span> on the
          object to include areas.{" "}
          <span className="font-medium text-red-600">Right-click</span> to
          exclude areas. Click on a point to remove it.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onContextMenu={handleContextMenu}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPointId(null)}
            className={cn(
              "w-full h-auto border rounded-lg cursor-crosshair",
              "hover:border-primary transition-colors",
            )}
          />

          {/* biome-ignore lint/performance/noImgElement: Hidden img for canvas drawing, next/image not suitable */}
          <img ref={imageRef} src={imageUrl} alt="Source" className="hidden" />

          {/* Cursor indicator */}
          {!hoveredPointId && (
            <div className="absolute top-2 right-2 flex gap-2">
              <Badge variant="default" className="bg-green-500 text-white">
                Left: Include
              </Badge>
              <Badge variant="destructive">Right: Exclude</Badge>
            </div>
          )}
        </div>

        {/* Point list */}
        {points.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Points ({points.length})</p>
            <div className="flex flex-wrap gap-2">
              {points.map((point, index) => (
                <Badge
                  key={point.id}
                  variant={point.label === 1 ? "default" : "destructive"}
                  className={cn(
                    "gap-2 cursor-pointer hover:opacity-80 transition-opacity",
                    point.label === 1 ? "bg-green-500 hover:bg-green-600" : "",
                  )}
                  onClick={() => onPointRemove(index)}
                >
                  {point.label === 1 ? "Include" : "Exclude"} #{index + 1}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Info message when no points */}
        {points.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Click on the object to start segmentation
          </p>
        )}
      </CardContent>
    </Card>
  );
}
