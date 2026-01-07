import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { type NextRequest, NextResponse } from "next/server";
import { logger, metrics } from "@/lib/logger";
import { APIError, withErrorHandler } from "./errors";

// Mock the logger module
mock.module("@/lib/logger", () => ({
  logger: {
    debug: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
  },
  metrics: {
    recordError: mock(() => {}),
  },
}));

describe("APIError", () => {
  it("should set message, code, statusCode, and details correctly", () => {
    const message = "Test error message";
    const code = "TEST_ERROR";
    const statusCode = 400;
    const details = { field: "test" };

    const error = new APIError(message, code, statusCode, details);

    expect(error.message).toBe(message);
    expect(error.code).toBe(code);
    expect(error.statusCode).toBe(statusCode);
    expect(error.details).toEqual(details);
  });

  it("should default statusCode to 500 when not provided", () => {
    const message = "Test error message";
    const code = "TEST_ERROR";

    const error = new APIError(message, code);

    expect(error.message).toBe(message);
    expect(error.code).toBe(code);
    expect(error.statusCode).toBe(500);
    expect(error.details).toBeUndefined();
  });

  it("should set name property to 'APIError'", () => {
    const error = new APIError("Test message", "TEST_CODE");

    expect(error.name).toBe("APIError");
  });

  it("should extend Error class", () => {
    const error = new APIError("Test message", "TEST_CODE");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof APIError).toBe(true);
  });

  it("should work with statusCode but no details", () => {
    const error = new APIError("Test message", "TEST_CODE", 404);

    expect(error.message).toBe("Test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.statusCode).toBe(404);
    expect(error.details).toBeUndefined();
  });

  it("should preserve error stack trace", () => {
    const error = new APIError("Test message", "TEST_CODE");

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe("string");
  });
});

