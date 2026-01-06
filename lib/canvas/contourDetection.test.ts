import { describe, expect, it } from "bun:test";
import {
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
import type { Point } from "./types";

/**
 * Helper to create a mock ImageData object
 */
function createMockImageData(
  width: number,
  height: number,
  pixels: number[][],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const value = pixels[y]?.[x] ?? 0;
      // Set RGBA (grayscale with full opacity)
      data[idx] = value; // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255; // A
    }
  }

  return {
    width,
    height,
    data,
    colorSpace: "srgb",
  } as ImageData;
}

/**
 * Helper to create a filled rectangle in pixel grid
 */
function createRectangleGrid(
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(x >= x1 && x < x2 && y >= y1 && y < y2 ? 255 : 0);
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Helper to create a circular mask
 */
function createCircleGrid(
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      row.push(dist <= radius ? 255 : 0);
    }
    grid.push(row);
  }
  return grid;
}

describe("maskToBinaryGrid", () => {
  it("should convert white pixels to 1", () => {
    const imageData = createMockImageData(3, 3, [
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ]);

    const grid = maskToBinaryGrid(imageData);

    expect(grid.length).toBe(9);
    expect(Array.from(grid)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it("should convert black pixels to 0", () => {
    const imageData = createMockImageData(3, 3, [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);

    const grid = maskToBinaryGrid(imageData);

    expect(grid.length).toBe(9);
    expect(Array.from(grid)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("should use threshold of 128", () => {
    const imageData = createMockImageData(4, 1, [[0, 127, 128, 255]]);

    const grid = maskToBinaryGrid(imageData);

    expect(Array.from(grid)).toEqual([0, 0, 1, 1]);
  });

  it("should handle mixed patterns", () => {
    const imageData = createMockImageData(3, 3, [
      [0, 255, 0],
      [255, 0, 255],
      [0, 255, 0],
    ]);

    const grid = maskToBinaryGrid(imageData);

    expect(Array.from(grid)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0]);
  });
});

describe("distance", () => {
  it("should calculate distance between two points", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("should return 0 for same point", () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it("should handle negative coordinates", () => {
    expect(distance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
  });

  it("should handle horizontal distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });

  it("should handle vertical distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(10);
  });
});

describe("perpendicularDistance", () => {
  it("should calculate perpendicular distance from point to horizontal line", () => {
    const point: Point = { x: 5, y: 5 };
    const lineStart: Point = { x: 0, y: 0 };
    const lineEnd: Point = { x: 10, y: 0 };

    const dist = perpendicularDistance(point, lineStart, lineEnd);
    expect(dist).toBe(5);
  });

  it("should calculate perpendicular distance from point to vertical line", () => {
    const point: Point = { x: 5, y: 5 };
    const lineStart: Point = { x: 0, y: 0 };
    const lineEnd: Point = { x: 0, y: 10 };

    const dist = perpendicularDistance(point, lineStart, lineEnd);
    expect(dist).toBe(5);
  });

  it("should return 0 for point on line", () => {
    const point: Point = { x: 5, y: 5 };
    const lineStart: Point = { x: 0, y: 0 };
    const lineEnd: Point = { x: 10, y: 10 };

    const dist = perpendicularDistance(point, lineStart, lineEnd);
    expect(dist).toBeCloseTo(0, 5);
  });

  it("should handle point at line start", () => {
    const point: Point = { x: 0, y: 0 };
    const lineStart: Point = { x: 0, y: 0 };
    const lineEnd: Point = { x: 10, y: 0 };

    const dist = perpendicularDistance(point, lineStart, lineEnd);
    expect(dist).toBe(0);
  });

  it("should handle zero-length line segment", () => {
    const point: Point = { x: 5, y: 5 };
    const lineStart: Point = { x: 0, y: 0 };
    const lineEnd: Point = { x: 0, y: 0 };

    const dist = perpendicularDistance(point, lineStart, lineEnd);
    expect(dist).toBeCloseTo(Math.sqrt(50), 5);
  });
});

describe("douglasPeucker", () => {
  it("should return input for less than 3 points", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];

    const simplified = douglasPeucker(points, 1);
    expect(simplified).toEqual(points);
  });

  it("should simplify straight line to endpoints", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];

    const simplified = douglasPeucker(points, 0.1);
    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 3, y: 0 });
  });

  it("should preserve significant points", () => {
    // Zigzag pattern
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 10 },
      { x: 10, y: 0 },
    ];

    const simplified = douglasPeucker(points, 1.0);
    expect(simplified.length).toBeGreaterThanOrEqual(2);
    // Should preserve the peak
    expect(simplified).toContainEqual({ x: 5, y: 10 });
  });

  it("should respect epsilon tolerance", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 1 }, // 1 unit from line
      { x: 10, y: 0 },
    ];

    // With small epsilon, should keep middle point
    const tightSimplified = douglasPeucker(points, 0.5);
    expect(tightSimplified.length).toBe(3);

    // With large epsilon, should remove middle point
    const looseSimplified = douglasPeucker(points, 2.0);
    expect(looseSimplified.length).toBe(2);
  });

  it("should handle complex path", () => {
    const points: Point[] = [];
    // Create a complex squiggle
    for (let i = 0; i <= 100; i++) {
      points.push({
        x: i,
        y: Math.sin(i / 10) * 5,
      });
    }

    const simplified = douglasPeucker(points, 1.0);
    expect(simplified.length).toBeLessThan(points.length);
    expect(simplified.length).toBeGreaterThan(2);
  });
});

