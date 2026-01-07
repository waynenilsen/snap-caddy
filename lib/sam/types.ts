/**
 * SAM (Segment Anything Model) Types
 * Type definitions for SAM integration using Replicate API
 */

import type { MaskOption } from "@/types/segmentation";

/**
 * Parameters for SAM segmentation request
 */
export interface SAMSegmentationParams {
  /** Image data as a Buffer */
  imageBuffer: Buffer;
  /** Point prompts for segmentation */
  points: Array<{
    x: number;
    y: number;
    label: 0 | 1; // 0 = background, 1 = foreground
  }>;
  /** Width of the input image in pixels */
  imageWidth: number;
  /** Height of the input image in pixels */
  imageHeight: number;
  /** Whether to return multiple mask options (default: false) */
  returnMultiple?: boolean;
  /** Output format for masks (default: 'base64png') */
  outputFormat?: "base64png" | "rle" | "binary";
}

/**
 * Result from SAM segmentation
 */
export interface SAMResult {
  /** Array of mask options with metadata */
  masks: MaskOption[];
}

/**
 * Replicate API prediction object
 */
export interface ReplicatePrediction {
  /** Unique prediction ID */
  id: string;
  /** Current status of the prediction */
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  /** Output data (available when succeeded) */
  output?: {
    masks?: string[]; // URLs to mask images
    scores?: number[]; // Confidence scores for each mask
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
 * Request payload for Replicate API
 */
export interface ReplicateRequest {
  version: string;
  input: {
    image: string; // Base64 data URI
    point_coords: number[][]; // [[x1, y1], [x2, y2], ...]
    point_labels: number[]; // [0, 1, ...]
    multimask_output?: boolean;
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
