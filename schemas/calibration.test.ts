import { describe, expect, it } from "bun:test";
import {
  CalibrationPointSchema,
  CalibrationRequestSchema,
  CalibrationSchema,
  ScaleSchema,
} from "./calibration";

describe("CalibrationPointSchema", () => {
  it("should accept valid point with x and y numbers", () => {
    const validPoint = { x: 10, y: 20 };
    const result = CalibrationPointSchema.safeParse(validPoint);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validPoint);
    }
  });

  it("should accept point with zero values", () => {
    const validPoint = { x: 0, y: 0 };
    const result = CalibrationPointSchema.safeParse(validPoint);
    expect(result.success).toBe(true);
  });

  it("should accept point with negative values", () => {
    const validPoint = { x: -10, y: -20 };
    const result = CalibrationPointSchema.safeParse(validPoint);
    expect(result.success).toBe(true);
  });

  it("should accept point with decimal values", () => {
    const validPoint = { x: 10.5, y: 20.75 };
    const result = CalibrationPointSchema.safeParse(validPoint);
    expect(result.success).toBe(true);
  });

  it("should reject point with x as Infinity", () => {
    const invalidPoint = { x: Infinity, y: 20 };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with y as Infinity", () => {
    const invalidPoint = { x: 10, y: Infinity };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with x as -Infinity", () => {
    const invalidPoint = { x: -Infinity, y: 20 };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with x as NaN", () => {
    const invalidPoint = { x: NaN, y: 20 };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with y as NaN", () => {
    const invalidPoint = { x: 10, y: NaN };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with missing x", () => {
    const invalidPoint = { y: 20 };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with missing y", () => {
    const invalidPoint = { x: 10 };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with non-number x", () => {
    const invalidPoint = { x: "10", y: 20 };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });

  it("should reject point with non-number y", () => {
    const invalidPoint = { x: 10, y: "20" };
    const result = CalibrationPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });
});

