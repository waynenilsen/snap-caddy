/**
 * Rate limiting middleware for API routes
 */

import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: NextRequest) => string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitStore {
  [key: string]: RateLimitRecord;
}

// In-memory store (use Redis for production multi-instance deployments)
const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    }
  },
  5 * 60 * 1000,
);

/**
 * Rate limiting middleware wrapper
 */
export function withRateLimit<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
  config?: Partial<RateLimitConfig>,
) {
  const maxRequests = config?.maxRequests ?? env.RATE_LIMIT_REQUESTS;
  const windowMs = config?.windowMs ?? env.RATE_LIMIT_WINDOW;
  const keyGenerator = config?.keyGenerator;

  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const key = keyGenerator
      ? keyGenerator(req)
      : req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "anonymous";

    const now = Date.now();
    const record = store[key];

    if (!record || record.resetTime < now) {
      // New window
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      // Existing window
      if (record.count >= maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);

        logger.warn("Rate limit exceeded", {
          key,
          count: record.count,
          maxRequests,
          retryAfter,
        });

        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded",
            code: "RATE_LIMIT",
            retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": retryAfter.toString(),
              "X-RateLimit-Limit": maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": record.resetTime.toString(),
            },
          },
        );
      }

      record.count++;
    }

    const response = await handler(req, ...args);

    // Add rate limit headers to response
    const currentRecord = store[key];
    if (currentRecord) {
      response.headers.set("X-RateLimit-Limit", maxRequests.toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        (maxRequests - currentRecord.count).toString(),
      );
      response.headers.set(
        "X-RateLimit-Reset",
        currentRecord.resetTime.toString(),
      );
    }

    return response;
  };
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): {
  remaining: number;
  resetTime: number;
} | null {
  const record = store[key];
  if (!record) return null;

  return {
    remaining: Math.max(0, env.RATE_LIMIT_REQUESTS - record.count),
    resetTime: record.resetTime,
  };
}

/**
 * Reset rate limit for a key (useful for testing)
 */
export function resetRateLimit(key: string): void {
  delete store[key];
}
