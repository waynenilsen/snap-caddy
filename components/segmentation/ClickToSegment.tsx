"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus, Minus } from "lucide-react";
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

type PointMode = "include" | "exclude";

export function ClickToSegment({
  imageUrl,
  points,
  onPointAdd,
  onPointRemove,
}: ClickToSegmentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [pointMode, setPointMode] = useState<PointMode>("include");

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
  }, [imageUrl, drawCanvas]);

  // Redraw when points or hover state changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Get canvas coordinates from a pointer/touch event
  const getCanvasCoords = (
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Unified handler for adding/removing points (works with mouse and touch)
  const handlePointInteraction = (
    clientX: number,
    clientY: number,
    forceExclude = false,
  ) => {
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return;

    const { x, y } = coords;

    // Check if clicking on existing point to remove it
    const clickedPoint = points.find((p) => {
      const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      return distance < 20; // Slightly larger hit area for touch
    });

    if (clickedPoint) {
      const index = points.findIndex((p) => p.id === clickedPoint.id);
      onPointRemove(index);
      return;
    }

    // Add new point using current mode (or force exclude for right-click)
    const newPoint: SegmentPoint = {
      x,
      y,
      label: forceExclude || pointMode === "exclude" ? 0 : 1,
      id: crypto.randomUUID(),
    };

    onPointAdd(newPoint);
  };

  // Handle pointer events (unified mouse + touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Prevent default to avoid issues with touch scrolling on canvas
    e.preventDefault();
    handlePointInteraction(e.clientX, e.clientY);
  };

  // Handle right-click for exclude points (desktop convenience)
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handlePointInteraction(e.clientX, e.clientY, true);
  };

  // Handle pointer move for hover detection
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only track hover for mouse (not touch)
    if (e.pointerType === "touch") return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    const { x, y } = coords;

    // Find hovered point
    const hovered = points.find((p) => {
      const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      return distance < 15;
    });

    setHoveredPointId(hovered?.id || null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Tap to Select Object</CardTitle>
        <CardDescription>
          Tap on the object to mark areas.{" "}
          <span className="hidden sm:inline">
            (Desktop: right-click to exclude)
          </span>
          <span className="sm:hidden">
            Use the toggle below to switch between include/exclude.
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Mode toggle - prominent on mobile */}
        <div className="flex items-center justify-between gap-2 p-2 sm:p-3 border rounded-lg bg-muted/50">
          <span className="text-sm font-medium">Mode:</span>
          <div className="flex gap-1 sm:gap-2">
            <Button
              variant={pointMode === "include" ? "default" : "outline"}
              size="sm"
              onClick={() => setPointMode("include")}
              className={cn(
                "gap-1 sm:gap-2 min-h-[44px] px-3 sm:px-4",
                "active:scale-95 transition-transform",
                pointMode === "include" && "bg-green-600 hover:bg-green-700",
              )}
            >
              <Plus className="w-4 h-4" />
              <span>Include</span>
            </Button>
            <Button
              variant={pointMode === "exclude" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setPointMode("exclude")}
              className={cn(
                "gap-1 sm:gap-2 min-h-[44px] px-3 sm:px-4",
                "active:scale-95 transition-transform",
              )}
            >
              <Minus className="w-4 h-4" />
              <span>Exclude</span>
            </Button>
          </div>
        </div>

        {/* Canvas container with max height for mobile */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onContextMenu={handleContextMenu}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoveredPointId(null)}
            className={cn(
              "w-full h-auto max-h-[60vh] object-contain border rounded-lg cursor-crosshair touch-none",
              "hover:border-primary active:border-primary transition-colors",
            )}
            style={{ touchAction: "none" }}
          />

          {/* Hidden image element */}
          <img ref={imageRef} src={imageUrl} alt="Source" className="hidden" />

          {/* Current mode indicator - compact badge in corner */}
          <Badge
            variant={pointMode === "include" ? "default" : "destructive"}
            className={cn(
              "absolute top-2 right-2 shadow-md",
              pointMode === "include" && "bg-green-600",
            )}
          >
            {pointMode === "include" ? "Include" : "Exclude"}
          </Badge>
        </div>

        {/* Point list */}
        {points.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Points ({points.length})</p>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {points.map((point, index) => (
                <Badge
                  key={point.id}
                  variant={point.label === 1 ? "default" : "destructive"}
                  className={cn(
                    "gap-1 sm:gap-2 cursor-pointer min-h-[32px] px-2 sm:px-3",
                    "hover:opacity-80 active:opacity-60 active:scale-95",
                    "transition-all touch-manipulation",
                    point.label === 1 ? "bg-green-500 hover:bg-green-600" : "",
                  )}
                  onClick={() => onPointRemove(index)}
                >
                  {point.label === 1 ? "+" : "−"} #{index + 1}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Info message when no points */}
        {points.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Tap on the image to start selecting the object
          </p>
        )}
      </CardContent>
    </Card>
  );
}