describe("CalibrationSchema", () => {
  it("should accept valid calibration object", () => {
    const validCalibration = {
      rulerPoints: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ] satisfies [{ x: number; y: number }, { x: number; y: number }],
      knownDistanceMm: 100,
      pixelsPerMm: 2.5,
      isValid: true,
      error: null,
    };
    const result = CalibrationSchema.safeParse(validCalibration);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validCalibration);
    }
  });

  it("should accept null rulerPoints", () => {
    const validCalibration = {
      rulerPoints: null,
      knownDistanceMm: 100,
      pixelsPerMm: null,
      isValid: false,
      error: "No ruler points set",
    };
    const result = CalibrationSchema.safeParse(validCalibration);
    expect(result.success).toBe(true);
  });

  it("should accept null pixelsPerMm", () => {
    const validCalibration = {
      rulerPoints: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      knownDistanceMm: 100,
      pixelsPerMm: null,
      isValid: false,
      error: "Not calculated yet",
    };
    const result = CalibrationSchema.safeParse(validCalibration);
    expect(result.success).toBe(true);
  });

  it("should accept null error", () => {
    const validCalibration = {
      rulerPoints: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      knownDistanceMm: 100,
      pixelsPerMm: 2.5,
      isValid: true,
      error: null,
    };
    const result = CalibrationSchema.safeParse(validCalibration);
    expect(result.success).toBe(true);
  });

  it("should accept knownDistanceMm at maximum value (1000)", () => {
    const validCalibration = {
      rulerPoints: null,
      knownDistanceMm: 1000,
      pixelsPerMm: null,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(validCalibration);
    expect(result.success).toBe(true);
  });

  it("should accept knownDistanceMm at minimum positive value", () => {
    const validCalibration = {
      rulerPoints: null,
      knownDistanceMm: 0.001,
      pixelsPerMm: null,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(validCalibration);
    expect(result.success).toBe(true);
  });

  it("should reject negative knownDistanceMm", () => {
    const invalidCalibration = {
      rulerPoints: null,
      knownDistanceMm: -10,
      pixelsPerMm: null,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject zero knownDistanceMm", () => {
    const invalidCalibration = {
      rulerPoints: null,
      knownDistanceMm: 0,
      pixelsPerMm: null,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject knownDistanceMm over 1000", () => {
    const invalidCalibration = {
      rulerPoints: null,
      knownDistanceMm: 1001,
      pixelsPerMm: null,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject negative pixelsPerMm", () => {
    const invalidCalibration = {
      rulerPoints: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      knownDistanceMm: 100,
      pixelsPerMm: -2.5,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject zero pixelsPerMm", () => {
    const invalidCalibration = {
      rulerPoints: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      knownDistanceMm: 100,
      pixelsPerMm: 0,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject rulerPoints with only one point", () => {
    const invalidCalibration = {
      rulerPoints: [{ x: 10, y: 20 }],
      knownDistanceMm: 100,
      pixelsPerMm: null,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject rulerPoints with three points", () => {
    const invalidCalibration = {
      rulerPoints: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ],
      knownDistanceMm: 100,
      pixelsPerMm: null,
      isValid: false,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject missing isValid field", () => {
    const invalidCalibration = {
      rulerPoints: null,
      knownDistanceMm: 100,
      pixelsPerMm: null,
      error: null,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });

  it("should reject missing error field", () => {
    const invalidCalibration = {
      rulerPoints: null,
      knownDistanceMm: 100,
      pixelsPerMm: null,
      isValid: false,
    };
    const result = CalibrationSchema.safeParse(invalidCalibration);
    expect(result.success).toBe(false);
  });
});

describe("ScaleSchema", () => {
  it("should accept valid scale object", () => {
    const validScale = {
      pixelsPerMm: 2.5,
      knownDistanceMm: 100,
      pixelDistance: 250,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(validScale);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validScale);
    }
  });

  it("should accept scale with decimal values", () => {
    const validScale = {
      pixelsPerMm: 2.54321,
      knownDistanceMm: 100.5,
      pixelDistance: 255.432,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(validScale);
    expect(result.success).toBe(true);
  });

  it("should accept scale with very small positive values", () => {
    const validScale = {
      pixelsPerMm: 0.001,
      knownDistanceMm: 0.001,
      pixelDistance: 0.001,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(validScale);
    expect(result.success).toBe(true);
  });

  it("should reject negative pixelsPerMm", () => {
    const invalidScale = {
      pixelsPerMm: -2.5,
      knownDistanceMm: 100,
      pixelDistance: 250,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });

  it("should reject zero pixelsPerMm", () => {
    const invalidScale = {
      pixelsPerMm: 0,
      knownDistanceMm: 100,
      pixelDistance: 250,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });

  it("should reject negative knownDistanceMm", () => {
    const invalidScale = {
      pixelsPerMm: 2.5,
      knownDistanceMm: -100,
      pixelDistance: 250,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });

  it("should reject zero knownDistanceMm", () => {
    const invalidScale = {
      pixelsPerMm: 2.5,
      knownDistanceMm: 0,
      pixelDistance: 250,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });

  it("should reject negative pixelDistance", () => {
    const invalidScale = {
      pixelsPerMm: 2.5,
      knownDistanceMm: 100,
      pixelDistance: -250,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });

  it("should reject zero pixelDistance", () => {
    const invalidScale = {
      pixelsPerMm: 2.5,
      knownDistanceMm: 100,
      pixelDistance: 0,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });

  it("should reject missing pixelsPerMm field", () => {
    const invalidScale = {
      knownDistanceMm: 100,
      pixelDistance: 250,
      isValid: true,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });

  it("should reject missing isValid field", () => {
    const invalidScale = {
      pixelsPerMm: 2.5,
      knownDistanceMm: 100,
      pixelDistance: 250,
    };
    const result = ScaleSchema.safeParse(invalidScale);
    expect(result.success).toBe(false);
  });
});

describe("CalibrationRequestSchema", () => {
  it("should accept valid request with two points and distance", () => {
    const validRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: 100,
    };
    const result = CalibrationRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validRequest);
    }
  });

  it("should accept request with decimal point coordinates", () => {
    const validRequest = {
      point1: { x: 10.5, y: 20.75 },
      point2: { x: 30.25, y: 40.125 },
      knownDistanceMm: 100.5,
    };
    const result = CalibrationRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should accept request with negative point coordinates", () => {
    const validRequest = {
      point1: { x: -10, y: -20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: 100,
    };
    const result = CalibrationRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should accept knownDistanceMm at maximum value (1000)", () => {
    const validRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: 1000,
    };
    const result = CalibrationRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should accept knownDistanceMm at minimum positive value", () => {
    const validRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: 0.001,
    };
    const result = CalibrationRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should reject negative knownDistanceMm", () => {
    const invalidRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: -10,
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject zero knownDistanceMm", () => {
    const invalidRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: 0,
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject knownDistanceMm over 1000", () => {
    const invalidRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: 1001,
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject point1 with Infinity", () => {
    const invalidRequest = {
      point1: { x: Infinity, y: 20 },
      point2: { x: 30, y: 40 },
      knownDistanceMm: 100,
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject point2 with NaN", () => {
    const invalidRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: NaN },
      knownDistanceMm: 100,
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject missing point1", () => {
    const invalidRequest = {
      point2: { x: 30, y: 40 },
      knownDistanceMm: 100,
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject missing point2", () => {
    const invalidRequest = {
      point1: { x: 10, y: 20 },
      knownDistanceMm: 100,
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject missing knownDistanceMm", () => {
    const invalidRequest = {
      point1: { x: 10, y: 20 },
      point2: { x: 30, y: 40 },
    };
    const result = CalibrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });
});
