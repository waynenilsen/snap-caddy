"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Box, Loader2, AlertCircle, Rotate3d, Image } from "lucide-react";
import { api } from "@/lib/api/client";
import type { GridfinityConfig } from "@/types/gridfinity";
import { STLViewer } from "./STLViewer";

type ViewMode = "3d" | "static";

interface STLPreviewProps {
  // Option 1: Provide a URL to fetch an existing preview
  previewUrl?: string;

  // Option 2: Generate a new preview from SVG + config
  svg?: string;
  config?: GridfinityConfig;
  quality?: "low" | "medium" | "high";

  // Option 3: Generation ID for 3D viewer (used after generation completes)
  generationId?: string;
  generationStatus?: "idle" | "queued" | "processing" | "complete" | "error";
}

export function STLPreview({
  previewUrl,
  svg,
  config,
  quality = "low",
  generationId,
  generationStatus,
}: STLPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("static");
  const [stlViewerError, setStlViewerError] = useState<Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine if 3D view is available (only after generation completes)
  const is3DAvailable = generationStatus === "complete" && !!generationId;

  // Build STL URL from generation ID
  const stlUrl = generationId ? `/api/download/${generationId}` : null;

  // Auto-switch to 3D view when generation completes
  useEffect(() => {
    if (is3DAvailable && viewMode === "static") {
      setViewMode("3d");
    }
  }, [is3DAvailable]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [imageUrl]);

  // Generate or fetch static preview
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state
    setError(null);

    // If we have a previewUrl, fetch it directly
    if (previewUrl) {
      fetchPreviewFromUrl(previewUrl);
      return;
    }

    // If we have svg + config, generate a preview with debouncing
    if (svg && config) {
      setLoading(true);

      // Debounce preview generation (500ms delay)
      timeoutRef.current = setTimeout(() => {
        generatePreview(svg, config, quality);
      }, 500);

      return;
    }

    // No preview data provided
    setLoading(false);
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
  }, [previewUrl, svg, config, quality]);

  const fetchPreviewFromUrl = async (url: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch preview: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Revoke old URL if exists
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }

      const newImageUrl = URL.createObjectURL(blob);
      setImageUrl(newImageUrl);
      setLoading(false);
    } catch (err) {
      console.error("Preview fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load preview");
      setLoading(false);
    }
  };

  const generatePreview = async (
    svgContent: string,
    gridfinityConfig: GridfinityConfig,
    previewQuality: "low" | "medium" | "high",
  ) => {
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const blob = await api.getPreview({
        svg: svgContent,
        config: gridfinityConfig,
        quality: previewQuality,
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Revoke old URL if exists
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }

      const newImageUrl = URL.createObjectURL(blob);
      setImageUrl(newImageUrl);
      setLoading(false);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("Preview generation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate preview",
      );
      setLoading(false);
    }
  };

  const handleSTLViewerError = (err: Error) => {
    setStlViewerError(err);
    // Fall back to static view on error
    setViewMode("static");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>3D Preview</CardTitle>
            <CardDescription>
              {viewMode === "3d"
                ? "Interactive 3D view - drag to rotate, scroll to zoom"
                : "Preview of your Gridfinity bin design"}
            </CardDescription>
          </div>

          {/* View mode toggle */}
          <div className="flex gap-1">
            <Button
              variant={viewMode === "3d" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("3d")}
              disabled={!is3DAvailable}
              title={
                is3DAvailable
                  ? "Switch to interactive 3D view"
                  : "3D view available after generation completes"
              }
              aria-label="3D view"
            >
              <Rotate3d className="w-4 h-4 mr-1.5" />
              3D
            </Button>
            <Button
              variant={viewMode === "static" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("static")}
              aria-label="Static image view"
            >
              <Image className="w-4 h-4 mr-1.5" />
              Static
            </Button>
          </div>
        </div>

        {/* 3D view availability hint */}
        {!is3DAvailable && generationStatus !== "complete" && (
          <p className="text-xs text-muted-foreground mt-2">
            Interactive 3D preview will be available after generation completes
          </p>
        )}
      </CardHeader>

      <CardContent>
        {/* 3D Viewer */}
        {viewMode === "3d" && is3DAvailable && stlUrl && (
          <STLViewer
            stlUrl={stlUrl}
            onError={handleSTLViewerError}
            showGrid={true}
            showAxes={false}
            autoRotate={false}
            quality="medium"
          />
        )}

        {/* Static Preview */}
        {viewMode === "static" && (
          <div className="aspect-square bg-muted rounded-lg relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" />
                  <p className="text-sm">Generating preview...</p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="text-center text-destructive">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-sm font-medium mb-2">Preview Error</p>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            )}

            {!loading && !error && !imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Box className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-sm">No preview available</p>
                  <p className="text-xs mt-2">
                    Configure your bin to see a preview
                  </p>
                </div>
              </div>
            )}

            {imageUrl && !loading && (
              <img
                src={imageUrl}
                alt="3D Preview"
                className="w-full h-full object-contain"
              />
            )}
          </div>
        )}

        {/* 3D viewer fallback message */}
        {viewMode === "3d" && !is3DAvailable && (
          <div className="aspect-square bg-muted rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Rotate3d className="w-16 h-16 mx-auto mb-4" />
                <p className="text-sm font-medium">3D View Not Available</p>
                <p className="text-xs mt-2">
                  Complete the generation to enable interactive 3D preview
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STL viewer error fallback message */}
        {stlViewerError && viewMode === "static" && (
          <p className="text-xs text-muted-foreground mt-2">
            3D view unavailable: {stlViewerError.message}. Showing static
            preview instead.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
