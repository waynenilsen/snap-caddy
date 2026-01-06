# Image Processing Pipeline

## Overview

This document details the client-side image processing pipeline that converts photos into scaled SVG paths for Gridfinity bin generation. The pipeline runs entirely in the browser using Canvas APIs and custom algorithms.

**Processing Flow:**
```
Raw Image → Load & Preprocess → SAM Segmentation → Mask to Contour → Contour to SVG → Scaled SVG
                ↓                                                               ↑
         Ruler Detection → Scale Calculation ────────────────────────────────────
```

## Table of Contents

1. [Image Loading & Preprocessing](#1-image-loading--preprocessing)
2. [Contour Detection](#2-contour-detection)
3. [SVG Generation](#3-svg-generation)
4. [Ruler/Scale Detection](#4-rulerscale-detection)
5. [Scale Calculation](#5-scale-calculation)
6. [Performance Considerations](#performance-considerations)
7. [Browser Compatibility](#browser-compatibility)

---

## 1. Image Loading & Preprocessing

**File:** `lib/canvas/imageProcessing.ts`

### Purpose

Handles loading images from various sources, resizing for performance, correcting orientation, and preparing for segmentation.

### Type Definitions

```typescript
interface ImageDimensions {
  width: number;
  height: number;
}

interface ImageMetadata {
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
  scaleFactor: number; // displaySize / originalSize
  orientation: number; // EXIF orientation (1-8)
  colorSpace: string;
  hasAlpha: boolean;
}

interface LoadImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 - 1.0
  maintainAspectRatio?: boolean;
  correctOrientation?: boolean;
  format?: 'png' | 'jpeg' | 'webp';
}

interface ProcessedImage {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: ImageData;
  metadata: ImageMetadata;
  dataUrl: string;
}
```

### Core Functions

#### 1.1 Load Image from File

```typescript
/**
 * Loads an image from a File/Blob and creates a canvas
 * @param file - The image file to load
 * @param options - Loading and preprocessing options
 * @returns Processed image with canvas and metadata
 * @throws Error if file is not a valid image or loading fails
 *
 * Time Complexity: O(width × height)
 * Space Complexity: O(width × height × 4) for ImageData
 */
export async function loadImageFromFile(
  file: File | Blob,
  options: LoadImageOptions = {}
): Promise<ProcessedImage> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.95,
    maintainAspectRatio = true,
    correctOrientation = true,
    format = 'png'
  } = options;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error(`Invalid file type: ${file.type}. Expected image/*`);
  }

  // Create object URL for the file
  const imageUrl = URL.createObjectURL(file);

  try {
    // Load the image
    const img = await loadImage(imageUrl);

    // Get EXIF orientation if needed
    const orientation = correctOrientation
      ? await getImageOrientation(file)
      : 1;

    // Calculate dimensions with max constraints
    const dimensions = calculateDisplayDimensions(
      img.width,
      img.height,
      maxWidth,
      maxHeight,
      maintainAspectRatio
    );

    // Create canvas with proper dimensions
    const canvas = createCanvas(dimensions.width, dimensions.height);
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: true
    });

    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    // Apply orientation correction transform
    applyOrientationTransform(ctx, orientation, dimensions.width, dimensions.height);

    // Draw image to canvas
    ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, dimensions.width, dimensions.height);

    // Detect color space and alpha channel
    const hasAlpha = detectAlphaChannel(imageData);

    // Create data URL
    const dataUrl = canvas.toDataURL(`image/${format}`, quality);

    // Build metadata
    const metadata: ImageMetadata = {
      originalWidth: img.width,
      originalHeight: img.height,
      displayWidth: dimensions.width,
      displayHeight: dimensions.height,
      scaleFactor: dimensions.width / img.width,
      orientation,
      colorSpace: 'sRGB', // Default for web images
      hasAlpha
    };

    return {
      canvas,
      context: ctx,
      imageData,
      metadata,
      dataUrl
    };
  } finally {
    // Clean up object URL
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * Helper: Load image element from URL
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    img.src = url;
  });
}
```

#### 1.2 Load Image from Base64

```typescript
/**
 * Loads an image from a base64 data URL
 * @param dataUrl - Base64 encoded image data URL
 * @param options - Loading options
 * @returns Processed image
 *
 * Time Complexity: O(width × height)
 */
export async function loadImageFromBase64(
  dataUrl: string,
  options: LoadImageOptions = {}
): Promise<ProcessedImage> {
  // Validate data URL format
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Invalid data URL format');
  }

  // Convert to blob then process
  const blob = dataUrlToBlob(dataUrl);
  return loadImageFromFile(blob, options);
}

/**
 * Helper: Convert data URL to Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  return new Blob([array], { type: mime });
}
```

#### 1.3 Dimension Calculation

```typescript
/**
 * Calculate display dimensions respecting max constraints
 * @param width - Original width
 * @param height - Original height
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height
 * @param maintainAspectRatio - Whether to maintain aspect ratio
 * @returns Calculated dimensions
 *
 * Time Complexity: O(1)
 */
export function calculateDisplayDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
  maintainAspectRatio = true
): ImageDimensions {
  // If image fits within constraints, return original size
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  if (!maintainAspectRatio) {
    return {
      width: Math.min(width, maxWidth),
      height: Math.min(height, maxHeight)
    };
  }

  // Calculate aspect ratio
  const aspectRatio = width / height;

  // Determine which dimension is the limiting factor
  const widthScale = maxWidth / width;
  const heightScale = maxHeight / height;
  const scale = Math.min(widthScale, heightScale);

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}
```

#### 1.4 EXIF Orientation Handling

```typescript
/**
 * Get EXIF orientation from image file
 * @param file - Image file
 * @returns Orientation value (1-8)
 *
 * EXIF Orientation values:
 * 1 = Normal (0°)
 * 2 = Flip horizontal
 * 3 = Rotate 180°
 * 4 = Flip vertical
 * 5 = Flip horizontal + Rotate 270° CW
 * 6 = Rotate 90° CW
 * 7 = Flip horizontal + Rotate 90° CW
 * 8 = Rotate 270° CW
 */
export async function getImageOrientation(file: File | Blob): Promise<number> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  // Check for JPEG signature
  if (view.getUint16(0, false) !== 0xFFD8) {
    return 1; // Not a JPEG, assume normal orientation
  }

  const length = view.byteLength;
  let offset = 2;

  while (offset < length) {
    // Check for invalid marker
    if (view.getUint8(offset) !== 0xFF) {
      return 1;
    }

    const marker = view.getUint8(offset + 1);
    offset += 2;

    // Check for EXIF marker (0xFFE1)
    if (marker === 0xE1) {
      // Read EXIF data
      const exifOffset = offset + 4; // Skip size bytes

      // Check for EXIF header
      if (view.getUint32(exifOffset, false) !== 0x45786966) {
        return 1;
      }

      // Parse TIFF header
      const tiffOffset = exifOffset + 6;
      const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;

      // Get IFD0 offset
      const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
      const ifdStart = tiffOffset + ifdOffset;

      // Read number of directory entries
      const tags = view.getUint16(ifdStart, littleEndian);

      // Search for Orientation tag (0x0112)
      for (let i = 0; i < tags; i++) {
        const entryOffset = ifdStart + 2 + (i * 12);
        const tag = view.getUint16(entryOffset, littleEndian);

        if (tag === 0x0112) {
          // Found orientation tag
          return view.getUint16(entryOffset + 8, littleEndian);
        }
      }
    } else {
      // Skip this marker
      const size = view.getUint16(offset - 2, false);
      offset += size - 2;
    }
  }

  return 1; // Default orientation
}

/**
 * Apply canvas transformation for EXIF orientation
 * @param ctx - Canvas 2D context
 * @param orientation - EXIF orientation value
 * @param width - Canvas width
 * @param height - Canvas height
 */
export function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number
): void {
  switch (orientation) {
    case 2:
      // Flip horizontal
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      // Rotate 180°
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      // Flip vertical
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      // Flip horizontal + Rotate 270° CW
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      // Rotate 90° CW
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      // Flip horizontal + Rotate 90° CW
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      // Rotate 270° CW
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      // Normal orientation (1)
      break;
  }
}
```

#### 1.5 Utility Functions

```typescript
/**
 * Create a new canvas element with specified dimensions
 */
export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Detect if image has alpha channel with actual transparency
 */
export function detectAlphaChannel(imageData: ImageData): boolean {
  const data = imageData.data;

  // Check alpha channel (every 4th byte)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }

  return false;
}

/**
 * Clone a canvas
 */
export function cloneCanvas(original: HTMLCanvasElement): HTMLCanvasElement {
  const clone = createCanvas(original.width, original.height);
  const ctx = clone.getContext('2d');

  if (ctx) {
    ctx.drawImage(original, 0, 0);
  }

  return clone;
}

/**
 * Free memory by clearing canvas
 */
export function disposeCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
}
```

### Usage Example

```typescript
// Example: Load and preprocess an image from file upload
async function handleImageUpload(file: File) {
  try {
    const processed = await loadImageFromFile(file, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.9,
      correctOrientation: true
    });

    console.log('Original:', processed.metadata.originalWidth, 'x', processed.metadata.originalHeight);
    console.log('Display:', processed.metadata.displayWidth, 'x', processed.metadata.displayHeight);
    console.log('Scale factor:', processed.metadata.scaleFactor);

    // Use the canvas for further processing
    return processed;
  } catch (error) {
    console.error('Image loading failed:', error);
    throw error;
  }
}
```

### Performance Considerations

1. **Memory Management**
   - Large images can use significant memory (4 bytes per pixel)
   - Always set `maxWidth` and `maxHeight` to reasonable values (1920-2048)
   - Call `disposeCanvas()` when done with temporary canvases
   - Use `{ willReadFrequently: true }` context option if reading pixels often

2. **Optimization Tips**
   - Resize images before processing for faster SAM inference
   - Use OffscreenCanvas in Web Workers for parallel processing
   - Consider WebP format for smaller data URLs
   - Cache processed images to avoid re-processing

3. **Complexity Analysis**
   - Image loading: O(1) - DOM operation
   - Canvas drawing: O(w × h) - pixel copy
   - EXIF parsing: O(n) where n is file size, typically < 100KB
   - Orientation transform: O(1) - matrix multiplication

---

## 2. Contour Detection

**File:** `lib/canvas/contourDetection.ts`

### Purpose

Converts binary segmentation masks from SAM into traced contours (sequences of boundary points) that can be converted to SVG paths.

### Type Definitions

```typescript
interface Point {
  x: number;
  y: number;
}

interface Contour {
  points: Point[];
  isHole: boolean; // True if this is an inner contour (hole)
  area: number; // Signed area (positive for outer, negative for holes)
  boundingBox: BoundingBox;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContourDetectionOptions {
  minArea?: number; // Minimum contour area in pixels
  simplifyTolerance?: number; // Douglas-Peucker epsilon
  smoothingIterations?: number; // Number of smoothing passes
  findHoles?: boolean; // Whether to detect inner contours
}

interface ContourResult {
  outerContour: Contour;
  holes: Contour[];
  allContours: Contour[]; // All detected contours, sorted by area
}
```

### Core Functions

#### 2.1 Extract Contours from Mask

```typescript
/**
 * Extract contours from a binary mask using marching squares algorithm
 * @param maskData - Binary mask ImageData (white = object, black = background)
 * @param options - Detection options
 * @returns Detected contours
 *
 * Time Complexity: O(width × height)
 * Space Complexity: O(perimeter) for contour storage
 */
export function findContours(
  maskData: ImageData,
  options: ContourDetectionOptions = {}
): ContourResult {
  const {
    minArea = 100,
    simplifyTolerance = 1.0,
    smoothingIterations = 0,
    findHoles = true
  } = options;

  const width = maskData.width;
  const height = maskData.height;

  // Convert ImageData to binary grid (0 = background, 1 = foreground)
  const binaryGrid = maskToBinaryGrid(maskData);

  // Find all contours using marching squares
  const rawContours = marchingSquares(binaryGrid, width, height);

  // Process each contour
  const processedContours: Contour[] = rawContours
    .map(points => {
      // Calculate area (using shoelace formula)
      const area = calculateSignedArea(points);

      // Skip small contours
      if (Math.abs(area) < minArea) {
        return null;
      }

      // Simplify contour
      let simplified = points;
      if (simplifyTolerance > 0) {
        simplified = douglasPeucker(points, simplifyTolerance);
      }

      // Smooth contour
      if (smoothingIterations > 0) {
        simplified = smoothContour(simplified, smoothingIterations);
      }

      // Calculate bounding box
      const boundingBox = calculateBoundingBox(simplified);

      return {
        points: simplified,
        isHole: area < 0,
        area: Math.abs(area),
        boundingBox
      };
    })
    .filter((c): c is Contour => c !== null)
    .sort((a, b) => b.area - a.area); // Sort by area, largest first

  // Separate outer contour from holes
  const outerContour = processedContours[0];
  const holes = findHoles ? processedContours.slice(1).filter(c => c.isHole) : [];

  return {
    outerContour,
    holes,
    allContours: processedContours
  };
}

/**
 * Convert mask ImageData to binary grid
 * Uses luminance threshold to determine foreground/background
 */
function maskToBinaryGrid(maskData: ImageData): Uint8Array {
  const data = maskData.data;
  const grid = new Uint8Array(maskData.width * maskData.height);
  const threshold = 128;

  for (let i = 0; i < grid.length; i++) {
    const pixelIndex = i * 4;
    // Use red channel (mask should be grayscale)
    const value = data[pixelIndex];
    grid[i] = value >= threshold ? 1 : 0;
  }

  return grid;
}
```

#### 2.2 Marching Squares Algorithm

```typescript
/**
 * Marching squares algorithm for contour tracing
 * Traces the boundary between 0 and 1 in a binary grid
 *
 * Algorithm:
 * 1. Scan grid for boundary pixels (0 adjacent to 1)
 * 2. Start tracing from boundary pixel
 * 3. Follow boundary using lookup table for 16 cases
 * 4. Continue until returning to start point
 *
 * Time Complexity: O(width × height) for scanning + O(perimeter) for tracing
 */
function marchingSquares(
  grid: Uint8Array,
  width: number,
  height: number
): Point[][] {
  const contours: Point[][] = [];
  const visited = new Uint8Array(width * height);

  // Marching squares lookup table
  // Each index represents a 2x2 cell configuration (4 bits)
  // Returns the edge direction to follow
  const moveTable = buildMoveTable();

  // Scan for starting points
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x;

      // Skip if already visited
      if (visited[idx]) continue;

      // Get 2x2 cell value
      const cellValue = getCellValue(grid, width, x, y);

      // Skip if no boundary (all 0 or all 1)
      if (cellValue === 0 || cellValue === 15) continue;

      // Trace contour from this point
      const contour = traceContour(grid, width, height, x, y, visited, moveTable);

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
 *   8  4
 *   1  2
 */
function getCellValue(grid: Uint8Array, width: number, x: number, y: number): number {
  const idx = y * width + x;
  let value = 0;

  if (grid[idx]) value |= 8;                    // Top-left
  if (grid[idx + 1]) value |= 4;                // Top-right
  if (grid[idx + width]) value |= 1;            // Bottom-left
  if (grid[idx + width + 1]) value |= 2;        // Bottom-right

  return value;
}

/**
 * Trace a single contour starting from (x, y)
 */
function traceContour(
  grid: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array,
  moveTable: number[][]
): Point[] {
  const points: Point[] = [];
  let x = startX;
  let y = startY;
  let direction = 0; // 0=right, 1=down, 2=left, 3=up

  const startIdx = y * width + x;

  do {
    // Mark as visited
    visited[y * width + x] = 1;

    // Add point (use cell center for smoother contours)
    points.push({ x: x + 0.5, y: y + 0.5 });

    // Get cell configuration
    const cellValue = getCellValue(grid, width, x, y);

    // Look up next move
    const move = moveTable[cellValue][direction];
    direction = move & 0x03; // New direction
    const action = move >> 2; // Movement action

    // Apply movement
    switch (action) {
      case 0: x += 1; break; // Right
      case 1: y += 1; break; // Down
      case 2: x -= 1; break; // Left
      case 3: y -= 1; break; // Up
    }

    // Check bounds
    if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) {
      break;
    }
  } while (x !== startX || y !== startY);

  return points;
}

/**
 * Build marching squares lookup table
 */
function buildMoveTable(): number[][] {
  // Simplified table - in production, use full 16x4 lookup table
  // Format: [cellValue][currentDirection] = (action << 2) | newDirection
  const table: number[][] = Array(16).fill(null).map(() => Array(4).fill(0));

  // Define moves for each of 16 cases
  // This is a simplified version - full implementation would have all cases

  table[1] = [0, 3, 2, 3];   // ___X
  table[2] = [0, 1, 2, 1];   // __X_
  table[3] = [0, 1, 2, 1];   // __XX
  table[4] = [1, 1, 3, 3];   // _X__
  // ... continue for all 16 cases

  return table;
}
```

#### 2.3 Douglas-Peucker Simplification

```typescript
/**
 * Douglas-Peucker algorithm for polyline simplification
 * Reduces number of points while preserving shape
 *
 * @param points - Contour points
 * @param epsilon - Maximum distance threshold
 * @returns Simplified points
 *
 * Time Complexity: O(n log n) average, O(n²) worst case
 * Space Complexity: O(n) for recursion stack
 */
export function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  // Find point with maximum distance from line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);

    if (distance > maxDistance) {
      maxDistance = distance;
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
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line segment length squared
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line segment is a point
    return distance(point, lineStart);
  }

  // Calculate projection parameter
  const t = Math.max(0, Math.min(1,
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq
  ));

  // Find projection point
  const projection: Point = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  };

  return distance(point, projection);
}

