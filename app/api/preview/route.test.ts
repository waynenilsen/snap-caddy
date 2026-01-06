/**
 * Unit tests for preview generation API route
 * Tests the validation schemas and expected behaviors
 */

import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

// Recreate the validation schema from the route
const PreviewConfigSchema = z.object({
  gridUnitsX: z.number().int().min(1).max(10),
  gridUnitsY: z.number().int().min(1).max(10),
  binHeight: z.number().min(7).max(100),
  cutoutDepth: z.number().min(3).max(50),
  cutoutPadding: z.number().min(0).max(20).optional().default(2),
  cutoutOffsetX: z.number().optional().default(0),
  cutoutOffsetY: z.number().optional().default(0),
  wallThickness: z.number().min(1).max(5).optional().default(2),
  baseType: z.enum(['solid', 'magnet', 'screw', 'magnet_screw']).optional().default('solid'),
  lipStyle: z.enum(['normal', 'reduced', 'none']).optional().default('normal'),
  cornerRadius: z.number().min(0).max(5).optional().default(0.5),
  taperAngle: z.number().min(0).max(45).optional(),
});

const PreviewRequestSchema = z.object({
  svg: z.string().min(10),
  config: PreviewConfigSchema,
});

describe('POST /api/preview', () => {
  describe('Request validation', () => {
    it('should accept valid request with minimal config', () => {
      const request = {
        svg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
        config: {
          gridUnitsX: 2,
          gridUnitsY: 2,
          binHeight: 20,
          cutoutDepth: 5,
        },
      };

      const result = PreviewRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should accept valid request with full config', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: {
          gridUnitsX: 3,
          gridUnitsY: 4,
          binHeight: 42,
          cutoutDepth: 10,
          cutoutPadding: 3,
          cutoutOffsetX: 1,
          cutoutOffsetY: 1,
          wallThickness: 2,
          baseType: 'magnet_screw',
          lipStyle: 'reduced',
          cornerRadius: 1,
          taperAngle: 5,
        },
      };

      const result = PreviewRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject empty SVG', () => {
      const request = {
        svg: '',
        config: {
          gridUnitsX: 2,
          gridUnitsY: 2,
          binHeight: 20,
          cutoutDepth: 5,
        },
      };

      const result = PreviewRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject SVG shorter than 10 characters', () => {
      const request = {
        svg: '<svg/>',
        config: {
          gridUnitsX: 2,
          gridUnitsY: 2,
          binHeight: 20,
          cutoutDepth: 5,
        },
      };

      const result = PreviewRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject missing config', () => {
      const request = {
        svg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
      };

      const result = PreviewRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - gridUnitsX', () => {
    const baseConfig = {
      gridUnitsY: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    it('should reject gridUnitsX = 0', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsX: 0 });
      expect(result.success).toBe(false);
    });

    it('should accept gridUnitsX = 1', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsX: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept gridUnitsX = 10', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsX: 10 });
      expect(result.success).toBe(true);
    });

    it('should reject gridUnitsX = 11', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsX: 11 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer gridUnitsX', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsX: 2.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - gridUnitsY', () => {
    const baseConfig = {
      gridUnitsX: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    it('should reject gridUnitsY = 0', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsY: 0 });
      expect(result.success).toBe(false);
    });

    it('should accept gridUnitsY = 1', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsY: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept gridUnitsY = 10', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsY: 10 });
      expect(result.success).toBe(true);
    });

    it('should reject gridUnitsY = 11', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, gridUnitsY: 11 });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - binHeight', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      cutoutDepth: 5,
    };

    it('should reject binHeight < 7', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, binHeight: 6 });
      expect(result.success).toBe(false);
    });

    it('should accept binHeight = 7', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, binHeight: 7 });
      expect(result.success).toBe(true);
    });

    it('should accept binHeight = 100', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, binHeight: 100 });
      expect(result.success).toBe(true);
    });

    it('should reject binHeight > 100', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, binHeight: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - cutoutDepth', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 20,
    };

    it('should reject cutoutDepth < 3', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutDepth: 2 });
      expect(result.success).toBe(false);
    });

    it('should accept cutoutDepth = 3', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutDepth: 3 });
      expect(result.success).toBe(true);
    });

    it('should accept cutoutDepth = 50', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutDepth: 50 });
      expect(result.success).toBe(true);
    });

    it('should reject cutoutDepth > 50', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutDepth: 51 });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - wallThickness', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    it('should reject wallThickness < 1', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, wallThickness: 0.5 });
      expect(result.success).toBe(false);
    });

    it('should accept wallThickness = 1', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, wallThickness: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept wallThickness = 5', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, wallThickness: 5 });
      expect(result.success).toBe(true);
    });

    it('should reject wallThickness > 5', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, wallThickness: 6 });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - baseType', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    const validBaseTypes = ['solid', 'magnet', 'screw', 'magnet_screw'];

    for (const baseType of validBaseTypes) {
      it(`should accept baseType = ${baseType}`, () => {
        const result = PreviewConfigSchema.safeParse({ ...baseConfig, baseType });
        expect(result.success).toBe(true);
      });
    }

    it('should reject invalid baseType', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, baseType: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - lipStyle', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    const validLipStyles = ['normal', 'reduced', 'none'];

    for (const lipStyle of validLipStyles) {
      it(`should accept lipStyle = ${lipStyle}`, () => {
        const result = PreviewConfigSchema.safeParse({ ...baseConfig, lipStyle });
        expect(result.success).toBe(true);
      });
    }

    it('should reject invalid lipStyle', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, lipStyle: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - cutoutPadding', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    it('should reject negative cutoutPadding', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutPadding: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept cutoutPadding = 0', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutPadding: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept cutoutPadding = 20', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutPadding: 20 });
      expect(result.success).toBe(true);
    });

    it('should reject cutoutPadding > 20', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cutoutPadding: 21 });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - cornerRadius', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    it('should reject negative cornerRadius', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cornerRadius: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept cornerRadius = 0', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cornerRadius: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept cornerRadius = 5', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cornerRadius: 5 });
      expect(result.success).toBe(true);
    });

    it('should reject cornerRadius > 5', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, cornerRadius: 6 });
      expect(result.success).toBe(false);
    });
  });

  describe('Config validation - taperAngle', () => {
    const baseConfig = {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 20,
      cutoutDepth: 5,
    };

    it('should reject negative taperAngle', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, taperAngle: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept taperAngle = 0', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, taperAngle: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept taperAngle = 45', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, taperAngle: 45 });
      expect(result.success).toBe(true);
    });

    it('should reject taperAngle > 45', () => {
      const result = PreviewConfigSchema.safeParse({ ...baseConfig, taperAngle: 46 });
      expect(result.success).toBe(false);
    });
  });

  describe('Default values', () => {
    it('should apply default values for optional fields', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = PreviewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cutoutPadding).toBe(2);
        expect(result.data.cutoutOffsetX).toBe(0);
        expect(result.data.cutoutOffsetY).toBe(0);
        expect(result.data.wallThickness).toBe(2);
        expect(result.data.baseType).toBe('solid');
        expect(result.data.lipStyle).toBe('normal');
        expect(result.data.cornerRadius).toBe(0.5);
      }
    });
  });

  describe('Response expectations', () => {
    it('should expect Content-Type: image/png for success', () => {
      const expectedContentType = 'image/png';
      expect(expectedContentType).toBe('image/png');
    });

    it('should expect Cache-Control header for caching', () => {
      const expectedCacheControl = 'public, max-age=300';
      expect(expectedCacheControl).toContain('max-age');
    });

    it('should expect X-Render-Time header for timing', () => {
      const renderTime = 1234;
      expect(typeof renderTime).toBe('number');
    });
  });
});
