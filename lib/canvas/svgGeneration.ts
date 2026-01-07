/**
 * SVG generation module for mask-to-SVG conversion pipeline
 *
 * Converts contour points to SVG paths with proper scaling,
 * optimizations, and formatting for OpenSCAD compatibility.
 */

import { calculateBoundingBox, distance } from "./contourDetection";
import type {
  Contour,
  PathSegment,
  Point,
  SVGDocument,
  SVGGenerationOptions,
} from "./types";

/**
 * Generate SVG document from contour with proper scaling
 *
 * @param contour - Outer contour with points in pixel coordinates
 * @param holes - Inner contours (holes)
 * @param options - Generation options
 * @returns Complete SVG document with metadata
 *
 * Time Complexity: O(n) where n is total points
 */
export function generateSVG(
  contour: Contour,
  holes: Contour[],
  options: SVGGenerationOptions,
): SVGDocument {
  const {
    pixelsPerMm,
    padding = 2,
    useBezier = false,
    bezierTension = 0.5,
    decimals = 3,
    flipY = true,
  } = options;

  // Handle empty contour
  if (contour.points.length === 0) {
    return {
      pathData: "",
      width: 0,
      height: 0,
      viewBox: "0 0 0 0",
      fullSvg: createSVGDocument("", 0, 0, "0 0 0 0"),
    };
  }

  // Convert pixel coordinates to mm
  const scaledContour = scaleContourToMm(contour, pixelsPerMm);
  const scaledHoles = holes.map((h) => scaleContourToMm(h, pixelsPerMm));

  // Calculate dimensions with padding
  const bbox = calculateBoundingBox(scaledContour.points);
  const width = bbox.width + padding * 2;
  const height = bbox.height + padding * 2;

  // Translate to apply padding and center
  const offsetX = -bbox.x + padding;
  const offsetY = -bbox.y + padding;

  // Generate path data
  const outerPath = useBezier
    ? contourToBezierPath(
        scaledContour.points,
        offsetX,
        offsetY,
        flipY,
        height,
        decimals,
        bezierTension,
      )
    : contourToLinePath(
        scaledContour.points,
        offsetX,
        offsetY,
        flipY,
        height,
        decimals,
      );

  // Generate hole paths (with opposite winding)
  const holePaths = scaledHoles.map((hole) =>
    useBezier
      ? contourToBezierPath(
          reverseWinding(hole.points),
          offsetX,
          offsetY,
          flipY,
          height,
          decimals,
          bezierTension,
        )
      : contourToLinePath(
          reverseWinding(hole.points),
          offsetX,
          offsetY,
          flipY,
          height,
          decimals,
        ),
  );

  // Combine paths
  const pathData = [outerPath, ...holePaths].filter(Boolean).join(" ");

  // Create viewBox
  const viewBox = `0 0 ${round(width, decimals)} ${round(height, decimals)}`;

  // Generate complete SVG document
  const fullSvg = createSVGDocument(pathData, width, height, viewBox);

  return {
    pathData,
    width,
    height,
    viewBox,
    fullSvg,
  };
}

/**
 * Scale contour from pixels to millimeters
 */
function scaleContourToMm(contour: Contour, pixelsPerMm: number): Contour {
  return {
    ...contour,
    points: contour.points.map((p) => ({
      x: p.x / pixelsPerMm,
      y: p.y / pixelsPerMm,
    })),
  };
}

/**
 * Convert contour points to SVG path using lines
 *
 * @param points - Contour points in mm
 * @param offsetX - X offset to apply
 * @param offsetY - Y offset to apply
 * @param flipY - Whether to flip Y axis
 * @param height - Total height for Y flip
 * @param decimals - Decimal precision
 * @returns SVG path string
 *
 * Time Complexity: O(n)
 */