/**
 * Euclidean distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

#### 2.4 Contour Smoothing

```typescript
/**
 * Smooth contour using moving average
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
        y: 0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y
      });
    }

    smoothed = newPoints;
  }

  return smoothed;
}
```

#### 2.5 Utility Functions

```typescript
/**
 * Calculate signed area of polygon using shoelace formula
 * Positive = counter-clockwise, Negative = clockwise
 *
 * Time Complexity: O(n)
 */
export function calculateSignedArea(points: Point[]): number {
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
 * Time Complexity: O(n)
 */
export function calculateBoundingBox(points: Point[]): BoundingBox {
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
    height: maxY - minY
  };
}

/**
 * Check if a point is inside a polygon (ray casting algorithm)
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

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}
```

### Usage Example

```typescript
// Example: Extract and simplify contours from SAM mask
async function processSegmentationMask(maskImageData: ImageData) {
  // Find contours
  const result = findContours(maskImageData, {
    minArea: 200,           // Ignore small noise
    simplifyTolerance: 2.0, // Reduce points while preserving shape
    smoothingIterations: 2, // Smooth edges
    findHoles: true         // Detect inner holes
  });

  console.log('Outer contour points:', result.outerContour.points.length);
  console.log('Holes found:', result.holes.length);
  console.log('Bounding box:', result.outerContour.boundingBox);

  return result;
}
```

### Performance Considerations

1. **Memory Usage**
   - Binary grid: 1 byte per pixel
   - Visited array: 1 byte per pixel
   - Contour storage: ~8 bytes per boundary pixel
   - Total: ~3× grid size + perimeter

2. **Optimization Tips**
   - Downsample mask before contour detection if very large
   - Use higher simplification tolerance for faster processing
   - Skip smoothing if sharp edges are acceptable
   - Process in Web Worker for large images

3. **Complexity Summary**
   - Marching squares: O(w × h)
   - Douglas-Peucker: O(n log n) average
   - Smoothing: O(n × iterations)
   - Total: O(w × h + n log n)

---

## 3. SVG Generation

**File:** `lib/canvas/svgGeneration.ts`

### Purpose

Converts contour points to SVG path syntax with proper scaling, optimizations, and formatting for OpenSCAD compatibility.

### Type Definitions

```typescript
interface SVGGenerationOptions {
  pixelsPerMm: number;     // Scale factor from calibration
  padding?: number;        // Padding in mm
  useBezier?: boolean;     // Use Bezier curves for smoothing
  bezierTension?: number;  // Tension for Bezier curves (0-1)
  decimals?: number;       // Decimal places for coordinates
  flipY?: boolean;         // Flip Y axis (SVG vs image coordinates)
}

interface SVGDocument {
  pathData: string;        // SVG path d attribute
  width: number;           // Width in mm
  height: number;          // Height in mm
  viewBox: string;         // SVG viewBox attribute
  fullSvg: string;         // Complete SVG document
}

interface PathSegment {
  command: 'M' | 'L' | 'C' | 'Q' | 'Z';
  points: number[];
}
```

### Core Functions

#### 3.1 Generate SVG from Contour

```typescript
/**
 * Generate SVG document from contour with proper scaling
 * @param contour - Contour with points in pixel coordinates
 * @param holes - Inner contours (holes)
 * @param options - Generation options
 * @returns Complete SVG document
 *
 * Time Complexity: O(n) where n is total points
 */
