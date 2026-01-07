/**
 * Unit tests for rate limiting middleware
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { type NextRequest, NextResponse } from "next/server";
import { withRateLimit, getRateLimitStatus, resetRateLimit } from "./rateLimit";

// Mock dependencies
mock.module("@/lib/env", () => ({
  env: {
    RATE_LIMIT_REQUESTS: 5,
    RATE_LIMIT_WINDOW: 60000, // 1 minute
  },
}));

mock.module("@/lib/logger", () => ({
  logger: {
    warn: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
  },
}));

// Helper function to create mock NextRequest
function createMockRequest(
  headers: Record<string, string> = {},
  url = "http://localhost:3000/api/test",
): NextRequest {
  const request = new Request(url, {
    method: "GET",
    headers: new Headers(headers),
  });
  return request as NextRequest;
}

// Helper function to create a simple handler
function createMockHandler(responseData: object = { success: true }) {
  return mock(async (req: NextRequest) => {
    return NextResponse.json(responseData);
  });
}

describe("withRateLimit", () => {
  beforeEach(() => {
    // Note: We can't directly clear the store, but we use unique keys per test
    // to avoid conflicts. For tests that need cleanup, we explicitly call resetRateLimit.
  });

  afterEach(() => {
    // Clean up after each test
    mock.restore();
  });

  it("should allow first request to pass through", async () => {
    const handler = createMockHandler();
    const rateLimitedHandler = withRateLimit(handler);
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.1" });

    const response = await rateLimitedHandler(req);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);

    const json = await response.json();
    expect(json).toEqual({ success: true });
  });

  it("should allow requests within the limit to pass through", async () => {
    const handler = createMockHandler();
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 5,
      windowMs: 60000,
    });
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.2" });

    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      const response = await rateLimitedHandler(req);
      expect(response.status).toBe(200);
    }

    expect(handler).toHaveBeenCalledTimes(5);
  });

  it("should return 429 when request exceeds limit", async () => {
    const handler = createMockHandler();
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 3,
      windowMs: 60000,
    });
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.3" });

    // Make 3 requests (at limit)
    for (let i = 0; i < 3; i++) {
      const response = await rateLimitedHandler(req);
      expect(response.status).toBe(200);
    }

    // 4th request should be rate limited
    const response = await rateLimitedHandler(req);
    expect(response.status).toBe(429);

    const json = await response.json();
    expect(json).toMatchObject({
      success: false,
      error: "Rate limit exceeded",
      code: "RATE_LIMIT",
    });
    expect(json.retryAfter).toBeGreaterThan(0);

    // Handler should only be called 3 times (not 4)
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("should reset rate limit after window expires", async () => {
    const handler = createMockHandler();
    const windowMs = 100; // 100ms window for testing
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 2,
      windowMs,
    });
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.4" });

    // Make 2 requests (at limit)
    await rateLimitedHandler(req);
    await rateLimitedHandler(req);

    // 3rd request should be rate limited
    const response1 = await rateLimitedHandler(req);
    expect(response1.status).toBe(429);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

    // Request should now succeed
    const response2 = await rateLimitedHandler(req);
    expect(response2.status).toBe(200);

    // Handler should be called 3 times (2 initial + 1 after reset)
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("should use custom keyGenerator when provided", async () => {
    const handler = createMockHandler();
    const customKeyGenerator = mock((req: NextRequest) => {
      return req.headers.get("x-api-key") || "default";
    });

    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 2,
      windowMs: 60000,
      keyGenerator: customKeyGenerator,
    });

    // Request with API key "user1"
    const req1 = createMockRequest({ "x-api-key": "user1" });
    await rateLimitedHandler(req1);
    await rateLimitedHandler(req1);

    // Request with API key "user2" should not be rate limited
    const req2 = createMockRequest({ "x-api-key": "user2" });
    const response = await rateLimitedHandler(req2);
    expect(response.status).toBe(200);

    // But another request from user1 should be rate limited
    const response2 = await rateLimitedHandler(req1);
    expect(response2.status).toBe(429);

    expect(customKeyGenerator).toHaveBeenCalledTimes(4);
  });

  it("should fall back to x-real-ip header when x-forwarded-for is not present", async () => {
    const handler = createMockHandler();
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 1,
      windowMs: 60000,
    });

    const req = createMockRequest({ "x-real-ip": "10.0.0.1" });
    await rateLimitedHandler(req);

    // Second request should be rate limited
    const response = await rateLimitedHandler(req);
    expect(response.status).toBe(429);
  });

  it("should use 'anonymous' key when no IP headers are present", async () => {
    const handler = createMockHandler();
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 1,
      windowMs: 60000,
    });

    const req1 = createMockRequest();
    await rateLimitedHandler(req1);

    // Second request (also without headers) should be rate limited
    const req2 = createMockRequest();
    const response = await rateLimitedHandler(req2);
    expect(response.status).toBe(429);
  });

  it("should set Retry-After header correctly on 429 response", async () => {
    const handler = createMockHandler();
    const windowMs = 60000;
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 1,
      windowMs,
    });
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.5" });

    // First request
    await rateLimitedHandler(req);

    // Second request should be rate limited
    const response = await rateLimitedHandler(req);
    expect(response.status).toBe(429);

    const retryAfter = response.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(Number(retryAfter)).toBeLessThanOrEqual(windowMs / 1000);
  });

  it("should add X-RateLimit-* headers to successful responses", async () => {
    const handler = createMockHandler();
    const maxRequests = 5;
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
    });
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.6" });

    // First request
    const response1 = await rateLimitedHandler(req);
    expect(response1.status).toBe(200);
    expect(response1.headers.get("X-RateLimit-Limit")).toBe(
      maxRequests.toString(),
    );
    expect(response1.headers.get("X-RateLimit-Remaining")).toBe("4");
    expect(response1.headers.get("X-RateLimit-Reset")).toBeTruthy();

    // Second request
    const response2 = await rateLimitedHandler(req);
    expect(response2.status).toBe(200);
    expect(response2.headers.get("X-RateLimit-Remaining")).toBe("3");

    // Third request
    const response3 = await rateLimitedHandler(req);
    expect(response3.status).toBe(200);
    expect(response3.headers.get("X-RateLimit-Remaining")).toBe("2");
  });

  it("should add X-RateLimit-* headers to 429 responses", async () => {
    const handler = createMockHandler();
    const maxRequests = 2;
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
    });
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.7" });

    // Make requests up to the limit
    await rateLimitedHandler(req);
    await rateLimitedHandler(req);

    // Exceed the limit
    const response = await rateLimitedHandler(req);
    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe(
      maxRequests.toString(),
    );
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("should handle concurrent requests correctly", async () => {
    const handler = createMockHandler();
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests: 3,
      windowMs: 60000,
    });
    const req = createMockRequest({ "x-forwarded-for": "192.168.1.8" });

    // Make 5 concurrent requests
    const responses = await Promise.all([
      rateLimitedHandler(req),
      rateLimitedHandler(req),
      rateLimitedHandler(req),
      rateLimitedHandler(req),
      rateLimitedHandler(req),
    ]);

    const successCount = responses.filter((r) => r.status === 200).length;
    const rateLimitedCount = responses.filter((r) => r.status === 429).length;

    // Should allow 3 requests and rate limit 2
    expect(successCount).toBe(3);
    expect(rateLimitedCount).toBe(2);
  });
});

describe("getRateLimitStatus", () => {
  beforeEach(() => {
    // Clear all rate limit records
    const testKeys = ["test-key-1", "test-key-2", "192.168.1.100"];
    testKeys.forEach((key) => resetRateLimit(key));
  });

  it("should return null for non-existent key", () => {
    const status = getRateLimitStatus("non-existent-key");
    expect(status).toBeNull();
  });

  it("should return correct status after requests", async () => {
    const handler = createMockHandler();
    const maxRequests = 5;
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
      keyGenerator: () => "test-key-1",
    });
    const req = createMockRequest();

    // Make 2 requests
    await rateLimitedHandler(req);
    await rateLimitedHandler(req);

    const status = getRateLimitStatus("test-key-1");
    expect(status).toBeTruthy();
    expect(status?.remaining).toBe(3); // 5 - 2 = 3
    expect(status?.resetTime).toBeGreaterThan(Date.now());
  });

  it("should return 0 remaining when limit is reached", async () => {
    const handler = createMockHandler();
    const maxRequests = 5; // Use same as env.RATE_LIMIT_REQUESTS
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
      keyGenerator: () => "test-key-2",
    });
    const req = createMockRequest();

    // Make requests up to limit
    for (let i = 0; i < maxRequests; i++) {
      await rateLimitedHandler(req);
    }

    const status = getRateLimitStatus("test-key-2");
    expect(status).toBeTruthy();
    expect(status?.remaining).toBe(0);
  });

  it("should not return negative remaining count", async () => {
    const handler = createMockHandler();
    const maxRequests = 5; // Use same as env.RATE_LIMIT_REQUESTS
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
      keyGenerator: () => "test-key-3",
    });
    const req = createMockRequest();

    // Make requests beyond limit (note: rate limiting prevents count from going over)
    for (let i = 0; i < maxRequests + 2; i++) {
      await rateLimitedHandler(req);
    }

    const status = getRateLimitStatus("test-key-3");
    expect(status).toBeTruthy();
    expect(status?.remaining).toBe(0);
    expect(status?.remaining).toBeGreaterThanOrEqual(0);
  });
});

describe("resetRateLimit", () => {
  it("should clear rate limit for a specific key", async () => {
    const handler = createMockHandler();
    const maxRequests = 5; // Use same as env.RATE_LIMIT_REQUESTS
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
      keyGenerator: () => "reset-test-key",
    });
    const req = createMockRequest();

    // Make requests up to limit
    for (let i = 0; i < maxRequests; i++) {
      await rateLimitedHandler(req);
    }

    // Verify limit is reached
    let status = getRateLimitStatus("reset-test-key");
    expect(status).toBeTruthy();
    expect(status?.remaining).toBe(0);

    // Reset the limit
    resetRateLimit("reset-test-key");

    // Verify limit is cleared
    status = getRateLimitStatus("reset-test-key");
    expect(status).toBeNull();

    // New request should succeed
    const response = await rateLimitedHandler(req);
    expect(response.status).toBe(200);
  });

  it("should not affect other keys", async () => {
    const handler = createMockHandler();
    const maxRequests = 5; // Use same as env.RATE_LIMIT_REQUESTS

    // Create two different rate limited handlers with different keys
    const handler1 = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
      keyGenerator: () => "key-1",
    });

    const handler2 = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
      keyGenerator: () => "key-2",
    });

    const req = createMockRequest();

    // Make requests for both keys to reach limit
    for (let i = 0; i < maxRequests; i++) {
      await handler1(req);
      await handler2(req);
    }

    // Reset only key-1
    resetRateLimit("key-1");

    // key-1 should be cleared
    expect(getRateLimitStatus("key-1")).toBeNull();

    // key-2 should still exist
    const status = getRateLimitStatus("key-2");
    expect(status).toBeTruthy();
    expect(status?.remaining).toBe(0);
  });

  it("should handle resetting non-existent key gracefully", () => {
    // Should not throw error
    expect(() => resetRateLimit("non-existent-key")).not.toThrow();
  });
});

describe("Rate Limit Integration", () => {
  it("should handle complete rate limit lifecycle", async () => {
    const handler = createMockHandler({ data: "test" });
    const maxRequests = 3;
    const windowMs = 200;

    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs,
      keyGenerator: (req) => req.headers.get("x-user-id") || "anonymous",
    });

    const req = createMockRequest({ "x-user-id": "user123" });

    // Phase 1: Make requests within limit
    for (let i = 0; i < maxRequests; i++) {
      const response = await rateLimitedHandler(req);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe(
        (maxRequests - i - 1).toString(),
      );
    }

    // Phase 2: Exceed limit
    const rateLimitedResponse = await rateLimitedHandler(req);
    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.headers.get("Retry-After")).toBeTruthy();

    // Phase 3: Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

    // Phase 4: New window - requests should succeed again
    const newResponse = await rateLimitedHandler(req);
    expect(newResponse.status).toBe(200);
    expect(newResponse.headers.get("X-RateLimit-Remaining")).toBe(
      (maxRequests - 1).toString(),
    );
  });

  it("should track different users independently", async () => {
    const handler = createMockHandler();
    const maxRequests = 2;
    const timestamp = Date.now();
    const rateLimitedHandler = withRateLimit(handler, {
      maxRequests,
      windowMs: 60000,
      keyGenerator: (req) =>
        req.headers.get("x-user-id")
          ? `${req.headers.get("x-user-id")}-${timestamp}`
          : "anonymous",
    });

    // User 1 makes 2 requests
    const user1Req = createMockRequest({ "x-user-id": "user1" });
    await rateLimitedHandler(user1Req);
    await rateLimitedHandler(user1Req);

    // User 1 is now rate limited
    const user1Response = await rateLimitedHandler(user1Req);
    expect(user1Response.status).toBe(429);

    // User 2 should still be able to make requests
    const user2Req = createMockRequest({ "x-user-id": "user2" });
    const user2Response = await rateLimitedHandler(user2Req);
    expect(user2Response.status).toBe(200);
    // User 2 has made 1 request, so 2-1 = 1 remaining
    expect(user2Response.headers.get("X-RateLimit-Remaining")).toBe(
      (maxRequests - 1).toString(),
    );
  });
});