export function contourToLinePath(
  points: Point[],
  offsetX: number,
  offsetY: number,
  flipY: boolean,
  height: number,
  decimals: number,
): string {
  if (points.length === 0) return "";

  const path: string[] = [];

  // Move to first point
  const first = transformPoint(points[0], offsetX, offsetY, flipY, height);
  path.push(`M ${round(first.x, decimals)} ${round(first.y, decimals)}`);

  // Line to subsequent points
  for (let i = 1; i < points.length; i++) {
    const p = transformPoint(points[i], offsetX, offsetY, flipY, height);
    path.push(`L ${round(p.x, decimals)} ${round(p.y, decimals)}`);
  }

  // Close path
  path.push("Z");

  return path.join(" ");
}

/**
 * Transform point coordinates
 */
function transformPoint(
  point: Point,
  offsetX: number,
  offsetY: number,
  flipY: boolean,
  height: number,
): Point {
  return {
    x: point.x + offsetX,
    y: flipY ? height - (point.y + offsetY) : point.y + offsetY,
  };
}

/**
 * Convert contour to smooth Bezier curve path
 * Uses Catmull-Rom to Cubic Bezier conversion
 *
 * @param points - Contour points
 * @param offsetX - X offset
 * @param offsetY - Y offset
 * @param flipY - Flip Y axis
 * @param height - Total height
 * @param decimals - Precision
 * @param tension - Curve tension (0 = straight, 1 = very curved)
 * @returns SVG path string with cubic Bezier curves
 *
 * Time Complexity: O(n)
 */
export function contourToBezierPath(
  points: Point[],
  offsetX: number,
  offsetY: number,
  flipY: boolean,
  height: number,
  decimals: number,
  tension: number = 0.5,
): string {
  if (points.length < 3) {
    return contourToLinePath(points, offsetX, offsetY, flipY, height, decimals);
  }

  const path: string[] = [];
  const n = points.length;

  // Move to first point
  const first = transformPoint(points[0], offsetX, offsetY, flipY, height);
  path.push(`M ${round(first.x, decimals)} ${round(first.y, decimals)}`);

  // Generate cubic Bezier curves for each segment
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    // Calculate control points using Catmull-Rom formula
    const cp1 = catmullRomControlPoint(p0, p1, p2, tension, true);
    const cp2 = catmullRomControlPoint(p1, p2, p3, tension, false);

    // Transform control points
    const tcp1 = transformPoint(cp1, offsetX, offsetY, flipY, height);
    const tcp2 = transformPoint(cp2, offsetX, offsetY, flipY, height);
    const tp2 = transformPoint(p2, offsetX, offsetY, flipY, height);

    // Add cubic Bezier command (C cp1x cp1y cp2x cp2y x y)
    path.push(
      `C ${round(tcp1.x, decimals)} ${round(tcp1.y, decimals)} ` +
        `${round(tcp2.x, decimals)} ${round(tcp2.y, decimals)} ` +
        `${round(tp2.x, decimals)} ${round(tp2.y, decimals)}`,
    );
  }

  // No Z command needed as we've looped back to start

  return path.join(" ");
}

/**
 * Calculate Catmull-Rom control point
 *
 * @param p0 - Point before
 * @param p1 - Start point
 * @param p2 - End point
 * @param tension - Curve tension
 * @param isFirst - Whether this is the first control point
 */
function catmullRomControlPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  tension: number,
  isFirst: boolean,
): Point {
  const t = tension / 6;

  if (isFirst) {
    return {
      x: p1.x + (p2.x - p0.x) * t,
      y: p1.y + (p2.y - p0.y) * t,
    };
  } else {
    return {
      x: p2.x - (p2.x - p0.x) * t,
      y: p2.y - (p2.y - p0.y) * t,
    };
  }
}

/**
 * Create complete SVG document with OpenSCAD-compatible format
 *
 * Requirements for OpenSCAD:
 * - 96 DPI (default SVG standard)
 * - Millimeter units
 * - No embedded styles or scripts
 * - Clean path data
 */
