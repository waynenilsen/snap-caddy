import { describe, it, expect } from "bun:test";
import {
  validateBinConfig,
  GRIDFINITY_CONSTRAINTS,
  type GridfinityBinConfig,
} from "./configuration";

describe("GRIDFINITY_CONSTRAINTS", () => {
  it("should have GRID_UNIT_SIZE of 42", () => {
    expect(GRIDFINITY_CONSTRAINTS.GRID_UNIT_SIZE).toBe(42);
  });

  it("should have MIN_GRID_UNITS of 1", () => {
    expect(GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS).toBe(1);
  });

  it("should have MAX_GRID_UNITS of 10", () => {
    expect(GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS).toBe(10);
  });

  it("should have MIN_BIN_HEIGHT of 7", () => {
    expect(GRIDFINITY_CONSTRAINTS.MIN_BIN_HEIGHT).toBe(7);
  });

  it("should have HEIGHT_INCREMENT of 7", () => {
    expect(GRIDFINITY_CONSTRAINTS.HEIGHT_INCREMENT).toBe(7);
  });

  it("should have MIN_WALL_THICKNESS of 1.0", () => {
    expect(GRIDFINITY_CONSTRAINTS.MIN_WALL_THICKNESS).toBe(1.0);
  });

  it("should have RECOMMENDED_WALL of 2.0", () => {
    expect(GRIDFINITY_CONSTRAINTS.RECOMMENDED_WALL).toBe(2.0);
  });

  it("should have MIN_CUTOUT_DEPTH of 3", () => {
    expect(GRIDFINITY_CONSTRAINTS.MIN_CUTOUT_DEPTH).toBe(3);
  });

  it("should have DEFAULT_PADDING of 2.0", () => {
    expect(GRIDFINITY_CONSTRAINTS.DEFAULT_PADDING).toBe(2.0);
  });

  it("should have MAX_BIN_HEIGHT of 100", () => {
    expect(GRIDFINITY_CONSTRAINTS.MAX_BIN_HEIGHT).toBe(100);
  });
});

