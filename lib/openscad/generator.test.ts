import { describe, expect, it } from "bun:test";
import type { GridfinityBinConfig } from "@/types/configuration";
import { OpenSCADGenerator } from "./generator";

describe("OpenSCADGenerator", () => {
  const generator = new OpenSCADGenerator();

  describe("populateTemplate", () => {
    const mockConfig: GridfinityBinConfig = {
      gridUnitsX: 2,
      gridUnitsY: 3,
      binHeight: 42,
      cutoutDepth: 5,
      wallThickness: 1.5,
      cutoutPadding: 2,
      cutoutOffsetX: 0,
      cutoutOffsetY: 0,
      baseType: "solid",
      lipStyle: "normal",
      cornerRadius: 0.5,
    };

    it("should replace all placeholders correctly", () => {
      const template = `
// Grid dimensions
grid_x = {{GRID_X}};
grid_y = {{GRID_Y}};
bin_height = {{BIN_HEIGHT}};

// SVG and cutout
svg_file = "{{SVG_FILE_PATH}}";
cutout_depth = {{CUTOUT_DEPTH}};

// Wall and base
wall_thickness = {{WALL_THICKNESS}};
base_style = {{BASE_STYLE}};
lip_style = {{LIP_STYLE}};

// Corner and padding
corner_radius = {{CORNER_RADIUS}};
padding_top = {{PADDING_TOP}};
padding_bottom = {{PADDING_BOTTOM}};
padding_left = {{PADDING_LEFT}};
padding_right = {{PADDING_RIGHT}};
base_thickness = {{BASE_THICKNESS}};

// Metadata
timestamp = "{{TIMESTAMP}}";
`;

      const result = generator.populateTemplate(
        template,
        "/path/to/file.svg",
        mockConfig,
      );

      expect(result).toContain("grid_x = 2;");
      expect(result).toContain("grid_y = 3;");
      expect(result).toContain("bin_height = 42;");
      expect(result).toContain('svg_file = "/path/to/file.svg";');
      expect(result).toContain("cutout_depth = 5;");
      expect(result).toContain("wall_thickness = 1.5;");
      expect(result).toContain("base_style = 0;");
      expect(result).toContain("lip_style = 0;");
      expect(result).toContain("corner_radius = 0.5;");
      expect(result).toContain("padding_top = 2;");
      expect(result).toContain("padding_bottom = 2;");
      expect(result).toContain("padding_left = 2;");
      expect(result).toContain("padding_right = 2;");
      expect(result).toContain("base_thickness = 5;");
      expect(result).toContain('timestamp = "');
      expect(result).not.toContain("{{");
    });

    it("should handle multiple occurrences of the same placeholder", () => {
      const template = "{{GRID_X}} {{GRID_X}} {{GRID_X}}";
      const result = generator.populateTemplate(
        template,
        "/test.svg",
        mockConfig,
      );
      expect(result).toBe("2 2 2");
    });

    it("should apply all padding values from cutoutPadding", () => {
      const configWithPadding: GridfinityBinConfig = {
        ...mockConfig,
        cutoutPadding: 3.5,
      };

      const template =
        "{{PADDING_TOP}} {{PADDING_BOTTOM}} {{PADDING_LEFT}} {{PADDING_RIGHT}}";
      const result = generator.populateTemplate(
        template,
        "/test.svg",
        configWithPadding,
      );
      expect(result).toBe("3.5 3.5 3.5 3.5");
    });

    it("should use default corner radius when not specified", () => {
      const configWithoutRadius: GridfinityBinConfig = {
        ...mockConfig,
        cornerRadius: undefined,
      };

      const template = "{{CORNER_RADIUS}}";
      const result = generator.populateTemplate(
        template,
        "/test.svg",
        configWithoutRadius,
      );
      expect(result).toBe("0.5");
    });

    it("should include ISO timestamp", () => {
      const template = "{{TIMESTAMP}}";
      const result = generator.populateTemplate(
        template,
        "/test.svg",
        mockConfig,
      );

      // Verify it's a valid ISO 8601 timestamp
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(() => new Date(result)).not.toThrow();
    });
  });

  describe("baseTypeToNumber", () => {
    const baseConfig: GridfinityBinConfig = {
      gridUnitsX: 1,
      gridUnitsY: 1,
      binHeight: 10,
      cutoutDepth: 2,
      wallThickness: 1,
      cutoutPadding: 1,
      cutoutOffsetX: 0,
      cutoutOffsetY: 0,
      baseType: "solid",
      lipStyle: "normal",
    };

    it("should map solid to 0", () => {
      const template = "{{BASE_STYLE}}";
      const result = generator.populateTemplate(template, "/test.svg", {
        ...baseConfig,
        baseType: "solid",
      });
      expect(result).toBe("0");
    });

    it("should map magnet to 1", () => {
      const template = "{{BASE_STYLE}}";
      const result = generator.populateTemplate(template, "/test.svg", {
        ...baseConfig,
        baseType: "magnet",
      });
      expect(result).toBe("1");
    });

    it("should map screw to 2", () => {
      const template = "{{BASE_STYLE}}";
      const result = generator.populateTemplate(template, "/test.svg", {
        ...baseConfig,
        baseType: "screw",
      });
      expect(result).toBe("2");
    });

    it("should map magnet_screw to 3", () => {
      const template = "{{BASE_STYLE}}";
      const result = generator.populateTemplate(template, "/test.svg", {
        ...baseConfig,
        baseType: "magnet_screw",
      });
      expect(result).toBe("3");
    });
  });

  describe("lipStyleToNumber", () => {
    const baseConfig: GridfinityBinConfig = {
      gridUnitsX: 1,
      gridUnitsY: 1,
      binHeight: 10,
      cutoutDepth: 2,
      wallThickness: 1,
      cutoutPadding: 1,
      cutoutOffsetX: 0,
      cutoutOffsetY: 0,
      baseType: "solid",
      lipStyle: "normal",
    };

    it("should map normal to 0", () => {
      const template = "{{LIP_STYLE}}";
      const result = generator.populateTemplate(template, "/test.svg", {
        ...baseConfig,
        lipStyle: "normal",
      });
      expect(result).toBe("0");
    });

    it("should map reduced to 1", () => {
      const template = "{{LIP_STYLE}}";
      const result = generator.populateTemplate(template, "/test.svg", {
        ...baseConfig,
        lipStyle: "reduced",
      });
      expect(result).toBe("1");
    });

    it("should map none to 2", () => {
      const template = "{{LIP_STYLE}}";
      const result = generator.populateTemplate(template, "/test.svg", {
        ...baseConfig,
        lipStyle: "none",
      });
      expect(result).toBe("2");
    });
  });

  describe("escapeScadString", () => {
    const baseConfig: GridfinityBinConfig = {
      gridUnitsX: 1,
      gridUnitsY: 1,
      binHeight: 10,
      cutoutDepth: 2,
      wallThickness: 1,
      cutoutPadding: 1,
      cutoutOffsetX: 0,
      cutoutOffsetY: 0,
      baseType: "solid",
      lipStyle: "normal",
    };

    it("should escape backslashes", () => {
      const template = "{{SVG_FILE_PATH}}";
      const result = generator.populateTemplate(
        template,
        "C:\\path\\to\\file.svg",
        baseConfig,
      );
      expect(result).toBe("C:\\\\path\\\\to\\\\file.svg");
    });

    it("should escape double quotes", () => {
      const template = "{{SVG_FILE_PATH}}";
      const result = generator.populateTemplate(
        template,
        '/path/with"quotes"/file.svg',
        baseConfig,
      );
      expect(result).toBe('/path/with\\"quotes\\"/file.svg');
    });

    it("should escape both backslashes and quotes", () => {
      const template = "{{SVG_FILE_PATH}}";
      const result = generator.populateTemplate(
        template,
        'C:\\path\\"quoted"\\file.svg',
        baseConfig,
      );
      expect(result).toBe('C:\\\\path\\\\\\"quoted\\"\\\\file.svg');
    });

    it("should handle strings without special characters", () => {
      const template = "{{SVG_FILE_PATH}}";
      const result = generator.populateTemplate(
        template,
        "/simple/path/file.svg",
        baseConfig,
      );
      expect(result).toBe("/simple/path/file.svg");
    });
  });

  describe("edge cases", () => {
    const baseConfig: GridfinityBinConfig = {
      gridUnitsX: 1,
      gridUnitsY: 1,
      binHeight: 10,
      cutoutDepth: 2,
      wallThickness: 1,
      cutoutPadding: 1,
      cutoutOffsetX: 0,
      cutoutOffsetY: 0,
      baseType: "solid",
      lipStyle: "normal",
    };

    it("should handle zero values in configuration", () => {
      const config: GridfinityBinConfig = {
        ...baseConfig,
        gridUnitsX: 0,
        gridUnitsY: 0,
        binHeight: 0,
        cornerRadius: 0,
      };

      const template = "{{GRID_X}} {{GRID_Y}} {{BIN_HEIGHT}} {{CORNER_RADIUS}}";
      const result = generator.populateTemplate(template, "/test.svg", config);
      expect(result).toBe("0 0 0 0");
    });

    it("should handle very large numeric values", () => {
      const config: GridfinityBinConfig = {
        ...baseConfig,
        gridUnitsX: 999999,
        gridUnitsY: 888888,
        binHeight: 1000000,
      };

      const template = "{{GRID_X}} {{GRID_Y}} {{BIN_HEIGHT}}";
      const result = generator.populateTemplate(template, "/test.svg", config);
      expect(result).toBe("999999 888888 1000000");
    });

    it("should handle decimal values correctly", () => {
      const config: GridfinityBinConfig = {
        ...baseConfig,
        binHeight: 10.5,
        cutoutDepth: 2.25,
        wallThickness: 1.125,
        cornerRadius: 0.75,
      };

      const template =
        "{{BIN_HEIGHT}} {{CUTOUT_DEPTH}} {{WALL_THICKNESS}} {{CORNER_RADIUS}}";
      const result = generator.populateTemplate(template, "/test.svg", config);
      expect(result).toBe("10.5 2.25 1.125 0.75");
    });

    it("should handle empty template", () => {
      const result = generator.populateTemplate("", "/test.svg", baseConfig);
      expect(result).toBe("");
    });

    it("should handle template with no placeholders", () => {
      const template = "This is a plain text template with no variables";
      const result = generator.populateTemplate(
        template,
        "/test.svg",
        baseConfig,
      );
      expect(result).toBe(template);
    });
  });
});
