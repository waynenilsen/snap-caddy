"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Undo, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col gap-3 p-3 sm:p-4 border rounded-lg bg-muted/50">
      {/* Primary action row - segment button full width on mobile */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Button
          variant="default"
          size="default"
          onClick={onSegment}
          disabled={pointCount === 0 || isLoading}
          aria-label="Generate segmentation"
          className={cn(
            "w-full sm:w-auto min-h-[48px] sm:min-h-[40px]",
            "active:scale-[0.98] transition-transform",
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Segmenting...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Segment Object
            </>
          )}
        </Button>

        {/* Secondary actions - side by side */}
        <div className="flex gap-2 sm:ml-auto">
          <Button
            variant="outline"
            size="default"
            onClick={onUndo}
            disabled={pointCount === 0 || isLoading}
            aria-label="Undo last point"
            className={cn(
              "flex-1 sm:flex-none min-h-[44px] sm:min-h-[40px]",
              "active:scale-[0.98] transition-transform",
            )}
          >
            <Undo className="w-4 h-4 mr-2" />
            Undo
          </Button>

          <Button
            variant="outline"
            size="default"
            onClick={onClear}
            disabled={pointCount === 0 || isLoading}
            aria-label="Clear all points"
            className={cn(
              "flex-1 sm:flex-none min-h-[44px] sm:min-h-[40px]",
              "active:scale-[0.98] transition-transform",
            )}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between text-sm">
        <Badge variant="secondary" className="tabular-nums">
          {pointCount} {pointCount === 1 ? "point" : "points"}
        </Badge>

        {isLoading && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Processing...</span>
          </span>
        )}
      </div>
    </div>
  );
}
