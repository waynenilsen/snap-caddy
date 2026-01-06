'use client';

import React, { useState } from 'react';
import { ClickToSegment, SegmentPoint } from './ClickToSegment';
import { MaskOverlay } from './MaskOverlay';
import { SegmentationControls } from './SegmentationControls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface SelectStepProps {
  imageUrl: string;
  onMaskGenerated: (maskData: string) => void;
}

export function SelectStep({ imageUrl, onMaskGenerated }: SelectStepProps) {
  const [points, setPoints] = useState<SegmentPoint[]>([]);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [maskData, setMaskData] = useState<string | null>(null);

  const handlePointAdd = (point: SegmentPoint) => {
    setPoints((prev) => [...prev, point]);
  };

  const handlePointRemove = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setPoints([]);
    setMaskData(null);
  };

  const handleUndo = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleSegment = async () => {
    if (points.length === 0) return;

    setIsSegmenting(true);

    try {
      // TODO: This will be replaced with actual SAM API call
      // For now, simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Placeholder: Generate a simple mock mask
      // In production, this will call the SAM API with points
      const mockMaskData = generateMockMask();
      setMaskData(mockMaskData);
      onMaskGenerated(mockMaskData);
    } catch (error) {
      console.error('Segmentation failed:', error);
      // TODO: Add error handling UI
    } finally {
      setIsSegmenting(false);
    }
  };

  // Temporary function to generate a mock mask for testing
  // This will be removed when SAM integration is complete
  const generateMockMask = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Create a simple circular mask around the first point
      ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
      if (points.length > 0) {
        const firstPoint = points[0];
        // Scale point coordinates if needed
        const x = (firstPoint.x / 1024) * 512;
        const y = (firstPoint.y / 1024) * 512;
        ctx.beginPath();
        ctx.arc(x, y, 100, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    return canvas.toDataURL('image/png');
  };

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
