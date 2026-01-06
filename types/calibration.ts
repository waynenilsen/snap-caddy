/**
 * Calibration and scale types
 */

import type { Point } from './image';

export interface CalibrationPoints {
  point1: Point;
  point2: Point;
}

export interface Scale {
  pixelsPerMm: number;
  knownDistanceMm: number;
  pixelDistance: number;
  isValid: boolean;
}

export interface CalibrationState {
  rulerPoints: [Point, Point] | null;
  knownDistanceMm: number;
  pixelsPerMm: number | null;
  isValid: boolean;
  error: string | null;
}

/**
 * Calculate pixels per millimeter from two points
 */
export function calculatePixelsPerMm(
  point1: Point,
  point2: Point,
  knownDistanceMm: number
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);
  return pixelDistance / knownDistanceMm;
}

/**
 * Calculate distance in pixels between two points
 */
export function calculatePixelDistance(point1: Point, point2: Point): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
