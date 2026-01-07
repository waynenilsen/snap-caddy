/**
 * Zod schemas for segment API
 *
 * These schemas validate segmentation API requests/responses.
 * Types inferred from these schemas are re-exported in types/segmentation.ts
 * to maintain a single source of truth for the API contract.
 */

import { z } from "zod";

/**
 * Point schema - represents a click point for segmentation
 * Note: This is what types/segmentation.ts calls "ClickPoint"
 */
export const PointSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  label: z.union([z.literal(0), z.literal(1)]), // 0=background, 1=foreground
});

/**
 * Segment request schema
 */
export const SegmentRequestSchema = z.object({
  image: z.string().min(1), // Base64 encoded image (data URI or raw)
  points: z.array(PointSchema).min(1).max(20), // At least 1 point, max 20
  imageWidth: z.number().int().min(1).max(8192),
  imageHeight: z.number().int().min(1).max(8192),
  // Optional: return multiple mask options
  returnMultipleMasks: z.boolean().optional().default(false),
  // Optional: mask encoding format
  maskFormat: z
    .enum(["base64png", "rle", "binary"])
    .optional()
    .default("base64png"),
});

/**
 * Bounding box schema
 */
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

/**
 * Mask option schema
 */
export const MaskOptionSchema = z.object({
  mask: z.string(), // Base64 PNG or RLE encoded
  confidence: z.number().min(0).max(1), // 0-1 score
  boundingBox: BoundingBoxSchema,
  area: z.number().int().positive(), // Pixel count
});

/**
 * Segment response schema
 */
export const SegmentResponseSchema = z.object({
  success: z.literal(true),
  masks: z.array(MaskOptionSchema).min(1), // Primary mask first, alternatives if requested
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
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
export type Point = z.infer<typeof PointSchema>;
export type SegmentRequest = z.infer<typeof SegmentRequestSchema>;
export type SegmentResponse = z.infer<typeof SegmentResponseSchema>;
export type SegmentErrorResponse = z.infer<typeof SegmentErrorResponseSchema>;
export type MaskOption = z.infer<typeof MaskOptionSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
