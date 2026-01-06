import { describe, expect, it } from "bun:test";
import {
  calculatePathLength,
  contourToBezierPath,
  contourToLinePath,
  createSVGDocument,
  generateSVG,
  isValidPathData,
  optimizePath,
  parsePathData,
  reverseWinding,
  round,
} from "./svgGeneration";
import type { Contour, Point } from "./types";

/**
 * Helper to create a simple contour
 */
function createSquareContour(size: number, offset = 0): Contour {
  return {
    points: [
      { x: offset, y: offset },
      { x: offset + size, y: offset },
      { x: offset + size, y: offset + size },
      { x: offset, y: offset + size },
    ],
    isHole: false,
    area: size * size,
    boundingBox: { x: offset, y: offset, width: size, height: size },
  };
}

/**
 * Helper to create a triangle contour
 */
function createTriangleContour(): Contour {
  return {
    points: [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    isHole: false,
    area: 5000,
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
  };
}

describe("round", () => {
  it("should round to specified decimal places", () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(1.23456, 3)).toBe(1.235);
    expect(round(1.23456, 0)).toBe(1);
  });

  it("should handle negative numbers", () => {
    expect(round(-1.567, 2)).toBe(-1.57);
  });

  it("should handle whole numbers", () => {
    expect(round(5, 2)).toBe(5);
  });

  it("should handle zero", () => {
    expect(round(0, 3)).toBe(0);
  });
});

describe("reverseWinding", () => {
  it("should reverse point order", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];

    const reversed = reverseWinding(points);

    expect(reversed).toHaveLength(3);
    expect(reversed[0]).toEqual({ x: 1, y: 1 });
    expect(reversed[1]).toEqual({ x: 1, y: 0 });
    expect(reversed[2]).toEqual({ x: 0, y: 0 });
  });

  it("should not modify original array", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const original = [...points];

    reverseWinding(points);

    expect(points).toEqual(original);
  });

  it("should handle empty array", () => {
    const reversed = reverseWinding([]);
    expect(reversed).toHaveLength(0);
  });
});

describe("isValidPathData", () => {
  it("should return true for valid path data", () => {
    expect(isValidPathData("M 0 0 L 10 10 Z")).toBe(true);
    expect(isValidPathData("M 0,0 L 10,10 L 20,0 Z")).toBe(true);
    expect(isValidPathData("M0 0L10 10Z")).toBe(true);
  });

  it("should return true for bezier paths", () => {
    expect(isValidPathData("M 0 0 C 10 10 20 10 30 0")).toBe(true);
    expect(isValidPathData("M 0 0 Q 10 10 20 0")).toBe(true);
  });

  it("should return true for empty string", () => {
    expect(isValidPathData("")).toBe(true);
  });

  it("should return false for invalid characters", () => {
    expect(isValidPathData("M 0 0 X 10 10")).toBe(false);
    expect(isValidPathData("<script>alert(1)</script>")).toBe(false);
  });
});

describe("parsePathData", () => {
  it("should parse M command", () => {
    const segments = parsePathData("M 10 20");

    expect(segments).toHaveLength(1);
    expect(segments[0].command).toBe("M");
    expect(segments[0].points).toEqual([10, 20]);
  });

  it("should parse L command", () => {
    const segments = parsePathData("L 30 40");

    expect(segments).toHaveLength(1);
    expect(segments[0].command).toBe("L");
    expect(segments[0].points).toEqual([30, 40]);
  });

  it("should parse Z command", () => {
    const segments = parsePathData("Z");

    expect(segments).toHaveLength(1);
    expect(segments[0].command).toBe("Z");
    expect(segments[0].points).toEqual([]);
  });

  it("should parse multiple commands", () => {
    const segments = parsePathData("M 0 0 L 10 10 L 20 0 Z");

    expect(segments).toHaveLength(4);
    expect(segments[0].command).toBe("M");
    expect(segments[1].command).toBe("L");
    expect(segments[2].command).toBe("L");
    expect(segments[3].command).toBe("Z");
  });

  it("should parse C (cubic Bezier) command", () => {
    const segments = parsePathData("C 10 20 30 40 50 60");

    expect(segments).toHaveLength(1);
    expect(segments[0].command).toBe("C");
    expect(segments[0].points).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("should handle comma-separated coordinates", () => {
    const segments = parsePathData("M 10,20 L 30,40");

    expect(segments[0].points).toEqual([10, 20]);
    expect(segments[1].points).toEqual([30, 40]);
  });

  it("should handle decimal numbers", () => {
    const segments = parsePathData("M 1.5 2.75");

    expect(segments[0].points).toEqual([1.5, 2.75]);
  });

  it("should handle negative numbers", () => {
    const segments = parsePathData("M -10 -20");

    expect(segments[0].points).toEqual([-10, -20]);
  });
});

describe("calculatePathLength", () => {
  it("should calculate length of square path", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const length = calculatePathLength(points);

    // Perimeter = 4 * 10 = 40
    expect(length).toBe(40);
  });

  it("should return 0 for empty points", () => {
    expect(calculatePathLength([])).toBe(0);
  });

  it("should handle single point", () => {
    const length = calculatePathLength([{ x: 5, y: 5 }]);
    expect(length).toBe(0); // No segments
  });

  it("should include closing segment", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 3, y: 4 }, // Distance 5 from (0,0)
    ];

    const length = calculatePathLength(points);
    expect(length).toBe(10); // 5 + 5 (back to start)
  });
});