export function generateSVG(
  contour: Contour,
  holes: Contour[],
  options: SVGGenerationOptions
): SVGDocument {
  const {
    pixelsPerMm,
    padding = 2,
    useBezier = false,
    bezierTension = 0.5,
    decimals = 3,
    flipY = true
  } = options;

  // Convert pixel coordinates to mm
  const scaledContour = scaleContourToMm(contour, pixelsPerMm);
  const scaledHoles = holes.map(h => scaleContourToMm(h, pixelsPerMm));

  // Calculate dimensions with padding
  const bbox = calculateBoundingBox(scaledContour.points);
  const width = bbox.width + (padding * 2);
  const height = bbox.height + (padding * 2);

  // Translate to apply padding and center
  const offsetX = -bbox.x + padding;
  const offsetY = -bbox.y + padding;

  // Generate path data
  const outerPath = useBezier
    ? contourToBezierPath(scaledContour.points, offsetX, offsetY, flipY, height, decimals, bezierTension)
    : contourToLinePath(scaledContour.points, offsetX, offsetY, flipY, height, decimals);

  // Generate hole paths (with opposite winding)
  const holePaths = scaledHoles.map(hole =>
    useBezier
      ? contourToBezierPath(reverseWinding(hole.points), offsetX, offsetY, flipY, height, decimals, bezierTension)
      : contourToLinePath(reverseWinding(hole.points), offsetX, offsetY, flipY, height, decimals)
  );

  // Combine paths
  const pathData = [outerPath, ...holePaths].join(' ');

  // Create viewBox
  const viewBox = `0 0 ${round(width, decimals)} ${round(height, decimals)}`;

  // Generate complete SVG document
  const fullSvg = createSVGDocument(pathData, width, height, viewBox);

  return {
    pathData,
    width,
    height,
    viewBox,
    fullSvg
  };
}

/**
 * Scale contour from pixels to millimeters
 */
