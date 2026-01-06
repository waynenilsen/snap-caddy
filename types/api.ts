/**
 * API request and response types
 */

import type { ClickPoint, MaskOption } from './segmentation';
import type { GridfinityConfig } from './gridfinity';
import type { BoundingBox } from './image';

// ============================================================================
// Segment API
// ============================================================================

export interface SegmentRequest {
  image: string; // Base64 encoded image (data URI or raw)
  points: ClickPoint[]; // Click points for segmentation
  imageWidth: number;
  imageHeight: number;
  returnMultipleMasks?: boolean; // Return multiple mask options
  maskFormat?: 'base64png' | 'rle' | 'binary'; // Mask encoding format
}

export interface SegmentResponse {
  success: boolean;
  masks: MaskOption[]; // Primary mask first, alternatives if requested
  imageWidth: number;
  imageHeight: number;
  processingTimeMs: number;
}

export interface SegmentErrorResponse {
  success: false;
  error: string;
  code: 'INVALID_INPUT' | 'IMAGE_TOO_LARGE' | 'SAM_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR';
  details?: unknown;
}

// ============================================================================
// Generate API
// ============================================================================

export interface GenerateRequest {
  svg: string; // SVG content
  config: GridfinityConfig;
  async?: boolean; // Request async generation with webhook
  webhookUrl?: string; // Optional webhook URL for completion notification
}

export type GenerationStatus = 'queued' | 'processing' | 'complete' | 'error';

export interface GenerateResponse {
  success: boolean;
  generationId: string; // UUID for download
  status: GenerationStatus;
  estimatedTimeMs?: number;
  downloadUrl?: string; // Available when complete
  previewUrl?: string; // PNG preview of model
  queuePosition?: number; // If queued
}

export interface GenerateErrorResponse {
  success: false;
  error: string;
  code: 'INVALID_INPUT' | 'INVALID_SVG' | 'OPENSCAD_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR';
  details?: unknown;
}

export interface GenerationStatusResponse {
  id: string;
  status: GenerationStatus;
  progress: number; // 0-100
  downloadUrl?: string;
  previewUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// ============================================================================
// Download API
// ============================================================================

export interface DownloadResponse {
  blob: Blob;
  filename: string;
  size: number;
}

export interface DownloadErrorResponse {
  error: string;
  code: 'NOT_FOUND' | 'EXPIRED' | 'INVALID_ID' | 'SERVER_ERROR';
}

// ============================================================================
// Preview API
// ============================================================================

export interface PreviewRequest {
  svg: string;
  config: GridfinityConfig;
  quality?: 'low' | 'medium' | 'high';
}

export interface PreviewResponse {
  image: Blob; // PNG image
}

// ============================================================================
// Common Error Types
// ============================================================================

export type APIErrorCode =
  | 'INVALID_INPUT'
  | 'IMAGE_TOO_LARGE'
  | 'INVALID_SVG'
  | 'SAM_ERROR'
  | 'OPENSCAD_ERROR'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'INVALID_ID';

export interface APIError {
  success: false;
  error: string;
  code: APIErrorCode;
  details?: unknown;
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

export interface RateLimitError extends APIError {
  code: 'RATE_LIMIT';
  retryAfter: number; // Seconds until retry
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface SVGValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
}

// ============================================================================
// Client API Types
// ============================================================================

export class APIClientError extends Error {
  constructor(
    message: string,
    public code: APIErrorCode,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIClientError';
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSegmentResponse(response: unknown): response is SegmentResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true &&
    'masks' in response &&
    Array.isArray((response as SegmentResponse).masks)
  );
}

export function isGenerateResponse(response: unknown): response is GenerateResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true &&
    'generationId' in response
  );
}

export function isAPIError(response: unknown): response is APIError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response &&
    'code' in response
  );
}
