"use client";

import { AlertCircle, Check, Info, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { APIClientError, api } from "@/lib/api/client";
import type { MaskData } from "@/types/segmentation";
import { getMaskColor, MaskToggleOverlay } from "./MaskToggleOverlay";

interface SelectStepProps {
  /** URL of the image to segment (base64 data URI) */
  imageUrl: string;
  /** Callback when user confirms mask selection */
  onMasksSelected: (selectedMasks: MaskData[]) => void;
}

/**
 * SelectStep - SAM 2 mask selection step
 *
 * Flow:
 * 1. When imageUrl is provided, automatically calls SAM 2 API
 * 2. Loads all individual masks from returned URLs
 * 3. Displays masks overlaid on image with different colors
 * 4. User taps/clicks to toggle masks on/off
 * 5. User confirms selection to proceed to next step
 */
export function SelectStep({ imageUrl, onMasksSelected }: SelectStepProps) {
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [masks, setMasks] = useState<MaskData[]>([]);
  const [masksLoading, setMasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Load image to get dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      setError("Failed to load image");
    };

    img.src = imageUrl;
  }, [imageUrl]);

  // Fetch masks from SAM 2 when image dimensions are available
  useEffect(() => {
    if (!imageDimensions || masks.length > 0 || isSegmenting) return;

    const fetchMasks = async () => {
      setIsSegmenting(true);
      setError(null);

      try {
        const response = await api.segment({
          image: imageUrl,
          imageWidth: imageDimensions.width,
          imageHeight: imageDimensions.height,
        });

        // Create mask data array from URLs
        const maskDataArray: MaskData[] = response.individualMaskUrls.map(
          (url, index) => ({
            index,
            url,
            imageData: null,
            selected: true, // Default: all masks selected
            color: getMaskColor(index),
          }),
        );

        setMasks(maskDataArray);

        // Load all mask images
        setMasksLoading(true);
        const loadPromises = maskDataArray.map(async (mask) => {
          try {
            const img = await loadImage(mask.url);
            const maskImageData = getImageData(
              img,
              imageDimensions.width,
              imageDimensions.height,
            );
            return { ...mask, imageData: maskImageData };
          } catch (err) {
            console.error(`Failed to load mask ${mask.index}:`, err);
            return mask;
          }
        });

        const loadedMasks = await Promise.all(loadPromises);
        setMasks(loadedMasks);
        setMasksLoading(false);
      } catch (err) {
        console.error("Segmentation failed:", err);
        setError(getErrorMessage(err));
      } finally {
        setIsSegmenting(false);
      }
    };

    fetchMasks();
  }, [imageDimensions, masks.length, isSegmenting, imageUrl]);

  /**
   * Toggle a mask's selection state
   */
  const handleMaskToggle = useCallback((index: number) => {
    setMasks((prev) =>
      prev.map((mask) =>
        mask.index === index ? { ...mask, selected: !mask.selected } : mask,
      ),
    );
  }, []);

  /**
   * Select all masks
   */
  const handleSelectAll = useCallback(() => {
    setMasks((prev) => prev.map((mask) => ({ ...mask, selected: true })));
  }, []);

  /**
   * Deselect all masks
   */
  const handleDeselectAll = useCallback(() => {
    setMasks((prev) => prev.map((mask) => ({ ...mask, selected: false })));
  }, []);

  /**
   * Retry fetching masks
   */
  const handleRetry = useCallback(() => {
    setMasks([]);
    setError(null);
  }, []);

  /**
   * Confirm selection and proceed
   */
  const handleConfirm = useCallback(() => {
    const selectedMasks = masks.filter((m) => m.selected);
    if (selectedMasks.length === 0) {
      setError("Please select at least one region");
      return;
    }
    onMasksSelected(selectedMasks);
  }, [masks, onMasksSelected]);

  const selectedCount = masks.filter((m) => m.selected).length;
  const hasLoaded = masks.length > 0 && masks.some((m) => m.imageData !== null);

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Tap on any region to include or exclude it from your cutout. Selected
          regions are shown in color, unselected regions are grayed out.
        </AlertDescription>
      </Alert>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main overlay */}
      {imageDimensions && (
        <MaskToggleOverlay
          imageUrl={imageUrl}
          masks={masks}
          onMaskToggle={handleMaskToggle}
          isLoading={isSegmenting || masksLoading}
          imageWidth={imageDimensions.width}
          imageHeight={imageDimensions.height}
        />
      )}

      {/* Controls */}
      {hasLoaded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={selectedCount === masks.length}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              disabled={selectedCount === 0}
            >
              Deselect All
            </Button>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Confirm Selection ({selectedCount})
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Load an image from URL
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Extract ImageData from an image
 */
function getImageData(
  img: HTMLImageElement,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof APIClientError) {
    if (error.statusCode === 429) {
      return "Too many requests. Please wait a moment before trying again.";
    }
    if (error.statusCode === 413) {
      return "Image is too large. Please use a smaller image.";
    }
    if (error.statusCode >= 500) {
      return "Server error. Please try again in a moment.";
    }
    return `Segmentation failed: ${error.message}`;
  }
  if (error instanceof Error) {
    if (error.message.includes("timeout")) {
      return "Request timed out. Please try again.";
    }
    if (error.message.includes("network") || error.message.includes("fetch")) {
      return "Network error. Please check your connection and try again.";
    }
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
}
