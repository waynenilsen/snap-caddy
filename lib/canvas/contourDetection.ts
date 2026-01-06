/**
 * Contour detection module for mask-to-SVG conversion pipeline
 *
 * Implements:
 * - Marching squares algorithm for contour tracing
 * - Douglas-Peucker algorithm for path simplification
 * - Contour smoothing via moving average
 */

import type {
  BoundingBox,
  Contour,
  ContourDetectionOptions,
  ContourResult,
  Point,
} from "./types";

/**
 * Extract contours from a binary mask using marching squares algorithm
 *
 * @param maskData - Binary mask ImageData (white = object, black = background)
 * @param options - Detection options
 * @returns Detected contours with outer contour and holes
 *
 * Time Complexity: O(width × height) for scanning + O(perimeter) for tracing
 */
export function findContours(
  maskData: ImageData,
  options: ContourDetectionOptions = {},
): ContourResult {
  const {
    minArea = 100,
    simplifyTolerance = 1.0,
    smoothingIterations = 0,
    findHoles = true,
  } = options;

  const width = maskData.width;
  const height = maskData.height;

  // Convert ImageData to binary grid (0 = background, 1 = foreground)
  const binaryGrid = maskToBinaryGrid(maskData);

  // Find all contours using marching squares
  const rawContours = marchingSquares(binaryGrid, width, height);

  // Process each contour
  const processedContours: Contour[] = rawContours
    .map((points) => {
      // Calculate signed area (using shoelace formula)
      const signedArea = calculateSignedArea(points);

      // Skip small contours
      if (Math.abs(signedArea) < minArea) {
        return null;
      }

      // Simplify contour
      let simplified = points;
      if (simplifyTolerance > 0 && points.length > 3) {
        simplified = douglasPeucker(points, simplifyTolerance);
      }

      // Smooth contour
      if (smoothingIterations > 0 && simplified.length > 3) {
        simplified = smoothContour(simplified, smoothingIterations);
      }

      // Calculate bounding box
      const boundingBox = calculateBoundingBox(simplified);

      return {
        points: simplified,
        isHole: signedArea < 0, // Negative area = clockwise = hole
        area: Math.abs(signedArea),
        boundingBox,
      };
    })
    .filter((c): c is Contour => c !== null)
    .sort((a, b) => b.area - a.area); // Sort by area, largest first

  // Handle case where no contours were found
  if (processedContours.length === 0) {
    return {
      outerContour: {
        points: [],
        isHole: false,
        area: 0,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      },
      holes: [],
      allContours: [],
    };
  }

  // Separate outer contour from holes
  const outerContour = processedContours[0];
  const holes = findHoles
    ? processedContours.slice(1).filter((c) => c.isHole)
    : [];

  return {
    outerContour,
    holes,
    allContours: processedContours,
  };
}

/**
 * Convert mask ImageData to binary grid
 * Uses luminance threshold to determine foreground/background
 *
 * @param maskData - ImageData from canvas
 * @returns Binary grid (0 = background, 1 = foreground)
 */
export function maskToBinaryGrid(maskData: ImageData): Uint8Array {
  const data = maskData.data;
  const grid = new Uint8Array(maskData.width * maskData.height);
  const threshold = 128;

  for (let i = 0; i < grid.length; i++) {
    const pixelIndex = i * 4;
    // Use red channel (mask should be grayscale or white)
    const value = data[pixelIndex];
    grid[i] = value >= threshold ? 1 : 0;
  }

  return grid;
}

/**
 * Marching squares algorithm for contour tracing
 * Traces the boundary between 0 and 1 in a binary grid
 *
 * @param grid - Binary grid (0 = background, 1 = foreground)
 * @param width - Grid width
 * @param height - Grid height
 * @returns Array of contour point arrays
 *
 * Time Complexity: O(width × height) for scanning + O(perimeter) for tracing
 */
export function marchingSquares(
  grid: Uint8Array,
  width: number,
  height: number,
): Point[][] {
  const contours: Point[][] = [];
  const visitedEdges = new Set<string>();

  // Scan for starting points (boundary cells)
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      // Get 2x2 cell value
      const cellValue = getCellValue(grid, width, height, x, y);

      // Skip if no boundary (all 0 or all 1)
      if (cellValue === 0 || cellValue === 15) continue;

      // Check if this cell's edge has been visited
      const edgeKey = `${x},${y}`;
      if (visitedEdges.has(edgeKey)) continue;

      // Trace contour from this point
      const contour = traceContourSimple(
        grid,
        width,
        height,
        x,
        y,
        visitedEdges,
      );

      if (contour.length > 3) {
        contours.push(contour);
      }
    }
  }

  return contours;
}

