/**
 * Central export for all type definitions
 */

// API types
export type {
  APIError,
  APIErrorCode,
  DownloadErrorResponse,
  DownloadResponse,
  GenerateErrorResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatus,
  GenerationStatusResponse,
  ImageValidationResult,
  PreviewRequest,
  PreviewResponse,
  RateLimitError,
  RateLimitHeaders,
  SegmentErrorResponse,
  SegmentRequest,
  SegmentResponse,
  SVGValidationResult,
  ValidationResult,
} from "./api";
export {
  APIClientError,
  isAPIError,
  isGenerateResponse,
  isSegmentResponse,
} from "./api";

// Calibration types
export type { CalibrationPoints, CalibrationState, Scale } from "./calibration";
export { calculatePixelDistance, calculatePixelsPerMm } from "./calibration";

// Gridfinity types
export type {
  BinConfigState,
  BinDimensions,
  GridfinityConfig,
} from "./gridfinity";
export { calculateBinDimensions, validateBinFit } from "./gridfinity";
// Image and geometric types
export type { BoundingBox, ImageData, ImageDimensions, Point } from "./image";
// Segmentation types
export type {
  MaskData,
  SegmentationState,
} from "./segmentation";
// Wizard types
export type {
  NavigationState,
  Step,
  StepMetadata,
  WizardState,
} from "./wizard";
export {
  getNextStep,
  getPreviousStep,
  getStepIndex,
  STEP_METADATA,
  STEP_ORDER,
} from "./wizard";
