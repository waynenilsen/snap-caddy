/**
 * Canvas utilities for mask-to-SVG conversion pipeline
 *
 * This module provides functions to:
 * - Extract contours from binary segmentation masks (marching squares)
 * - Simplify contours while preserving shape (Douglas-Peucker)
 * - Generate SVG paths with proper scaling and OpenSCAD compatibility
 */

// Contour detection exports
export {
  calculateBoundingBox,
  calculateSignedArea,
  distance,
  douglasPeucker,
  findContours,
  isPointInPolygon,
  marchingSquares,
  maskToBinaryGrid,
  perpendicularDistance,
  smoothContour,
} from "./contourDetection";
// SVG generation exports
export {
  calculatePathLength,
  contourToBezierPath,
  contourToLinePath,
  createSVGDocument,
  downloadSVG,
  generateSVG,
  isValidPathData,
  optimizePath,
  parsePathData,
  reverseWinding,
  round,
} from "./svgGeneration";
// Type exports
export type {
  BoundingBox,
  Contour,
  ContourDetectionOptions,
  ContourResult,
  PathSegment,
  Point,
  SVGDocument,
  SVGGenerationOptions,
} from "./types";
