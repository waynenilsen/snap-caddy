"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Box, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api/client";
import type { GridfinityConfig } from "@/types/gridfinity";

interface STLPreviewProps {
  // Option 1: Provide a URL to fetch an existing preview
  previewUrl?: string;

  // Option 2: Generate a new preview from SVG + config
  svg?: string;
  config?: GridfinityConfig;
  quality?: 'low' | 'medium' | 'high';
}

export function STLPreview({ previewUrl, svg, config, quality = 'low' }: STLPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cleanup function to revoke object URLs
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
      console.error('Preview fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preview');
      setLoading(false);
    }
  };

  const generatePreview = async (svgContent: string, gridfinityConfig: GridfinityConfig, previewQuality: 'low' | 'medium' | 'high') => {
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
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('Preview generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Preview</CardTitle>
        <CardDescription>
          Preview of your Gridfinity bin design
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                <p className="text-xs mt-2">Configure your bin to see a preview</p>
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
      </CardContent>
    </Card>
  );
}
