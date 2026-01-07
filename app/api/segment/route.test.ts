/**
 * Unit tests for Segment API Route
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";
import type { SegmentResponse } from "@/types/api";
import { POST } from "./route";

// Mock modules
const mockRunSAMSegmentation = mock(() =>
  Promise.resolve({
    masks: [
      {
        mask: "base64-encoded-mask-data",
        confidence: 0.95,
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        area: 10000,
      },
    ],
  }),
);

const mockValidateBase64Image = mock(() => ({
  valid: true as boolean,
  size: 1024000, // 1MB
  width: 1024,
  height: 768,
}));

const mockDecodeBase64Image = mock(() => Buffer.from("fake-image-data"));

const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

const mockMetrics = {
  recordSegmentation: mock(() => {}),
  recordError: mock(() => {}),
};

// Mock the imported modules
mock.module("@/lib/sam/inference", () => ({
  runSAMSegmentation: mockRunSAMSegmentation,
}));

mock.module("@/lib/validation/image", () => ({
  validateBase64Image: mockValidateBase64Image,
  decodeBase64Image: mockDecodeBase64Image,
}));

mock.module("@/lib/logger", () => ({
  logger: mockLogger,
  metrics: mockMetrics,
}));

// Counter for unique IPs to avoid rate limit collisions
let ipCounter = 0;

// Helper to create mock NextRequest
function createMockRequest(
  body: unknown,
  options?: { headers?: Record<string, string> },
): NextRequest {
  const url = "http://localhost:3000/api/segment";

  // Use unique IP for each request unless explicitly provided
  const headers = {
    "content-type": "application/json",
    "x-forwarded-for": `test-ip-${ipCounter++}`,
    ...options?.headers,
  };

  const request = new NextRequest(url, {
    method: "POST",
    headers,
  });

  // Override json() method to return our test data
  request.json = mock(() => Promise.resolve(body));

  return request;
}

// Valid test data
const validRequestBody = {
  image:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  points: [
    { x: 100, y: 100, label: 1 },
    { x: 200, y: 200, label: 0 },
  ],
  imageWidth: 1024,
  imageHeight: 768,
  returnMultipleMasks: false,
  maskFormat: "base64png" as const,
};

describe("POST /api/segment", () => {
  beforeEach(() => {
    // Note: Do NOT reset ipCounter here - it needs to be global to avoid collisions

    // Reset all mocks before each test
    mockRunSAMSegmentation.mockClear();
    mockValidateBase64Image.mockClear();
    mockDecodeBase64Image.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockMetrics.recordSegmentation.mockClear();
    mockMetrics.recordError.mockClear();

    // Reset mock implementations to defaults
    mockRunSAMSegmentation.mockImplementation(() =>
      Promise.resolve({
        masks: [
          {
            mask: "base64-encoded-mask-data",
            confidence: 0.95,
            boundingBox: { x: 10, y: 10, width: 100, height: 100 },
            area: 10000,
          },
        ],
      }),
    );

    mockValidateBase64Image.mockImplementation(() => ({
      valid: true as boolean,
      size: 1024000,
      width: 1024,
      height: 768,
    }));

    mockDecodeBase64Image.mockImplementation(() =>
      Buffer.from("fake-image-data"),
    );
  });

  describe("Valid requests", () => {
    it("should return success response with mask data", async () => {
      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = (await response.json()) as SegmentResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.masks).toHaveLength(1);
      expect(data.masks[0].mask).toBe("base64-encoded-mask-data");
      expect(data.masks[0].confidence).toBe(0.95);
      expect(data.imageWidth).toBe(1024);
      expect(data.imageHeight).toBe(768);
      expect(data.processingTimeMs).toBeGreaterThanOrEqual(0);

      // Verify mocks were called
      expect(mockValidateBase64Image).toHaveBeenCalledWith(
        validRequestBody.image,
        {
          maxSize: 10 * 1024 * 1024,
          maxWidth: 4096,
          maxHeight: 4096,
          allowedFormats: ["png", "jpg", "jpeg", "webp"],
        },
      );
      expect(mockDecodeBase64Image).toHaveBeenCalledWith(
        validRequestBody.image,
      );
      expect(mockRunSAMSegmentation).toHaveBeenCalledWith({
        imageBuffer: expect.any(Buffer),
        points: validRequestBody.points,
        imageWidth: validRequestBody.imageWidth,
        imageHeight: validRequestBody.imageHeight,
        returnMultiple: validRequestBody.returnMultipleMasks,
        outputFormat: validRequestBody.maskFormat,
      });
      expect(mockMetrics.recordSegmentation).toHaveBeenCalled();
    });

    it("should handle multiple points correctly", async () => {
      const multiPointBody = {
        ...validRequestBody,
        points: [
          { x: 50, y: 50, label: 1 },
          { x: 100, y: 100, label: 1 },
          { x: 150, y: 150, label: 0 },
        ],
      };

      const request = createMockRequest(multiPointBody);
      const response = await POST(request);
      const data = (await response.json()) as SegmentResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockRunSAMSegmentation).toHaveBeenCalledWith(
        expect.objectContaining({
          points: multiPointBody.points,
        }),
      );
    });

    it("should handle returnMultipleMasks option", async () => {
      const multiMaskBody = {
        ...validRequestBody,
        returnMultipleMasks: true,
      };

      mockRunSAMSegmentation.mockImplementation(() =>
        Promise.resolve({
          masks: [
            {
              mask: "mask1",
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 100, height: 100 },
              area: 10000,
            },
            {
              mask: "mask2",
              confidence: 0.85,
              boundingBox: { x: 15, y: 15, width: 90, height: 90 },
              area: 8100,
            },
          ],
        }),
      );

      const request = createMockRequest(multiMaskBody);
      const response = await POST(request);
      const data = (await response.json()) as SegmentResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.masks).toHaveLength(2);
      expect(mockRunSAMSegmentation).toHaveBeenCalledWith(
        expect.objectContaining({
          returnMultiple: true,
        }),
      );
    });

    it("should handle different mask formats", async () => {
      const rleFormatBody = {
        ...validRequestBody,
        maskFormat: "rle" as const,
      };

      const request = createMockRequest(rleFormatBody);
      const response = await POST(request);
      const data = (await response.json()) as SegmentResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockRunSAMSegmentation).toHaveBeenCalledWith(
        expect.objectContaining({
          outputFormat: "rle",
        }),
      );
    });
  });

  describe("Invalid JSON", () => {
    it("should return 500 for invalid JSON", async () => {
      const request = createMockRequest(null);
      // Override json() to throw error
      request.json = mock(() =>
        Promise.reject(new SyntaxError("Unexpected end of JSON input")),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
      expect(mockMetrics.recordError).toHaveBeenCalled();
    });
  });

  describe("Schema validation", () => {
    it("should return 400 for missing image field", async () => {
      const invalidBody = {
        points: [{ x: 100, y: 100, label: 1 }],
        imageWidth: 1024,
        imageHeight: 768,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid request");
      expect(data.code).toBe("INVALID_INPUT");
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should return 400 for missing points field", async () => {
      const invalidBody = {
        image: validRequestBody.image,
        imageWidth: 1024,
        imageHeight: 768,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid request");
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 for empty points array", async () => {
      const invalidBody = {
        ...validRequestBody,
        points: [],
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 for too many points (>20)", async () => {
      const invalidBody = {
        ...validRequestBody,
        points: Array.from({ length: 21 }, (_, i) => ({
          x: i * 10,
          y: i * 10,
          label: 1,
        })),
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 for invalid point label", async () => {
      const invalidBody = {
        ...validRequestBody,
        points: [{ x: 100, y: 100, label: 2 }], // Invalid label (must be 0 or 1)
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 for negative point coordinates", async () => {
      const invalidBody = {
        ...validRequestBody,
        points: [{ x: -10, y: 100, label: 1 }],
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 for missing imageWidth", async () => {
      const invalidBody = {
        image: validRequestBody.image,
        points: validRequestBody.points,
        imageHeight: 768,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 for invalid imageWidth (>8192)", async () => {
      const invalidBody = {
        ...validRequestBody,
        imageWidth: 8193,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 for invalid maskFormat", async () => {
      const invalidBody = {
        ...validRequestBody,
        maskFormat: "invalid-format",
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });
  });

  describe("Image validation", () => {
    it("should return 400 when image validation fails", async () => {
      mockValidateBase64Image.mockImplementation(() => ({
        valid: false as const,
        error: "Invalid image format",
        size: 1024000,
        width: 0,
        height: 0,
      }));

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid image format");
      expect(data.code).toBe("INVALID_INPUT");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Image validation failed",
        expect.objectContaining({
          error: "Invalid image format",
        }),
      );
    });

    it("should return 400 when image is too large", async () => {
      mockValidateBase64Image.mockImplementation(() => ({
        valid: false as const,
        error: "Image size exceeds maximum allowed size",
        size: 15 * 1024 * 1024, // 15MB
        width: 0,
        height: 0,
      }));

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });

    it("should return 400 when image format is not allowed", async () => {
      mockValidateBase64Image.mockImplementation(() => ({
        valid: false as const,
        error: "Image format not allowed",
        size: 0,
        width: 0,
        height: 0,
      }));

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_INPUT");
    });
  });

  describe("Image dimensions validation", () => {
    it("should return 400 when imageWidth exceeds 4096", async () => {
      const invalidBody = {
        ...validRequestBody,
        imageWidth: 4097,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe(
        "Image dimensions exceed maximum allowed size (4096x4096)",
      );
      expect(data.code).toBe("IMAGE_TOO_LARGE");
    });

    it("should return 400 when imageHeight exceeds 4096", async () => {
      const invalidBody = {
        ...validRequestBody,
        imageHeight: 5000,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe(
        "Image dimensions exceed maximum allowed size (4096x4096)",
      );
      expect(data.code).toBe("IMAGE_TOO_LARGE");
    });

    it("should return 400 when both dimensions exceed 4096", async () => {
      const invalidBody = {
        ...validRequestBody,
        imageWidth: 5000,
        imageHeight: 5000,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("IMAGE_TOO_LARGE");
    });

    it("should accept dimensions exactly at 4096", async () => {
      const validBody = {
        ...validRequestBody,
        imageWidth: 4096,
        imageHeight: 4096,
      };

      const request = createMockRequest(validBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("SAM segmentation errors", () => {
    it("should return 503 for Replicate API errors", async () => {
      mockRunSAMSegmentation.mockImplementation(() =>
        Promise.reject(new Error("Replicate API error: Service unavailable")),
      );

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe("SAM segmentation service error");
      expect(data.code).toBe("SAM_ERROR");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should return 503 for prediction errors", async () => {
      mockRunSAMSegmentation.mockImplementation(() =>
        Promise.reject(new Error("prediction failed: timeout")),
      );

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe("SAM segmentation service error");
      expect(data.code).toBe("SAM_ERROR");
    });

    it("should return 500 for generic errors", async () => {
      mockRunSAMSegmentation.mockImplementation(() =>
        Promise.reject(new Error("Generic error")),
      );

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Internal server error during segmentation");
      expect(data.code).toBe("SERVER_ERROR");
    });

    it("should return 500 for non-Error throws", async () => {
      mockRunSAMSegmentation.mockImplementation(() =>
        Promise.reject("string error"),
      );

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.code).toBe("SERVER_ERROR");
    });
  });

  describe("Rate limiting", () => {
    // Note: Testing rate limiting is complex because it's in the wrapper.
    // These tests verify the middleware integration.

    it("should add rate limit headers to successful response", async () => {
      const testIp = "rate-limit-test-1";
      const request = createMockRequest(validRequestBody, {
        headers: { "x-forwarded-for": testIp },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.has("X-RateLimit-Remaining")).toBe(true);
      expect(response.headers.has("X-RateLimit-Reset")).toBe(true);
    });

    it("should return 429 after exceeding rate limit", async () => {
      const testIp = "rate-limit-test-2";

      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        const request = createMockRequest(validRequestBody, {
          headers: { "x-forwarded-for": testIp },
        });
        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // 11th request should be rate limited
      const request = createMockRequest(validRequestBody, {
        headers: { "x-forwarded-for": testIp },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Rate limit exceeded");
      expect(data.code).toBe("RATE_LIMIT");
      expect(data.retryAfter).toBeGreaterThan(0);
      expect(response.headers.get("Retry-After")).toBeTruthy();
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("should track rate limits per IP address", async () => {
      const testIp1 = "rate-limit-test-3";
      const testIp2 = "rate-limit-test-4";

      // IP 1 makes 5 requests
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(validRequestBody, {
          headers: { "x-forwarded-for": testIp1 },
        });
        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // IP 2 should have its own limit
      const request = createMockRequest(validRequestBody, {
        headers: { "x-forwarded-for": testIp2 },
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("9"); // First request for IP 2
    });
  });

  describe("Error handling wrapper", () => {
    it("should catch and format APIError correctly", async () => {
      // Force an APIError by providing invalid dimensions
      const invalidBody = {
        ...validRequestBody,
        imageWidth: 5000,
      };

      const request = createMockRequest(invalidBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
      expect(data.code).toBe("IMAGE_TOO_LARGE");
    });

    it("should handle unexpected errors gracefully", async () => {
      mockDecodeBase64Image.mockImplementation(() => {
        throw new Error("Unexpected decoding error");
      });

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.code).toBe("SERVER_ERROR");
      expect(mockMetrics.recordError).toHaveBeenCalled();
    });
  });

  describe("Logging and metrics", () => {
    it("should log segmentation request details", async () => {
      const request = createMockRequest(validRequestBody);
      await POST(request);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Processing segmentation request",
        expect.objectContaining({
          imageWidth: validRequestBody.imageWidth,
          imageHeight: validRequestBody.imageHeight,
          pointCount: validRequestBody.points.length,
          imageSize: 1024000,
        }),
      );
    });

    it("should log successful completion with metrics", async () => {
      const request = createMockRequest(validRequestBody);
      await POST(request);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Segmentation completed successfully",
        expect.objectContaining({
          maskCount: 1,
          processingTimeMs: expect.any(Number),
        }),
      );
    });

    it("should record segmentation metrics", async () => {
      const request = createMockRequest(validRequestBody);
      await POST(request);

      expect(mockMetrics.recordSegmentation).toHaveBeenCalledWith(
        expect.any(Number),
      );
    });

    it("should log validation errors", async () => {
      const invalidBody = {
        image: validRequestBody.image,
        points: [],
        imageWidth: 1024,
        imageHeight: 768,
      };

      const request = createMockRequest(invalidBody);
      await POST(request);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid segment request",
        expect.objectContaining({
          errors: expect.any(Array),
        }),
      );
    });

    it("should log SAM errors", async () => {
      mockRunSAMSegmentation.mockImplementation(() =>
        Promise.reject(new Error("SAM error")),
      );

      const request = createMockRequest(validRequestBody);
      await POST(request);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Segmentation error",
        expect.objectContaining({
          error: "SAM error",
          duration: expect.any(Number),
        }),
      );
    });
  });

  describe("Processing time", () => {
    it("should include processing time in response", async () => {
      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = (await response.json()) as SegmentResponse;

      expect(data.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof data.processingTimeMs).toBe("number");
    });

    it("should measure processing time accurately", async () => {
      // Mock a delay in SAM processing
      mockRunSAMSegmentation.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                masks: [
                  {
                    mask: "base64-encoded-mask-data",
                    confidence: 0.95,
                    boundingBox: { x: 10, y: 10, width: 100, height: 100 },
                    area: 10000,
                  },
                ],
              });
            }, 50);
          }),
      );

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = (await response.json()) as SegmentResponse;

      expect(data.processingTimeMs).toBeGreaterThanOrEqual(50);
    });
  });
});
