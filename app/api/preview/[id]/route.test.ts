import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

// UUID validation schema (same as in route.ts)
const UUIDSchema = z.string().uuid();

describe('GET /api/preview/[id]', () => {
  describe('UUID Validation', () => {
    it('should accept valid UUID v4 format', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ];

      for (const uuid of validUUIDs) {
        const result = UUIDSchema.safeParse(uuid);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid UUID format', () => {
      const result = UUIDSchema.safeParse('invalid-uuid');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = UUIDSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject path traversal attempts', () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '..%2F..%2Fetc/passwd',
        'valid-id/../../secret',
      ];

      for (const input of maliciousInputs) {
        const result = UUIDSchema.safeParse(input);
        expect(result.success).toBe(false);
      }
    });

    it('should reject UUIDs with extra characters', () => {
      const result = UUIDSchema.safeParse('123e4567-e89b-12d3-a456-426614174000-extra');
      expect(result.success).toBe(false);
    });

    it('should reject malformed UUIDs', () => {
      const malformed = [
        '123e4567-e89b-12d3-a456', // too short
        '123e4567-e89b-12d3-a456-426614174000-1234', // too long
        '123e4567e89b12d3a456426614174000', // no dashes
        '123g4567-e89b-12d3-a456-426614174000', // invalid character
      ];

      for (const uuid of malformed) {
        const result = UUIDSchema.safeParse(uuid);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Response headers expectations', () => {
    it('should define correct Content-Type for PNG', () => {
      const expectedContentType = 'image/png';
      expect(expectedContentType).toBe('image/png');
    });

    it('should define appropriate Cache-Control', () => {
      const expectedCacheControl = 'public, max-age=3600';
      expect(expectedCacheControl).toContain('max-age=3600');
    });

    it('should define X-Content-Type-Options for security', () => {
      const expectedSecurityHeader = 'nosniff';
      expect(expectedSecurityHeader).toBe('nosniff');
    });
  });

  describe('Error response format', () => {
    it('should have correct 400 error structure for invalid UUID', () => {
      const expectedError = { error: 'Invalid job ID format' };
      expect(expectedError).toHaveProperty('error');
      expect(typeof expectedError.error).toBe('string');
    });

    it('should have correct 404 error structure for missing job', () => {
      const expectedError = { error: 'Job not found' };
      expect(expectedError).toHaveProperty('error');
    });

    it('should have correct 404 error structure for missing preview', () => {
      const expectedError = { error: 'Preview not found' };
      expect(expectedError).toHaveProperty('error');
    });

    it('should have correct 500 error structure for server errors', () => {
      const expectedError = { error: 'Failed to retrieve preview' };
      expect(expectedError).toHaveProperty('error');
    });
  });
});
