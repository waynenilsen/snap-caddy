/**
 * SAM 2 segmentation types
 *
 * SAM 2 uses automatic mask generation - returns all masks as URLs.
 * Users toggle masks on/off to select which segments to include.
 */

import type {
  SegmentRequest as SchemaSegmentRequest,
  SegmentResponse as SchemaSegmentResponse,
} from "@/schemas/segment";

/**
 * Individual mask data for display
 * Includes the image data and selection state
 */
export interface MaskData {
  /** Unique index for this mask */
  index: number;
  /** URL to the mask image from Replicate */
  url: string;
  /** Loaded image data for canvas rendering */
  imageData: ImageData | null;
  /** Whether this mask is selected/included */
  selected: boolean;
  /** Display color (assigned automatically) */
  color: string;
}

/**
 * State for the segmentation step
 */
export interface SegmentationState {
  /** Whether we're currently fetching masks from SAM 2 */
  isSegmenting: boolean;
  /** All masks returned from SAM 2 */
  masks: MaskData[];
  /** Combined mask URL from SAM 2 */
  combinedMaskUrl: string | null;
  /** Error message if segmentation failed */
  error: string | null;
  /** Image dimensions */
  imageWidth: number;
  imageHeight: number;
}

/**
 * Re-export schema types for API usage
 */
export type SegmentRequest = SchemaSegmentRequest;
export type SegmentResponse = SchemaSegmentResponse;
