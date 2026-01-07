/**
 * Zod schemas for SAM 2 segment API
 *
 * SAM 2 uses automatic mask generation - no point prompts needed.
 * It returns all detected masks as URLs which the client fetches and displays.
 * Users toggle masks on/off to select what to include.
 */

import { z } from "zod";

/**
 * Segment request schema for SAM 2
 * No points needed - SAM 2 auto-generates all masks
 */
export const SegmentRequestSchema = z.object({
  /** Base64 encoded image (data URI or raw) */
  image: z.string().min(1),
  /** Image width in pixels */
  imageWidth: z.number().int().min(1).max(8192),
  /** Image height in pixels */
  imageHeight: z.number().int().min(1).max(8192),
  /** Points per side for mask generation (default: 32) */
  pointsPerSide: z.number().int().min(1).max(64).optional().default(32),
  /** Predicted IOU threshold (default: 0.88) */
  predIouThresh: z.number().min(0).max(1).optional().default(0.88),
  /** Stability score threshold (default: 0.95) */
  stabilityScoreThresh: z.number().min(0).max(1).optional().default(0.95),
  /** Use M2M refinement (default: true) */
  useM2M: z.boolean().optional().default(true),
});

/**
 * Segment response schema for SAM 2
 * Returns URLs to masks (not the mask data itself)
 */
export const SegmentResponseSchema = z.object({
  success: z.literal(true),
  /** URL to combined mask showing all segments */
  combinedMaskUrl: z.string().url(),
  /** URLs to individual mask images */
  individualMaskUrls: z.array(z.string().url()).min(1),
  /** Number of masks detected */
  maskCount: z.number().int().positive(),
  /** Image dimensions */
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  /** Processing time in milliseconds */
  processingTimeMs: z.number().nonnegative(),
});

/**
 * Segment error response schema
 */
export const SegmentErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    "INVALID_INPUT",
    "IMAGE_TOO_LARGE",
    "SAM_ERROR",
    "RATE_LIMIT",
    "SERVER_ERROR",
  ]),
  details: z.unknown().optional(),
});

// Infer types from schemas
export type SegmentRequest = z.infer<typeof SegmentRequestSchema>;
export type SegmentResponse = z.infer<typeof SegmentResponseSchema>;
export type SegmentErrorResponse = z.infer<typeof SegmentErrorResponseSchema>;