/**
 * Get 2x2 cell value as 4-bit number
 * Bit layout:
 *   8(TL)  4(TR)
 *   1(BL)  2(BR)
 */
function getCellValue(
  grid: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let value = 0;

  // Top-left
  if (x >= 0 && y >= 0 && x < width && y < height && grid[y * width + x]) {
    value |= 8;
  }
  // Top-right
  if (
    x + 1 >= 0 &&
    y >= 0 &&
    x + 1 < width &&
    y < height &&
    grid[y * width + (x + 1)]
  ) {
    value |= 4;
  }
  // Bottom-left
  if (
    x >= 0 &&
    y + 1 >= 0 &&
    x < width &&
    y + 1 < height &&
    grid[(y + 1) * width + x]
  ) {
    value |= 1;
  }
  // Bottom-right
  if (
    x + 1 >= 0 &&
    y + 1 >= 0 &&
    x + 1 < width &&
    y + 1 < height &&
    grid[(y + 1) * width + (x + 1)]
  ) {
    value |= 2;
  }

  return value;
}

/**
 * Simplified contour tracing using marching squares
 * Traces the boundary by following edges between cells
 */
function traceContourSimple(
  grid: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visitedEdges: Set<string>,
): Point[] {
  const points: Point[] = [];
  let x = startX;
  let y = startY;

  // Direction: 0=right, 1=down, 2=left, 3=up
  // Start by finding which direction to go based on cell configuration
  let dir = getInitialDirection(getCellValue(grid, width, height, x, y));

  const maxIterations = (width + height) * 4; // More than enough for any contour
  let iterations = 0;

  do {
    // Mark this edge as visited
    visitedEdges.add(`${x},${y}`);

    // Get cell value
    const cellValue = getCellValue(grid, width, height, x, y);

    // Get edge point for this cell
    const point = getEdgePoint(cellValue, x, y, dir);
    if (point) {
      // Avoid duplicate consecutive points
      const lastPoint = points[points.length - 1];
      if (!lastPoint || point.x !== lastPoint.x || point.y !== lastPoint.y) {
        points.push(point);
      }
    }

    // Get next direction and move
    dir = getNextDirection(cellValue, dir);

    // Move to next cell
    switch (dir) {
      case 0:
        x += 1;
        break; // Right
      case 1:
        y += 1;
        break; // Down
      case 2:
        x -= 1;
        break; // Left
      case 3:
        y -= 1;
        break; // Up
    }

    iterations++;

    // Check bounds
    if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) {
      break;
    }
  } while ((x !== startX || y !== startY) && iterations < maxIterations);

  return points;
}

/**
 * Get initial direction based on cell configuration
 */
function getInitialDirection(cellValue: number): number {
  // Find an edge to follow - pick direction based on cell type
  switch (cellValue) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 9:
    case 11:
    case 13:
      return 2; // Left
    case 2:
    case 6:
    case 14:
      return 1; // Down
    case 4:
    case 12:
      return 0; // Right
    case 8:
      return 3; // Up
    default:
      return 0;
  }
}

/**
 * Get edge point for a cell based on entry direction
 */
function getEdgePoint(
  cellValue: number,
  x: number,
  y: number,
  dir: number,
): Point | null {
  // Edge midpoints
  const top: Point = { x: x + 0.5, y: y };
  const right: Point = { x: x + 1, y: y + 0.5 };
  const bottom: Point = { x: x + 0.5, y: y + 1 };
  const left: Point = { x: x, y: y + 0.5 };

  // Simplified: return the edge point based on the cell configuration
  // The edge point depends on which edges are "on" (inside to outside transition)
  switch (cellValue) {
    case 1:
      return bottom; // BL only
    case 2:
      return right; // BR only
    case 3:
      return right; // Bottom row
    case 4:
      return top; // TR only
    case 5:
      return dir === 3 || dir === 2 ? left : right; // Saddle TR+BL
    case 6:
      return top; // Right column
    case 7:
      return top; // All except TL
    case 8:
      return left; // TL only
    case 9:
      return bottom; // Left column
    case 10:
      return dir === 0 || dir === 1 ? bottom : top; // Saddle TL+BR
    case 11:
      return right; // All except TR
    case 12:
      return left; // Top row
    case 13:
      return bottom; // All except BR
    case 14:
      return left; // All except BL
    default:
      return null;
  }
}

