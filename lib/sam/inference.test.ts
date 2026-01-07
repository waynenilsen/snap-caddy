/**
 * Unit tests for SAM (Segment Anything Model) Inference
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { SAMSegmentationParams } from "./types";

// Mock the env module
const mockEnv = {
  REPLICATE_API_TOKEN: "",
  SAM_MODEL_VERSION: "meta/sam-2-hiera-large",
  OPENSCAD_PATH: "openscad",
  GRIDFINITY_LIB_PATH: "/usr/local/share/gridfinity",
  OPENSCAD_USE_XVFB: true,
  OPENSCAD_TIMEOUT: 300000,
  TEMP_DIR: "/tmp/snap-caddy",
  MAX_FILE_SIZE: 10485760,
  FILE_RETENTION_MS: 3600000,
  RATE_LIMIT_REQUESTS: 10,
  RATE_LIMIT_WINDOW: 60000,
  GENERATE_PREVIEWS: false,
  ENABLE_ASYNC_GENERATION: false,
  LOG_LEVEL: "info" as const,
  NODE_ENV: "test" as const,
};

// Mock the env module before importing inference
mock.module("@/lib/env", () => ({
  env: mockEnv,
}));

// Mock the logger module to suppress logs during tests
mock.module("@/lib/logger", () => ({
  logger: {
    info: mock(() => {}),
    debug: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  },
}));

// Now import the module under test
import { analyzeMask, encodeRLE, runSAMSegmentation } from "./inference";

describe("detectImageType (via bufferToDataUri)", () => {
  describe("PNG detection", () => {
    it("should detect PNG from magic bytes", async () => {
      // Mock fetch to capture the data URI
      const mockFetch = mock(async (url: string, options?: any) => {
        // POST request - create prediction
        if (options?.method === "POST") {
          const body = JSON.parse(options.body);
          expect(body.input.image).toStartWith("data:image/png;base64,");

          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        // GET request - download mask
        if (url.includes("example.com")) {
          const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          return new Response(pngBuffer, { status: 200 });
        }

        // GET request - poll prediction (should never be called since POST returns succeeded)
        if (url.includes("predictions/test-prediction")) {
          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        // Default response
        return new Response("{}", { status: 200 });
      });

      global.fetch = mockFetch as any;

      // Create PNG buffer with magic bytes: 0x89, 0x50, 0x4e, 0x47
      const pngBuffer = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...Array(100).fill(0),
      ]);

      const params: SAMSegmentationParams = {
        imageBuffer: pngBuffer,
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      // Set mock env token
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      try {
        await runSAMSegmentation(params);
        expect(mockFetch).toHaveBeenCalled();
      } finally {
        mockEnv.REPLICATE_API_TOKEN = "";
      }
    });
  });

  describe("JPEG detection", () => {
    it("should detect JPEG from magic bytes", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (options?.method === "POST") {
          const body = JSON.parse(options.body);
          expect(body.input.image).toStartWith("data:image/jpeg;base64,");

          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        if (url.includes("example.com")) {
          const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          return new Response(pngBuffer, { status: 200 });
        }

        if (url.includes("predictions/test-prediction")) {
          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        return new Response("{}", { status: 200 });
      });

      global.fetch = mockFetch as any;

      // Create JPEG buffer with magic bytes: 0xff, 0xd8, 0xff
      const jpegBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(100).fill(0),
      ]);

      const params: SAMSegmentationParams = {
        imageBuffer: jpegBuffer,
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      mockEnv.REPLICATE_API_TOKEN = "test-token";

      try {
        await runSAMSegmentation(params);
        expect(mockFetch).toHaveBeenCalled();
      } finally {
        mockEnv.REPLICATE_API_TOKEN = "";
      }
    });
  });

  describe("WebP detection", () => {
    it("should detect WebP from magic bytes", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (options?.method === "POST") {
          const body = JSON.parse(options.body);
          expect(body.input.image).toStartWith("data:image/webp;base64,");

          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        if (url.includes("example.com")) {
          const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          return new Response(pngBuffer, { status: 200 });
        }

        if (url.includes("predictions/test-prediction")) {
          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        return new Response("{}", { status: 200 });
      });

      global.fetch = mockFetch as any;

      // Create WebP buffer with magic bytes at positions 8-11: 0x57, 0x45, 0x42, 0x50
      const webpBuffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // File size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
        ...Array(100).fill(0),
      ]);

      const params: SAMSegmentationParams = {
        imageBuffer: webpBuffer,
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      mockEnv.REPLICATE_API_TOKEN = "test-token";

      try {
        await runSAMSegmentation(params);
        expect(mockFetch).toHaveBeenCalled();
      } finally {
        mockEnv.REPLICATE_API_TOKEN = "";
      }
    });
  });

  describe("Unknown format", () => {
    it("should default to PNG for unknown format", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (options?.method === "POST") {
          const body = JSON.parse(options.body);
          expect(body.input.image).toStartWith("data:image/png;base64,");

          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        if (url.includes("example.com")) {
          const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          return new Response(pngBuffer, { status: 200 });
        }

        if (url.includes("predictions/test-prediction")) {
          return new Response(
            JSON.stringify({
              id: "test-prediction",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        return new Response("{}", { status: 200 });
      });

      global.fetch = mockFetch as any;

      // Create buffer with unknown magic bytes
      const unknownBuffer = Buffer.from([
        0x00,
        0x00,
        0x00,
        0x00,
        ...Array(100).fill(0),
      ]);

      const params: SAMSegmentationParams = {
        imageBuffer: unknownBuffer,
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      mockEnv.REPLICATE_API_TOKEN = "test-token";

      try {
        await runSAMSegmentation(params);
        expect(mockFetch).toHaveBeenCalled();
      } finally {
        mockEnv.REPLICATE_API_TOKEN = "";
      }
    });
  });
});

describe("analyzeMask", () => {
  describe("PNG file handling", () => {
    it("should return estimated bounding box for PNG files", () => {
      // Create PNG buffer with magic bytes
      const pngBuffer = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        ...Array(100).fill(0),
      ]);

      const width = 200;
      const height = 150;

      const analysis = analyzeMask(pngBuffer, width, height);

      // Should return estimated values (10% margin, 80% size)
      expect(analysis.boundingBox.x).toBe(Math.floor(width * 0.1));
      expect(analysis.boundingBox.y).toBe(Math.floor(height * 0.1));
      expect(analysis.boundingBox.width).toBe(Math.floor(width * 0.8));
      expect(analysis.boundingBox.height).toBe(Math.floor(height * 0.8));
      expect(analysis.area).toBe(Math.floor(width * height * 0.64));
    });
  });

  describe("Binary mask handling", () => {
    it("should calculate correct bounding box for binary mask", () => {
      const width = 10;
      const height = 10;

      // Create a binary mask with a rectangle from (2,2) to (6,6)
      const maskBuffer = Buffer.alloc(width * height);

      for (let y = 2; y <= 6; y++) {
        for (let x = 2; x <= 6; x++) {
          maskBuffer[y * width + x] = 255;
        }
      }

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.boundingBox.x).toBe(2);
      expect(analysis.boundingBox.y).toBe(2);
      expect(analysis.boundingBox.width).toBe(5); // 6 - 2 + 1
      expect(analysis.boundingBox.height).toBe(5); // 6 - 2 + 1
      expect(analysis.area).toBe(25); // 5 * 5
    });

    it("should handle mask in top-left corner", () => {
      const width = 10;
      const height = 10;

      // Create a mask in top-left corner
      const maskBuffer = Buffer.alloc(width * height);
      maskBuffer[0] = 255; // (0, 0)
      maskBuffer[1] = 255; // (1, 0)
      maskBuffer[width] = 255; // (0, 1)

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.boundingBox.x).toBe(0);
      expect(analysis.boundingBox.y).toBe(0);
      expect(analysis.boundingBox.width).toBe(2);
      expect(analysis.boundingBox.height).toBe(2);
      expect(analysis.area).toBe(3);
    });

    it("should handle mask in bottom-right corner", () => {
      const width = 10;
      const height = 10;

      // Create a mask in bottom-right corner
      const maskBuffer = Buffer.alloc(width * height);
      maskBuffer[99] = 255; // (9, 9)
      maskBuffer[98] = 255; // (8, 9)
      maskBuffer[89] = 255; // (9, 8)

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.boundingBox.x).toBe(8);
      expect(analysis.boundingBox.y).toBe(8);
      expect(analysis.boundingBox.width).toBe(2);
      expect(analysis.boundingBox.height).toBe(2);
      expect(analysis.area).toBe(3);
    });

    it("should calculate correct area for scattered mask", () => {
      const width = 10;
      const height = 10;

      // Create a scattered mask
      const maskBuffer = Buffer.alloc(width * height);
      maskBuffer[0] = 255; // (0, 0)
      maskBuffer[50] = 255; // (0, 5)
      maskBuffer[99] = 255; // (9, 9)

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.area).toBe(3);
      expect(analysis.boundingBox.x).toBe(0);
      expect(analysis.boundingBox.y).toBe(0);
      expect(analysis.boundingBox.width).toBe(10); // 9 - 0 + 1
      expect(analysis.boundingBox.height).toBe(10); // 9 - 0 + 1
    });
  });

  describe("Empty mask handling", () => {
    it("should return zero area for empty mask", () => {
      const width = 10;
      const height = 10;

      // Create an empty mask (all zeros)
      const maskBuffer = Buffer.alloc(width * height);

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.boundingBox.x).toBe(0);
      expect(analysis.boundingBox.y).toBe(0);
      expect(analysis.boundingBox.width).toBe(0);
      expect(analysis.boundingBox.height).toBe(0);
      expect(analysis.area).toBe(0);
    });

    it("should return zero area for below-threshold values", () => {
      const width = 10;
      const height = 10;

      // Create a mask with values below threshold (128)
      const maskBuffer = Buffer.alloc(width * height);
      maskBuffer.fill(100); // All values below 128

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.area).toBe(0);
    });
  });

  describe("Threshold behavior", () => {
    it("should include pixels above 128 threshold", () => {
      const width = 5;
      const height = 5;

      const maskBuffer = Buffer.alloc(width * height);
      maskBuffer[0] = 129; // Just above threshold
      maskBuffer[1] = 255; // Well above threshold

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.area).toBe(2);
    });

    it("should exclude pixels at or below 128 threshold", () => {
      const width = 5;
      const height = 5;

      const maskBuffer = Buffer.alloc(width * height);
      maskBuffer[0] = 128; // At threshold
      maskBuffer[1] = 127; // Below threshold
      maskBuffer[2] = 0; // Well below threshold

      const analysis = analyzeMask(maskBuffer, width, height);

      expect(analysis.area).toBe(0);
    });
  });
});

describe("encodeRLE", () => {
  describe("PNG file handling", () => {
    it("should return placeholder for PNG files", () => {
      // Create PNG buffer with magic bytes
      const pngBuffer = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        ...Array(100).fill(0),
      ]);

      const rle = encodeRLE(pngBuffer, 100, 100);

      expect(rle).toBe("RLE_ENCODED_MASK_DATA");
    });
  });

  describe("Binary mask RLE encoding", () => {
    it("should encode simple alternating pattern", () => {
      const width = 4;
      const height = 1;

      // Create pattern: 0, 255, 0, 255
      const maskBuffer = Buffer.from([0, 255, 0, 255]);

      const rle = encodeRLE(maskBuffer, width, height);

      // Should encode as: starting with 0, runs of [1, 1, 1, 1]
      expect(rle).toBe("4,1:1,1,1,1");
    });

    it("should encode all zeros", () => {
      const width = 5;
      const height = 2;

      const maskBuffer = Buffer.alloc(width * height);

      const rle = encodeRLE(maskBuffer, width, height);

      // Should encode as: starting with 0, one run of 10
      expect(rle).toBe("5,2:10");
    });

    it("should encode all ones", () => {
      const width = 5;
      const height = 2;

      const maskBuffer = Buffer.alloc(width * height);
      maskBuffer.fill(255);

      const rle = encodeRLE(maskBuffer, width, height);

      // Should encode as: starting with 1, one run of 10
      expect(rle).toBe("5,2:10");
    });

    it("should encode continuous runs", () => {
      const width = 8;
      const height = 1;

      // Create pattern: [0, 0, 0, 255, 255, 255, 255, 0]
      const maskBuffer = Buffer.from([0, 0, 0, 255, 255, 255, 255, 0]);

      const rle = encodeRLE(maskBuffer, width, height);

      // Should encode as: starting with 0, runs of [3, 4, 1]
      expect(rle).toBe("8,1:3,4,1");
    });

    it("should handle single pixel mask", () => {
      const width = 1;
      const height = 1;

      const maskBuffer = Buffer.from([255]);

      const rle = encodeRLE(maskBuffer, width, height);

      expect(rle).toBe("1,1:1");
    });

    it("should handle threshold boundary values", () => {
      const width = 5;
      const height = 1;

      // Values at and around threshold: 127, 128, 129, 130, 255
      const maskBuffer = Buffer.from([127, 128, 129, 130, 255]);

      const rle = encodeRLE(maskBuffer, width, height);

      // 127 and 128 should be 0 (<=128), 129, 130, 255 should be 1 (>128)
      expect(rle).toBe("5,1:2,3");
    });

    it("should encode rectangular mask pattern", () => {
      const width = 4;
      const height = 4;

      // Create a pattern with a 2x2 square in the middle
      const maskBuffer = Buffer.from([
        0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0,
      ]);

      const rle = encodeRLE(maskBuffer, width, height);

      // Reading row by row: 5 zeros (4 + 1), 2 ones, 2 zeros, 2 ones, 5 zeros (1 + 4)
      expect(rle).toBe("4,4:5,2,2,2,5");
    });

    it("should handle buffer shorter than width * height", () => {
      const width = 10;
      const height = 10;

      // Buffer with only 5 elements (rest will be treated as 0)
      const maskBuffer = Buffer.from([255, 255, 255, 255, 255]);

      const rle = encodeRLE(maskBuffer, width, height);

      // 5 ones followed by 95 zeros
      expect(rle).toBe("10,10:5,95");
    });
  });

  describe("Format validation", () => {
    it("should return correct format string", () => {
      const width = 100;
      const height = 50;

      const maskBuffer = Buffer.alloc(1); // Small buffer
      maskBuffer[0] = 255;

      const rle = encodeRLE(maskBuffer, width, height);

      // Should start with "width,height:"
      expect(rle).toStartWith("100,50:");

      // Should have comma-separated numbers after colon
      const parts = rle.split(":");
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe("100,50");

      const runs = parts[1].split(",");
      expect(runs.length).toBeGreaterThan(0);
      runs.forEach((run) => {
        expect(Number.isInteger(Number(run))).toBe(true);
      });
    });
  });
});

describe("runSAMSegmentation", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockEnv.REPLICATE_API_TOKEN = "";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockEnv.REPLICATE_API_TOKEN = "";
  });

  describe("API token validation", () => {
    it("should throw error when REPLICATE_API_TOKEN is not set", async () => {
      mockEnv.REPLICATE_API_TOKEN = "";

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      await expect(runSAMSegmentation(params)).rejects.toThrow(
        "REPLICATE_API_TOKEN is not configured",
      );
    });
  });

  describe("Successful segmentation", () => {
    it("should complete full segmentation flow", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async (url: string, options?: any) => {
        callCount++;

        // First call: Create prediction
        if (callCount === 1) {
          expect(url).toBe("https://api.replicate.com/v1/predictions");
          expect(options.method).toBe("POST");
          expect(options.headers.Authorization).toBe("Token test-token");

          const body = JSON.parse(options.body);
          expect(body.input.point_coords).toEqual([[50, 50]]);
          expect(body.input.point_labels).toEqual([1]);

          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        // Second call: Get prediction (processing)
        if (callCount === 2) {
          expect(url).toBe("https://api.replicate.com/v1/predictions/pred-123");

          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "processing",
            }),
            { status: 200 },
          );
        }

        // Third call: Get prediction (succeeded)
        if (callCount === 3) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask1.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        // Fourth call: Download mask
        if (callCount === 4) {
          expect(url).toBe("http://example.com/mask1.png");

          // Return a PNG buffer
          const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          return new Response(pngBuffer, { status: 200 });
        }

        return new Response("", { status: 404 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      const result = await runSAMSegmentation(params);

      expect(result.masks).toHaveLength(1);
      expect(result.masks[0].confidence).toBe(0.95);
      expect(result.masks[0].boundingBox).toBeDefined();
      expect(result.masks[0].area).toBeGreaterThan(0);
      expect(callCount).toBe(4);
    });

    it("should handle multiple masks when returnMultiple is true", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async (_url: string, options?: any) => {
        callCount++;

        if (callCount === 1) {
          const body = JSON.parse(options.body);
          expect(body.input.multimask_output).toBe(true);

          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        if (callCount === 2) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "succeeded",
              output: {
                masks: [
                  "http://example.com/mask1.png",
                  "http://example.com/mask2.png",
                  "http://example.com/mask3.png",
                ],
                scores: [0.95, 0.85, 0.75],
              },
            }),
            { status: 200 },
          );
        }

        // Download mask calls
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        return new Response(pngBuffer, { status: 200 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
        returnMultiple: true,
      };

      const result = await runSAMSegmentation(params);

      expect(result.masks).toHaveLength(3);
      expect(result.masks[0].confidence).toBe(0.95);
      expect(result.masks[1].confidence).toBe(0.85);
      expect(result.masks[2].confidence).toBe(0.75);
    });

    it("should return only best mask when returnMultiple is false", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async (_url: string, _options?: any) => {
        callCount++;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        if (callCount === 2) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "succeeded",
              output: {
                masks: [
                  "http://example.com/mask1.png",
                  "http://example.com/mask2.png",
                ],
                scores: [0.85, 0.95], // Best is second mask
              },
            }),
            { status: 200 },
          );
        }

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        return new Response(pngBuffer, { status: 200 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
        returnMultiple: false,
      };

      const result = await runSAMSegmentation(params);

      expect(result.masks).toHaveLength(1);
      expect(result.masks[0].confidence).toBe(0.95); // Best mask
    });

    it("should handle multiple points", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      const mockFetch = mock(async (url: string, options?: any) => {
        if (options?.method === "POST") {
          const body = JSON.parse(options.body);
          expect(body.input.point_coords).toEqual([
            [10, 20],
            [30, 40],
            [50, 60],
          ]);
          expect(body.input.point_labels).toEqual([1, 1, 0]);

          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        if (url.includes("example.com")) {
          const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          return new Response(pngBuffer, { status: 200 });
        }

        if (url.includes("predictions/pred-123")) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        return new Response("{}", { status: 200 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [
          { x: 10, y: 20, label: 1 },
          { x: 30, y: 40, label: 1 },
          { x: 50, y: 60, label: 0 },
        ],
      };

      const result = await runSAMSegmentation(params);

      expect(result.masks).toHaveLength(1);
    });
  });

  describe("Output format handling", () => {
    it("should handle base64png format", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      const mockFetch = mock(async (url: string) => {
        if (url.includes("predictions")) {
          if (url.includes("pred-123")) {
            return new Response(
              JSON.stringify({
                id: "pred-123",
                status: "succeeded",
                output: {
                  masks: ["http://example.com/mask.png"],
                  scores: [0.95],
                },
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({ id: "pred-123", status: "starting" }),
            { status: 200 },
          );
        }

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        return new Response(pngBuffer, { status: 200 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
        outputFormat: "base64png",
      };

      const result = await runSAMSegmentation(params);

      expect(result.masks[0].mask).toBeTruthy();
      expect(typeof result.masks[0].mask).toBe("string");
    });

    it("should handle rle format", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      const mockFetch = mock(async (url: string) => {
        if (url.includes("predictions")) {
          if (url.includes("pred-123")) {
            return new Response(
              JSON.stringify({
                id: "pred-123",
                status: "succeeded",
                output: {
                  masks: ["http://example.com/mask.png"],
                  scores: [0.95],
                },
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({ id: "pred-123", status: "starting" }),
            { status: 200 },
          );
        }

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        return new Response(pngBuffer, { status: 200 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
        outputFormat: "rle",
      };

      const result = await runSAMSegmentation(params);

      expect(result.masks[0].mask).toBe("RLE_ENCODED_MASK_DATA");
    });
  });

  describe("Error handling", () => {
    it("should throw error on failed prediction creation", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      const mockFetch = mock(async () => {
        return new Response("API Error", { status: 400 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      await expect(runSAMSegmentation(params)).rejects.toThrow(
        "Replicate API error",
      );
    });

    it("should throw error when prediction fails", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async () => {
        callCount++;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        return new Response(
          JSON.stringify({
            id: "pred-123",
            status: "failed",
            error: "Model execution failed",
          }),
          { status: 200 },
        );
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      await expect(runSAMSegmentation(params)).rejects.toThrow(
        "Prediction failed",
      );
    });

    it("should throw error when prediction is canceled", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async () => {
        callCount++;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        return new Response(
          JSON.stringify({
            id: "pred-123",
            status: "canceled",
          }),
          { status: 200 },
        );
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      await expect(runSAMSegmentation(params)).rejects.toThrow(
        "Prediction was canceled",
      );
    });

    it("should throw error when no masks are returned", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async () => {
        callCount++;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        return new Response(
          JSON.stringify({
            id: "pred-123",
            status: "succeeded",
            output: {
              masks: [],
              scores: [],
            },
          }),
          { status: 200 },
        );
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      await expect(runSAMSegmentation(params)).rejects.toThrow(
        "No masks returned",
      );
    });

    it("should throw error when mask download fails", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async (_url: string) => {
        callCount++;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        if (callCount === 2) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                scores: [0.95],
              },
            }),
            { status: 200 },
          );
        }

        // Mask download fails
        return new Response("Not found", { status: 404 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      await expect(runSAMSegmentation(params)).rejects.toThrow(
        "Failed to download mask",
      );
    });
  });

  describe("Default values", () => {
    it("should use default confidence when scores not provided", async () => {
      mockEnv.REPLICATE_API_TOKEN = "test-token";

      let callCount = 0;
      const mockFetch = mock(async () => {
        callCount++;

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "starting",
            }),
            { status: 200 },
          );
        }

        if (callCount === 2) {
          return new Response(
            JSON.stringify({
              id: "pred-123",
              status: "succeeded",
              output: {
                masks: ["http://example.com/mask.png"],
                // scores array is missing
              },
            }),
            { status: 200 },
          );
        }

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        return new Response(pngBuffer, { status: 200 });
      });

      global.fetch = mockFetch as any;

      const params: SAMSegmentationParams = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        imageWidth: 100,
        imageHeight: 100,
        points: [{ x: 50, y: 50, label: 1 }],
      };

      const result = await runSAMSegmentation(params);

      expect(result.masks[0].confidence).toBe(0.9); // Default value
    });
  });
});
