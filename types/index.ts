/**
 * Central export for all type definitions
 */

// Image and geometric types
export type { Point, BoundingBox, ImageDimensions, ImageData } from './image';

// Segmentation types
export type {
  ClickPoint,
  MaskOption,
  SegmentationResult,
  SegmentationState,
} from './segmentation';

// Calibration types
export type { CalibrationPoints, Scale, CalibrationState } from './calibration';
export { calculatePixelsPerMm, calculatePixelDistance } from './calibration';

// Gridfinity types
export type {
  GridfinityConfig,
  BinConfigState,
  BinDimensions,
} from './gridfinity';
export { calculateBinDimensions, validateBinFit } from './gridfinity';

// Wizard types
export type {
  Step,
  StepMetadata,
  NavigationState,
  WizardState,
} from './wizard';
export {
  STEP_ORDER,
  STEP_METADATA,
  getStepIndex,
  getNextStep,
  getPreviousStep,
} from './wizard';

// API types
export type {
  SegmentRequest,
  SegmentResponse,
  SegmentErrorResponse,
  GenerateRequest,
  GenerateResponse,
  GenerateErrorResponse,
  GenerationStatus,
  GenerationStatusResponse,
  DownloadResponse,
  DownloadErrorResponse,
  PreviewRequest,
  PreviewResponse,
  APIError,
  APIErrorCode,
  RateLimitHeaders,
  RateLimitError,
  ValidationResult,
  ImageValidationResult,
  SVGValidationResult,
} from './api';
export {
  APIClientError,
  isSegmentResponse,
  isGenerateResponse,
  isAPIError,
} from './api';