function scaleContourToMm(contour: Contour, pixelsPerMm: number): Contour {
  return {
    ...contour,
    points: contour.points.map(p => ({
      x: p.x / pixelsPerMm,
      y: p.y / pixelsPerMm
    }))
  };
}
```

#### 3.2 Linear Path Generation

```typescript
/**
 * Convert contour points to SVG path using lines
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
  decimals: number
): string {
  if (points.length === 0) return '';

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
  path.push('Z');

  return path.join(' ');
}

/**
 * Transform point coordinates
 */
function transformPoint(
  point: Point,
  offsetX: number,
  offsetY: number,
  flipY: boolean,
  height: number
): Point {
  return {
    x: point.x + offsetX,
    y: flipY ? (height - (point.y + offsetY)) : (point.y + offsetY)
  };
}
```

#### 3.3 Bezier Curve Path Generation

```typescript
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
  tension: number = 0.5
): string {
  if (points.length < 3) {
    return contourToLinePath(points, offsetX, offsetY, flipY, height, decimals);
  }

  const path: string[] = [];
  const n = points.length;

  // Move to first point
  const first = transformPoint(points[0], offsetX, offsetY, flipY, height);
  path.push(`M ${round(first.x, decimals)} ${round(first.y, decimals)}`);

  // Generate cubic Bezier curves
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
      `${round(tp2.x, decimals)} ${round(tp2.y, decimals)}`
    );
  }

  // No Z command needed as we've looped back to start

  return path.join(' ');
}

/**
 * Calculate Catmull-Rom control point
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
  isFirst: boolean
): Point {
  const t = tension / 6;

  if (isFirst) {
    return {
      x: p1.x + (p2.x - p0.x) * t,
      y: p1.y + (p2.y - p0.y) * t
    };
  } else {
    return {
      x: p2.x - (p2.x - p0.x) * t,
      y: p2.y - (p2.y - p0.y) * t
    };
  }
}
```

#### 3.4 SVG Document Creation

```typescript
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
  viewBox: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     version="1.1"
     width="${width}mm"
     height="${height}mm"
     viewBox="${viewBox}">
  <path d="${pathData}"
        fill="black"
        stroke="none"/>
</svg>`;
}

/**
 * Export SVG as downloadable file
 */
export function downloadSVG(svg: string, filename: string = 'cutout.svg'): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
```

#### 3.5 Path Optimization

```typescript
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
export function optimizePath(pathData: string, tolerance: number = 0.1): string {
  // Parse path commands
  const commands = parsePathData(pathData);

  // Filter out collinear points
  const optimized: PathSegment[] = [];

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    if (cmd.command === 'M' || cmd.command === 'Z') {
      optimized.push(cmd);
      continue;
    }

    // Check if point is collinear with previous and next
    if (i > 0 && i < commands.length - 1) {
      const prev = commands[i - 1];
      const next = commands[i + 1];

      if (isCollinear(prev.points, cmd.points, next.points, tolerance)) {
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
function isCollinear(p1: number[], p2: number[], p3: number[], tolerance: number): boolean {
  if (p1.length < 2 || p2.length < 2 || p3.length < 2) return false;

  // Calculate cross product
  const dx1 = p2[0] - p1[0];
  const dy1 = p2[1] - p1[1];
  const dx2 = p3[0] - p2[0];
  const dy2 = p3[1] - p2[1];

  const cross = Math.abs(dx1 * dy2 - dy1 * dx2);

  return cross < tolerance;
}

/**
 * Parse SVG path data into commands
 */
function parsePathData(pathData: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const regex = /([MLCQZ])\s*([-\d.,\s]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(pathData)) !== null) {
    const command = match[1] as PathSegment['command'];
    const numbers = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter(s => s.length > 0)
      .map(Number);

    segments.push({ command, points: numbers });
  }

  return segments;
}

/**
 * Convert path segments back to string
 */
function pathSegmentsToString(segments: PathSegment[]): string {
  return segments.map(seg => {
    if (seg.command === 'Z') {
      return 'Z';
    }
    return `${seg.command} ${seg.points.join(' ')}`;
  }).join(' ');
}
```

#### 3.6 Utility Functions

```typescript
/**
 * Round number to specified decimal places
 */
export function round(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
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
  const validCommands = /^[MLHVCSQTAZ\s\d.,-]+$/i;
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
```

### Usage Example

```typescript
// Example: Generate SVG from contour with calibration
async function generateScaledSVG(
  contourResult: ContourResult,
  pixelsPerMm: number
) {
  const svg = generateSVG(
    contourResult.outerContour,
    contourResult.holes,
    {
      pixelsPerMm: pixelsPerMm,
      padding: 3,              // 3mm padding
      useBezier: true,         // Smooth curves
      bezierTension: 0.4,      // Moderate smoothing
      decimals: 2,             // 0.01mm precision
      flipY: true              // SVG Y-axis convention
    }
  );

  console.log('SVG Dimensions:', svg.width, 'mm x', svg.height, 'mm');
  console.log('Path length:', svg.pathData.length, 'characters');

  // Download SVG file
  downloadSVG(svg.fullSvg, 'gridfinity-cutout.svg');

  return svg;
}
```

### Performance Considerations

1. **Memory Usage**
   - Path string: ~20-50 bytes per point
   - Bezier curves: 3× more data than lines
   - Full SVG document: ~500 bytes overhead

2. **Optimization Tips**
   - Use appropriate decimal precision (2-3 decimals sufficient)
   - Simplify contours before SVG generation
   - Use line paths for angular objects
   - Use Bezier curves for organic shapes
   - Remove collinear points

3. **OpenSCAD Compatibility**
   - Always use millimeter units
   - Avoid transforms (apply during generation)
   - Use black fill, no stroke
   - Keep paths simple (< 1000 points)
   - Test import in OpenSCAD before 3D generation

---

## 4. Ruler/Scale Detection

**File:** `lib/calibration/rulerDetection.ts`

### Purpose

Optional automated detection of rulers, reference objects, or calibration markers in images to simplify the scaling process.

### Type Definitions

```typescript
interface RulerDetectionOptions {
  minLineLength?: number;    // Minimum line length in pixels
  maxLineGap?: number;       // Max gap in line detection
  angleThreshold?: number;   // Tolerance for horizontal/vertical in degrees
  tickSpacing?: number[];    // Expected tick spacings in pixels
  enableCoinDetection?: boolean;
  enableCardDetection?: boolean;
}

interface DetectedLine {
  start: Point;
  end: Point;
  length: number;
  angle: number; // In radians
  confidence: number; // 0-1
}

interface DetectedRuler {
  edges: [DetectedLine, DetectedLine]; // Parallel edges
  ticks: Point[];                      // Detected tick marks
  orientation: 'horizontal' | 'vertical';
  estimatedUnit: 'mm' | 'cm' | 'inch' | 'unknown';
  confidence: number;
}

interface ReferenceObject {
  type: 'coin' | 'card' | 'ruler';
  boundingBox: BoundingBox;
  knownSize: number; // in mm
  confidence: number;
}
```

### Core Functions

#### 4.1 Detect Lines (Simplified Hough Transform)

```typescript
/**
 * Detect lines in image using edge detection
 * Simplified Hough transform for browser performance
 *
 * @param imageData - Grayscale image data
 * @param options - Detection options
 * @returns Detected lines
 *
 * Time Complexity: O(width × height)
 * Note: Full Hough transform is O(w × h × r × θ) - very expensive
 * This uses edge-based simplification
 */
export function detectLines(
  imageData: ImageData,
  options: RulerDetectionOptions = {}
): DetectedLine[] {
  const {
    minLineLength = 100,
    maxLineGap = 10,
    angleThreshold = 5
  } = options;

  // Convert to grayscale if needed
  const grayData = toGrayscale(imageData);

  // Apply Sobel edge detection
  const edges = sobelEdgeDetection(grayData);

  // Find connected edge components
  const edgeChains = traceEdgeChains(edges, maxLineGap);

  // Filter and classify chains as lines
  const lines: DetectedLine[] = [];

  for (const chain of edgeChains) {
    if (chain.length < minLineLength) continue;

    // Fit line to points using least squares
    const line = fitLine(chain);

    if (line.length >= minLineLength) {
      lines.push({
        ...line,
        confidence: calculateLineConfidence(chain, line)
      });
    }
  }

  return lines.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Convert ImageData to grayscale
 */
function toGrayscale(imageData: ImageData): Uint8Array {
  const data = imageData.data;
  const gray = new Uint8Array(imageData.width * imageData.height);

  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    // Luminance formula
    gray[i] = Math.round(
      0.299 * data[idx] +     // R
      0.587 * data[idx + 1] + // G
      0.114 * data[idx + 2]   // B
    );
  }

  return gray;
}
```

#### 4.2 Sobel Edge Detection

```typescript
/**
 * Sobel edge detection for finding boundaries
 *
 * Sobel kernels:
 * Gx = [-1  0  1]    Gy = [-1 -2 -1]
 *      [-2  0  2]         [ 0  0  0]
 *      [-1  0  1]         [ 1  2  1]
 *
 * @param grayData - Grayscale pixel array
 * @param width - Image width
 * @param height - Image height
 * @returns Edge magnitude array
 *
 * Time Complexity: O(width × height)
 */
function sobelEdgeDetection(grayData: Uint8Array): Uint8Array {
  const width = Math.sqrt(grayData.length); // Assuming square for simplicity
  const height = width;
  const edges = new Uint8Array(grayData.length);

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      // Apply kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          const pixel = grayData[idx];

          gx += pixel * sobelX[kernelIdx];
          gy += pixel * sobelY[kernelIdx];
        }
      }

      // Calculate magnitude
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }

  return edges;
}
```

#### 4.3 Ruler Detection

```typescript
/**
 * Detect ruler in image by finding parallel lines with tick marks
 *
 * @param imageData - Source image
 * @param options - Detection options
 * @returns Detected ruler or null
 *
 * Time Complexity: O(n²) where n is number of detected lines
 */
