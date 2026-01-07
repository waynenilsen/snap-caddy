/**
 * Central export for all Zod schemas
 */

// Segment schemas
export {
  PointSchema,
  SegmentRequestSchema,
  SegmentResponseSchema,
  SegmentErrorResponseSchema,
  BoundingBoxSchema,
  MaskOptionSchema,
} from "./segment";

export type {
  Point,
  SegmentRequest,
  SegmentResponse,
  SegmentErrorResponse,
  MaskOption,
  BoundingBox,
} from "./segment";

// Generate schemas
export {
  GridfinityConfigSchema,
  GenerateRequestSchema,
  GenerateResponseSchema,
  GenerateErrorResponseSchema,
  GenerationStatusSchema,
  GenerationStatusResponseSchema,
} from "./generate";

export type {
  GridfinityConfig,
  GenerateRequest,
  GenerateResponse,
  GenerateErrorResponse,
  GenerationStatus,
  GenerationStatusResponse,
} from "./generate";

// Calibration schemas
export {
  CalibrationPointSchema,
  CalibrationSchema,
  ScaleSchema,
  CalibrationRequestSchema,
} from "./calibration";

export type {
  CalibrationPoint,
  Calibration,
  Scale,
  CalibrationRequest,
} from "./calibration";

// Helper validation functions
import { z } from "zod";

/**
 * Validate and parse with custom error handling
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorPrefix = "Validation error",
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");

    throw new Error(`${errorPrefix}: ${errors}`);
  }

  return result.data;
}

/**
 * Safe validation that returns null on error
 */
export function safeValidateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Get validation errors as array
 */
export function getValidationErrors<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): string[] {
  const result = schema.safeParse(data);

  if (result.success) {
    return [];
  }

  return result.error.issues.map(
    (err) => `${err.path.join(".")}: ${err.message}`,
  );
}