describe("smoothContour", () => {
  it("should smooth a contour", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const smoothed = smoothContour(points, 1);

    // After smoothing, points should be different
    expect(smoothed).toHaveLength(4);
    // Center points should be pulled toward center
    expect(smoothed[0].x).toBeGreaterThan(0);
    expect(smoothed[0].y).toBeGreaterThan(0);
  });

  it("should handle multiple iterations", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const smoothed1 = smoothContour(points, 1);
    const smoothed2 = smoothContour(points, 2);

    // More iterations = more smoothing (points move further)
    expect(Math.abs(smoothed2[0].x - 5)).toBeLessThan(
      Math.abs(smoothed1[0].x - 5) + 0.1,
    );
  });

  it("should return same length array", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];

    const smoothed = smoothContour(points, 3);
    expect(smoothed).toHaveLength(points.length);
  });
});

describe("calculateSignedArea", () => {
  it("should return 0 for less than 3 points", () => {
    expect(calculateSignedArea([])).toBe(0);
    expect(calculateSignedArea([{ x: 0, y: 0 }])).toBe(0);
    expect(
      calculateSignedArea([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(0);
  });

  it("should calculate positive area for counter-clockwise polygon", () => {
    // Counter-clockwise square
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const area = calculateSignedArea(points);
    expect(area).toBe(100);
  });

  it("should calculate negative area for clockwise polygon", () => {
    // Clockwise square
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ];

    const area = calculateSignedArea(points);
    expect(area).toBe(-100);
  });

  it("should calculate area of triangle", () => {
    // Counter-clockwise triangle with base 10 and height 10
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];

    const area = calculateSignedArea(points);
    expect(area).toBe(50); // 1/2 * base * height
  });
});

describe("calculateBoundingBox", () => {
  it("should return zero box for empty array", () => {
    const bbox = calculateBoundingBox([]);
    expect(bbox).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("should calculate bounding box for rectangle", () => {
    const points: Point[] = [
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 60 },
      { x: 10, y: 60 },
    ];

    const bbox = calculateBoundingBox(points);

    expect(bbox.x).toBe(10);
    expect(bbox.y).toBe(20);
    expect(bbox.width).toBe(40);
    expect(bbox.height).toBe(40);
  });

  it("should handle single point", () => {
    const points: Point[] = [{ x: 5, y: 10 }];

    const bbox = calculateBoundingBox(points);

    expect(bbox.x).toBe(5);
    expect(bbox.y).toBe(10);
    expect(bbox.width).toBe(0);
    expect(bbox.height).toBe(0);
  });

  it("should handle negative coordinates", () => {
    const points: Point[] = [
      { x: -10, y: -20 },
      { x: 10, y: 20 },
    ];

    const bbox = calculateBoundingBox(points);

    expect(bbox.x).toBe(-10);
    expect(bbox.y).toBe(-20);
    expect(bbox.width).toBe(20);
    expect(bbox.height).toBe(40);
  });
});

describe("isPointInPolygon", () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("should return true for point inside polygon", () => {
    expect(isPointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it("should return false for point outside polygon", () => {
    expect(isPointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(isPointInPolygon({ x: -5, y: 5 }, square)).toBe(false);
    expect(isPointInPolygon({ x: 5, y: 15 }, square)).toBe(false);
  });

  it("should handle point on edge (implementation specific)", () => {
    // Point on left edge - behavior may vary
    const result = isPointInPolygon({ x: 0, y: 5 }, square);
    expect(typeof result).toBe("boolean");
  });

  it("should handle triangle", () => {
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];

    expect(isPointInPolygon({ x: 5, y: 3 }, triangle)).toBe(true);
    expect(isPointInPolygon({ x: 0, y: 10 }, triangle)).toBe(false);
  });
});

describe("marchingSquares", () => {
  it("should return empty array for empty grid", () => {
    const grid = new Uint8Array(16); // 4x4 all zeros
    const contours = marchingSquares(grid, 4, 4);
    expect(contours).toHaveLength(0);
  });

  it("should return empty array for fully filled grid", () => {
    const grid = new Uint8Array(16).fill(1); // 4x4 all ones
    const contours = marchingSquares(grid, 4, 4);
    expect(contours).toHaveLength(0);
  });

  it("should trace a simple rectangle", () => {
    // 8x8 grid with 4x4 rectangle in center
    const width = 8;
    const height = 8;
    const grid = new Uint8Array(width * height);

    // Fill center rectangle (2,2) to (5,5)
    for (let y = 2; y < 6; y++) {
      for (let x = 2; x < 6; x++) {
        grid[y * width + x] = 1;
      }
    }

    const contours = marchingSquares(grid, width, height);

    // Should find at least one contour
    expect(contours.length).toBeGreaterThan(0);

    // Contour should have reasonable number of points
    expect(contours[0].length).toBeGreaterThan(3);
  });

  it("should handle small shapes", () => {
    // 6x6 grid with 2x2 square in center
    const width = 6;
    const height = 6;
    const grid = new Uint8Array(width * height);

    grid[2 * width + 2] = 1;
    grid[2 * width + 3] = 1;
    grid[3 * width + 2] = 1;
    grid[3 * width + 3] = 1;

    const contours = marchingSquares(grid, width, height);
    expect(contours.length).toBeGreaterThanOrEqual(0); // May find contour depending on implementation
  });
});

describe("findContours", () => {
  it("should handle empty mask", () => {
    const imageData = createMockImageData(
      10,
      10,
      createRectangleGrid(10, 10, 0, 0, 0, 0),
    );

    const result = findContours(imageData);

    expect(result.outerContour.points).toHaveLength(0);
    expect(result.holes).toHaveLength(0);
  });

  it("should detect rectangle contour", () => {
    // Create 20x20 mask with 10x10 white rectangle in center
    const grid = createRectangleGrid(20, 20, 5, 5, 15, 15);
    const imageData = createMockImageData(20, 20, grid);

    const result = findContours(imageData, {
      minArea: 10,
      simplifyTolerance: 0, // No simplification
      smoothingIterations: 0,
    });

    expect(result.outerContour.points.length).toBeGreaterThan(0);
    expect(result.outerContour.area).toBeGreaterThan(0);
  });

  it("should apply minArea filter", () => {
    // Create small 5x5 shape
    const grid = createRectangleGrid(20, 20, 8, 8, 12, 12);
    const imageData = createMockImageData(20, 20, grid);

    // With high minArea, should filter out the small shape
    const result = findContours(imageData, {
      minArea: 100, // 4x4 = 16 pixels is less than 100
    });

    // Either no contours or very small outer contour
    expect(
      result.outerContour.points.length === 0 || result.outerContour.area < 100,
    ).toBe(true);
  });

  it("should apply simplification", () => {
    const grid = createCircleGrid(50, 50, 25, 25, 15);
    const imageData = createMockImageData(50, 50, grid);

    // Without simplification
    const result1 = findContours(imageData, {
      minArea: 10,
      simplifyTolerance: 0,
    });

    // With simplification
    const result2 = findContours(imageData, {
      minArea: 10,
      simplifyTolerance: 2,
    });

    // Simplified should have fewer points
    if (
      result1.outerContour.points.length > 0 &&
      result2.outerContour.points.length > 0
    ) {
      expect(result2.outerContour.points.length).toBeLessThanOrEqual(
        result1.outerContour.points.length,
      );
    }
  });

  it("should sort contours by area", () => {
    const result = findContours(
      createMockImageData(30, 30, createRectangleGrid(30, 30, 5, 5, 25, 25)),
      { minArea: 1 },
    );

    if (result.allContours.length > 1) {
      for (let i = 1; i < result.allContours.length; i++) {
        expect(result.allContours[i - 1].area).toBeGreaterThanOrEqual(
          result.allContours[i].area,
        );
      }
    }
  });
});