export function detectRuler(
  imageData: ImageData,
  options: RulerDetectionOptions = {}
): DetectedRuler | null {
  // Detect all lines
  const lines = detectLines(imageData, options);

  if (lines.length < 2) return null;

  // Find parallel line pairs (ruler edges)
  const parallelPairs = findParallelPairs(lines, 5); // 5 degree tolerance

  if (parallelPairs.length === 0) return null;

  // For each pair, check for tick marks between them
  for (const [line1, line2] of parallelPairs) {
    const ticks = detectTickMarks(imageData, line1, line2);

    if (ticks.length >= 3) {
      // Found ruler!
      const orientation = Math.abs(line1.angle) < Math.PI / 4
        ? 'horizontal'
        : 'vertical';

      // Estimate unit from tick spacing
      const spacing = estimateTickSpacing(ticks);
      const estimatedUnit = estimateUnit(spacing);

      return {
        edges: [line1, line2],
        ticks,
        orientation,
        estimatedUnit,
        confidence: (line1.confidence + line2.confidence) / 2
      };
    }
  }

  return null;
}

/**
 * Find pairs of parallel lines
 */
function findParallelPairs(
  lines: DetectedLine[],
  angleTolerance: number
): [DetectedLine, DetectedLine][] {
  const pairs: [DetectedLine, DetectedLine][] = [];
  const toleranceRad = (angleTolerance * Math.PI) / 180;

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const angleDiff = Math.abs(lines[i].angle - lines[j].angle);

      // Check if parallel (same angle)
      if (angleDiff < toleranceRad || Math.abs(angleDiff - Math.PI) < toleranceRad) {
        pairs.push([lines[i], lines[j]]);
      }
    }
  }

  return pairs;
}

/**
 * Detect tick marks between two parallel lines
 */
function detectTickMarks(
  imageData: ImageData,
  edge1: DetectedLine,
  edge2: DetectedLine
): Point[] {
  // This is a simplified version
  // Full implementation would use perpendicular line detection
  // between the two edges

  const ticks: Point[] = [];

  // TODO: Implement tick detection algorithm
  // 1. Find region between edges
  // 2. Detect short perpendicular lines
  // 3. Filter by regular spacing

  return ticks;
}

/**
 * Estimate measurement unit from tick spacing
 */
function estimateUnit(spacing: number): 'mm' | 'cm' | 'inch' | 'unknown' {
  // Common pixel spacings at typical photo resolutions
  // This is very approximate and depends on camera distance

  if (spacing < 10) return 'mm';
  if (spacing < 50) return 'cm';
  if (spacing < 100) return 'inch';

  return 'unknown';
}

/**
 * Calculate average spacing between tick marks
 */
function estimateTickSpacing(ticks: Point[]): number {
  if (ticks.length < 2) return 0;

  const spacings: number[] = [];

  for (let i = 1; i < ticks.length; i++) {
    spacings.push(distance(ticks[i - 1], ticks[i]));
  }

  // Return median spacing (more robust than mean)
  spacings.sort((a, b) => a - b);
  return spacings[Math.floor(spacings.length / 2)];
}
```

#### 4.4 Reference Object Detection

```typescript
/**
 * Detect common reference objects (coins, credit cards)
 * Uses simple shape and size heuristics
 *
 * @param imageData - Source image
 * @param options - Detection options
 * @returns Detected reference objects
 */
