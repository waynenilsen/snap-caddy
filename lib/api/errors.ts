/**
 * Error handling middleware for API routes
 */

import { type NextRequest, NextResponse } from "next/server";
import { logger, metrics } from "@/lib/logger";

export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Error handling middleware wrapper
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      logger.error("API error", {
        error: error instanceof Error ? error.message : "Unknown error",
        url: req.url,
        method: req.method,
      });

      metrics.recordError(
        error instanceof Error ? error : new Error("Unknown error"),
        {
          url: req.url,
          method: req.method,
        },
      );

      if (error instanceof APIError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.code,
            details: error.details,
          },
          { status: error.statusCode },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
          code: "SERVER_ERROR",
        },
        { status: 500 },
      );
    }
  };
}
