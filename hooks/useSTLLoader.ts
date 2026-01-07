"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

interface UseSTLLoaderOptions {
  center?: boolean;
  computeNormals?: boolean;
}

interface UseSTLLoaderResult {
  geometry: THREE.BufferGeometry | null;
  loading: boolean;
  error: Error | null;
  progress: number;
  retry: () => void;
}

/**
 * Custom hook for loading STL files asynchronously
 * Provides loading state, progress, error handling, and retry functionality
 */
export function useSTLLoader(
  url: string | null,
  options: UseSTLLoaderOptions = {},
): UseSTLLoaderResult {
  const { center = true, computeNormals = true } = options;

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [_retryCount, setRetryCount] = useState(0);

  const loaderRef = useRef<STLLoader | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadSTL = useCallback(async () => {
    if (!url) {
      setGeometry(null);
      setLoading(false);
      setError(null);
      setProgress(0);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Fetch the STL file with abort signal
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch STL: ${response.status} ${response.statusText}`,
        );
      }

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      // Read the response body as array buffer with progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          setProgress((loaded / total) * 100);
        }
      }

      // Combine chunks into a single array buffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // Parse the STL data
      if (!loaderRef.current) {
        loaderRef.current = new STLLoader();
      }

      const stlGeometry = loaderRef.current.parse(combined.buffer);

      // Center the geometry if requested
      if (center) {
        stlGeometry.center();
      }

      // Compute vertex normals for smooth shading if requested
      if (computeNormals) {
        stlGeometry.computeVertexNormals();
      }

      // Compute bounding box for proper framing
      stlGeometry.computeBoundingBox();

      setGeometry(stlGeometry);
      setProgress(100);
      setLoading(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("STL loading error:", err);
      setError(err instanceof Error ? err : new Error("Failed to load STL"));
      setLoading(false);
    }
  }, [url, center, computeNormals]);

  // Load STL when URL changes or on retry
  useEffect(() => {
    loadSTL();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadSTL]);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      if (geometry) {
        geometry.dispose();
      }
    };
  }, [geometry]);

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  return { geometry, loading, error, progress, retry };
}