export function detectReferenceObjects(
  imageData: ImageData,
  options: RulerDetectionOptions = {}
): ReferenceObject[] {
  const objects: ReferenceObject[] = [];

  // Detect circular objects (coins)
  if (options.enableCoinDetection) {
    const coins = detectCircles(imageData);

    for (const circle of coins) {
      // US Quarter: 24.26mm diameter
      // US Penny: 19.05mm diameter
      // Detect based on relative size

      objects.push({
        type: 'coin',
        boundingBox: {
          x: circle.center.x - circle.radius,
          y: circle.center.y - circle.radius,
          width: circle.radius * 2,
          height: circle.radius * 2
        },
        knownSize: 24.26, // Assume quarter
        confidence: circle.confidence
      });
    }
  }

  // Detect rectangular objects (credit cards)
  if (options.enableCardDetection) {
    const rectangles = detectRectangles(imageData);

    for (const rect of rectangles) {
      const aspectRatio = rect.width / rect.height;

      // Credit card: 85.6mm × 53.98mm (ratio ≈ 1.586)
      if (Math.abs(aspectRatio - 1.586) < 0.1) {
        objects.push({
          type: 'card',
          boundingBox: rect,
          knownSize: 85.6, // Width in mm
          confidence: 0.7 // Lower confidence for rectangles
        });
      }
    }
  }

  return objects.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detect circles using Hough Circle Transform (simplified)
 */
function detectCircles(imageData: ImageData): Array<{
  center: Point;
  radius: number;
  confidence: number;
}> {
  // Placeholder - full implementation would use Hough Circle Transform
  // This is computationally expensive in JavaScript
  return [];
}

/**
 * Detect rectangles in image
 */
function detectRectangles(imageData: ImageData): BoundingBox[] {
  // Placeholder - would use contour detection + shape fitting
  return [];
}
```

### Usage Example

```typescript
// Example: Auto-detect ruler for calibration
async function autoDetectScale(imageData: ImageData) {
  // Try ruler detection first
  const ruler = detectRuler(imageData, {
    minLineLength: 200,
    maxLineGap: 20,
    angleThreshold: 5
  });

  if (ruler && ruler.confidence > 0.7) {
    console.log('Detected ruler:', ruler.orientation);
    console.log('Estimated unit:', ruler.estimatedUnit);
    return ruler;
  }

  // Fallback to reference object detection
  const objects = detectReferenceObjects(imageData, {
    enableCoinDetection: true,
    enableCardDetection: true
  });

  if (objects.length > 0) {
    console.log('Detected reference:', objects[0].type);
    console.log('Known size:', objects[0].knownSize, 'mm');
    return objects[0];
  }

  // No automatic detection, user must manually calibrate
  return null;
}
```

### Performance Considerations

1. **Computational Complexity**
   - Edge detection: O(w × h)
   - Line detection: O(w × h + n²) where n is edges
   - Full Hough transform: O(w × h × r × θ) - very expensive
   - This implementation uses simplified algorithms

2. **Optimization Tips**
   - Downsample image before detection (2-4×)
   - Process in Web Worker to avoid blocking UI
   - Cache detection results
   - Use user hints to limit search region

3. **Reliability**
   - Auto-detection is a convenience feature
   - Always provide manual calibration option
   - Validate detected measurements
   - Show confidence scores to user

---

## 5. Scale Calculation

**File:** `lib/calibration/scaleCalculation.ts`

### Purpose

Calculate the pixel-to-millimeter conversion factor from user-provided or auto-detected reference measurements.

### Type Definitions

```typescript
interface CalibrationPoints {
  point1: Point;
  point2: Point;
  knownDistance: number; // in mm
  unit: 'mm' | 'cm' | 'inch';
}

interface ScaleResult {
  pixelsPerMm: number;
  confidence: number;
  errorBound: number; // Estimated error in mm
  dpi: number; // Effective DPI
  method: 'manual' | 'ruler' | 'reference-object';
}

interface ScaleValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

### Core Functions

#### 5.1 Calculate Scale from Two Points

```typescript
/**
 * Calculate pixels per millimeter from two calibration points
 *
 * @param calibration - Two points with known real-world distance
 * @returns Scale calculation result
 *
 * Time Complexity: O(1)
 */
export function calculateScale(calibration: CalibrationPoints): ScaleResult {
  const { point1, point2, knownDistance, unit } = calibration;

  // Convert known distance to mm
  const distanceMm = convertToMm(knownDistance, unit);

  // Calculate pixel distance
  const pixelDistance = distance(point1, point2);

  // Calculate scale (pixels per mm)
  const pixelsPerMm = pixelDistance / distanceMm;

  // Calculate effective DPI (dots per inch)
  // 1 inch = 25.4 mm
  const dpi = pixelsPerMm * 25.4;

  // Estimate confidence based on distance
  // Longer calibration distances are more accurate
  const confidence = calculateConfidence(pixelDistance, distanceMm);

  // Estimate error bound
  // Assumes ±1 pixel error in point placement
  const errorBound = 1 / pixelsPerMm;

  return {
    pixelsPerMm,
    confidence,
    errorBound,
    dpi,
    method: 'manual'
  };
}

/**
 * Convert measurement to millimeters
 */
function convertToMm(value: number, unit: 'mm' | 'cm' | 'inch'): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'inch':
      return value * 25.4;
  }
}

/**
 * Calculate confidence score based on measurement quality
 * Longer measurements are more accurate
 */
function calculateConfidence(pixelDistance: number, realDistance: number): number {
  // Ideal: > 500 pixels for a 10cm measurement
  const idealRatio = 50; // pixels per mm
  const actualRatio = pixelDistance / realDistance;

  // Confidence drops if measurement is too short (low resolution)
  if (actualRatio < 10) return 0.3; // < 10 pixels/mm: low confidence
  if (actualRatio < 20) return 0.6; // 10-20 pixels/mm: medium confidence
  if (actualRatio < 40) return 0.8; // 20-40 pixels/mm: good confidence

  return 0.95; // > 40 pixels/mm: excellent confidence
}
```

#### 5.2 Validate Scale Calculation

```typescript
/**
 * Validate scale calculation for reasonableness
 * Checks for common errors and unrealistic values
 *
 * @param scale - Scale calculation result
 * @param imageSize - Original image dimensions
 * @returns Validation result with errors/warnings
 */
export function validateScale(
  scale: ScaleResult,
  imageSize: ImageDimensions
): ScaleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for invalid values
  if (!isFinite(scale.pixelsPerMm) || scale.pixelsPerMm <= 0) {
    errors.push('Invalid scale calculation: pixels per mm must be positive');
  }

  // Check for unreasonably small scale (object too large)
  // Typical phone camera: 10-100 pixels/mm at reasonable distance
  if (scale.pixelsPerMm < 1) {
    errors.push(
      `Scale too small (${scale.pixelsPerMm.toFixed(2)} px/mm). ` +
      'Object may be too large or distance incorrect.'
    );
  }

  // Check for unreasonably large scale (object too small or too close)
  if (scale.pixelsPerMm > 200) {
    errors.push(
      `Scale too large (${scale.pixelsPerMm.toFixed(2)} px/mm). ` +
      'Object may be too small or too close to camera.'
    );
  }

  // Warn if DPI is unusual
  if (scale.dpi < 72) {
    warnings.push(
      `Low effective DPI (${scale.dpi.toFixed(0)}). ` +
      'Consider taking photo from closer distance.'
    );
  }

  if (scale.dpi > 600) {
    warnings.push(
      `Very high DPI (${scale.dpi.toFixed(0)}). ` +
      'Verify calibration measurements are correct.'
    );
  }

  // Warn if confidence is low
  if (scale.confidence < 0.5) {
    warnings.push(
      'Low confidence in scale calculation. ' +
      'Use longer reference distance for better accuracy.'
    );
  }

  // Check if calculated object size is reasonable for Gridfinity
  // Gridfinity base unit: 42mm × 42mm
  const estimatedWidthMm = imageSize.width / scale.pixelsPerMm;
  const estimatedHeightMm = imageSize.height / scale.pixelsPerMm;

  if (estimatedWidthMm > 500 || estimatedHeightMm > 500) {
    warnings.push(
      `Calculated image size (${estimatedWidthMm.toFixed(0)}mm × ${estimatedHeightMm.toFixed(0)}mm) ` +
      'is very large. Verify scale is correct.'
    );
  }

  if (estimatedWidthMm < 10 || estimatedHeightMm < 10) {
    warnings.push(
      `Calculated image size (${estimatedWidthMm.toFixed(0)}mm × ${estimatedHeightMm.toFixed(0)}mm) ` +
      'is very small. Verify scale is correct.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

#### 5.3 Multi-Point Calibration

```typescript
/**
 * Calculate scale from multiple calibration measurements
 * Uses least-squares fitting for better accuracy
 *
 * @param calibrations - Array of calibration point pairs
 * @returns Averaged scale result
 *
 * Time Complexity: O(n) where n is number of calibrations
 */
export function calculateMultiPointScale(
  calibrations: CalibrationPoints[]
): ScaleResult {
  if (calibrations.length === 0) {
    throw new Error('At least one calibration required');
  }

  if (calibrations.length === 1) {
    return calculateScale(calibrations[0]);
  }

  // Calculate scale for each calibration
  const scales = calibrations.map(calculateScale);

  // Calculate weighted average (weight by confidence)
  const totalWeight = scales.reduce((sum, s) => sum + s.confidence, 0);

  const avgPixelsPerMm = scales.reduce(
    (sum, s) => sum + s.pixelsPerMm * s.confidence,
    0
  ) / totalWeight;

  const avgDpi = avgPixelsPerMm * 25.4;

  // Calculate standard deviation for error estimate
  const variance = scales.reduce(
    (sum, s) => sum + Math.pow(s.pixelsPerMm - avgPixelsPerMm, 2) * s.confidence,
    0
  ) / totalWeight;

  const stdDev = Math.sqrt(variance);
  const errorBound = stdDev / avgPixelsPerMm; // Relative error in mm

  // Higher confidence with multiple measurements
  const avgConfidence = Math.min(
    0.98,
    scales.reduce((sum, s) => sum + s.confidence, 0) / scales.length + 0.1
  );

  return {
    pixelsPerMm: avgPixelsPerMm,
    confidence: avgConfidence,
    errorBound,
    dpi: avgDpi,
    method: 'manual'
  };
}
```

#### 5.4 Scale from Ruler Detection

```typescript
/**
 * Calculate scale from detected ruler
 *
 * @param ruler - Detected ruler information
 * @returns Scale calculation
 */
export function scaleFromRuler(ruler: DetectedRuler): ScaleResult {
  if (ruler.ticks.length < 2) {
    throw new Error('Insufficient tick marks detected');
  }

  // Calculate average spacing between ticks
  const spacings: number[] = [];

  for (let i = 1; i < ruler.ticks.length; i++) {
    spacings.push(distance(ruler.ticks[i - 1], ruler.ticks[i]));
  }

  const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;

  // Determine real-world spacing based on estimated unit
  let realSpacing: number;

  switch (ruler.estimatedUnit) {
    case 'mm':
      realSpacing = 1;
      break;
    case 'cm':
      realSpacing = 10;
      break;
    case 'inch':
      realSpacing = 25.4; // 1 inch in mm
      break;
    default:
      throw new Error('Unknown ruler unit');
  }

  const pixelsPerMm = avgSpacing / realSpacing;
  const dpi = pixelsPerMm * 25.4;

  // Error bound from spacing variance
  const spacingVariance = spacings.reduce(
    (sum, s) => sum + Math.pow(s - avgSpacing, 2),
    0
  ) / spacings.length;

  const errorBound = Math.sqrt(spacingVariance) / pixelsPerMm;

  return {
    pixelsPerMm,
    confidence: ruler.confidence,
    errorBound,
    dpi,
    method: 'ruler'
  };
}
```

#### 5.5 Scale from Reference Object

```typescript
/**
 * Calculate scale from detected reference object
 *
 * @param object - Detected reference object (coin, card, etc.)
 * @returns Scale calculation
 */
export function scaleFromReferenceObject(object: ReferenceObject): ScaleResult {
  let pixelSize: number;

  switch (object.type) {
    case 'coin':
      // Use bounding box width (diameter)
      pixelSize = object.boundingBox.width;
      break;
    case 'card':
      // Use bounding box width
      pixelSize = object.boundingBox.width;
      break;
    case 'ruler':
      // Use bounding box length
      pixelSize = Math.max(object.boundingBox.width, object.boundingBox.height);
      break;
  }

  const pixelsPerMm = pixelSize / object.knownSize;
  const dpi = pixelsPerMm * 25.4;

  // Reference objects typically less accurate than ruler measurements
  const confidence = Math.min(0.75, object.confidence);

  // Assume ±2% error in object detection
  const errorBound = object.knownSize * 0.02;

  return {
    pixelsPerMm,
    confidence,
    errorBound,
    dpi,
    method: 'reference-object'
  };
}
```

### Usage Example

```typescript
// Example: Manual calibration workflow
async function calibrateFromUserPoints(
  point1: Point,
  point2: Point,
  userInput: { distance: number; unit: 'mm' | 'cm' | 'inch' },
  imageSize: ImageDimensions
) {
  // Calculate scale
  const scale = calculateScale({
    point1,
    point2,
    knownDistance: userInput.distance,
    unit: userInput.unit
  });

  // Validate
  const validation = validateScale(scale, imageSize);

  if (!validation.isValid) {
    console.error('Calibration errors:', validation.errors);
    throw new Error('Invalid calibration');
  }

  if (validation.warnings.length > 0) {
    console.warn('Calibration warnings:', validation.warnings);
  }

  console.log('Scale:', scale.pixelsPerMm, 'pixels/mm');
  console.log('DPI:', scale.dpi);
  console.log('Confidence:', (scale.confidence * 100).toFixed(0), '%');
  console.log('Error bound: ±', scale.errorBound.toFixed(2), 'mm');

  return scale;
}

// Example: Automatic calibration
async function autoCalibrate(imageData: ImageData, imageSize: ImageDimensions) {
  // Try ruler detection
  const ruler = detectRuler(imageData);

  if (ruler && ruler.confidence > 0.7) {
    const scale = scaleFromRuler(ruler);
    const validation = validateScale(scale, imageSize);

    if (validation.isValid) {
      return scale;
    }
  }

  // Try reference object detection
  const objects = detectReferenceObjects(imageData, {
    enableCoinDetection: true,
    enableCardDetection: true
  });

  if (objects.length > 0) {
    const scale = scaleFromReferenceObject(objects[0]);
    const validation = validateScale(scale, imageSize);

    if (validation.isValid) {
      return scale;
    }
  }

  // Fallback to manual calibration
  throw new Error('Automatic calibration failed, manual calibration required');
}
```

### Performance Considerations

1. **Numerical Precision**
   - Use double precision (64-bit) floats
   - Round results appropriately (2-3 decimals)
   - Avoid division by very small numbers
   - Handle edge cases (zero distance, etc.)

2. **Error Propagation**
   - ±1 pixel error in point placement
   - ±0.5mm error in ruler reading
   - Compounded in final SVG scaling
   - Longer calibration distances reduce relative error

3. **Validation**
   - Always validate scale before using
   - Check for reasonable DPI (50-300 typical)
   - Verify calculated object sizes make sense
   - Provide user feedback on calibration quality

4. **Complexity**
   - Single point: O(1)
   - Multi-point: O(n)
   - All calculations are fast (<1ms)

---

## Performance Considerations

### Memory Management

**Image Processing Memory Usage:**
- Original image: `width × height × 4 bytes` (RGBA)
- Grayscale conversion: `width × height × 1 byte`
- Edge detection: `width × height × 1 byte`
- Contour storage: `~perimeter × 16 bytes` (Point objects)
- SVG string: `~perimeter × 20-50 bytes`

**Example for 2048×2048 image:**
- ImageData: ~16 MB
- Processing buffers: ~4 MB
- Total peak: ~20 MB (reasonable for modern browsers)

**Optimization Tips:**
1. Set max image dimensions (1920-2048)
2. Dispose of canvases when done
3. Use typed arrays (Uint8Array) instead of regular arrays
4. Clear ImageData when no longer needed
5. Process in chunks for very large images

### Web Worker Considerations

Heavy processing should run in Web Workers:

```typescript
// Example: Contour detection in worker
// main.ts
const worker = new Worker('contour-worker.ts');

worker.postMessage({
  type: 'findContours',
  maskData: maskImageData,
  options: { simplifyTolerance: 2.0 }
});

worker.onmessage = (e) => {
  const result = e.data;
  // Use contours in main thread
};

// contour-worker.ts
self.onmessage = (e) => {
  const { type, maskData, options } = e.data;

  if (type === 'findContours') {
    const result = findContours(maskData, options);
    self.postMessage(result);
  }
};
```

**Best Candidates for Web Workers:**
- Edge detection (Sobel)
- Contour tracing (marching squares)
- Douglas-Peucker simplification
- Ruler/line detection

### Browser-Specific Optimizations

**Chrome/Edge:**
- Excellent Canvas performance
- Good support for OffscreenCanvas
- Use `willReadFrequently: true` for frequent getImageData calls

**Firefox:**
- Slightly slower Canvas operations
- Good typed array performance
- May need lower max dimensions (1024-1536)

**Safari:**
- Good Canvas performance on Apple Silicon
- Stricter memory limits on iOS
- Test on actual devices for mobile

**Compatibility Table:**

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Canvas 2D | ✅ | ✅ | ✅ | ✅ |
| ImageData | ✅ | ✅ | ✅ | ✅ |
| OffscreenCanvas | ✅ | ✅ | ⚠️ Partial | ✅ |
| Web Workers | ✅ | ✅ | ✅ | ✅ |
| FileReader API | ✅ | ✅ | ✅ | ✅ |
| EXIF reading | ✅ | ✅ | ✅ | ✅ |

---

## Browser Compatibility

### Minimum Requirements

- **Chrome/Edge**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Mobile**: iOS 14+, Android Chrome 90+

### Polyfills & Fallbacks

Not typically needed for this application as all features are well-supported. However:

```typescript
// Check for required APIs
function checkBrowserSupport(): { supported: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!window.FileReader) missing.push('FileReader');
  if (!document.createElement('canvas').getContext('2d')) missing.push('Canvas 2D');
  if (typeof Worker === 'undefined') missing.push('Web Workers');
  if (!window.URL || !window.URL.createObjectURL) missing.push('URL API');

  return {
    supported: missing.length === 0,
    missing
  };
}

