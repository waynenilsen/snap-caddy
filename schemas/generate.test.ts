/**
 * Unit tests for generate.ts Zod schemas
 */

import { describe, it, expect } from 'bun:test';
import {
  GridfinityConfigSchema,
  GenerateRequestSchema,
  GenerationStatusSchema,
  GenerateResponseSchema,
  GenerateErrorResponseSchema,
  GenerationStatusResponseSchema,
} from './generate';

describe('GridfinityConfigSchema', () => {
  describe('valid configurations', () => {
    it('should validate a config with all fields explicitly set', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 3,
        binHeight: 42,
        cutoutDepth: 10,
        wallThickness: 1.5,
        paddingTop: 3,
        paddingBottom: 3,
        paddingLeft: 3,
        paddingRight: 3,
        magnetHoles: true,
        screwHoles: false,
        stackingLip: true,
        cornerRadius: 1.0,
        baseThickness: 6,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('should validate a minimal config with only required fields', () => {
      const config = {
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 7,
        cutoutDepth: 1,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('default values', () => {
    it('should apply default value for wallThickness', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.parse(config);
      expect(result.wallThickness).toBe(1.2);
    });

    it('should apply default values for padding fields', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.parse(config);
      expect(result.paddingTop).toBe(2);
      expect(result.paddingBottom).toBe(2);
      expect(result.paddingLeft).toBe(2);
      expect(result.paddingRight).toBe(2);
    });

    it('should apply default values for base options', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.parse(config);
      expect(result.magnetHoles).toBe(true);
      expect(result.screwHoles).toBe(false);
      expect(result.stackingLip).toBe(true);
    });

    it('should apply default values for advanced options', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.parse(config);
      expect(result.cornerRadius).toBe(0.5);
      expect(result.baseThickness).toBe(5);
    });

    it('should not override explicitly set values', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        wallThickness: 2.5,
        paddingTop: 5,
        magnetHoles: false,
        cornerRadius: 2.0,
      };

      const result = GridfinityConfigSchema.parse(config);
      expect(result.wallThickness).toBe(2.5);
      expect(result.paddingTop).toBe(5);
      expect(result.magnetHoles).toBe(false);
      expect(result.cornerRadius).toBe(2.0);
    });
  });

  describe('gridUnitsX validation', () => {
    it('should accept gridUnitsX at minimum bound (1)', () => {
      const config = {
        gridUnitsX: 1,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept gridUnitsX at maximum bound (10)', () => {
      const config = {
        gridUnitsX: 10,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject gridUnitsX below minimum (0)', () => {
      const config = {
        gridUnitsX: 0,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject gridUnitsX above maximum (11)', () => {
      const config = {
        gridUnitsX: 11,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer gridUnitsX', () => {
      const config = {
        gridUnitsX: 2.5,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('gridUnitsY validation', () => {
    it('should accept gridUnitsY at minimum bound (1)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 1,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept gridUnitsY at maximum bound (10)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 10,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject gridUnitsY below minimum (0)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 0,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject gridUnitsY above maximum (11)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 11,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer gridUnitsY', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2.5,
        binHeight: 20,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('binHeight validation', () => {
    it('should accept binHeight at minimum bound (7)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 7,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept binHeight at maximum bound (100)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 100,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject binHeight below minimum (6)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 6,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject binHeight above maximum (101)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 101,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept decimal binHeight within range', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 42.5,
        cutoutDepth: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('cutoutDepth validation', () => {
    it('should accept cutoutDepth at minimum bound (1)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 1,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept cutoutDepth at maximum bound (50)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 60,
        cutoutDepth: 50,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject cutoutDepth below minimum (0)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 0,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject cutoutDepth above maximum (51)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 60,
        cutoutDepth: 51,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept decimal cutoutDepth within range', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 7.5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('wallThickness validation', () => {
    it('should accept wallThickness at minimum bound (0.5)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        wallThickness: 0.5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept wallThickness at maximum bound (5)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        wallThickness: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject wallThickness below minimum (0.4)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        wallThickness: 0.4,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject wallThickness above maximum (5.1)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        wallThickness: 5.1,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('padding validation', () => {
    it('should accept padding values at minimum bound (0)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept padding values at maximum bound (20)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 50,
        cutoutDepth: 5,
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 20,
        paddingRight: 20,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject negative padding values', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        paddingTop: -1,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject padding values above maximum', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 50,
        cutoutDepth: 5,
        paddingBottom: 21,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('cornerRadius validation', () => {
    it('should accept cornerRadius at minimum bound (0)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        cornerRadius: 0,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept cornerRadius at maximum bound (5)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        cornerRadius: 5,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject cornerRadius below minimum', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        cornerRadius: -0.1,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject cornerRadius above maximum', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        cornerRadius: 5.1,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('baseThickness validation', () => {
    it('should accept baseThickness at minimum bound (2)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        baseThickness: 2,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept baseThickness at maximum bound (10)', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        baseThickness: 10,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject baseThickness below minimum', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        baseThickness: 1.9,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject baseThickness above maximum', () => {
      const config = {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 20,
        cutoutDepth: 5,
        baseThickness: 10.1,
      };

      const result = GridfinityConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});

describe('GenerateRequestSchema', () => {
  const validConfig = {
    gridUnitsX: 2,
    gridUnitsY: 2,
    binHeight: 20,
    cutoutDepth: 5,
  };

  describe('valid requests', () => {
    it('should validate a request with svg and config', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate a request with all optional fields', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        async: true,
        webhookUrl: 'https://example.com/webhook',
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('svg validation', () => {
    it('should accept svg at minimum length (10 characters)', () => {
      const request = {
        svg: '1234567890', // Exactly 10 characters
        config: validConfig,
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject svg below minimum length (9 characters)', () => {
      const request = {
        svg: '123456789', // Only 9 characters
        config: validConfig,
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject empty svg string', () => {
      const request = {
        svg: '',
        config: validConfig,
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('async field', () => {
    it('should default async to false when not provided', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
      };

      const result = GenerateRequestSchema.parse(request);
      expect(result.async).toBe(false);
    });

    it('should accept explicit async true value', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        async: true,
      };

      const result = GenerateRequestSchema.parse(request);
      expect(result.async).toBe(true);
    });

    it('should accept explicit async false value', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        async: false,
      };

      const result = GenerateRequestSchema.parse(request);
      expect(result.async).toBe(false);
    });
  });

  describe('webhookUrl validation', () => {
    it('should accept valid HTTP URL', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        webhookUrl: 'http://example.com/webhook',
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should accept valid HTTPS URL', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        webhookUrl: 'https://example.com/webhook',
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should accept URL with path and query parameters', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        webhookUrl: 'https://example.com/api/webhook?token=abc123',
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL format', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        webhookUrl: 'not-a-valid-url',
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject empty string as webhookUrl', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
        webhookUrl: '',
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should allow webhookUrl to be omitted', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: validConfig,
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('config validation', () => {
    it('should reject request with invalid config', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
        config: {
          gridUnitsX: 0, // Invalid: below minimum
          gridUnitsY: 2,
          binHeight: 20,
          cutoutDepth: 5,
        },
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject request with missing config', () => {
      const request = {
        svg: '<svg><rect width="100" height="100"/></svg>',
      };

      const result = GenerateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });
});

describe('GenerationStatusSchema', () => {
  it('should accept "queued" status', () => {
    const result = GenerationStatusSchema.safeParse('queued');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('queued');
    }
  });

  it('should accept "processing" status', () => {
    const result = GenerationStatusSchema.safeParse('processing');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('processing');
    }
  });

  it('should accept "complete" status', () => {
    const result = GenerationStatusSchema.safeParse('complete');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('complete');
    }
  });

  it('should accept "error" status', () => {
    const result = GenerationStatusSchema.safeParse('error');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('error');
    }
  });

  it('should reject invalid status value', () => {
    const result = GenerationStatusSchema.safeParse('invalid');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = GenerationStatusSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('should reject non-string values', () => {
    const result = GenerationStatusSchema.safeParse(123);
    expect(result.success).toBe(false);
  });
});

describe('GenerateResponseSchema', () => {
  it('should validate a complete success response', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      estimatedTimeMs: 5000,
      downloadUrl: 'https://example.com/download/model.stl',
      previewUrl: 'https://example.com/preview/model.png',
      queuePosition: 1,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate a minimal success response', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate response with queued status', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      queuePosition: 5,
      estimatedTimeMs: 30000,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate response with processing status', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'processing' as const,
      estimatedTimeMs: 10000,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should reject response with success: false', () => {
    const response = {
      success: false,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject response with invalid UUID format', () => {
    const response = {
      success: true,
      generationId: 'not-a-uuid',
      status: 'complete' as const,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject response with invalid status', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'invalid',
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject negative estimatedTimeMs', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'processing' as const,
      estimatedTimeMs: -100,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject invalid downloadUrl format', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      downloadUrl: 'not-a-url',
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject negative queuePosition', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      queuePosition: -1,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject zero queuePosition', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      queuePosition: 0,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject non-integer queuePosition', () => {
    const response = {
      success: true,
      generationId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      queuePosition: 1.5,
    };

    const result = GenerateResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});

describe('GenerateErrorResponseSchema', () => {
  it('should validate a complete error response', () => {
    const response = {
      success: false,
      error: 'Invalid SVG format',
      code: 'INVALID_SVG' as const,
      details: { line: 5, column: 10 },
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate error response without details', () => {
    const response = {
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT' as const,
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should accept INVALID_INPUT error code', () => {
    const response = {
      success: false,
      error: 'Invalid input provided',
      code: 'INVALID_INPUT' as const,
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should accept INVALID_SVG error code', () => {
    const response = {
      success: false,
      error: 'SVG parsing failed',
      code: 'INVALID_SVG' as const,
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should accept OPENSCAD_ERROR error code', () => {
    const response = {
      success: false,
      error: 'OpenSCAD compilation failed',
      code: 'OPENSCAD_ERROR' as const,
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should accept RATE_LIMIT error code', () => {
    const response = {
      success: false,
      error: 'Too many requests',
      code: 'RATE_LIMIT' as const,
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should accept SERVER_ERROR error code', () => {
    const response = {
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR' as const,
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should reject invalid error code', () => {
    const response = {
      success: false,
      error: 'Something went wrong',
      code: 'UNKNOWN_ERROR',
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject response with success: true', () => {
    const response = {
      success: true,
      error: 'Error message',
      code: 'SERVER_ERROR' as const,
    };

    const result = GenerateErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should accept various types for details field', () => {
    const responses = [
      {
        success: false,
        error: 'Error',
        code: 'SERVER_ERROR' as const,
        details: 'string details',
      },
      {
        success: false,
        error: 'Error',
        code: 'SERVER_ERROR' as const,
        details: { key: 'value' },
      },
      {
        success: false,
        error: 'Error',
        code: 'SERVER_ERROR' as const,
        details: [1, 2, 3],
      },
      {
        success: false,
        error: 'Error',
        code: 'SERVER_ERROR' as const,
        details: null,
      },
    ];

    responses.forEach((response) => {
      const result = GenerateErrorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('GenerationStatusResponseSchema', () => {
  it('should validate a complete status response', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      downloadUrl: 'https://example.com/download/model.stl',
      previewUrl: 'https://example.com/preview/model.png',
      error: undefined,
      createdAt: '2024-01-15T10:30:00Z',
      completedAt: '2024-01-15T10:35:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate a minimal status response', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      progress: 0,
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate status response with error', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'error' as const,
      progress: 50,
      error: 'Processing failed',
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate progress at minimum bound (0)', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      progress: 0,
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate progress at maximum bound (100)', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should reject progress below minimum', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
      progress: -1,
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject progress above maximum', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 101,
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID format', () => {
    const response = {
      id: 'not-a-uuid',
      status: 'complete' as const,
      progress: 100,
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime format for createdAt', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      createdAt: 'not-a-datetime',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime format for completedAt', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      createdAt: '2024-01-15T10:30:00Z',
      completedAt: 'not-a-datetime',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should validate ISO 8601 datetime format with Z timezone', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate ISO 8601 datetime format with milliseconds', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      createdAt: '2024-01-15T10:30:00.123Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should reject invalid URL format for downloadUrl', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      downloadUrl: 'not-a-url',
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should reject invalid URL format for previewUrl', () => {
    const response = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'complete' as const,
      progress: 100,
      previewUrl: 'not-a-url',
      createdAt: '2024-01-15T10:30:00Z',
    };

    const result = GenerationStatusResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});
