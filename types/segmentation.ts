/**
 * SAM segmentation types
 */

import type { Point, BoundingBox } from './image';

export interface ClickPoint extends Point {
  label: 0 | 1; // 0 = background, 1 = foreground
}

export interface MaskOption {
  mask: string; // Base64 PNG or RLE encoded
  confidence: number; // 0-1 score
  boundingBox: BoundingBox;
  area: number; // Pixel count
}

export interface SegmentationResult {
  masks: MaskOption[];
  imageWidth: number;
  imageHeight: number;
  processingTimeMs: number;
}

export interface SegmentationState {
  clickPoints: ClickPoint[];
  mask: ImageData | null;
  boundingBox: BoundingBox | null;
  isSegmenting: boolean;
  error: string | null;
  confidence: number | null;
}
