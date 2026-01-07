"use client";

import { Check, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MaskData } from "@/types/segmentation";
import { getMaskSolidColor } from "./MaskToggleOverlay";

interface SegmentListProps {
  /** Array of mask data with selection state */
  masks: MaskData[];
  /** Callback when a mask is toggled */
  onMaskToggle: (index: number) => void;
  /** Image dimensions for generating thumbnails */
  imageWidth: number;
  imageHeight: number;
  /** Whether masks are still loading */
  isLoading?: boolean;
}

/**
 * SegmentList - Grid-based segment selection list
 *
 * Displays each detected segment as a card with:
 * - Thumbnail preview of the mask
 * - Color indicator matching the overlay color
 * - Large touch-friendly toggle button
 * - Clear selected/unselected visual state
 */
export function SegmentList({
  masks,
  onMaskToggle,
  imageWidth,
  imageHeight,
  isLoading = false,
}: SegmentListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (masks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No segments detected
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {masks.map((mask) => (
        <SegmentCard
          key={mask.index}
          mask={mask}
          onToggle={() => onMaskToggle(mask.index)}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
      ))}
    </div>
  );
}

interface SegmentCardProps {
  mask: MaskData;
  onToggle: () => void;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Individual segment card with thumbnail and toggle
 */
function SegmentCard({
  mask,
  onToggle,
  imageWidth,
  imageHeight,
}: SegmentCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnailGenerated, setThumbnailGenerated] = useState(false);

  // Generate thumbnail from mask imageData
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mask.imageData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Find bounding box of the mask for better thumbnail
    const bounds = getMaskBounds(mask.imageData, imageWidth, imageHeight);

    // Canvas is square, so we need to fit the mask bounds into it
    const size = 80; // thumbnail size
    canvas.width = size;
    canvas.height = size;

    // Clear with transparent background
    ctx.clearRect(0, 0, size, size);

    // Create a temporary canvas with the full mask
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageWidth;
    tempCanvas.height = imageHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Colorize the mask for the thumbnail
    const colorMatch = mask.color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
    );
    const r = colorMatch ? Number.parseInt(colorMatch[1], 10) : 255;
    const g = colorMatch ? Number.parseInt(colorMatch[2], 10) : 0;
    const b = colorMatch ? Number.parseInt(colorMatch[3], 10) : 0;

    // Create colorized mask data
    const colorizedData = new ImageData(imageWidth, imageHeight);
    const srcData = mask.imageData.data;
    const dstData = colorizedData.data;

    for (let i = 0; i < srcData.length; i += 4) {
      // Check if this pixel is part of the mask (non-black)
      if (srcData[i] > 10 || srcData[i + 1] > 10 || srcData[i + 2] > 10) {
        dstData[i] = r;
        dstData[i + 1] = g;
        dstData[i + 2] = b;
        dstData[i + 3] = 255; // Full opacity for thumbnail
      } else {
        dstData[i + 3] = 0; // Transparent
      }
    }

    tempCtx.putImageData(colorizedData, 0, 0);

    // Draw the bounded region into the thumbnail canvas
    // Add some padding around the bounds
    const padding = Math.max(bounds.width, bounds.height) * 0.1;
    const srcX = Math.max(0, bounds.x - padding);
    const srcY = Math.max(0, bounds.y - padding);
    const srcW = Math.min(imageWidth - srcX, bounds.width + padding * 2);
    const srcH = Math.min(imageHeight - srcY, bounds.height + padding * 2);

    // Fit into square canvas maintaining aspect ratio
    const scale = Math.min(size / srcW, size / srcH);
    const dstW = srcW * scale;
    const dstH = srcH * scale;
    const dstX = (size - dstW) / 2;
    const dstY = (size - dstH) / 2;

    ctx.drawImage(tempCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

    setThumbnailGenerated(true);
  }, [mask, imageWidth, imageHeight]);

  const solidColor = getMaskSolidColor(mask.index);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative aspect-square rounded-lg border-2 overflow-hidden transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "active:scale-95 touch-manipulation",
        mask.selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-muted bg-muted/30 opacity-60 hover:opacity-80",
      )}
      aria-pressed={mask.selected}
      aria-label={`Segment ${mask.index + 1}: ${mask.selected ? "selected" : "not selected"}`}
    >
      {/* Color indicator bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ backgroundColor: solidColor }}
      />

      {/* Thumbnail canvas */}
      <canvas
        ref={canvasRef}
        className={cn("w-full h-full", !thumbnailGenerated && "opacity-0")}
      />

      {/* Loading placeholder */}
      {!mask.imageData && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="w-6 h-6 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
        </div>
      )}

      {/* Selection indicator */}
      <div
        className={cn(
          "absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all",
          mask.selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted-foreground/30 text-muted-foreground",
        )}
      >
        {mask.selected ? (
          <Check className="w-4 h-4" />
        ) : (
          <EyeOff className="w-3 h-3" />
        )}
      </div>

      {/* Segment number */}
      <div
        className={cn(
          "absolute top-2 left-1 text-xs font-medium px-1.5 py-0.5 rounded",
          mask.selected
            ? "bg-primary/80 text-primary-foreground"
            : "bg-muted-foreground/50 text-muted",
        )}
      >
        {mask.index + 1}
      </div>
    </button>
  );
}

/**
 * Get the bounding box of non-transparent pixels in mask data
 */
function getMaskBounds(
  imageData: ImageData,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Check if pixel is part of mask (non-black)
      if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Handle empty mask
  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: width, height: height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
