/**
 * Central export for all Zod schemas
 */

export type {
  Calibration,
  CalibrationPoint,
  CalibrationRequest,
  Scale,
} from "./calibration";
// Calibration schemas
export {
  CalibrationPointSchema,
  CalibrationRequestSchema,
  CalibrationSchema,
  ScaleSchema,
} from "./calibration";
export type {
  GenerateErrorResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatus,
  GenerationStatusResponse,
  GridfinityConfig,
} from "./generate";
// Generate schemas
export {
  GenerateErrorResponseSchema,
  GenerateRequestSchema,
  GenerateResponseSchema,
  GenerationStatusResponseSchema,
  GenerationStatusSchema,
  GridfinityConfigSchema,
} from "./generate";

// Helper validation functions
import type { z } from "zod";

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
