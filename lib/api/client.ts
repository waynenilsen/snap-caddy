/**
 * Client-side API wrapper for Snap Caddy
 * Provides type-safe methods for interacting with the backend API
 */

import type {
  SegmentRequest,
  SegmentResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatusResponse,
  PreviewRequest,
} from '@/types/api';
import type { GridfinityConfig, BinConfigState } from '@/types/gridfinity';

/**
 * Convert frontend BinConfigState to API GridfinityConfig
 * Removes frontend-only fields (tolerance, error) for API requests
 */
function binConfigToApiConfig(config: BinConfigState): GridfinityConfig {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tolerance, error, ...apiConfig } = config;
  return apiConfig;
}

/**
 * Custom error class for API errors
 */
export class APIClientError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'APIClientError';
    this.code = code;
    this.statusCode = statusCode;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIClientError);
    }
  }
}

/**
 * Main API client class for Snap Caddy
 */
export class SnapCaddyAPI {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Helper method to make API requests with proper error handling
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorCode = 'UNKNOWN_ERROR';

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorCode = errorData.code || errorCode;
      } catch {
        // If JSON parsing fails, use default error message
      }

      throw new APIClientError(errorMessage, errorCode, response.status);
    }

    return response.json();
  }

  /**
   * Helper method to fetch binary data (blobs)
   */
  private async fetchBlob(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Blob> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorCode = 'UNKNOWN_ERROR';

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorCode = errorData.code || errorCode;
      } catch {
        // If JSON parsing fails, use default error message
      }

      throw new APIClientError(errorMessage, errorCode, response.status);
    }

    return response.blob();
  }

  /**
   * Segment an image using SAM (Segment Anything Model)
   * @param params - Segmentation parameters
   * @returns Segmentation response with masks
   */
  async segment(params: {
    image: string;
    points: Array<{ x: number; y: number; label: 0 | 1 }>;
    imageWidth: number;
    imageHeight: number;
    returnMultipleMasks?: boolean;
  }): Promise<SegmentResponse> {
    const request: Partial<SegmentRequest> = {
      image: params.image,
      points: params.points,
      imageWidth: params.imageWidth,
      imageHeight: params.imageHeight,
    };

    if (params.returnMultipleMasks !== undefined) {
      request.returnMultipleMasks = params.returnMultipleMasks;
    }

    return this.fetch<SegmentResponse>('/api/segment', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Generate a Gridfinity bin from SVG
   * @param params - Generation parameters
   * @returns Generation response with ID and status
   */
  async generate(params: {
    svg: string;
    config: GridfinityConfig | BinConfigState;
    async?: boolean;
  }): Promise<GenerateResponse> {
    // Convert BinConfigState to API format if needed
    const apiConfig = 'tolerance' in params.config
      ? binConfigToApiConfig(params.config as BinConfigState)
      : params.config;

    const request: Partial<GenerateRequest> = {
      svg: params.svg,
      config: apiConfig,
    };

    if (params.async !== undefined) {
      request.async = params.async;
    }

    return this.fetch<GenerateResponse>('/api/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get the status of a generation job
   * @param id - Generation ID
   * @returns Generation status
   */
  async getGenerationStatus(id: string): Promise<GenerationStatusResponse> {
    return this.fetch<GenerationStatusResponse>(`/api/generate?id=${id}`);
  }

  /**
   * Download the STL file for a completed generation
   * @param id - Generation ID
   * @returns STL file as a Blob
   */
  async downloadSTL(id: string): Promise<Blob> {
    return this.fetchBlob(`/api/download/${id}`);
  }

  /**
   * Get a preview render of the bin
   * @param params - Preview parameters
   * @returns Preview image as a Blob
   */
  async getPreview(params: {
    svg: string;
    config: GridfinityConfig | BinConfigState;
    quality?: 'low' | 'medium' | 'high';
  }): Promise<Blob> {
    // Convert BinConfigState to API format if needed
    const apiConfig = 'tolerance' in params.config
      ? binConfigToApiConfig(params.config as BinConfigState)
      : params.config;

    const request: PreviewRequest = {
      svg: params.svg,
      config: apiConfig,
      quality: params.quality,
    };

    return this.fetchBlob('/api/preview', {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate a bin and automatically download it when ready
   * This is a convenience method that combines generate + polling + download
   * @param params - Generation parameters
   * @returns STL file as a Blob
   */
  async generateAndDownload(params: {
    svg: string;
    config: GridfinityConfig | BinConfigState;
    onProgress?: (status: GenerationStatusResponse) => void;
    pollingInterval?: number;
  }): Promise<Blob> {
    // Start generation
    const generateResponse = await this.generate({
      svg: params.svg,
      config: params.config,
      async: true,
    });

    const generationId = generateResponse.generationId;
    const pollingInterval = params.pollingInterval || 1000; // Default 1 second

    // Poll for completion
    while (true) {
      const status = await this.getGenerationStatus(generationId);

      // Call progress callback if provided
      if (params.onProgress) {
        params.onProgress(status);
      }

      if (status.status === 'complete') {
        // Download the file
        return this.downloadSTL(generationId);
      }

      if (status.status === 'error') {
        throw new APIClientError(
          status.error || 'Generation failed',
          'GENERATION_ERROR',
          500
        );
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }
  }

  /**
   * Create a download link (object URL) from a blob
   * @param blob - The blob to create a URL for
   * @param filename - Optional filename (not used for object URL)
   * @returns Object URL string
   */
  createDownloadLink(blob: Blob, filename?: string): string {
    return URL.createObjectURL(blob);
  }

  /**
   * Programmatically trigger a download of a blob
   * @param blob - The blob to download
   * @param filename - The filename to use for the download
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = this.createDownloadLink(blob);

    // Create a temporary anchor element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);

    // Revoke the object URL after a short delay to ensure download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }
}

/**
 * Singleton API client instance for use throughout the application
 */
export const api = new SnapCaddyAPI();
