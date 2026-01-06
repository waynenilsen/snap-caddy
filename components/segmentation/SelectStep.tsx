'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ClickToSegment, SegmentPoint } from './ClickToSegment';
import { MaskOverlay } from './MaskOverlay';
import { SegmentationControls } from './SegmentationControls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, AlertCircle, X, RefreshCw } from 'lucide-react';
import { api, APIClientError } from '@/lib/api/client';
import type { ClickPoint } from '@/types/segmentation';

interface SelectStepProps {
  imageUrl: string;
  onMaskGenerated: (maskData: string) => void;
}

export function SelectStep({ imageUrl, onMaskGenerated }: SelectStepProps) {
  const [points, setPoints] = useState<SegmentPoint[]>([]);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [maskData, setMaskData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const handlePointAdd = (point: SegmentPoint) => {
    setPoints((prev) => [...prev, point]);
  };

  const handlePointRemove = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setPoints([]);
    setMaskData(null);
    setError(null);
  };

  const handleUndo = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleSegment = async () => {
    if (points.length === 0) return;
    if (!imageDimensions) {
      setError('Image dimensions not loaded. Please try again.');
      return;
    }

    setIsSegmenting(true);
    setError(null);

    try {
      // Convert SegmentPoint[] to ClickPoint[] (remove the id field)
      const clickPoints: ClickPoint[] = points.map((point) => ({
        x: point.x,
        y: point.y,
        label: point.label,
      }));

      // Call the segment API
      const response = await api.segment({
        image: imageUrl,
        points: clickPoints,
        imageWidth: imageDimensions.width,
        imageHeight: imageDimensions.height,
        returnMultipleMasks: false,
      });

      // Extract the first (best) mask from the response
      if (response.masks && response.masks.length > 0) {
        const bestMask = response.masks[0];
        const maskDataUrl = bestMask.mask;

        setMaskData(maskDataUrl);
        onMaskGenerated(maskDataUrl);
      } else {
        throw new Error('No masks returned from segmentation');
      }
    } catch (error) {
      console.error('Segmentation failed:', error);

      // Transform technical errors into user-friendly messages
      let errorMessage = "Unable to identify the object. Please try clicking on a different part of the image.";

      if (error instanceof APIClientError) {
        if (error.status === 429) {
          errorMessage = "Too many requests. Please wait a moment before trying again.";
        } else if (error.status === 413) {
          errorMessage = "Image is too large. Please use a smaller image.";
        } else if (error.status === 400) {
          errorMessage = "Invalid request. Please make sure you've clicked on the object and try again.";
        } else if (error.status >= 500) {
          errorMessage = "Server error. Please try again in a moment.";
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message) {
          errorMessage = `Segmentation failed: ${error.message}`;
        }
      } else if (error instanceof Error) {
        if (error.message.includes("No masks")) {
          errorMessage = "Unable to detect the object. Please try adding more points or clicking on different areas.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again.";
        }
      }

      setError(errorMessage);
      // Note: We intentionally don't clear points here so users can retry with the same points
    } finally {
      setIsSegmenting(false);
    }
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
    handleSegment();
  };

  // Load image to get dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      setError('Failed to load image');
    };

    img.src = imageUrl;
    imageRef.current = img;
  }, [imageUrl]);

  return (
    <div className="space-y-6">
      {/* Info alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Click on the object you want to extract. Add include points (left-click) on the object
          and exclude points (right-click) on the background to refine the selection.
        </AlertDescription>
      </Alert>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-start justify-between gap-4">
            <span className="flex-1">{error}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                disabled={isSegmenting || points.length === 0}
                className="h-8 px-3 hover:bg-destructive/20"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissError}
                className="h-8 w-8 p-0 hover:bg-destructive/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <SegmentationControls
        pointCount={points.length}
        isLoading={isSegmenting}
        onClear={handleClear}
        onUndo={handleUndo}
        onSegment={handleSegment}
      />

      {/* Main canvas with overlay */}
      <div className="relative">
        {maskData ? (
          <MaskOverlay imageUrl={imageUrl} maskData={maskData} opacity={0.5} />
        ) : (
          <ClickToSegment
            imageUrl={imageUrl}
            points={points}
            onPointAdd={handlePointAdd}
            onPointRemove={handlePointRemove}
          />
        )}
      </div>

      {/* Show message when mask is generated */}
      {maskData && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Segmentation complete! Click "Clear All" to start over or adjust points to refine the mask.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
