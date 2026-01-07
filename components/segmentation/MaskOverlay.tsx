"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MaskOverlayProps {
  imageUrl: string;
  maskData: string; // base64 PNG or data URL
  opacity?: number;
}

export function MaskOverlay({
  imageUrl,
  maskData,
  opacity = 0.5,
}: MaskOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsLoading(true);
    setError(null);

    const image = new Image();
    const mask = new Image();
    let imagesLoaded = 0;

    const checkLoaded = () => {
      imagesLoaded++;
      if (imagesLoaded === 2) {
        drawComposite();
        setIsLoading(false);
      }
    };

    const handleError = (_e: ErrorEvent | Event) => {
      setError("Failed to load image or mask");
      setIsLoading(false);
    };

    const drawComposite = () => {
      // Set canvas dimensions to match image
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw original image
      ctx.drawImage(image, 0, 0);

      // Draw mask with transparency and green tint
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = "source-over";

      // Create a temporary canvas to tint the mask green
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = mask.naturalWidth;
      tempCanvas.height = mask.naturalHeight;
      const tempCtx = tempCanvas.getContext("2d");

      if (tempCtx) {
        // Draw mask
        tempCtx.drawImage(mask, 0, 0);

        // Apply green tint
        tempCtx.globalCompositeOperation = "source-in";
        tempCtx.fillStyle = "#22c55e"; // Green color
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw tinted mask onto main canvas
        ctx.drawImage(tempCanvas, 0, 0);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Draw edge highlighting
      drawEdges(ctx, mask);
    };

    const drawEdges = (
      ctx: CanvasRenderingContext2D,
      maskImg: HTMLImageElement,
    ) => {
      // Create temporary canvas for edge detection
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = maskImg.naturalWidth;
      tempCanvas.height = maskImg.naturalHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      // Draw mask to temp canvas
      tempCtx.drawImage(maskImg, 0, 0);
      const imageData = tempCtx.getImageData(
        0,
        0,
        tempCanvas.width,
        tempCanvas.height,
      );
      const data = imageData.data;

      // Simple edge detection: check for boundaries
      ctx.strokeStyle = "#16a34a"; // Darker green for edges
      ctx.lineWidth = 2;

      for (let y = 1; y < tempCanvas.height - 1; y++) {
        for (let x = 1; x < tempCanvas.width - 1; x++) {
          const idx = (y * tempCanvas.width + x) * 4;
          const alpha = data[idx + 3];

          if (alpha > 128) {
            // Check if this is an edge pixel
            const isEdge =
              data[((y - 1) * tempCanvas.width + x) * 4 + 3] < 128 ||
              data[((y + 1) * tempCanvas.width + x) * 4 + 3] < 128 ||
              data[(y * tempCanvas.width + (x - 1)) * 4 + 3] < 128 ||
              data[(y * tempCanvas.width + (x + 1)) * 4 + 3] < 128;

            if (isEdge) {
              ctx.fillStyle = "#16a34a";
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    };

    image.addEventListener("load", checkLoaded);
    image.addEventListener("error", handleError);
    mask.addEventListener("load", checkLoaded);
    mask.addEventListener("error", handleError);

    image.src = imageUrl;
    mask.src = maskData;

    return () => {
      image.removeEventListener("load", checkLoaded);
      image.removeEventListener("error", handleError);
      mask.removeEventListener("load", checkLoaded);
      mask.removeEventListener("error", handleError);
    };
  }, [imageUrl, maskData, opacity]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className={cn(
          "w-full h-auto rounded-lg border",
          isLoading && "opacity-0",
        )}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading mask...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
