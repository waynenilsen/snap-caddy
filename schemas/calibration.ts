/**
 * Zod schemas for calibration
 */

import { z } from 'zod';

/**
 * Point schema (without label)
 */
export const CalibrationPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/**
 * Calibration schema
 */
export const CalibrationSchema = z.object({
  rulerPoints: z.tuple([CalibrationPointSchema, CalibrationPointSchema]).nullable(),
  knownDistanceMm: z.number().positive().max(1000),
  pixelsPerMm: z.number().positive().nullable(),
  isValid: z.boolean(),
  error: z.string().nullable(),
});

/**
 * Scale calculation schema
 */
export const ScaleSchema = z.object({
  pixelsPerMm: z.number().positive(),
  knownDistanceMm: z.number().positive(),
  pixelDistance: z.number().positive(),
  isValid: z.boolean(),
});

/**
 * Calibration request schema (for API if needed)
 */
export const CalibrationRequestSchema = z.object({
  point1: CalibrationPointSchema,
  point2: CalibrationPointSchema,
  knownDistanceMm: z.number().positive().max(1000),
});

// Infer types from schemas
export type CalibrationPoint = z.infer<typeof CalibrationPointSchema>;
export type Calibration = z.infer<typeof CalibrationSchema>;
export type Scale = z.infer<typeof ScaleSchema>;
export type CalibrationRequest = z.infer<typeof CalibrationRequestSchema>;