export function createSVGDocument(
  pathData: string,
  width: number,
  height: number,
  viewBox: string,
): string {
  // Format dimensions to avoid scientific notation
  const widthStr = width.toFixed(3);
  const heightStr = height.toFixed(3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     version="1.1"
     width="${widthStr}mm"
     height="${heightStr}mm"
     viewBox="${viewBox}">
  <path d="${pathData}"
        fill="black"
        stroke="none"/>
</svg>`;
}

/**
 * Export SVG as downloadable file
 */
export function downloadSVG(
  svg: string,
  filename: string = "cutout.svg",
): void {
  // Check if we're in a browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    console.warn("downloadSVG: Cannot download in server environment");
    return;
  }

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Optimize SVG path by removing redundant points
 * Points are redundant if they're collinear with neighbors
 *
 * @param pathData - SVG path string
 * @param tolerance - Collinearity tolerance in mm
 * @returns Optimized path
 *
 * Time Complexity: O(n)
 */
export function optimizePath(
  pathData: string,
  tolerance: number = 0.1,
): string {
  // Parse path commands
  const commands = parsePathData(pathData);

  if (commands.length < 3) return pathData;

  // Filter out collinear points
  const optimized: PathSegment[] = [];

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    if (cmd.command === "M" || cmd.command === "Z") {
      optimized.push(cmd);
      continue;
    }

    // Check if point is collinear with previous and next
    if (i > 0 && i < commands.length - 1) {
      const prev = commands[i - 1];
      const next = commands[i + 1];

      if (
        cmd.command === "L" &&
        prev.points.length >= 2 &&
        next.points.length >= 2 &&
        isCollinear(prev.points, cmd.points, next.points, tolerance)
      ) {
        continue; // Skip this point
      }
    }

    optimized.push(cmd);
  }

  // Convert back to path string
  return pathSegmentsToString(optimized);
}

/**
 * Check if three points are collinear
 */
function isCollinear(
  p1: number[],
  p2: number[],
  p3: number[],
  tolerance: number,
): boolean {
  if (p1.length < 2 || p2.length < 2 || p3.length < 2) return false;

  // Calculate cross product
  const dx1 = p2[0] - p1[p1.length - 2];
  const dy1 = p2[1] - p1[p1.length - 1];
  const dx2 = p3[0] - p2[0];
  const dy2 = p3[1] - p2[1];

  const cross = Math.abs(dx1 * dy2 - dy1 * dx2);

  return cross < tolerance;
}

/**
 * Parse SVG path data into commands
 */
export function parsePathData(pathData: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const regex = /([MLCQZ])\s*([-\d.,\s]*)/gi;

  for (const match of pathData.matchAll(regex)) {
    const command = match[1].toUpperCase() as PathSegment["command"];
    const numbersStr = match[2].trim();

    const numbers =
      numbersStr.length > 0
        ? numbersStr
            .split(/[\s,]+/)
            .filter((s) => s.length > 0)
            .map(Number)
        : [];

    segments.push({ command, points: numbers });
  }

  return segments;
}

/**
 * Convert path segments back to string
 */
function pathSegmentsToString(segments: PathSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.command === "Z") {
        return "Z";
      }
      return `${seg.command} ${seg.points.join(" ")}`;
    })
    .join(" ");
}

/**
 * Round number to specified decimal places
 */
export function round(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Reverse winding order of points (for holes)
 */
export function reverseWinding(points: Point[]): Point[] {
  return [...points].reverse();
}

/**
 * Validate SVG path data
 */
export function isValidPathData(pathData: string): boolean {
  // Check for valid SVG path commands
  const validCommands = /^[MLHVCSQTAZ\s\d.,-]*$/i;
  return validCommands.test(pathData);
}

/**
 * Calculate path length (approximate)
 */
export function calculatePathLength(points: Point[]): number {
  let length = 0;

  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }

  // Add closing segment
  if (points.length > 0) {
    length += distance(points[points.length - 1], points[0]);
  }

  return length;
}