/**
 * Get next direction based on cell configuration and current direction
 */
function getNextDirection(cellValue: number, currentDir: number): number {
  // Marching squares direction lookup
  // Returns the next direction to move based on the cell type and entry direction
  const dirTable: { [key: number]: { [dir: number]: number } } = {
    1: { 0: 1, 1: 1, 2: 2, 3: 2 }, // BL only: go down or left
    2: { 0: 0, 1: 0, 2: 1, 3: 1 }, // BR only: go right or down
    3: { 0: 0, 1: 0, 2: 2, 3: 2 }, // Bottom row: continue horizontal
    4: { 0: 3, 1: 0, 2: 3, 3: 3 }, // TR only: go up or right
    5: { 0: 3, 1: 0, 2: 1, 3: 2 }, // Saddle TR+BL
    6: { 0: 3, 1: 1, 2: 3, 3: 3 }, // Right column: continue vertical
    7: { 0: 3, 1: 3, 2: 2, 3: 2 }, // All except TL: go up or left
    8: { 0: 2, 1: 2, 2: 3, 3: 3 }, // TL only: go left or up
    9: { 0: 1, 1: 1, 2: 3, 3: 3 }, // Left column: continue vertical
    10: { 0: 1, 1: 2, 2: 3, 3: 0 }, // Saddle TL+BR
    11: { 0: 0, 1: 0, 2: 3, 3: 3 }, // All except TR: go right or up
    12: { 0: 0, 1: 2, 2: 2, 3: 0 }, // Top row: continue horizontal
    13: { 0: 0, 1: 0, 2: 1, 3: 1 }, // All except BR: go right or down
    14: { 0: 1, 1: 1, 2: 2, 3: 2 }, // All except BL: go down or left
  };

  return dirTable[cellValue]?.[currentDir] ?? currentDir;
}

/**
 * Douglas-Peucker algorithm for polyline simplification
 * Reduces number of points while preserving shape
 *
 * @param points - Contour points
 * @param epsilon - Maximum distance threshold
 * @returns Simplified points
 *
 * Time Complexity: O(n log n) average, O(n²) worst case
 */
export function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];

  // Find point with maximum distance from line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);

    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive call
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);

    // Concatenate results (removing duplicate middle point)
    return [...left.slice(0, -1), ...right];
  }

  // Max distance is within epsilon, return endpoints
  return [start, end];
}

/**
 * Calculate perpendicular distance from point to line segment
 */
export function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line segment length squared
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line segment is a point
    return distance(point, lineStart);
  }

  // Calculate projection parameter
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq,
    ),
  );

  // Find projection point
  const projection: Point = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };

  return distance(point, projection);
}

/**
 * Euclidean distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Smooth contour using moving average
 *
 * @param points - Contour points
 * @param iterations - Number of smoothing passes
 * @returns Smoothed points
 *
 * Time Complexity: O(n × iterations)
 */
export function smoothContour(points: Point[], iterations: number): Point[] {
  let smoothed = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: Point[] = [];
    const n = smoothed.length;

    for (let i = 0; i < n; i++) {
      // Use 3-point moving average (weight: 0.25, 0.5, 0.25)
      const prev = smoothed[(i - 1 + n) % n];
      const curr = smoothed[i];
      const next = smoothed[(i + 1) % n];

      newPoints.push({
        x: 0.25 * prev.x + 0.5 * curr.x + 0.25 * next.x,
        y: 0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y,
      });
    }

    smoothed = newPoints;
  }

  return smoothed;
}

/**
 * Calculate signed area of polygon using shoelace formula
 * Positive = counter-clockwise, Negative = clockwise
 *
 * @param points - Polygon points
 * @returns Signed area
 *
 * Time Complexity: O(n)
 */
export function calculateSignedArea(points: Point[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return area / 2;
}

/**
 * Calculate bounding box of contour
 *
 * @param points - Contour points
 * @returns Bounding box
 *
 * Time Complexity: O(n)
 */
export function calculateBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Check if a point is inside a polygon (ray casting algorithm)
 *
 * @param point - Point to check
 * @param polygon - Polygon points
 * @returns True if point is inside polygon
 *
 * Time Complexity: O(n)
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}
