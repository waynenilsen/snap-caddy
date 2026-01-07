/**
 * SAM 2 (Segment Anything Model 2) Integration
 * Public API for SAM 2 segmentation functionality
 *
 * SAM 2 uses automatic mask generation - returns all detected masks
 * which users can then toggle on/off to select what to include.
 */

export { runSAMSegmentation } from "./inference";
export type {
  ReplicatePrediction,
  ReplicateRequest,
  SAM2Mask,
  SAMResult,
  SAMSegmentationParams,
} from "./types";