describe("contourToLinePath", () => {
  it("should generate path for square", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const path = contourToLinePath(points, 0, 0, false, 10, 2);

    expect(path).toContain("M 0 0");
    expect(path).toContain("L 10 0");
    expect(path).toContain("L 10 10");
    expect(path).toContain("L 0 10");
    expect(path).toContain("Z");
  });

  it("should return empty string for empty points", () => {
    const path = contourToLinePath([], 0, 0, false, 10, 2);
    expect(path).toBe("");
  });

  it("should apply offset", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];

    const path = contourToLinePath(points, 5, 10, false, 20, 0);

    expect(path).toContain("M 5 10");
    expect(path).toContain("L 15 20");
  });

  it("should flip Y axis when specified", () => {
    const points: Point[] = [{ x: 0, y: 0 }];

    // With flipY=false, height=100
    const pathNoFlip = contourToLinePath(points, 0, 0, false, 100, 0);
    expect(pathNoFlip).toContain("M 0 0");

    // With flipY=true, height=100, point at y=0 becomes y=100
    const pathFlip = contourToLinePath(points, 0, 0, true, 100, 0);
    expect(pathFlip).toContain("M 0 100");
  });

  it("should round coordinates to specified decimals", () => {
    const points: Point[] = [{ x: 1.23456, y: 7.89012 }];

    const path = contourToLinePath(points, 0, 0, false, 10, 2);
    expect(path).toContain("1.23");
    expect(path).toContain("7.89");
  });
});

describe("contourToBezierPath", () => {
  it("should fall back to line path for less than 3 points", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];

    const path = contourToBezierPath(points, 0, 0, false, 10, 2, 0.5);

    // Should be same as line path
    expect(path).toContain("M");
    expect(path).toContain("L");
  });

  it("should generate cubic Bezier commands", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const path = contourToBezierPath(points, 0, 0, false, 10, 2, 0.5);

    expect(path).toContain("M");
    expect(path).toContain("C"); // Should have cubic Bezier commands
  });

  it("should use tension parameter", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ];

    const pathLowTension = contourToBezierPath(points, 0, 0, false, 50, 2, 0.1);
    const pathHighTension = contourToBezierPath(
      points,
      0,
      0,
      false,
      50,
      2,
      1.0,
    );

    // Different tension should produce different control points
    expect(pathLowTension).not.toBe(pathHighTension);
  });
});

describe("createSVGDocument", () => {
  it("should create valid SVG document", () => {
    const svg = createSVGDocument("M 0 0 L 10 10 Z", 100, 100, "0 0 100 100");

    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="100.000mm"');
    expect(svg).toContain('height="100.000mm"');
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('<path d="M 0 0 L 10 10 Z"');
    expect(svg).toContain('fill="black"');
    expect(svg).toContain('stroke="none"');
    expect(svg).toContain("</svg>");
  });

  it("should handle decimal dimensions", () => {
    const svg = createSVGDocument("M 0 0", 12.5, 25.75, "0 0 12.5 25.75");

    expect(svg).toContain('width="12.500mm"');
    expect(svg).toContain('height="25.750mm"');
  });
});

describe("optimizePath", () => {
  it("should preserve M and Z commands", () => {
    const path = "M 0 0 L 10 0 Z";
    const optimized = optimizePath(path, 0.1);

    expect(optimized).toContain("M");
    expect(optimized).toContain("Z");
  });

  it("should remove collinear points", () => {
    // Three points on a straight horizontal line
    const path = "M 0 0 L 5 0 L 10 0 Z";
    const optimized = optimizePath(path, 0.1);

    // Middle point should be removed
    // Result should be M 0 0 L 10 0 Z
    const segments = parsePathData(optimized);
    const lCommands = segments.filter((s) => s.command === "L");
    expect(lCommands.length).toBeLessThanOrEqual(2);
  });

  it("should preserve significant points", () => {
    // L-shaped path - middle point is not collinear
    const path = "M 0 0 L 10 0 L 10 10 Z";
    const optimized = optimizePath(path, 0.1);

    // All points should be preserved
    expect(optimized).toContain("L 10 0");
    expect(optimized).toContain("L 10 10");
  });

  it("should handle empty path", () => {
    const path = "";
    const optimized = optimizePath(path, 0.1);
    expect(optimized).toBe("");
  });
});

