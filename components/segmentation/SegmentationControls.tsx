"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Trash2, Undo, Sparkles } from "lucide-react";

interface SegmentationControlsProps {
  pointCount: number;
  isLoading: boolean;
  onClear: () => void;
  onUndo: () => void;
  onSegment: () => void;
}

export function SegmentationControls({
  pointCount,
  isLoading,
  onClear,
  onUndo,
  onSegment,
}: SegmentationControlsProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={pointCount === 0 || isLoading}
          aria-label="Undo last point"
        >
          <Undo className="w-4 h-4 mr-2" />
          Undo
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={pointCount === 0 || isLoading}
          aria-label="Clear all points"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="default"
          size="sm"
          onClick={onSegment}
          disabled={pointCount === 0 || isLoading}
          aria-label="Generate segmentation"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Segmenting...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Segment
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Badge variant="secondary" className="tabular-nums">
          {pointCount} {pointCount === 1 ? "point" : "points"}
        </Badge>

        {isLoading && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </span>
        )}
      </div>
    </div>
  );
}
