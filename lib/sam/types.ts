/**
 * SAM 2 (Segment Anything Model 2) Types
 * Type definitions for SAM 2 integration using Replicate API
 *
 * SAM 2 uses automatic mask generation - no point prompts needed.
 * It returns all detected masks which users can then toggle on/off.
 */

/**
 * Individual mask returned from SAM 2
 */
export interface SAM2Mask {
  /** URL to the mask image */
  url: string;
  /** Unique index for this mask */
  index: number;
}

/**
 * Parameters for SAM 2 segmentation request
 * SAM 2 auto-generates all masks - no point prompts needed
 */
export interface SAMSegmentationParams {
  /** Image data as a Buffer */
  imageBuffer: Buffer;
  /** Width of the input image in pixels */
  imageWidth: number;
  /** Height of the input image in pixels */
  imageHeight: number;
  /** Points per side for mask generation (default: 32) */
  pointsPerSide?: number;
  /** Predicted IOU threshold (default: 0.88) */
  predIouThresh?: number;
  /** Stability score threshold (default: 0.95) */
  stabilityScoreThresh?: number;
  /** Use M2M (mask-to-mask) refinement (default: true) */
  useM2M?: boolean;
}

/**
 * Result from SAM 2 segmentation
 */
export interface SAMResult {
  /** URL to combined mask showing all segments */
  combinedMaskUrl: string;
  /** Array of individual mask URLs */
  individualMaskUrls: string[];
}

/**
 * SAM 2 Replicate API prediction object
 */
export interface ReplicatePrediction {
  /** Unique prediction ID */
  id: string;
  /** Current status of the prediction */
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  /** Output data (available when succeeded) - SAM 2 format */
  output?: {
    combined_mask?: string; // URL to combined mask
    individual_masks?: string[]; // URLs to individual mask images
  };
  /** Error information (available when failed) */
  error?: string;
  /** URLs for accessing the prediction */
  urls?: {
    get?: string;
    cancel?: string;
  };
  /** When the prediction was created */
  created_at?: string;
  /** When the prediction started processing */
  started_at?: string;
  /** When the prediction completed */
  completed_at?: string;
  /** Prediction metrics */
  metrics?: {
    predict_time?: number;
  };
  /** Logs from the prediction */
  logs?: string;
}

/**
 * Request payload for SAM 2 Replicate API
 * Uses automatic mask generation (no point prompts)
 */
export interface ReplicateRequest {
  version: string;
  input: {
    /** Input image (data URI) */
    image: string;
    /** Points per side for mask generation */
    points_per_side?: number;
    /** Predicted IOU threshold */
    pred_iou_thresh?: number;
    /** Stability score threshold */
    stability_score_thresh?: number;
    /** Use M2M refinement */
    use_m2m?: boolean;
  };
}

/**
 * Mask analysis result
 */
export interface MaskAnalysis {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  area: number;
}
