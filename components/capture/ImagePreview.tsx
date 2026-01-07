"use client";

import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ImageInfo {
  dimensions: { width: number; height: number };
  fileSize?: number;
  format?: string;
}

interface ImagePreviewProps {
  src: string;
  alt?: string;
  onRetake?: () => void;
  enableZoom?: boolean;
  enablePan?: boolean;
  showInfo?: boolean;
  maxZoom?: number;
  minZoom?: number;
}

export function ImagePreview({
  src,
  alt = "Preview",
  onRetake,
  enableZoom = true,
  enablePan = true,
  showInfo = true,
  maxZoom = 3,
  minZoom = 0.5,
}: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState<
    number | null
  >(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom) return;

    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + delta, minZoom), maxZoom));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enablePan) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !enablePan) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageInfo({
        dimensions: {
          width: imageRef.current.naturalWidth,
          height: imageRef.current.naturalHeight,
        },
      });
    }
  };

  // Touch support for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableZoom) return;

    if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      setInitialPinchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableZoom || !initialPinchDistance) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getDistance(e.touches[0], e.touches[1]);
      const scaleFactor = distance / initialPinchDistance;
      setScale((prev) =>
        Math.min(Math.max(prev * scaleFactor, minZoom), maxZoom),
      );
      setInitialPinchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setInitialPinchDistance(null);
  };

  function getDistance(touch1: React.Touch, touch2: React.Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  return (
    <div className="w-full">
      <Card>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-muted"
            style={{ aspectRatio: "4/3" }}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className={cn(
                "w-full h-full flex items-center justify-center",
                isDragging && "cursor-grabbing",
                enablePan && !isDragging && "cursor-grab",
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                ref={imageRef}
                src={src}
                alt={alt}
                onLoad={handleImageLoad}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${
                    position.y / scale
                  }px)`,
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                }}
                draggable={false}
              />
            </div>

            {/* Zoom controls */}
            {enableZoom && (
              <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() =>
                    setScale((prev) => Math.min(prev + 0.25, maxZoom))
                  }
                  disabled={scale >= maxZoom}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() =>
                    setScale((prev) => Math.max(prev - 0.25, minZoom))
                  }
                  disabled={scale <= minZoom}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleReset}
                  aria-label="Reset view"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Image info overlay */}
            {showInfo && imageInfo && (
              <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
                <p className="font-medium">
                  {imageInfo.dimensions.width} × {imageInfo.dimensions.height}px
                </p>
                <p className="text-muted-foreground">
                  Zoom: {Math.round(scale * 100)}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Retake button */}
      {onRetake && (
        <div className="mt-4 flex justify-center">
          <Button onClick={onRetake} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake / Re-upload
          </Button>
        </div>
      )}
    </div>
  );
}
