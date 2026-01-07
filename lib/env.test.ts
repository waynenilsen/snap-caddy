/**
 * Unit Tests for Environment Configuration
 * Tests the Zod schema validation, defaults, and transformations
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Re-create the schema for testing purposes
// This allows us to test the schema behavior without being affected by
// the module-level env parsing that happens at import time
const envSchema = z.object({
  // SAM Segmentation
  REPLICATE_API_TOKEN: z.string().min(1).optional(),
  SAM_MODEL_VERSION: z
    .string()
    .default(
      "fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83",
    ),

  // OpenSCAD
  OPENSCAD_PATH: z.string().default("openscad"),
  GRIDFINITY_LIB_PATH: z.string().default("/usr/local/share/gridfinity"),
  OPENSCAD_USE_XVFB: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .pipe(z.boolean())
    .catch(true),
  OPENSCAD_TIMEOUT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 300000))
    .pipe(z.number().positive())
    .catch(300000),

  // File Storage
  TEMP_DIR: z.string().default("/tmp/snap-caddy"),
  MAX_FILE_SIZE: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 10485760))
    .pipe(z.number().positive())
    .catch(10485760),
  FILE_RETENTION_MS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3600000))
    .pipe(z.number().positive())
    .catch(3600000),

  // Rate Limiting
  RATE_LIMIT_REQUESTS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 10))
    .pipe(z.number().int().positive())
    .catch(10),
  RATE_LIMIT_WINDOW: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 60000))
    .pipe(z.number().int().positive())
    .catch(60000),

  // Features
  GENERATE_PREVIEWS: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .pipe(z.boolean())
    .catch(false),
  ENABLE_ASYNC_GENERATION: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .pipe(z.boolean())
    .catch(false),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

describe("Environment Variable Schema", () => {
  describe("Default Values", () => {
    it("should apply all default values when parsing empty object", () => {
      const result = envSchema.parse({});

      expect(result.SAM_MODEL_VERSION).toBe(
        "fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83",
      );
      expect(result.OPENSCAD_PATH).toBe("openscad");
      expect(result.GRIDFINITY_LIB_PATH).toBe("/usr/local/share/gridfinity");
      expect(result.OPENSCAD_USE_XVFB).toBe(false);
      expect(result.OPENSCAD_TIMEOUT).toBe(300000);
      expect(result.TEMP_DIR).toBe("/tmp/snap-caddy");
      expect(result.MAX_FILE_SIZE).toBe(10485760);
      expect(result.FILE_RETENTION_MS).toBe(3600000);
      expect(result.RATE_LIMIT_REQUESTS).toBe(10);
      expect(result.RATE_LIMIT_WINDOW).toBe(60000);
      expect(result.GENERATE_PREVIEWS).toBe(false);
      expect(result.ENABLE_ASYNC_GENERATION).toBe(false);
      expect(result.LOG_LEVEL).toBe("info");
      expect(result.NODE_ENV).toBe("development");
    });

    it("should apply defaults for missing optional fields", () => {
      const result = envSchema.parse({
        REPLICATE_API_TOKEN: "test-token",
      });

      expect(result.REPLICATE_API_TOKEN).toBe("test-token");
      expect(result.OPENSCAD_TIMEOUT).toBe(300000);
      expect(result.MAX_FILE_SIZE).toBe(10485760);
    });
  });

  describe("String to Number Transformations", () => {
    it("should transform valid numeric strings to numbers", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: "500000",
        MAX_FILE_SIZE: "20971520",
        FILE_RETENTION_MS: "7200000",
        RATE_LIMIT_REQUESTS: "20",
        RATE_LIMIT_WINDOW: "120000",
      });

      expect(result.OPENSCAD_TIMEOUT).toBe(500000);
      expect(result.MAX_FILE_SIZE).toBe(20971520);
      expect(result.FILE_RETENTION_MS).toBe(7200000);
      expect(result.RATE_LIMIT_REQUESTS).toBe(20);
      expect(result.RATE_LIMIT_WINDOW).toBe(120000);
    });

    it("should use defaults when numeric strings are not provided", () => {
      const result = envSchema.parse({});

      expect(result.OPENSCAD_TIMEOUT).toBe(300000);
      expect(result.MAX_FILE_SIZE).toBe(10485760);
      expect(result.FILE_RETENTION_MS).toBe(3600000);
      expect(result.RATE_LIMIT_REQUESTS).toBe(10);
      expect(result.RATE_LIMIT_WINDOW).toBe(60000);
    });

    it("should handle edge case numeric values", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: "1",
        MAX_FILE_SIZE: "1024",
        RATE_LIMIT_REQUESTS: "1",
      });

      expect(result.OPENSCAD_TIMEOUT).toBe(1);
      expect(result.MAX_FILE_SIZE).toBe(1024);
      expect(result.RATE_LIMIT_REQUESTS).toBe(1);
    });
  });

  describe("String to Boolean Transformations", () => {
    it('should transform "true" string to boolean true', () => {
      const result = envSchema.parse({
        OPENSCAD_USE_XVFB: "true",
        GENERATE_PREVIEWS: "true",
        ENABLE_ASYNC_GENERATION: "true",
      });

      expect(result.OPENSCAD_USE_XVFB).toBe(true);
      expect(result.GENERATE_PREVIEWS).toBe(true);
      expect(result.ENABLE_ASYNC_GENERATION).toBe(true);
    });

    it('should transform any non-"true" string to boolean false', () => {
      const result = envSchema.parse({
        OPENSCAD_USE_XVFB: "false",
        GENERATE_PREVIEWS: "FALSE",
        ENABLE_ASYNC_GENERATION: "1",
      });

      expect(result.OPENSCAD_USE_XVFB).toBe(false);
      expect(result.GENERATE_PREVIEWS).toBe(false);
      expect(result.ENABLE_ASYNC_GENERATION).toBe(false);
    });

    it("should handle empty strings for boolean fields", () => {
      const result = envSchema.parse({
        OPENSCAD_USE_XVFB: "",
        GENERATE_PREVIEWS: "",
      });

      expect(result.OPENSCAD_USE_XVFB).toBe(false);
      expect(result.GENERATE_PREVIEWS).toBe(false);
    });

    it("should use default values when boolean fields are not provided", () => {
      const result = envSchema.parse({});

      expect(result.OPENSCAD_USE_XVFB).toBe(false);
      expect(result.GENERATE_PREVIEWS).toBe(false);
      expect(result.ENABLE_ASYNC_GENERATION).toBe(false);
    });
  });

  describe("Invalid Values with .catch() Fallbacks", () => {
    it("should fall back to default for invalid OPENSCAD_TIMEOUT", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: "invalid",
      });

      expect(result.OPENSCAD_TIMEOUT).toBe(300000);
    });

    it("should fall back to default for negative numbers", () => {
      const result = envSchema.parse({
        MAX_FILE_SIZE: "-1000",
        FILE_RETENTION_MS: "-5000",
      });

      expect(result.MAX_FILE_SIZE).toBe(10485760);
      expect(result.FILE_RETENTION_MS).toBe(3600000);
    });

    it("should fall back to default for zero values", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: "0",
        RATE_LIMIT_REQUESTS: "0",
      });

      expect(result.OPENSCAD_TIMEOUT).toBe(300000);
      expect(result.RATE_LIMIT_REQUESTS).toBe(10);
    });

    it("should fall back to default for non-numeric strings", () => {
      const result = envSchema.parse({
        MAX_FILE_SIZE: "not-a-number",
        RATE_LIMIT_WINDOW: "abc123",
      });

      expect(result.MAX_FILE_SIZE).toBe(10485760);
      expect(result.RATE_LIMIT_WINDOW).toBe(60000);
    });

    it("should fall back to default for floating point when integer required", () => {
      const result = envSchema.parse({
        RATE_LIMIT_REQUESTS: "10.5",
      });

      // The transformation will parse it as Number(v), but the .int() validator will catch it
      expect(result.RATE_LIMIT_REQUESTS).toBe(10);
    });
  });

  describe("Valid Custom Values", () => {
    it("should accept valid custom string values", () => {
      const result = envSchema.parse({
        REPLICATE_API_TOKEN: "custom-api-token-12345",
        SAM_MODEL_VERSION: "meta/sam-2-custom",
        OPENSCAD_PATH: "/usr/local/bin/openscad",
        GRIDFINITY_LIB_PATH: "/custom/path/gridfinity",
        TEMP_DIR: "/var/tmp/custom-caddy",
      });

      expect(result.REPLICATE_API_TOKEN).toBe("custom-api-token-12345");
      expect(result.SAM_MODEL_VERSION).toBe("meta/sam-2-custom");
      expect(result.OPENSCAD_PATH).toBe("/usr/local/bin/openscad");
      expect(result.GRIDFINITY_LIB_PATH).toBe("/custom/path/gridfinity");
      expect(result.TEMP_DIR).toBe("/var/tmp/custom-caddy");
    });

    it("should accept valid LOG_LEVEL enum values", () => {
      expect(envSchema.parse({ LOG_LEVEL: "debug" }).LOG_LEVEL).toBe("debug");
      expect(envSchema.parse({ LOG_LEVEL: "info" }).LOG_LEVEL).toBe("info");
      expect(envSchema.parse({ LOG_LEVEL: "warn" }).LOG_LEVEL).toBe("warn");
      expect(envSchema.parse({ LOG_LEVEL: "error" }).LOG_LEVEL).toBe("error");
    });

    it("should accept valid NODE_ENV enum values", () => {
      expect(envSchema.parse({ NODE_ENV: "development" }).NODE_ENV).toBe(
        "development",
      );
      expect(envSchema.parse({ NODE_ENV: "production" }).NODE_ENV).toBe(
        "production",
      );
      expect(envSchema.parse({ NODE_ENV: "test" }).NODE_ENV).toBe("test");
    });

    it("should accept all valid values together", () => {
      const customEnv = {
        REPLICATE_API_TOKEN: "token-xyz",
        SAM_MODEL_VERSION: "custom-model",
        OPENSCAD_PATH: "/custom/openscad",
        GRIDFINITY_LIB_PATH: "/custom/gridfinity",
        OPENSCAD_USE_XVFB: "true",
        OPENSCAD_TIMEOUT: "600000",
        TEMP_DIR: "/custom/temp",
        MAX_FILE_SIZE: "52428800",
        FILE_RETENTION_MS: "7200000",
        RATE_LIMIT_REQUESTS: "50",
        RATE_LIMIT_WINDOW: "300000",
        GENERATE_PREVIEWS: "true",
        ENABLE_ASYNC_GENERATION: "true",
        LOG_LEVEL: "debug",
        NODE_ENV: "production",
      };

      const result = envSchema.parse(customEnv);

      expect(result.REPLICATE_API_TOKEN).toBe("token-xyz");
      expect(result.SAM_MODEL_VERSION).toBe("custom-model");
      expect(result.OPENSCAD_PATH).toBe("/custom/openscad");
      expect(result.GRIDFINITY_LIB_PATH).toBe("/custom/gridfinity");
      expect(result.OPENSCAD_USE_XVFB).toBe(true);
      expect(result.OPENSCAD_TIMEOUT).toBe(600000);
      expect(result.TEMP_DIR).toBe("/custom/temp");
      expect(result.MAX_FILE_SIZE).toBe(52428800);
      expect(result.FILE_RETENTION_MS).toBe(7200000);
      expect(result.RATE_LIMIT_REQUESTS).toBe(50);
      expect(result.RATE_LIMIT_WINDOW).toBe(300000);
      expect(result.GENERATE_PREVIEWS).toBe(true);
      expect(result.ENABLE_ASYNC_GENERATION).toBe(true);
      expect(result.LOG_LEVEL).toBe("debug");
      expect(result.NODE_ENV).toBe("production");
    });
  });

  describe("Optional Fields", () => {
    it("should allow REPLICATE_API_TOKEN to be undefined", () => {
      const result = envSchema.parse({});

      expect(result.REPLICATE_API_TOKEN).toBeUndefined();
    });

    it("should reject empty REPLICATE_API_TOKEN", () => {
      expect(() => envSchema.parse({ REPLICATE_API_TOKEN: "" })).toThrow();
    });

    it("should accept valid REPLICATE_API_TOKEN", () => {
      const result = envSchema.parse({
        REPLICATE_API_TOKEN: "valid-token",
      });

      expect(result.REPLICATE_API_TOKEN).toBe("valid-token");
    });
  });

  describe("Enum Validation", () => {
    it("should reject invalid LOG_LEVEL values", () => {
      expect(() => envSchema.parse({ LOG_LEVEL: "verbose" })).toThrow();
      expect(() => envSchema.parse({ LOG_LEVEL: "trace" })).toThrow();
      expect(() => envSchema.parse({ LOG_LEVEL: "INVALID" })).toThrow();
    });

    it("should reject invalid NODE_ENV values", () => {
      expect(() => envSchema.parse({ NODE_ENV: "staging" })).toThrow();
      expect(() => envSchema.parse({ NODE_ENV: "local" })).toThrow();
      expect(() => envSchema.parse({ NODE_ENV: "prod" })).toThrow();
    });

    it("should use default for LOG_LEVEL when not provided", () => {
      const result = envSchema.parse({});

      expect(result.LOG_LEVEL).toBe("info");
    });

    it("should use default for NODE_ENV when not provided", () => {
      const result = envSchema.parse({});

      expect(result.NODE_ENV).toBe("development");
    });
  });

  describe("Type Safety", () => {
    it("should enforce number types for numeric fields", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: "123456",
        MAX_FILE_SIZE: "999999",
      });

      // These should be numbers, not strings
      expect(typeof result.OPENSCAD_TIMEOUT).toBe("number");
      expect(typeof result.MAX_FILE_SIZE).toBe("number");
    });

    it("should enforce boolean types for boolean fields", () => {
      const result = envSchema.parse({
        OPENSCAD_USE_XVFB: "true",
        GENERATE_PREVIEWS: "false",
      });

      // These should be booleans, not strings
      expect(typeof result.OPENSCAD_USE_XVFB).toBe("boolean");
      expect(typeof result.GENERATE_PREVIEWS).toBe("boolean");
    });

    it("should enforce string types for string fields", () => {
      const result = envSchema.parse({
        OPENSCAD_PATH: "/custom/path",
        TEMP_DIR: "/tmp/custom",
      });

      expect(typeof result.OPENSCAD_PATH).toBe("string");
      expect(typeof result.TEMP_DIR).toBe("string");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large numbers", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: "9999999999",
        MAX_FILE_SIZE: "999999999999",
      });

      expect(result.OPENSCAD_TIMEOUT).toBe(9999999999);
      expect(result.MAX_FILE_SIZE).toBe(999999999999);
    });

    it("should handle numeric strings with whitespace", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: " 500000 ",
      });

      // Number(' 500000 ') should work correctly
      expect(result.OPENSCAD_TIMEOUT).toBe(500000);
    });

    it("should reject special numeric values like Infinity", () => {
      const result = envSchema.parse({
        OPENSCAD_TIMEOUT: "Infinity",
      });

      // Should fall back to default due to validation
      expect(result.OPENSCAD_TIMEOUT).toBe(300000);
    });

    it("should handle mixed case for boolean-like strings", () => {
      const result = envSchema.parse({
        OPENSCAD_USE_XVFB: "True",
        GENERATE_PREVIEWS: "TRUE",
        ENABLE_ASYNC_GENERATION: "TrUe",
      });

      // Only exact 'true' should result in true
      expect(result.OPENSCAD_USE_XVFB).toBe(false);
      expect(result.GENERATE_PREVIEWS).toBe(false);
      expect(result.ENABLE_ASYNC_GENERATION).toBe(false);
    });
  });
});
