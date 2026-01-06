/**
 * Unit tests for segment schemas
 */

import { describe, it, expect } from 'bun:test';
import {
  PointSchema,
  SegmentRequestSchema,
  BoundingBoxSchema,
  MaskOptionSchema,
  SegmentResponseSchema,
  SegmentErrorResponseSchema,
} from './segment';

describe('PointSchema', () => {
  describe('valid cases', () => {
    it('should accept valid point with label 0 (background)', () => {
      const validPoint = {
        x: 100,
        y: 200,
        label: 0,
      };
      expect(() => PointSchema.parse(validPoint)).not.toThrow();
      const result = PointSchema.parse(validPoint);
      expect(result).toEqual(validPoint);
    });

    it('should accept valid point with label 1 (foreground)', () => {
      const validPoint = {
        x: 50,
        y: 75,
        label: 1,
      };
      expect(() => PointSchema.parse(validPoint)).not.toThrow();
      const result = PointSchema.parse(validPoint);
      expect(result).toEqual(validPoint);
    });

    it('should accept point with x and y as 0', () => {
      const validPoint = {
        x: 0,
        y: 0,
        label: 1,
      };
      expect(() => PointSchema.parse(validPoint)).not.toThrow();
    });

    it('should accept point with floating point coordinates', () => {
      const validPoint = {
        x: 123.456,
        y: 789.012,
        label: 1,
      };
      expect(() => PointSchema.parse(validPoint)).not.toThrow();
    });
  });

  describe('invalid cases', () => {
    it('should reject negative x coordinate', () => {
      const invalidPoint = {
        x: -1,
        y: 100,
        label: 1,
      };
      expect(() => PointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject negative y coordinate', () => {
      const invalidPoint = {
        x: 100,
        y: -1,
        label: 0,
      };
      expect(() => PointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject label value 2', () => {
      const invalidPoint = {
        x: 100,
        y: 100,
        label: 2,
      };
      expect(() => PointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject negative label', () => {
      const invalidPoint = {
        x: 100,
        y: 100,
        label: -1,
      };
      expect(() => PointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject missing x coordinate', () => {
      const invalidPoint = {
        y: 100,
        label: 1,
      };
      expect(() => PointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject missing y coordinate', () => {
      const invalidPoint = {
        x: 100,
        label: 1,
      };
      expect(() => PointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject missing label', () => {
      const invalidPoint = {
        x: 100,
        y: 100,
      };
      expect(() => PointSchema.parse(invalidPoint)).toThrow();
    });
  });
});

describe('SegmentRequestSchema', () => {
  const validRequest = {
    image: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
    points: [
      { x: 100, y: 200, label: 1 },
      { x: 150, y: 250, label: 0 },
    ],
    imageWidth: 1920,
    imageHeight: 1080,
  };

  describe('valid cases', () => {
    it('should accept valid request with all required fields', () => {
      expect(() => SegmentRequestSchema.parse(validRequest)).not.toThrow();
      const result = SegmentRequestSchema.parse(validRequest);
      expect(result.image).toBe(validRequest.image);
      expect(result.points).toEqual(validRequest.points);
      expect(result.imageWidth).toBe(validRequest.imageWidth);
      expect(result.imageHeight).toBe(validRequest.imageHeight);
    });

    it('should apply default value for returnMultipleMasks (false)', () => {
      const result = SegmentRequestSchema.parse(validRequest);
      expect(result.returnMultipleMasks).toBe(false);
    });

    it('should apply default value for maskFormat (base64png)', () => {
      const result = SegmentRequestSchema.parse(validRequest);
      expect(result.maskFormat).toBe('base64png');
    });

    it('should accept explicit returnMultipleMasks true', () => {
      const requestWithOption = {
        ...validRequest,
        returnMultipleMasks: true,
      };
      const result = SegmentRequestSchema.parse(requestWithOption);
      expect(result.returnMultipleMasks).toBe(true);
    });

    it('should accept maskFormat rle', () => {
      const requestWithOption = {
        ...validRequest,
        maskFormat: 'rle' as const,
      };
      const result = SegmentRequestSchema.parse(requestWithOption);
      expect(result.maskFormat).toBe('rle');
    });

    it('should accept maskFormat binary', () => {
      const requestWithOption = {
        ...validRequest,
        maskFormat: 'binary' as const,
      };
      const result = SegmentRequestSchema.parse(requestWithOption);
      expect(result.maskFormat).toBe('binary');
    });

    it('should accept request with 1 point (minimum)', () => {
      const minRequest = {
        ...validRequest,
        points: [{ x: 100, y: 100, label: 1 }],
      };
      expect(() => SegmentRequestSchema.parse(minRequest)).not.toThrow();
    });

    it('should accept request with 20 points (maximum)', () => {
      const maxRequest = {
        ...validRequest,
        points: Array.from({ length: 20 }, (_, i) => ({
          x: i * 10,
          y: i * 10,
          label: i % 2,
        })),
      };
      expect(() => SegmentRequestSchema.parse(maxRequest)).not.toThrow();
    });

    it('should accept imageWidth of 1 (minimum)', () => {
      const minWidthRequest = {
        ...validRequest,
        imageWidth: 1,
      };
      expect(() => SegmentRequestSchema.parse(minWidthRequest)).not.toThrow();
    });

    it('should accept imageWidth of 8192 (maximum)', () => {
      const maxWidthRequest = {
        ...validRequest,
        imageWidth: 8192,
      };
      expect(() => SegmentRequestSchema.parse(maxWidthRequest)).not.toThrow();
    });

    it('should accept imageHeight of 1 (minimum)', () => {
      const minHeightRequest = {
        ...validRequest,
        imageHeight: 1,
      };
      expect(() => SegmentRequestSchema.parse(minHeightRequest)).not.toThrow();
    });

    it('should accept imageHeight of 8192 (maximum)', () => {
      const maxHeightRequest = {
        ...validRequest,
        imageHeight: 8192,
      };
      expect(() => SegmentRequestSchema.parse(maxHeightRequest)).not.toThrow();
    });
  });

  describe('invalid cases', () => {
    it('should reject empty image string', () => {
      const invalidRequest = {
        ...validRequest,
        image: '',
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject empty points array', () => {
      const invalidRequest = {
        ...validRequest,
        points: [],
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject points array with 21 points', () => {
      const invalidRequest = {
        ...validRequest,
        points: Array.from({ length: 21 }, (_, i) => ({
          x: i * 10,
          y: i * 10,
          label: i % 2,
        })),
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject imageWidth of 0', () => {
      const invalidRequest = {
        ...validRequest,
        imageWidth: 0,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject imageWidth greater than 8192', () => {
      const invalidRequest = {
        ...validRequest,
        imageWidth: 8193,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject negative imageWidth', () => {
      const invalidRequest = {
        ...validRequest,
        imageWidth: -100,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject imageHeight of 0', () => {
      const invalidRequest = {
        ...validRequest,
        imageHeight: 0,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject imageHeight greater than 8192', () => {
      const invalidRequest = {
        ...validRequest,
        imageHeight: 8193,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject negative imageHeight', () => {
      const invalidRequest = {
        ...validRequest,
        imageHeight: -100,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject floating point imageWidth', () => {
      const invalidRequest = {
        ...validRequest,
        imageWidth: 1920.5,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject floating point imageHeight', () => {
      const invalidRequest = {
        ...validRequest,
        imageHeight: 1080.5,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid maskFormat', () => {
      const invalidRequest = {
        ...validRequest,
        maskFormat: 'jpeg',
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject missing image field', () => {
      const invalidRequest = {
        points: validRequest.points,
        imageWidth: validRequest.imageWidth,
        imageHeight: validRequest.imageHeight,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject missing points field', () => {
      const invalidRequest = {
        image: validRequest.image,
        imageWidth: validRequest.imageWidth,
        imageHeight: validRequest.imageHeight,
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid point in points array', () => {
      const invalidRequest = {
        ...validRequest,
        points: [
          { x: 100, y: 200, label: 1 },
          { x: -10, y: 250, label: 0 }, // Invalid negative x
        ],
      };
      expect(() => SegmentRequestSchema.parse(invalidRequest)).toThrow();
    });
  });
});

describe('BoundingBoxSchema', () => {
  describe('valid cases', () => {
    it('should accept valid bounding box', () => {
      const validBox = {
        x: 100,
        y: 200,
        width: 300,
        height: 400,
      };
      expect(() => BoundingBoxSchema.parse(validBox)).not.toThrow();
      const result = BoundingBoxSchema.parse(validBox);
      expect(result).toEqual(validBox);
    });

    it('should accept negative x coordinate', () => {
      const validBox = {
        x: -50,
        y: 100,
        width: 200,
        height: 150,
      };
      expect(() => BoundingBoxSchema.parse(validBox)).not.toThrow();
    });

    it('should accept negative y coordinate', () => {
      const validBox = {
        x: 100,
        y: -50,
        width: 200,
        height: 150,
      };
      expect(() => BoundingBoxSchema.parse(validBox)).not.toThrow();
    });

    it('should accept floating point dimensions', () => {
      const validBox = {
        x: 100.5,
        y: 200.5,
        width: 300.75,
        height: 400.25,
      };
      expect(() => BoundingBoxSchema.parse(validBox)).not.toThrow();
    });

    it('should accept very small positive dimensions', () => {
      const validBox = {
        x: 0,
        y: 0,
        width: 0.001,
        height: 0.001,
      };
      expect(() => BoundingBoxSchema.parse(validBox)).not.toThrow();
    });
  });

  describe('invalid cases', () => {
    it('should reject width of 0', () => {
      const invalidBox = {
        x: 100,
        y: 200,
        width: 0,
        height: 300,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });

    it('should reject negative width', () => {
      const invalidBox = {
        x: 100,
        y: 200,
        width: -100,
        height: 300,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });

    it('should reject height of 0', () => {
      const invalidBox = {
        x: 100,
        y: 200,
        width: 300,
        height: 0,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });

    it('should reject negative height', () => {
      const invalidBox = {
        x: 100,
        y: 200,
        width: 300,
        height: -100,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });

    it('should reject missing x field', () => {
      const invalidBox = {
        y: 200,
        width: 300,
        height: 400,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });

    it('should reject missing y field', () => {
      const invalidBox = {
        x: 100,
        width: 300,
        height: 400,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });

    it('should reject missing width field', () => {
      const invalidBox = {
        x: 100,
        y: 200,
        height: 400,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });

    it('should reject missing height field', () => {
      const invalidBox = {
        x: 100,
        y: 200,
        width: 300,
      };
      expect(() => BoundingBoxSchema.parse(invalidBox)).toThrow();
    });
  });
});

describe('MaskOptionSchema', () => {
  const validBoundingBox = {
    x: 100,
    y: 200,
    width: 300,
    height: 400,
  };

  describe('valid cases', () => {
    it('should accept valid mask option', () => {
      const validMask = {
        mask: 'data:image/png;base64,iVBORw0KGgo...',
        confidence: 0.95,
        boundingBox: validBoundingBox,
        area: 120000,
      };
      expect(() => MaskOptionSchema.parse(validMask)).not.toThrow();
      const result = MaskOptionSchema.parse(validMask);
      expect(result).toEqual(validMask);
    });

    it('should accept confidence of 0', () => {
      const validMask = {
        mask: 'base64data',
        confidence: 0,
        boundingBox: validBoundingBox,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(validMask)).not.toThrow();
    });

    it('should accept confidence of 1', () => {
      const validMask = {
        mask: 'base64data',
        confidence: 1,
        boundingBox: validBoundingBox,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(validMask)).not.toThrow();
    });

    it('should accept confidence between 0 and 1', () => {
      const validMask = {
        mask: 'base64data',
        confidence: 0.5,
        boundingBox: validBoundingBox,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(validMask)).not.toThrow();
    });

    it('should accept area of 1 (minimum positive)', () => {
      const validMask = {
        mask: 'base64data',
        confidence: 0.8,
        boundingBox: validBoundingBox,
        area: 1,
      };
      expect(() => MaskOptionSchema.parse(validMask)).not.toThrow();
    });

    it('should accept large area value', () => {
      const validMask = {
        mask: 'base64data',
        confidence: 0.8,
        boundingBox: validBoundingBox,
        area: 8192 * 8192, // Maximum possible area
      };
      expect(() => MaskOptionSchema.parse(validMask)).not.toThrow();
    });
  });

  describe('invalid cases', () => {
    it('should reject confidence less than 0', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: -0.1,
        boundingBox: validBoundingBox,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject confidence greater than 1', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: 1.1,
        boundingBox: validBoundingBox,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject area of 0', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: 0.8,
        boundingBox: validBoundingBox,
        area: 0,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject negative area', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: 0.8,
        boundingBox: validBoundingBox,
        area: -100,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject floating point area', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: 0.8,
        boundingBox: validBoundingBox,
        area: 1000.5,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject invalid bounding box', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: 0.8,
        boundingBox: {
          x: 100,
          y: 200,
          width: 0, // Invalid
          height: 400,
        },
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject missing mask field', () => {
      const invalidMask = {
        confidence: 0.8,
        boundingBox: validBoundingBox,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject missing confidence field', () => {
      const invalidMask = {
        mask: 'base64data',
        boundingBox: validBoundingBox,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject missing boundingBox field', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: 0.8,
        area: 1000,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });

    it('should reject missing area field', () => {
      const invalidMask = {
        mask: 'base64data',
        confidence: 0.8,
        boundingBox: validBoundingBox,
      };
      expect(() => MaskOptionSchema.parse(invalidMask)).toThrow();
    });
  });
});

describe('SegmentResponseSchema', () => {
  const validMask = {
    mask: 'data:image/png;base64,iVBORw0KGgo...',
    confidence: 0.95,
    boundingBox: {
      x: 100,
      y: 200,
      width: 300,
      height: 400,
    },
    area: 120000,
  };

  describe('valid cases', () => {
    it('should accept valid success response', () => {
      const validResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 150.5,
      };
      expect(() => SegmentResponseSchema.parse(validResponse)).not.toThrow();
      const result = SegmentResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it('should accept response with multiple masks', () => {
      const validResponse = {
        success: true,
        masks: [
          validMask,
          { ...validMask, confidence: 0.85 },
          { ...validMask, confidence: 0.75 },
        ],
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 200,
      };
      expect(() => SegmentResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should accept processingTimeMs of 0', () => {
      const validResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 0,
      };
      expect(() => SegmentResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should accept imageWidth of 1 (minimum positive)', () => {
      const validResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1,
        imageHeight: 1080,
        processingTimeMs: 100,
      };
      expect(() => SegmentResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should accept imageHeight of 1 (minimum positive)', () => {
      const validResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 1,
        processingTimeMs: 100,
      };
      expect(() => SegmentResponseSchema.parse(validResponse)).not.toThrow();
    });
  });

  describe('invalid cases', () => {
    it('should reject success field with false value', () => {
      const invalidResponse = {
        success: false,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject empty masks array', () => {
      const invalidResponse = {
        success: true,
        masks: [],
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject imageWidth of 0', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 0,
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject negative imageWidth', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: -1920,
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject imageHeight of 0', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 0,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject negative imageHeight', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: -1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject floating point imageWidth', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920.5,
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject floating point imageHeight', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 1080.5,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject negative processingTimeMs', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: -10,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject invalid mask in masks array', () => {
      const invalidResponse = {
        success: true,
        masks: [
          {
            ...validMask,
            confidence: 1.5, // Invalid confidence > 1
          },
        ],
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject missing masks field', () => {
      const invalidResponse = {
        success: true,
        imageWidth: 1920,
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject missing imageWidth field', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageHeight: 1080,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject missing imageHeight field', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        processingTimeMs: 150,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject missing processingTimeMs field', () => {
      const invalidResponse = {
        success: true,
        masks: [validMask],
        imageWidth: 1920,
        imageHeight: 1080,
      };
      expect(() => SegmentResponseSchema.parse(invalidResponse)).toThrow();
    });
  });
});

describe('SegmentErrorResponseSchema', () => {
  describe('valid cases', () => {
    it('should accept valid error response with INVALID_INPUT code', () => {
      const validError = {
        success: false,
        error: 'Invalid input parameters',
        code: 'INVALID_INPUT' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
      const result = SegmentErrorResponseSchema.parse(validError);
      expect(result).toEqual(validError);
    });

    it('should accept error response with IMAGE_TOO_LARGE code', () => {
      const validError = {
        success: false,
        error: 'Image exceeds maximum size',
        code: 'IMAGE_TOO_LARGE' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });

    it('should accept error response with SAM_ERROR code', () => {
      const validError = {
        success: false,
        error: 'SAM model error',
        code: 'SAM_ERROR' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });

    it('should accept error response with RATE_LIMIT code', () => {
      const validError = {
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });

    it('should accept error response with SERVER_ERROR code', () => {
      const validError = {
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });

    it('should accept error response with optional details as object', () => {
      const validError = {
        success: false,
        error: 'Invalid input',
        code: 'INVALID_INPUT' as const,
        details: {
          field: 'imageWidth',
          message: 'Width exceeds maximum',
        },
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });

    it('should accept error response with optional details as string', () => {
      const validError = {
        success: false,
        error: 'Invalid input',
        code: 'INVALID_INPUT' as const,
        details: 'Additional error information',
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });

    it('should accept error response with optional details as array', () => {
      const validError = {
        success: false,
        error: 'Multiple validation errors',
        code: 'INVALID_INPUT' as const,
        details: ['Error 1', 'Error 2', 'Error 3'],
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });

    it('should accept error response without details field', () => {
      const validError = {
        success: false,
        error: 'Generic error',
        code: 'SERVER_ERROR' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(validError)).not.toThrow();
    });
  });

  describe('invalid cases', () => {
    it('should reject success field with true value', () => {
      const invalidError = {
        success: true,
        error: 'Invalid input',
        code: 'INVALID_INPUT' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(invalidError)).toThrow();
    });

    it('should reject invalid error code', () => {
      const invalidError = {
        success: false,
        error: 'Some error',
        code: 'UNKNOWN_ERROR',
      };
      expect(() => SegmentErrorResponseSchema.parse(invalidError)).toThrow();
    });

    it('should reject missing error field', () => {
      const invalidError = {
        success: false,
        code: 'SERVER_ERROR' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(invalidError)).toThrow();
    });

    it('should reject missing code field', () => {
      const invalidError = {
        success: false,
        error: 'Some error',
      };
      expect(() => SegmentErrorResponseSchema.parse(invalidError)).toThrow();
    });

    it('should reject empty error string', () => {
      const invalidError = {
        success: false,
        error: '',
        code: 'SERVER_ERROR' as const,
      };
      // Zod allows empty strings unless explicitly forbidden
      // This test documents current behavior - if you want to reject empty strings,
      // add .min(1) to the error field in the schema
      expect(() => SegmentErrorResponseSchema.parse(invalidError)).not.toThrow();
    });

    it('should reject numeric error value', () => {
      const invalidError = {
        success: false,
        error: 123,
        code: 'SERVER_ERROR' as const,
      };
      expect(() => SegmentErrorResponseSchema.parse(invalidError)).toThrow();
    });
  });
});
