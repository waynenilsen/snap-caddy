"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MaskData } from "@/types/segmentation";

/**
 * SAM-style color palette for masks
 * Distinct colors that are visually distinguishable
 */
const MASK_COLORS = [
  "rgba(255, 0, 0, 0.4)", // Red
  "rgba(0, 255, 0, 0.4)", // Green
  "rgba(0, 0, 255, 0.4)", // Blue
  "rgba(255, 255, 0, 0.4)", // Yellow
  "rgba(255, 0, 255, 0.4)", // Magenta
  "rgba(0, 255, 255, 0.4)", // Cyan
  "rgba(255, 128, 0, 0.4)", // Orange
  "rgba(128, 0, 255, 0.4)", // Purple
  "rgba(0, 255, 128, 0.4)", // Spring Green
  "rgba(255, 0, 128, 0.4)", // Rose
  "rgba(128, 255, 0, 0.4)", // Lime
  "rgba(0, 128, 255, 0.4)", // Sky Blue
];

/**
 * Get a consistent color for a mask index
 */
export function getMaskColor(index: number): string {
  return MASK_COLORS[index % MASK_COLORS.length];
}

/**
 * Get the solid (non-transparent) version of a mask color for borders
 */
export function getMaskSolidColor(index: number): string {
  return MASK_COLORS[index % MASK_COLORS.length].replace("0.4)", "1)");
}

interface MaskPreviewOverlayProps {
  /** URL of the original image */
  imageUrl: string;
  /** Array of mask data with selection state */
  masks: MaskData[];
  /** Whether masks are still loading */
  isLoading?: boolean;
  /** Image dimensions */
  imageWidth: number;
  imageHeight: number;
  /** Optional: show compact version */
  compact?: boolean;
}

/**
 * MaskPreviewOverlay - Preview display for SAM 2 masks (no interaction)
 *
 * Displays the original image with all detected masks overlaid.
 * Each mask has a distinct color.
 *
 * Selected masks: Full opacity color
 * Unselected masks: Dimmed/grayed out
 *
 * Note: This component is now view-only. Use SegmentList for selection.
 */
export function MaskToggleOverlay({
  imageUrl,
  masks,
  isLoading = false,
  imageWidth,
  imageHeight,
  compact = false,
}: MaskPreviewOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Load the original image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    setIsImageLoading(true);

    img.onload = () => {
      setLoadedImage(img);
      setIsImageLoading(false);
    };

    img.onerror = () => {
      console.error("Failed to load image");
      setIsImageLoading(false);
    };

    img.src = imageUrl;
  }, [imageUrl]);

  // Calculate display size maintaining aspect ratio
  useEffect(() => {
    if (!containerRef.current || !loadedImage) return;

    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const maxHeight = compact
        ? window.innerHeight * 0.35
        : window.innerHeight * 0.5;

      const aspectRatio = imageWidth / imageHeight;
      let displayWidth = containerWidth;
      let displayHeight = displayWidth / aspectRatio;

      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight * aspectRatio;
      }

      setDisplaySize({
        width: Math.floor(displayWidth),
        height: Math.floor(displayHeight),
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [loadedImage, imageWidth, imageHeight, compact]);

  // Render the canvas with image and masks
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !loadedImage || displaySize.width === 0) return;

    // Set canvas size
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the original image
    ctx.drawImage(loadedImage, 0, 0, displaySize.width, displaySize.height);

    // Draw each mask overlay
    for (const mask of masks) {
      if (!mask.imageData) continue;

      // Create a temporary canvas for this mask
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = imageWidth;
      maskCanvas.height = imageHeight;
      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) continue;

      // Put the mask image data
      maskCtx.putImageData(mask.imageData, 0, 0);

      // Get the pixel data to colorize
      const maskImageData = maskCtx.getImageData(0, 0, imageWidth, imageHeight);
      const data = maskImageData.data;

      // Parse the mask color
      const colorMatch = mask.color.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
      );
      const r = colorMatch ? Number.parseInt(colorMatch[1], 10) : 255;
      const g = colorMatch ? Number.parseInt(colorMatch[2], 10) : 0;
      const b = colorMatch ? Number.parseInt(colorMatch[3], 10) : 0;

      // Colorize the mask
      // Selected masks: full color, unselected: grayed/dimmed
      const alpha = mask.selected ? 0.5 : 0.15;

      for (let i = 0; i < data.length; i += 4) {
        // Check if this pixel is part of the mask (non-black)
        if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
          if (mask.selected) {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = Math.floor(255 * alpha);
          } else {
            // Unselected: gray with low opacity
            data[i] = 128;
            data[i + 1] = 128;
            data[i + 2] = 128;
            data[i + 3] = Math.floor(255 * 0.2);
          }
        } else {
          // Transparent for non-mask areas
          data[i + 3] = 0;
        }
      }

      maskCtx.putImageData(maskImageData, 0, 0);

      // Draw the colorized mask onto the main canvas
      ctx.drawImage(maskCanvas, 0, 0, displaySize.width, displaySize.height);
    }
  }, [loadedImage, masks, displaySize, imageWidth, imageHeight]);

  const showLoading = isLoading || isImageLoading;

  return (
    <div ref={containerRef} className="relative w-full">
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {isImageLoading ? "Loading image..." : "Processing masks..."}
            </span>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border"
        style={{
          maxHeight: compact ? "35vh" : "50vh",
          objectFit: "contain",
        }}
      />

      {/* Mask count indicator */}
      {!showLoading && masks.length > 0 && (
        <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-xs">
          {masks.filter((m) => m.selected).length}/{masks.length} selected
        </div>
      )}
    </div>
  );
}
