"use client";

import {
  AlertCircle,
  Check,
  CheckSquare,
  Info,
  RefreshCw,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { APIClientError, api } from "@/lib/api/client";
import type { MaskData } from "@/types/segmentation";
import { getMaskColor, MaskToggleOverlay } from "./MaskToggleOverlay";
import { SegmentList } from "./SegmentList";

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
 * 3. Displays image preview with mask overlays
 * 4. Shows segment list below for easy selection/deselection
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
    // Don't fetch if: no dimensions, already have masks, currently fetching, or had an error
    // Error state prevents infinite retry loop - user must manually click Retry
    if (!imageDimensions || masks.length > 0 || isSegmenting || error) return;

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
  }, [imageDimensions, masks.length, isSegmenting, imageUrl, error]);

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
  const isLoading = isSegmenting || masksLoading;

  return (
    <div className="space-y-4">
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

      {/* Preview with mask overlay - compact mode */}
      {imageDimensions && (
        <MaskToggleOverlay
          imageUrl={imageUrl}
          masks={masks}
          isLoading={isLoading}
          imageWidth={imageDimensions.width}
          imageHeight={imageDimensions.height}
          compact
        />
      )}

      {/* Instructions */}
      {hasLoaded && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Tap segments below to include or exclude them from your cutout.
            Selected segments are highlighted, unselected are dimmed.
          </AlertDescription>
        </Alert>
      )}

      {/* Segment selection list */}
      {imageDimensions && (
        <div className="space-y-3">
          {/* Quick actions bar */}
          {hasLoaded && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {masks.length} segment{masks.length !== 1 ? "s" : ""} detected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={selectedCount === masks.length}
                  className="gap-1.5"
                >
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Select All</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={selectedCount === 0}
                  className="gap-1.5"
                >
                  <Square className="h-4 w-4" />
                  <span className="hidden sm:inline">Deselect All</span>
                </Button>
              </div>
            </div>
          )}

          {/* Segment grid */}
          <SegmentList
            masks={masks}
            onMaskToggle={handleMaskToggle}
            imageWidth={imageDimensions.width}
            imageHeight={imageDimensions.height}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Confirm button - sticky on mobile */}
      {hasLoaded && (
        <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 sm:static sm:bg-transparent sm:pt-2 sm:pb-0 sm:mx-0 sm:px-0">
          <Button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="w-full sm:w-auto gap-2"
            size="lg"
          >
            <Check className="h-5 w-5" />
            Confirm Selection ({selectedCount} selected)
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