describe("validateBinConfig", () => {
  const createValidConfig = (): GridfinityBinConfig => ({
    gridUnitsX: 2,
    gridUnitsY: 3,
    binHeight: 21, // 3 * 7mm increment
    cutoutDepth: 10,
    cutoutPadding: 2,
    cutoutOffsetX: 0,
    cutoutOffsetY: 0,
    wallThickness: 2.0,
    baseType: "solid",
    lipStyle: "normal",
  });

  describe("valid configurations", () => {
    it("should return valid: true for a valid configuration", () => {
      const config = createValidConfig();
      const result = validateBinConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should allow minimum valid values", () => {
      const config: GridfinityBinConfig = {
        ...createValidConfig(),
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 7,
        cutoutDepth: 3,
        cutoutPadding: 0,
        wallThickness: 1.0,
      };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should allow maximum valid values", () => {
      const config: GridfinityBinConfig = {
        ...createValidConfig(),
        gridUnitsX: 10,
        gridUnitsY: 10,
        binHeight: 100,
        cutoutDepth: 99,
      };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("gridUnitsX validation", () => {
    it("should return error when gridUnitsX is 0", () => {
      const config = { ...createValidConfig(), gridUnitsX: 0 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("gridUnitsX must be between 1 and 10");
    });

    it("should return error when gridUnitsX is 11", () => {
      const config = { ...createValidConfig(), gridUnitsX: 11 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("gridUnitsX must be between 1 and 10");
    });

    it("should return error when gridUnitsX is negative", () => {
      const config = { ...createValidConfig(), gridUnitsX: -1 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("gridUnitsX must be between 1 and 10");
    });
  });

  describe("gridUnitsY validation", () => {
    it("should return error when gridUnitsY is 0", () => {
      const config = { ...createValidConfig(), gridUnitsY: 0 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("gridUnitsY must be between 1 and 10");
    });

    it("should return error when gridUnitsY is 11", () => {
      const config = { ...createValidConfig(), gridUnitsY: 11 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("gridUnitsY must be between 1 and 10");
    });

    it("should return error when gridUnitsY is negative", () => {
      const config = { ...createValidConfig(), gridUnitsY: -5 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("gridUnitsY must be between 1 and 10");
    });
  });

  describe("binHeight validation", () => {
    it("should return error when binHeight is below MIN_BIN_HEIGHT", () => {
      const config = { ...createValidConfig(), binHeight: 6 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("binHeight must be at least 7mm");
    });

    it("should return error when binHeight is above MAX_BIN_HEIGHT", () => {
      const config = { ...createValidConfig(), binHeight: 101 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("binHeight must be at most 100mm");
    });

    it("should return warning for non-standard binHeight (not 7mm increment)", () => {
      const config = { ...createValidConfig(), binHeight: 15, cutoutDepth: 10 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "binHeight should be in 7mm increments for standard Gridfinity compatibility",
      );
    });

    it("should not return warning for standard binHeight (7mm increment)", () => {
      const config = { ...createValidConfig(), binHeight: 14, cutoutDepth: 10 };
      const result = validateBinConfig(config);

      expect(result.warnings).not.toContain(
        "binHeight should be in 7mm increments for standard Gridfinity compatibility",
      );
    });
  });

  describe("cutoutDepth validation", () => {
    it("should return error when cutoutDepth equals binHeight", () => {
      const config = { ...createValidConfig(), binHeight: 21, cutoutDepth: 21 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "cutoutDepth (21mm) must be less than binHeight (21mm)",
      );
    });

    it("should return error when cutoutDepth is greater than binHeight", () => {
      const config = { ...createValidConfig(), binHeight: 21, cutoutDepth: 25 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "cutoutDepth (25mm) must be less than binHeight (21mm)",
      );
    });

    it("should return error when cutoutDepth is below minimum", () => {
      const config = { ...createValidConfig(), cutoutDepth: 2 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("cutoutDepth must be at least 3mm");
    });

    it("should return error when cutoutDepth is 0", () => {
      const config = { ...createValidConfig(), cutoutDepth: 0 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("cutoutDepth must be at least 3mm");
    });
  });

  describe("wallThickness validation", () => {
    it("should return error when wallThickness is below minimum", () => {
      const config = { ...createValidConfig(), wallThickness: 0.9 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("wallThickness must be at least 1mm");
    });

    it("should return warning when wallThickness is below recommended", () => {
      const config = { ...createValidConfig(), wallThickness: 1.5 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "wallThickness below 2mm may result in weak walls",
      );
    });

    it("should not return warning when wallThickness is at recommended value", () => {
      const config = { ...createValidConfig(), wallThickness: 2.0 };
      const result = validateBinConfig(config);

      expect(result.warnings).not.toContain(
        "wallThickness below 2mm may result in weak walls",
      );
    });

    it("should not return warning when wallThickness is above recommended", () => {
      const config = { ...createValidConfig(), wallThickness: 3.0 };
      const result = validateBinConfig(config);

      expect(result.warnings).not.toContain(
        "wallThickness below 2mm may result in weak walls",
      );
    });
  });

  describe("cutoutPadding validation", () => {
    it("should return error when cutoutPadding is negative", () => {
      const config = { ...createValidConfig(), cutoutPadding: -1 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("cutoutPadding cannot be negative");
    });

    it("should return error when cutoutPadding is negative decimal", () => {
      const config = { ...createValidConfig(), cutoutPadding: -0.5 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("cutoutPadding cannot be negative");
    });

    it("should allow cutoutPadding of 0", () => {
      const config = { ...createValidConfig(), cutoutPadding: 0 };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).not.toContain("cutoutPadding cannot be negative");
    });
  });

  describe("multiple errors", () => {
    it("should return multiple errors when multiple validations fail", () => {
      const config: GridfinityBinConfig = {
        ...createValidConfig(),
        gridUnitsX: 0,
        gridUnitsY: 15,
        binHeight: 5,
        cutoutDepth: 1,
        wallThickness: 0.5,
        cutoutPadding: -2,
      };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain("gridUnitsX must be between 1 and 10");
      expect(result.errors).toContain("gridUnitsY must be between 1 and 10");
      expect(result.errors).toContain("binHeight must be at least 7mm");
      expect(result.errors).toContain("cutoutDepth must be at least 3mm");
      expect(result.errors).toContain("wallThickness must be at least 1mm");
      expect(result.errors).toContain("cutoutPadding cannot be negative");
    });

    it("should return both errors and warnings when applicable", () => {
      const config: GridfinityBinConfig = {
        ...createValidConfig(),
        binHeight: 15, // Non-standard height (warning)
        wallThickness: 1.2, // Below recommended (warning)
        cutoutDepth: 20, // Greater than binHeight (error)
      };
      const result = validateBinConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.errors).toContain(
        "cutoutDepth (20mm) must be less than binHeight (15mm)",
      );
      expect(result.warnings).toContain(
        "binHeight should be in 7mm increments for standard Gridfinity compatibility",
      );
      expect(result.warnings).toContain(
        "wallThickness below 2mm may result in weak walls",
      );
    });
  });
});