// Usage
const support = checkBrowserSupport();
if (!support.supported) {
  alert(`Browser missing required features: ${support.missing.join(', ')}`);
}
```

### Mobile Considerations

1. **Memory Limits**
   - iOS Safari: ~1.5 GB per tab
   - Android Chrome: Varies by device
   - Always set reasonable max dimensions

2. **Touch Events**
   - Use pointer events for calibration points
   - Provide larger touch targets (44×44px minimum)

3. **Performance**
   - Process images at lower resolution on mobile
   - Show loading indicators for operations > 500ms
   - Consider skipping expensive smoothing on low-end devices

---

## Testing & Validation

### Test Images

Create test suite with:
1. **Ruler images**: Various rulers (metric/imperial)
2. **Reference objects**: Coins, cards at different angles
3. **Complex shapes**: Objects with holes, multiple contours
4. **Edge cases**: Very small objects, very large images
5. **Poor quality**: Blurry, low contrast, angled shots

### Validation Metrics

```typescript
interface ProcessingMetrics {
  loadTime: number;        // Image loading (ms)
  segmentTime: number;     // SAM segmentation (ms)
  contourTime: number;     // Contour detection (ms)
  svgTime: number;         // SVG generation (ms)
  totalTime: number;       // End-to-end (ms)

  contourPoints: number;   // Original points
  simplifiedPoints: number; // After simplification
  svgSize: number;         // SVG file size (bytes)