describe("withErrorHandler", () => {
  // Helper to create mock NextRequest
  const createMockRequest = (
    url = "http://localhost:56577/api/test",
    method = "GET",
  ) => {
    return {
      url,
      method,
      headers: new Headers(),
      nextUrl: new URL(url),
    } as NextRequest;
  };

  beforeEach(() => {
    // Clear mock call history before each test
    if (
      logger.error &&
      typeof logger.error === "function" &&
      "mock" in logger.error
    ) {
      const mockError = logger.error as ReturnType<typeof mock>;
      mockError.mock?.calls?.splice(0);
    }
    if (
      metrics.recordError &&
      typeof metrics.recordError === "function" &&
      "mock" in metrics.recordError
    ) {
      const mockRecordError = metrics.recordError as ReturnType<typeof mock>;
      mockRecordError.mock?.calls?.splice(0);
    }
  });

  it("should return response unchanged when handler succeeds", async () => {
    const mockRequest = createMockRequest();
    const expectedResponse = NextResponse.json({ success: true, data: "test" });

    const mockHandler = mock(async () => expectedResponse);
    const wrappedHandler = withErrorHandler(mockHandler);

    const result = await wrappedHandler(mockRequest);

    expect(result).toBe(expectedResponse);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(mockRequest);
  });

  it("should pass additional arguments to handler", async () => {
    const mockRequest = createMockRequest();
    const expectedResponse = NextResponse.json({ success: true });
    const extraArgs = { id: "123" };

    const mockHandler = mock(
      async (_req: NextRequest, args: typeof extraArgs) => {
        expect(args).toBe(extraArgs);
        return expectedResponse;
      },
    );

    const wrappedHandler = withErrorHandler(mockHandler);
    const result = await wrappedHandler(mockRequest, extraArgs);

    expect(result).toBe(expectedResponse);
    expect(mockHandler).toHaveBeenCalledWith(mockRequest, extraArgs);
  });

  it("should catch APIError and return proper JSON response with status", async () => {
    const mockRequest = createMockRequest(
      "http://localhost:56577/api/test",
      "POST",
    );
    const apiError = new APIError(
      "Validation failed",
      "VALIDATION_ERROR",
      400,
      { field: "email", message: "Invalid email" },
    );

    const mockHandler = mock(async () => {
      throw apiError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    const result = await wrappedHandler(mockRequest);

    // Check response body
    const responseBody = await result.json();
    expect(responseBody).toEqual({
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: { field: "email", message: "Invalid email" },
    });

    // Check status code
    expect(result.status).toBe(400);
  });

  it("should catch APIError without details", async () => {
    const mockRequest = createMockRequest();
    const apiError = new APIError("Not found", "NOT_FOUND", 404);

    const mockHandler = mock(async () => {
      throw apiError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    const result = await wrappedHandler(mockRequest);

    const responseBody = await result.json();
    expect(responseBody).toEqual({
      success: false,
      error: "Not found",
      code: "NOT_FOUND",
      details: undefined,
    });
    expect(result.status).toBe(404);
  });

  it("should catch APIError with default 500 status code", async () => {
    const mockRequest = createMockRequest();
    const apiError = new APIError("Server error", "SERVER_ERROR");

    const mockHandler = mock(async () => {
      throw apiError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    const result = await wrappedHandler(mockRequest);

    const responseBody = await result.json();
    expect(responseBody).toEqual({
      success: false,
      error: "Server error",
      code: "SERVER_ERROR",
      details: undefined,
    });
    expect(result.status).toBe(500);
  });

  it("should catch non-APIError exceptions and return 500 with generic message", async () => {
    const mockRequest = createMockRequest();
    const genericError = new Error("Unexpected error");

    const mockHandler = mock(async () => {
      throw genericError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    const result = await wrappedHandler(mockRequest);

    const responseBody = await result.json();
    expect(responseBody).toEqual({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR",
    });
    expect(result.status).toBe(500);
  });

  it("should catch non-Error exceptions and return 500 with generic message", async () => {
    const mockRequest = createMockRequest();

    const mockHandler = mock(async () => {
      throw "String error";
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    const result = await wrappedHandler(mockRequest);

    const responseBody = await result.json();
    expect(responseBody).toEqual({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR",
    });
    expect(result.status).toBe(500);
  });

  it("should log APIError properly", async () => {
    const mockRequest = createMockRequest(
      "http://localhost:56577/api/users",
      "DELETE",
    );
    const apiError = new APIError("Unauthorized", "UNAUTHORIZED", 401);

    // Spy on logger.error
    const loggerErrorSpy = spyOn(logger, "error");

    const mockHandler = mock(async () => {
      throw apiError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    await wrappedHandler(mockRequest);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith("API error", {
      error: "Unauthorized",
      url: "http://localhost:56577/api/users",
      method: "DELETE",
    });
  });

  it("should log non-APIError properly", async () => {
    const mockRequest = createMockRequest(
      "http://localhost:56577/api/test",
      "GET",
    );
    const genericError = new Error("Database connection failed");

    const loggerErrorSpy = spyOn(logger, "error");

    const mockHandler = mock(async () => {
      throw genericError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    await wrappedHandler(mockRequest);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith("API error", {
      error: "Database connection failed",
      url: "http://localhost:56577/api/test",
      method: "GET",
    });
  });

  it("should log non-Error exceptions as 'Unknown error'", async () => {
    const mockRequest = createMockRequest();

    const loggerErrorSpy = spyOn(logger, "error");

    const mockHandler = mock(async () => {
      throw null;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    await wrappedHandler(mockRequest);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith("API error", {
      error: "Unknown error",
      url: mockRequest.url,
      method: mockRequest.method,
    });
  });

  it("should record APIError in metrics", async () => {
    const mockRequest = createMockRequest(
      "http://localhost:56577/api/items",
      "PUT",
    );
    const apiError = new APIError("Conflict", "CONFLICT", 409);

    const metricsRecordErrorSpy = spyOn(metrics, "recordError");

    const mockHandler = mock(async () => {
      throw apiError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    await wrappedHandler(mockRequest);

    expect(metricsRecordErrorSpy).toHaveBeenCalledTimes(1);
    expect(metricsRecordErrorSpy).toHaveBeenCalledWith(apiError, {
      url: "http://localhost:56577/api/items",
      method: "PUT",
    });
  });

  it("should record non-APIError in metrics", async () => {
    const mockRequest = createMockRequest();
    const genericError = new TypeError("Cannot read property");

    const metricsRecordErrorSpy = spyOn(metrics, "recordError");

    const mockHandler = mock(async () => {
      throw genericError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    await wrappedHandler(mockRequest);

    expect(metricsRecordErrorSpy).toHaveBeenCalledTimes(1);
    expect(metricsRecordErrorSpy).toHaveBeenCalledWith(genericError, {
      url: mockRequest.url,
      method: mockRequest.method,
    });
  });

  it("should wrap non-Error exceptions in Error for metrics", async () => {
    const mockRequest = createMockRequest();

    const metricsRecordErrorSpy = spyOn(metrics, "recordError");

    const mockHandler = mock(async () => {
      throw { custom: "error object" };
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    await wrappedHandler(mockRequest);

    expect(metricsRecordErrorSpy).toHaveBeenCalledTimes(1);

    // Check that an Error instance was passed
    const recordedError = metricsRecordErrorSpy.mock.calls[0][0];
    expect(recordedError instanceof Error).toBe(true);
    expect(recordedError.message).toBe("Unknown error");
  });

  it("should handle both logging and metrics recording for APIError", async () => {
    const mockRequest = createMockRequest(
      "http://localhost:56577/api/data",
      "PATCH",
    );
    const apiError = new APIError("Bad request", "BAD_REQUEST", 400, {
      param: "invalid",
    });

    const loggerErrorSpy = spyOn(logger, "error");
    const metricsRecordErrorSpy = spyOn(metrics, "recordError");

    const mockHandler = mock(async () => {
      throw apiError;
    });

    const wrappedHandler = withErrorHandler(mockHandler);
    const result = await wrappedHandler(mockRequest);

    // Check logging
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith("API error", {
      error: "Bad request",
      url: "http://localhost:56577/api/data",
      method: "PATCH",
    });

    // Check metrics
    expect(metricsRecordErrorSpy).toHaveBeenCalledTimes(1);
    expect(metricsRecordErrorSpy).toHaveBeenCalledWith(apiError, {
      url: "http://localhost:56577/api/data",
      method: "PATCH",
    });

    // Check response
    const responseBody = await result.json();
    expect(responseBody).toEqual({
      success: false,
      error: "Bad request",
      code: "BAD_REQUEST",
      details: { param: "invalid" },
    });
    expect(result.status).toBe(400);
  });
});
