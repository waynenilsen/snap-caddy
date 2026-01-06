/**
 * Image and geometric types
 */

import type { BoundingBox as SchemaBoundingBox } from '@/schemas/segment';

/**
 * Point - basic 2D coordinate
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * BoundingBox - rectangular region
 * Uses schema-validated type to ensure consistency with API
 */
export type BoundingBox = SchemaBoundingBox;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageData {
  data: string; // Base64 encoded image (data URI or raw)
  dimensions: ImageDimensions;
  format?: string; // image/png, image/jpeg, etc.
  size?: number; // File size in bytes
}
