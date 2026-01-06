/**
 * Custom hook for polling generation status
 * Automatically polls the status endpoint and cleans up on unmount
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { GenerationStatusResponse, GenerationStatus } from '@/types/api';

export interface UseGenerationPollingResult {
  status: GenerationStatus | null;
  progress: number;
  downloadUrl?: string;
  previewUrl?: string;
  error?: string;
  isPolling: boolean;
}

export interface UseGenerationPollingOptions {
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds
  onComplete?: (data: GenerationStatusResponse) => void;
  onError?: (error: string) => void;
}

/**
 * Hook to poll generation status for async STL generation
 * @param generationId - The ID of the generation to poll
 * @param options - Polling options
 * @returns Generation status data and polling state
 */
export function useGenerationPolling(
  generationId: string | null | undefined,
  options: UseGenerationPollingOptions = {}
): UseGenerationPollingResult {
  const {
    enabled = true,
    pollingInterval = 2000, // 2 seconds default
    onComplete,
    onError,
  } = options;

  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Use ref to track the interval ID for cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use ref to track if we've already called completion callback
  const completedRef = useRef<boolean>(false);

  useEffect(() => {
    // Reset state when generationId changes
    if (generationId) {
      setStatus(null);
      setProgress(0);
      setDownloadUrl(undefined);
      setPreviewUrl(undefined);
      setError(undefined);
      setIsPolling(false);
      completedRef.current = false;
    }
  }, [generationId]);

  useEffect(() => {
    // Don't poll if not enabled, no generationId, or already completed/errored
    if (!enabled || !generationId) {
      return;
    }

    // Don't poll if status is already complete or error
    if (status === 'complete' || status === 'error') {
      return;
    }

    const pollStatus = async () => {
      try {
        setIsPolling(true);
        const response = await api.getGenerationStatus(generationId);

        setStatus(response.status);
        setProgress(response.progress);
        setDownloadUrl(response.downloadUrl);
        setPreviewUrl(response.previewUrl);

        // Handle completion
        if (response.status === 'complete') {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // Only call onComplete once
          if (!completedRef.current && onComplete) {
            completedRef.current = true;
            onComplete(response);
          }
        }

        // Handle error
        if (response.status === 'error') {
          setIsPolling(false);
          const errorMsg = response.error || 'Generation failed';
          setError(errorMsg);

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // Only call onError once
          if (!completedRef.current && onError) {
            completedRef.current = true;
            onError(errorMsg);
          }
        }
      } catch (err) {
        console.error('Failed to poll generation status:', err);

        // Handle network errors gracefully - don't stop polling immediately
        // Just log the error and try again on next interval
        // This makes the polling more resilient to temporary network issues

        // Only stop polling and set error state if it's a persistent error (404)
        if (err instanceof Error && err.message.includes('404')) {
          setIsPolling(false);
          const errorMsg = 'Generation not found';
          setError(errorMsg);
          setStatus('error');

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          if (!completedRef.current && onError) {
            completedRef.current = true;
            onError(errorMsg);
          }
        }
        // For other errors, just log and continue polling
      }
    };

    // Start polling immediately
    pollStatus();

    // Set up interval for subsequent polls
    intervalRef.current = setInterval(pollStatus, pollingInterval);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [generationId, enabled, pollingInterval, status, onComplete, onError]);

  return {
    status,
    progress,
    downloadUrl,
    previewUrl,
    error,
    isPolling,
  };
}
