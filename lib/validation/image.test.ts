import { describe, expect, it } from "bun:test";
import { decodeBase64Image, validateBase64Image } from "./image";

describe("validateBase64Image", () => {
  // Helper: Create a base64 string of a specific size (in bytes)
  const createBase64OfSize = (sizeInBytes: number): string => {
    // Base64 encoding: 3 bytes -> 4 characters
    // So for X bytes, we need approximately (X * 4) / 3 characters
    const base64Length = Math.ceil((sizeInBytes * 4) / 3);
    // Create a string of 'A's which is valid base64
    return "A".repeat(base64Length);
  };

  // Sample valid base64 images (1x1 pixel images)
  const VALID_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const VALID_JPEG_BASE64 =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==";

  describe("empty/null input", () => {
    it("returns invalid for empty string", () => {
      const result = validateBase64Image("", {
        maxSize: 1024,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Image data is empty");
    });

    it("returns invalid for whitespace-only string", () => {
      const result = validateBase64Image("   ", {
        maxSize: 1024,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Image data is empty");
    });

    it("returns invalid for null-like input", () => {
      const result = validateBase64Image(null as unknown as string, {
        maxSize: 1024,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Image data is empty");
    });
  });

  describe("valid base64 with data URI prefix", () => {
    it("validates PNG with data URI prefix", () => {
      const base64 = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it("validates JPEG with data URI prefix", () => {
      const base64 = `data:image/jpeg;base64,${VALID_JPEG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it("validates GIF with data URI prefix", () => {
      const base64 = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe("valid raw base64 without prefix", () => {
    it("validates raw base64 without prefix when no format restriction", () => {
      const result = validateBase64Image(VALID_PNG_BASE64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it("calculates size correctly for raw base64", () => {
      const result = validateBase64Image(VALID_PNG_BASE64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
      });

      // The PNG base64 decodes to some number of bytes - just verify it's positive
      expect(result.size).toBeGreaterThan(0);
      expect(result.size).toBeLessThan(200);
    });
  });

  describe("size validation", () => {
    it("rejects image that exceeds max size", () => {
      const base64 = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10, // Very small max size
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum allowed size");
      expect(result.size).toBeGreaterThan(10);
    });

    it("accepts image within size limit", () => {
      const base64 = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 100000, // Large max size
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.size).toBeLessThan(100000);
    });

    it("correctly calculates size for base64 with padding", () => {
      // Base64 with different padding scenarios
      const base64WithPadding = "data:image/png;base64,iVBORw0KGgo=="; // 2 padding chars
      const result = validateBase64Image(base64WithPadding, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe("format validation", () => {
    it("accepts allowed format (PNG)", () => {
      const base64 = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png", "jpeg"],
      });

      expect(result.valid).toBe(true);
    });

    it("accepts allowed format (JPEG)", () => {
      const base64 = `data:image/jpeg;base64,${VALID_JPEG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png", "jpeg"],
      });

      expect(result.valid).toBe(true);
    });

    it("rejects disallowed format", () => {
      const base64 = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png", "jpeg"],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Image format 'gif' is not allowed");
      expect(result.error).toContain("png, jpeg");
    });

    it("handles format with leading dot", () => {
      const base64 = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: [".png", ".jpeg"],
      });

      expect(result.valid).toBe(true);
    });

    it("handles case-insensitive format matching", () => {
      const base64 = `data:image/PNG;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png"],
      });

      expect(result.valid).toBe(true);
    });

    it("requires data URI when format validation is enabled", () => {
      const result = validateBase64Image(VALID_PNG_BASE64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png"],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Image format could not be determined");
      expect(result.error).toContain("Use data URI format");
    });

    it("allows raw base64 when no format restrictions", () => {
      const result = validateBase64Image(VALID_PNG_BASE64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: [],
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("PNG format detection", () => {
    it("detects PNG format from data URI", () => {
      const base64 = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png"],
      });

      expect(result.valid).toBe(true);
    });

    it("rejects PNG when only JPEG is allowed", () => {
      const base64 = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["jpeg"],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Image format 'png' is not allowed");
    });
  });

  describe("JPEG format detection", () => {
    it("detects JPEG format from data URI", () => {
      const base64 = `data:image/jpeg;base64,${VALID_JPEG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["jpeg"],
      });

      expect(result.valid).toBe(true);
    });

    it("detects JPG format (alias for JPEG)", () => {
      const base64 = `data:image/jpg;base64,${VALID_JPEG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["jpg", "jpeg"],
      });

      expect(result.valid).toBe(true);
    });

    it("rejects JPEG when only PNG is allowed", () => {
      const base64 = `data:image/jpeg;base64,${VALID_JPEG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png"],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Image format 'jpeg' is not allowed");
    });
  });

  describe("invalid base64 handling", () => {
    it("handles malformed data URI gracefully", () => {
      const result = validateBase64Image("data:image/png;base64", {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
      });

      // This will be treated as raw base64 (no match on regex)
      expect(result.valid).toBe(true); // Empty but valid structure
    });

    it("handles invalid base64 characters", () => {
      const result = validateBase64Image(
        "data:image/png;base64,!!!invalid!!!",
        {
          maxSize: 10000,
          maxWidth: 100,
          maxHeight: 100,
        },
      );

      // Size calculation should still work even with invalid chars
      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it("handles extremely large base64 string", () => {
      const largeBase64 = createBase64OfSize(10000000); // 10 MB
      const result = validateBase64Image(largeBase64, {
        maxSize: 1000000, // 1 MB limit
        maxWidth: 100,
        maxHeight: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum allowed size");
    });

    it("returns error info when validation fails", () => {
      const base64 = `data:image/bmp;base64,${VALID_PNG_BASE64}`;
      const result = validateBase64Image(base64, {
        maxSize: 10000,
        maxWidth: 100,
        maxHeight: 100,
        allowedFormats: ["png", "jpeg"],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
    });
  });
});

describe("decodeBase64Image", () => {
  const VALID_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const VALID_JPEG_BASE64 =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==";

  describe("strips data URI prefix correctly", () => {
    it("removes PNG data URI prefix", () => {
      const withPrefix = `data:image/png;base64,${VALID_PNG_BASE64}`;
      const buffer = decodeBase64Image(withPrefix);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's the same as decoding without prefix
      const bufferWithoutPrefix = decodeBase64Image(VALID_PNG_BASE64);
      expect(buffer.toString("base64")).toBe(
        bufferWithoutPrefix.toString("base64"),
      );
    });

    it("removes JPEG data URI prefix", () => {
      const withPrefix = `data:image/jpeg;base64,${VALID_JPEG_BASE64}`;
      const buffer = decodeBase64Image(withPrefix);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const bufferWithoutPrefix = decodeBase64Image(VALID_JPEG_BASE64);
      expect(buffer.toString("base64")).toBe(
        bufferWithoutPrefix.toString("base64"),
      );
    });

    it("removes GIF data URI prefix", () => {
      const gifBase64 =
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      const withPrefix = `data:image/gif;base64,${gifBase64}`;
      const buffer = decodeBase64Image(withPrefix);

      expect(buffer).toBeInstanceOf(Buffer);
      const bufferWithoutPrefix = decodeBase64Image(gifBase64);
      expect(buffer.toString("base64")).toBe(
        bufferWithoutPrefix.toString("base64"),
      );
    });

    it("removes WEBP data URI prefix", () => {
      const webpBase64 =
        "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";
      const withPrefix = `data:image/webp;base64,${webpBase64}`;
      const buffer = decodeBase64Image(withPrefix);

      expect(buffer).toBeInstanceOf(Buffer);
      const bufferWithoutPrefix = decodeBase64Image(webpBase64);
      expect(buffer.toString("base64")).toBe(
        bufferWithoutPrefix.toString("base64"),
      );
    });
  });

  describe("decodes raw base64 correctly", () => {
    it("decodes PNG base64 to Buffer", () => {
      const buffer = decodeBase64Image(VALID_PNG_BASE64);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify PNG signature (first 8 bytes)
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // 'P'
      expect(buffer[2]).toBe(0x4e); // 'N'
      expect(buffer[3]).toBe(0x47); // 'G'
    });

    it("decodes JPEG base64 to Buffer", () => {
      const buffer = decodeBase64Image(VALID_JPEG_BASE64);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify JPEG signature (first 3 bytes: 0xFF 0xD8 0xFF)
      expect(buffer[0]).toBe(0xff);
      expect(buffer[1]).toBe(0xd8);
      expect(buffer[2]).toBe(0xff);
    });

    it("decodes base64 with padding", () => {
      const base64WithPadding = "SGVsbG8gV29ybGQ="; // "Hello World"
      const buffer = decodeBase64Image(base64WithPadding);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString("utf-8")).toBe("Hello World");
    });

    it("handles empty base64 string", () => {
      const buffer = decodeBase64Image("");

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(0);
    });
  });

  describe("returns proper Buffer", () => {
    it("returns a Buffer instance", () => {
      const buffer = decodeBase64Image(VALID_PNG_BASE64);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it("can be re-encoded to original base64", () => {
      const buffer = decodeBase64Image(VALID_PNG_BASE64);
      const reEncoded = buffer.toString("base64");

      expect(reEncoded).toBe(VALID_PNG_BASE64);
    });

    it("returns correct buffer length", () => {
      const buffer = decodeBase64Image(VALID_PNG_BASE64);

      // Calculate expected length (base64 length * 3 / 4, minus padding)
      const paddingChars = (VALID_PNG_BASE64.match(/=/g) || []).length;
      const expectedLength = Math.floor(
        (VALID_PNG_BASE64.length * 3) / 4 - paddingChars,
      );

      expect(buffer.length).toBe(expectedLength);
    });

    it("handles various base64 lengths correctly", () => {
      const testCases = [
        "YQ==", // 1 byte
        "YWI=", // 2 bytes
        "YWJj", // 3 bytes
        "YWJjZA==", // 4 bytes
      ];

      testCases.forEach((base64) => {
        const buffer = decodeBase64Image(base64);
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
      });
    });
  });
});
