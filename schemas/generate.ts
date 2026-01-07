/**
 * Zod schemas for generate API
 *
 * These schemas validate API requests and define the contract between
 * frontend and backend. The GridfinityConfig type here is the API format,
 * which differs from the backend GridfinityBinConfig used by OpenSCAD.
 *
 * Conversion happens in app/api/generate/route.ts via apiConfigToBinConfig()
 */

import { z } from "zod";

/**
 * Gridfinity configuration schema - API request format
 *
 * This schema validates the configuration sent from the frontend.
 * It uses boolean flags (magnetHoles, screwHoles, stackingLip) and
 * individual padding values for easier frontend manipulation.
 *
 * The backend converts this to GridfinityBinConfig which uses:
 * - baseType enum instead of magnet/screw booleans
 * - lipStyle enum instead of stackingLip boolean
 * - single cutoutPadding instead of individual padding values
 */
export const GridfinityConfigSchema = z.object({
  // Grid dimensions
  gridUnitsX: z.number().int().min(1).max(10),
  gridUnitsY: z.number().int().min(1).max(10),

  // Bin parameters
  binHeight: z.number().min(7).max(100), // mm
  cutoutDepth: z.number().min(1).max(50), // mm
  wallThickness: z.number().min(0.5).max(5).default(1.2), // mm

  // Padding around cutout
  paddingTop: z.number().min(0).max(20).default(2), // mm
  paddingBottom: z.number().min(0).max(20).default(2),
  paddingLeft: z.number().min(0).max(20).default(2),
  paddingRight: z.number().min(0).max(20).default(2),

  // Base options
  magnetHoles: z.boolean().default(true),
  screwHoles: z.boolean().default(false),
  stackingLip: z.boolean().default(true),

  // Advanced
  cornerRadius: z.number().min(0).max(5).default(0.5), // mm
  baseThickness: z.number().min(2).max(10).default(5), // mm
});

/**
 * Generate request schema
 */
export const GenerateRequestSchema = z.object({
  svg: z.string().min(10), // SVG content
  config: GridfinityConfigSchema,
});

/**
 * Generation status enum
 */
export const GenerationStatusSchema = z.enum([
  "queued",
  "processing",
  "complete",
  "error",
]);

/**
 * Generate response schema
 */
export const GenerateResponseSchema = z.object({
  success: z.literal(true),
  generationId: z.string().uuid(), // UUID for download
  status: GenerationStatusSchema,
  estimatedTimeMs: z.number().positive().optional(),
  downloadUrl: z.string().url().optional(), // Available when complete
  previewUrl: z.string().url().optional(), // PNG preview of model
});

/**
 * Generate error response schema
 */
export const GenerateErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    "INVALID_INPUT",
    "INVALID_SVG",
    "OPENSCAD_ERROR",
    "RATE_LIMIT",
    "SERVER_ERROR",
  ]),
  details: z.unknown().optional(),
});

/**
 * Generation status response schema (for polling)
 */
export const GenerationStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: GenerationStatusSchema,
  progress: z.number().min(0).max(100), // 0-100
  downloadUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

// Infer types from schemas
export type GridfinityConfig = z.infer<typeof GridfinityConfigSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
export type GenerateErrorResponse = z.infer<typeof GenerateErrorResponseSchema>;
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;
export type GenerationStatusResponse = z.infer<
  typeof GenerationStatusResponseSchema
>;