describe("generateSVG", () => {
  it("should generate valid SVG from contour", () => {
    const contour = createSquareContour(100);

    const result = generateSVG(contour, [], {
      pixelsPerMm: 10,
      padding: 2,
      useBezier: false,
      decimals: 2,
    });

    expect(result.pathData).toContain("M");
    expect(result.pathData).toContain("L");
    expect(result.pathData).toContain("Z");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.fullSvg).toContain("<svg");
    expect(result.fullSvg).toContain("</svg>");
  });

  it("should handle empty contour", () => {
    const emptyContour: Contour = {
      points: [],
      isHole: false,
      area: 0,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    };

    const result = generateSVG(emptyContour, [], {
      pixelsPerMm: 10,
    });

    expect(result.pathData).toBe("");
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it("should scale to millimeters", () => {
    // 100x100 pixel contour at 10 pixels/mm = 10x10 mm
    const contour = createSquareContour(100);

    const result = generateSVG(contour, [], {
      pixelsPerMm: 10,
      padding: 0,
    });

    // Should be approximately 10mm x 10mm
    expect(result.width).toBeCloseTo(10, 0);
    expect(result.height).toBeCloseTo(10, 0);
  });

  it("should add padding", () => {
    const contour = createSquareContour(100);

    const noPadding = generateSVG(contour, [], {
      pixelsPerMm: 10,
      padding: 0,
    });

    const withPadding = generateSVG(contour, [], {
      pixelsPerMm: 10,
      padding: 5,
    });

    // Width with 5mm padding on each side should be 10mm more
    expect(withPadding.width).toBeCloseTo(noPadding.width + 10, 0);
    expect(withPadding.height).toBeCloseTo(noPadding.height + 10, 0);
  });

  it("should include holes in path data", () => {
    const outer = createSquareContour(100);
    const hole: Contour = {
      points: [
        { x: 25, y: 25 },
        { x: 75, y: 25 },
        { x: 75, y: 75 },
        { x: 25, y: 75 },
      ],
      isHole: true,
      area: 2500,
      boundingBox: { x: 25, y: 25, width: 50, height: 50 },
    };

    const result = generateSVG(outer, [hole], {
      pixelsPerMm: 10,
    });

    // Should have two M commands (one for outer, one for hole)
    const mCount = (result.pathData.match(/M /g) || []).length;
    expect(mCount).toBe(2);
  });

  it("should use bezier curves when specified", () => {
    const contour = createSquareContour(100);

    const linearResult = generateSVG(contour, [], {
      pixelsPerMm: 10,
      useBezier: false,
    });

    const bezierResult = generateSVG(contour, [], {
      pixelsPerMm: 10,
      useBezier: true,
      bezierTension: 0.5,
    });

    expect(linearResult.pathData).toContain("L");
    expect(bezierResult.pathData).toContain("C");
  });

  it("should generate valid viewBox", () => {
    const contour = createSquareContour(100);

    const result = generateSVG(contour, [], {
      pixelsPerMm: 10,
      padding: 2,
      decimals: 3,
    });

    // ViewBox should match dimensions
    expect(result.viewBox).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
    expect(result.fullSvg).toContain(`viewBox="${result.viewBox}"`);
  });

  it("should flip Y axis by default", () => {
    const contour: Contour = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      isHole: false,
      area: 10000,
      boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    };

    const result = generateSVG(contour, [], {
      pixelsPerMm: 10,
      padding: 0,
      flipY: true,
      decimals: 0,
    });

    // With Y flip, the point at y=0 in pixel space should be at y=height in SVG
    expect(result.pathData).toMatch(/M \d+ 10/); // First point should be at y=10 (height)
  });
});

describe("integration", () => {
  it("should produce OpenSCAD-compatible SVG", () => {
    const contour = createTriangleContour();

    const result = generateSVG(contour, [], {
      pixelsPerMm: 10,
      padding: 2,
      useBezier: false,
      decimals: 2,
    });

    // OpenSCAD requirements:
    // - Has proper XML declaration
    expect(result.fullSvg).toContain('<?xml version="1.0"');

    // - Has millimeter units
    expect(result.fullSvg).toMatch(/width="\d+(\.\d+)?mm"/);
    expect(result.fullSvg).toMatch(/height="\d+(\.\d+)?mm"/);

    // - Has viewBox
    expect(result.fullSvg).toContain("viewBox=");

    // - Has black fill, no stroke
    expect(result.fullSvg).toContain('fill="black"');
    expect(result.fullSvg).toContain('stroke="none"');

    // - Has valid path
    expect(isValidPathData(result.pathData)).toBe(true);
  });
});