  memoryUsed: number;      // Peak memory (MB)
}

function benchmarkProcessing(/* ... */): ProcessingMetrics {
  // Implement timing and memory tracking
}
```

### Expected Performance

| Operation | Time (ms) | Notes |
|-----------|-----------|-------|
| Load 2MP image | 50-200 | Depends on file size |
| EXIF parsing | 10-50 | Small overhead |
| Edge detection | 100-300 | 2048×2048 image |
| Marching squares | 50-150 | Depends on perimeter |
| Douglas-Peucker | 10-50 | 500-1000 points |
| SVG generation | 5-20 | Mostly string ops |
| **Total** | **300-800** | Excluding SAM |

---

## Implementation Checklist

### Phase 1: Core Image Loading
- [ ] Implement `loadImageFromFile`
- [ ] Add EXIF orientation correction
- [ ] Test with various image formats
- [ ] Add dimension constraints
- [ ] Memory management utilities

### Phase 2: Contour Detection
- [ ] Binary mask conversion
- [ ] Marching squares algorithm
- [ ] Douglas-Peucker simplification
- [ ] Contour smoothing
- [ ] Hole detection

### Phase 3: SVG Generation
- [ ] Linear path generation
- [ ] Bezier curve fitting
- [ ] Scale factor application
- [ ] SVG document creation
- [ ] Path optimization

### Phase 4: Calibration
- [ ] Two-point scale calculation
- [ ] Scale validation
- [ ] Multi-point averaging
- [ ] UI for point selection
- [ ] Visual feedback

### Phase 5: Auto-Detection (Optional)
- [ ] Edge detection (Sobel)
- [ ] Line detection
- [ ] Ruler detection
- [ ] Reference object detection
- [ ] Confidence scoring

### Phase 6: Testing & Optimization
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Performance benchmarks
- [ ] Error handling
- [ ] User documentation

---

## References

### Algorithms
- **Marching Squares**: https://en.wikipedia.org/wiki/Marching_squares
- **Douglas-Peucker**: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
- **Sobel Operator**: https://en.wikipedia.org/wiki/Sobel_operator
- **Catmull-Rom Splines**: https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline

### Web APIs
- **Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **ImageData**: https://developer.mozilla.org/en-US/docs/Web/API/ImageData
- **FileReader**: https://developer.mozilla.org/en-US/docs/Web/API/FileReader
- **Web Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

### SVG Specification
- **SVG Paths**: https://www.w3.org/TR/SVG/paths.html
- **SVG Units**: https://oreillymedia.github.io/Using_SVG/guide/units.html
- **OpenSCAD SVG Import**: https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/SVG_Import

---

## Appendix: Complete Example Workflow

```typescript
// Complete example: Image to SVG pipeline
import {
  loadImageFromFile,
  findContours,
  generateSVG,
  calculateScale,
  validateScale
} from './lib/canvas';

async function completeImageProcessingWorkflow(
  imageFile: File,
  maskImageData: ImageData, // From SAM
  calibrationPoints: { p1: Point; p2: Point; distance: number }
) {
  // Step 1: Load and preprocess image
  console.log('Loading image...');
  const processed = await loadImageFromFile(imageFile, {
    maxWidth: 2048,
    maxHeight: 2048,
    correctOrientation: true
  });

  console.log(`Loaded: ${processed.metadata.displayWidth}×${processed.metadata.displayHeight}`);

  // Step 2: Calculate scale
  console.log('Calculating scale...');
  const scale = calculateScale({
    point1: calibrationPoints.p1,
    point2: calibrationPoints.p2,
    knownDistance: calibrationPoints.distance,
    unit: 'mm'
  });

  const validation = validateScale(scale, {
    width: processed.metadata.displayWidth,
    height: processed.metadata.displayHeight
  });

  if (!validation.isValid) {
    throw new Error(`Invalid scale: ${validation.errors.join(', ')}`);
  }

  console.log(`Scale: ${scale.pixelsPerMm.toFixed(2)} px/mm (${scale.dpi.toFixed(0)} DPI)`);

  // Step 3: Extract contours from mask
  console.log('Detecting contours...');
  const contours = findContours(maskImageData, {
    minArea: 200,
    simplifyTolerance: 1.5,
    smoothingIterations: 2,
    findHoles: true
  });

  console.log(`Found: ${contours.outerContour.points.length} points, ${contours.holes.length} holes`);

  // Step 4: Generate SVG
  console.log('Generating SVG...');
  const svg = generateSVG(contours.outerContour, contours.holes, {
    pixelsPerMm: scale.pixelsPerMm,
    padding: 3,
    useBezier: true,
    bezierTension: 0.4,
    decimals: 2
  });

  console.log(`SVG: ${svg.width.toFixed(1)}mm × ${svg.height.toFixed(1)}mm`);
  console.log(`Path length: ${svg.pathData.length} characters`);

  // Step 5: Download SVG
  downloadSVG(svg.fullSvg, 'gridfinity-cutout.svg');

  return {
    svg,
    scale,
    contours,
    processed
  };
}
```

---

**End of Image Processing Documentation**

This documentation provides the complete technical specification for implementing the client-side image processing pipeline. Each function includes TypeScript signatures, algorithm details, complexity analysis, and usage examples. Developers can implement these functions directly based on this documentation.
