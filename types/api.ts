/**
 * API request and response types
 * These types represent the API contract between frontend and backend.
 * Where possible, they reference schema-validated types for consistency.
 */

import type {
  GenerateErrorResponse as SchemaGenerateErrorResponse,
  GenerateRequest as SchemaGenerateRequest,
  GenerateResponse as SchemaGenerateResponse,
  GenerationStatus as SchemaGenerationStatus,
  GenerationStatusResponse as SchemaGenerationStatusResponse,
} from "@/schemas/generate";
import type {
  SegmentErrorResponse as SchemaSegmentErrorResponse,
  SegmentRequest as SchemaSegmentRequest,
  SegmentResponse as SchemaSegmentResponse,
} from "@/schemas/segment";
import type { GridfinityConfig } from "./gridfinity";

// ============================================================================
// Segment API
// ============================================================================

/**
 * SegmentRequest - uses schema-validated type
 */
export type SegmentRequest = SchemaSegmentRequest;

/**
 * SegmentResponse - uses schema-validated type
 */
export type SegmentResponse = SchemaSegmentResponse;

/**
 * SegmentErrorResponse - uses schema-validated type
 */
export type SegmentErrorResponse = SchemaSegmentErrorResponse;

// ============================================================================
// Generate API
// ============================================================================

/**
 * GenerateRequest - uses schema-validated type
 */
export type GenerateRequest = SchemaGenerateRequest;

/**
 * GenerationStatus - uses schema-validated type
 */
export type GenerationStatus = SchemaGenerationStatus;

/**
 * GenerateResponse - uses schema-validated type
 */
export type GenerateResponse = SchemaGenerateResponse;

/**
 * GenerateErrorResponse - uses schema-validated type
 */
export type GenerateErrorResponse = SchemaGenerateErrorResponse;

/**
 * GenerationStatusResponse - uses schema-validated type
 */
export type GenerationStatusResponse = SchemaGenerationStatusResponse;

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
  code: "NOT_FOUND" | "EXPIRED" | "INVALID_ID" | "SERVER_ERROR";
}

// ============================================================================
// Preview API
// ============================================================================

/**
 * PreviewRequest - request for generating a preview image
 */
export interface PreviewRequest {
  svg: string;
  config: GridfinityConfig;
  quality?: "low" | "medium" | "high";
}

export interface PreviewResponse {
  image: Blob; // PNG image
}

// ============================================================================
// Common Error Types
// ============================================================================

export type APIErrorCode =
  | "INVALID_INPUT"
  | "IMAGE_TOO_LARGE"
  | "INVALID_SVG"
  | "SAM_ERROR"
  | "OPENSCAD_ERROR"
  | "RATE_LIMIT"
  | "SERVER_ERROR"
  | "NOT_FOUND"
  | "EXPIRED"
  | "INVALID_ID";

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
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
}

export interface RateLimitError extends APIError {
  code: "RATE_LIMIT";
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
    public details?: unknown,
  ) {
    super(message);
    this.name = "APIClientError";
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSegmentResponse(
  response: unknown,
): response is SegmentResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    response.success === true &&
    "combinedMaskUrl" in response &&
    "individualMaskUrls" in response &&
    Array.isArray((response as SegmentResponse).individualMaskUrls)
  );
}

export function isGenerateResponse(
  response: unknown,
): response is GenerateResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    response.success === true &&
    "generationId" in response
  );
}

export function isAPIError(response: unknown): response is APIError {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    response.success === false &&
    "error" in response &&
    "code" in response
  );
}
