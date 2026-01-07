/**
 * Canvas utility type definitions for mask-to-SVG conversion pipeline
 */

/**
 * 2D point with x and y coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Bounding box for a contour or region
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A contour represents a closed path of points
 */
export interface Contour {
  /** Points forming the contour boundary */
  points: Point[];
  /** True if this is an inner contour (hole) */
  isHole: boolean;
  /** Absolute area of the contour in pixels^2 */
  area: number;
  /** Bounding box of the contour */
  boundingBox: BoundingBox;
}

/**
 * Options for contour detection
 */
export interface ContourDetectionOptions {
  /** Minimum contour area in pixels^2 (default: 100) */
  minArea?: number;
  /** Douglas-Peucker simplification tolerance in pixels (default: 1.0) */
  simplifyTolerance?: number;
  /** Number of smoothing passes (default: 0) */
  smoothingIterations?: number;
  /** Whether to detect inner contours/holes (default: true) */
  findHoles?: boolean;
}

/**
 * Result of contour detection
 */
export interface ContourResult {
  /** The main outer contour (largest by area) */
  outerContour: Contour;
  /** Inner contours (holes) */
  holes: Contour[];
  /** All detected contours sorted by area (largest first) */
  allContours: Contour[];
}

/**
 * Options for SVG generation
 */
export interface SVGGenerationOptions {
  /** Scale factor from calibration (pixels per mm) */
  pixelsPerMm: number;
  /** Padding in mm to add around the contour (default: 2) */
  padding?: number;
  /** Use Bezier curves for smooth paths (default: false) */
  useBezier?: boolean;
  /** Tension for Bezier curves 0-1 (default: 0.5) */
  bezierTension?: number;
  /** Decimal places for coordinates (default: 3) */
  decimals?: number;
  /** Flip Y axis for SVG coordinate system (default: true) */
  flipY?: boolean;
}

/**
 * Generated SVG document with metadata
 */
export interface SVGDocument {
  /** SVG path d attribute */
  pathData: string;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** SVG viewBox attribute */
  viewBox: string;
  /** Complete SVG document as string */
  fullSvg: string;
}

/**
 * Path segment types for SVG path parsing
 */
export interface PathSegment {
  command: "M" | "L" | "C" | "Q" | "Z";
  points: number[];
}
