/**
 * SAM segmentation types
 * Note: Core types (ClickPoint, MaskOption) are defined in schemas/segment.ts
 * and re-exported here for consistency with the validated API contract
 */

import type {
  BoundingBox,
  MaskOption as SchemaMaskOption,
  Point as SchemaPoint,
} from "@/schemas/segment";

/**
 * ClickPoint - represents a user click for segmentation
 * Uses schema-validated type to ensure consistency with API
 */
export type ClickPoint = SchemaPoint;

/**
 * MaskOption - represents a segmentation mask result
 * Uses schema-validated type to ensure consistency with API
 */
export type MaskOption = SchemaMaskOption;

/**
 * SegmentationResult - complete response from segmentation
 */
export interface SegmentationResult {
  masks: MaskOption[];
  imageWidth: number;
  imageHeight: number;
  processingTimeMs: number;
}

export type { BoundingBox };

export interface SegmentationState {
  clickPoints: ClickPoint[];
  mask: ImageData | null;
  boundingBox: BoundingBox | null;
  isSegmenting: boolean;
  error: string | null;
  confidence: number | null;
}
