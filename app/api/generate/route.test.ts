/**
 * Unit tests for Generate API Route
 * Tests POST and GET handlers, validation, and configuration mapping
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { type NextRequest, NextResponse } from "next/server";
import type { GridfinityBinConfig } from "@/types/configuration";

// Mock dependencies before importing the route
const mockValidateSVG = mock((_svg: string) => ({ valid: true as boolean }));
const mockValidateBinConfig = mock((_config: GridfinityBinConfig) => ({
  valid: true as boolean,
  errors: [] as string[],
  warnings: [] as string[],
}));

const mockCreateJobPaths = mock(async () => ({
  jobId: "550e8400-e29b-41d4-a716-446655440000",
  svgPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/cutout.svg",
  scadPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.scad",
  stlPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.stl",
}));

const mockWriteSVG = mock(async (_path: string, _content: string) => {});

const mockGenerate = mock(
  async (
    _svgPath: string,
    _config: GridfinityBinConfig,
    _scadPath: string,
  ) => ({
    success: true as boolean,
    scadPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.scad" as
      | string
      | undefined,
    error: undefined as string | undefined,
  }),
);

const mockRender = mock(async (_scadPath: string, _stlPath: string) => ({
  success: true as boolean,
  outputPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.stl" as
    | string
    | undefined,
  duration: 1500 as number | undefined,
  error: undefined as string | undefined,
  stderr: undefined as string | undefined,
  stdout: undefined as string | undefined,
}));

const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

const mockMetrics = {
  recordGeneration: mock(() => {}),
};

// Mock modules
mock.module("@/lib/validation/svg", () => ({
  validateSVG: mockValidateSVG,
}));

mock.module("@/types/configuration", () => ({
  validateBinConfig: mockValidateBinConfig,
  GRIDFINITY_CONSTRAINTS: {
    GRID_UNIT_SIZE: 42,
    MIN_GRID_UNITS: 1,
    MAX_GRID_UNITS: 10,
    MIN_BIN_HEIGHT: 7,
    HEIGHT_INCREMENT: 7,
    MIN_WALL_THICKNESS: 1.0,
    RECOMMENDED_WALL: 2.0,
    MIN_CUTOUT_DEPTH: 3,
    DEFAULT_PADDING: 2.0,
    MAX_BIN_HEIGHT: 100,
  },
}));

mock.module("@/lib/openscad/fileManager", () => ({
  stlFileManager: {
    createJobPaths: mockCreateJobPaths,
    writeSVG: mockWriteSVG,
  },
}));

mock.module("@/lib/openscad/generator", () => ({
  openscadGenerator: {
    generate: mockGenerate,
  },
}));

mock.module("@/lib/openscad/executor", () => ({
  openscadExecutor: {
    render: mockRender,
  },
}));

mock.module("@/lib/logger", () => ({
  logger: mockLogger,
  metrics: mockMetrics,
}));

mock.module("@/lib/api/rateLimit", () => ({
  // biome-ignore lint/complexity/noBannedTypes: Test mock, function type is acceptable
  withRateLimit: (handler: Function) => handler,
}));

// Create APIError class
class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "APIError";
  }
}

mock.module("@/lib/api/errors", () => ({
  // biome-ignore lint/complexity/noBannedTypes: Test mock, function type is acceptable
  withErrorHandler: (handler: Function) => {
    return async (req: NextRequest) => {
      try {
        return await handler(req);
      } catch (error) {
        if (error instanceof APIError) {
          return NextResponse.json(
            {
              message: error.message,
              code: error.code,
              details: error.details,
            },
            { status: error.statusCode },
          );
        }
        return NextResponse.json(
          {
            message: error instanceof Error ? error.message : "Unknown error",
            code: "SERVER_ERROR",
          },
          { status: 500 },
        );
      }
    };
  },
  APIError,
}));

// Import the route handlers after mocking
// Note: We need to import the internal functions for testing
// In a real implementation, you might export these or use a different testing approach
const routeModule = await import("./route");

// Helper to create a mock NextRequest
function createMockRequest(
  method: string,
  body?: unknown,
  url: string = "http://localhost:56577/api/generate",
): NextRequest {
  const request = new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return request as NextRequest;
}

// Helper to create valid request body
function createValidRequestBody(overrides?: Record<string, unknown>) {
  return {
    svg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
    config: {
      gridUnitsX: 2,
      gridUnitsY: 1,
      binHeight: 14,
      cutoutDepth: 10,
      wallThickness: 1.2,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 2,
      paddingRight: 2,
      magnetHoles: true,
      screwHoles: false,
      stackingLip: true,
      cornerRadius: 0.5,
      baseThickness: 5,
    },
    ...overrides,
  };
}

describe("apiConfigToBinConfig", () => {
  // We need to test the internal function
  // Since it's not exported, we'll test it indirectly through the POST handler
  // For better testing, the function should be exported

  it("applies default values correctly", async () => {
    const requestBody = {
      svg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
      config: {
        gridUnitsX: 2,
        gridUnitsY: 1,
        binHeight: 14,
        cutoutDepth: 10,
        // Omit optional fields to test defaults
      },
    };

    const request = createMockRequest("POST", requestBody);
    const response = await routeModule.POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Check that the generator was called with default values applied
    expect(mockGenerate).toHaveBeenCalled();
    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;

    expect(config.wallThickness).toBe(1.2);
    expect(config.cutoutPadding).toBe(2); // (2+2+2+2)/4
    expect(config.cornerRadius).toBe(0.5);
  });

  it("maps magnetHoles=true, screwHoles=true to baseType=magnet_screw", async () => {
    const requestBody = createValidRequestBody({
      config: {
        ...createValidRequestBody().config,
        magnetHoles: true,
        screwHoles: true,
      },
    });

    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.baseType).toBe("magnet_screw");
  });

  it("maps magnetHoles=true, screwHoles=false to baseType=magnet", async () => {
    const requestBody = createValidRequestBody({
      config: {
        ...createValidRequestBody().config,
        magnetHoles: true,
        screwHoles: false,
      },
    });

    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.baseType).toBe("magnet");
  });

  it("maps magnetHoles=false, screwHoles=true to baseType=screw", async () => {
    const requestBody = createValidRequestBody({
      config: {
        ...createValidRequestBody().config,
        magnetHoles: false,
        screwHoles: true,
      },
    });

    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.baseType).toBe("screw");
  });

  it("maps magnetHoles=false, screwHoles=false to baseType=solid", async () => {
    const requestBody = createValidRequestBody({
      config: {
        ...createValidRequestBody().config,
        magnetHoles: false,
        screwHoles: false,
      },
    });

    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.baseType).toBe("solid");
  });

  it("maps stackingLip=true to lipStyle=normal", async () => {
    const requestBody = createValidRequestBody({
      config: {
        ...createValidRequestBody().config,
        stackingLip: true,
      },
    });

    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.lipStyle).toBe("normal");
  });

  it("maps stackingLip=false to lipStyle=none", async () => {
    const requestBody = createValidRequestBody({
      config: {
        ...createValidRequestBody().config,
        stackingLip: false,
      },
    });

    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.lipStyle).toBe("none");
  });

  it("calculates cutoutPadding as average of all padding values", async () => {
    const requestBody = createValidRequestBody({
      config: {
        ...createValidRequestBody().config,
        paddingTop: 4,
        paddingBottom: 3,
        paddingLeft: 2,
        paddingRight: 1,
      },
    });

    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.cutoutPadding).toBe(2.5); // (4+3+2+1)/4
  });

  it("sets cutoutOffsetX and cutoutOffsetY to 0", async () => {
    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);
    await routeModule.POST(request);

    const generatorCall =
      mockGenerate.mock.calls[mockGenerate.mock.calls.length - 1];
    const config = generatorCall[1] as GridfinityBinConfig;
    expect(config.cutoutOffsetX).toBe(0);
    expect(config.cutoutOffsetY).toBe(0);
  });
});

// Shared beforeEach for all tests
beforeEach(() => {
  // Reset mocks
  mockValidateSVG.mockClear();
  mockValidateBinConfig.mockClear();
  mockCreateJobPaths.mockClear();
  mockWriteSVG.mockClear();
  mockGenerate.mockClear();
  mockRender.mockClear();
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
  mockLogger.debug.mockClear();
  mockMetrics.recordGeneration.mockClear();

  // Set default mock behaviors
  mockValidateSVG.mockImplementation(() => ({ valid: true as boolean }));
  mockValidateBinConfig.mockImplementation(() => ({
    valid: true as boolean,
    errors: [] as string[],
    warnings: [] as string[],
  }));
  mockCreateJobPaths.mockImplementation(async () => ({
    jobId: "550e8400-e29b-41d4-a716-446655440000",
    svgPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/cutout.svg",
    scadPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.scad",
    stlPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.stl",
  }));
  mockWriteSVG.mockImplementation(async (_path: string, _content: string) => {
    // Default: do nothing, just succeed
  });
  mockGenerate.mockImplementation(async () => ({
    success: true as boolean,
    scadPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.scad" as
      | string
      | undefined,
    error: undefined as string | undefined,
  }));
  mockRender.mockImplementation(async () => ({
    success: true as boolean,
    outputPath: "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.stl" as
      | string
      | undefined,
    duration: 1500 as number | undefined,
    error: undefined as string | undefined,
    stderr: undefined as string | undefined,
    stdout: undefined as string | undefined,
  }));
});

describe("POST /api/generate", () => {
  it("returns success with generationId for valid request", async () => {
    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      generationId: "550e8400-e29b-41d4-a716-446655440000",
      status: "complete",
      downloadUrl: "/api/download/550e8400-e29b-41d4-a716-446655440000",
      estimatedTimeMs: expect.any(Number),
    });

    // Verify all services were called
    expect(mockValidateSVG).toHaveBeenCalledWith(requestBody.svg);
    expect(mockValidateBinConfig).toHaveBeenCalled();
    expect(mockCreateJobPaths).toHaveBeenCalled();
    expect(mockWriteSVG).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalled();
    expect(mockMetrics.recordGeneration).toHaveBeenCalled();
  });

  it("returns 400 for invalid schema", async () => {
    const requestBody = {
      svg: "short", // Too short (< 10 chars)
      config: createValidRequestBody().config,
    };
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(data.message).toContain("Invalid request");
    expect(data.message).toContain("svg");
  });

  it("returns 400 for missing required fields", async () => {
    const requestBody = {
      svg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
      // Missing config
    };
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(data.message).toContain("Invalid request");
    expect(data.message).toContain("config");
  });

  it("returns 400 for invalid SVG", async () => {
    mockValidateSVG.mockImplementation(() => ({
      valid: false,
      error: "SVG contains malicious script tag",
    }));

    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.code).toBe("INVALID_SVG");
    expect(data.message).toContain("SVG contains malicious script tag");
    expect(mockLogger.warn).toHaveBeenCalledWith("SVG validation failed", {
      error: "SVG contains malicious script tag",
    });
  });

  it("returns 400 for invalid config", async () => {
    mockValidateBinConfig.mockImplementation(() => ({
      valid: false as const,
      errors: [
        "binHeight must be at least 7mm",
        "cutoutDepth must be less than binHeight",
      ] as const,
      warnings: [] as const,
    }));

    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(data.message).toContain("Invalid configuration");
    expect(data.message).toContain("binHeight must be at least 7mm");
    expect(mockLogger.warn).toHaveBeenCalledWith("Config validation failed", {
      errors: [
        "binHeight must be at least 7mm",
        "cutoutDepth must be less than binHeight",
      ],
    });
  });

  it("logs warnings for valid config with warnings", async () => {
    mockValidateBinConfig.mockImplementation(() => ({
      valid: true as const,
      errors: [] as const,
      warnings: ["wallThickness below 2.0mm may result in weak walls"] as const,
    }));

    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(200);

    expect(mockLogger.info).toHaveBeenCalledWith("Config validation warnings", {
      warnings: ["wallThickness below 2.0mm may result in weak walls"],
    });
  });

  it("returns 500 when OpenSCAD generation fails", async () => {
    mockGenerate.mockImplementation(async () => ({
      success: false as const,
      scadPath: undefined,
      error: "Failed to parse SVG file",
    }));

    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.code).toBe("OPENSCAD_ERROR");
    expect(data.message).toContain("Failed to parse SVG file");
  });

  it("returns 500 when OpenSCAD rendering fails", async () => {
    mockRender.mockImplementation(async () => ({
      success: false as const,
      outputPath: undefined,
      duration: undefined,
      error: "OpenSCAD process crashed",
      stderr: "ERROR: Syntax error in generated SCAD file",
      stdout: undefined,
    }));

    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.code).toBe("OPENSCAD_ERROR");
    expect(data.message).toContain("OpenSCAD process crashed");
    expect(mockLogger.error).toHaveBeenCalledWith("OpenSCAD render failed", {
      error: "OpenSCAD process crashed",
      stderr: "ERROR: Syntax error in generated SCAD file",
    });
  });

  it("handles generic errors and returns 500", async () => {
    mockWriteSVG.mockImplementation(async () => {
      throw new Error("File system error: disk full");
    });

    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    const response = await routeModule.POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.code).toBe("SERVER_ERROR");
    expect(data.message).toContain("Internal server error during generation");
    expect(mockLogger.error).toHaveBeenCalledWith("Generation error", {
      error: "File system error: disk full",
      duration: expect.any(Number),
    });
  });

  it("writes correct SVG content to file", async () => {
    const svgContent =
      '<svg><rect x="10" y="10" width="50" height="50"/></svg>';
    const requestBody = createValidRequestBody({ svg: svgContent });
    const request = createMockRequest("POST", requestBody);

    await routeModule.POST(request);

    expect(mockWriteSVG).toHaveBeenCalledWith(
      "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/cutout.svg",
      svgContent,
    );
  });

  it("passes correct config to OpenSCAD generator", async () => {
    const requestBody = createValidRequestBody({
      config: {
        gridUnitsX: 3,
        gridUnitsY: 2,
        binHeight: 21,
        cutoutDepth: 15,
        wallThickness: 2.0,
        paddingTop: 3,
        paddingBottom: 3,
        paddingLeft: 3,
        paddingRight: 3,
        magnetHoles: true,
        screwHoles: true,
        stackingLip: false,
        cornerRadius: 1.0,
      },
    });
    const request = createMockRequest("POST", requestBody);

    await routeModule.POST(request);

    expect(mockGenerate).toHaveBeenCalledWith(
      "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/cutout.svg",
      {
        gridUnitsX: 3,
        gridUnitsY: 2,
        binHeight: 21,
        cutoutDepth: 15,
        cutoutPadding: 3,
        cutoutOffsetX: 0,
        cutoutOffsetY: 0,
        wallThickness: 2.0,
        baseType: "magnet_screw",
        lipStyle: "none",
        cornerRadius: 1.0,
      },
      "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.scad",
    );
  });

  it("passes correct paths to OpenSCAD renderer", async () => {
    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    await routeModule.POST(request);

    expect(mockRender).toHaveBeenCalledWith(
      "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.scad",
      "/tmp/jobs/550e8400-e29b-41d4-a716-446655440000/bin.stl",
    );
  });

  it("records generation metrics on success", async () => {
    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    await routeModule.POST(request);

    expect(mockMetrics.recordGeneration).toHaveBeenCalledWith(
      expect.any(Number),
    );
  });

  it("does not record metrics on failure", async () => {
    mockGenerate.mockImplementation(async () => ({
      success: false as const,
      scadPath: undefined,
      error: "Generation failed",
    }));

    const requestBody = createValidRequestBody();
    const request = createMockRequest("POST", requestBody);

    await routeModule.POST(request);

    expect(mockMetrics.recordGeneration).not.toHaveBeenCalled();
  });
});

describe("GET /api/generate", () => {
  it("returns 400 when id parameter is missing", async () => {
    const request = createMockRequest(
      "GET",
      undefined,
      "http://localhost:56577/api/generate",
    );

    const response = await routeModule.GET(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(data.message).toContain("Missing id query parameter");
  });

  it("returns 404 when generation id is not found", async () => {
    const request = createMockRequest(
      "GET",
      undefined,
      "http://localhost:3000/api/generate?id=nonexistent-id",
    );

    const response = await routeModule.GET(request);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(data.message).toContain("Generation not found");
  });

  it("returns status for valid generation id", async () => {
    // Use a fresh request to ensure we get a new job ID
    const requestBody = createValidRequestBody();

    // First create a job (synchronous)
    const postRequest = createMockRequest("POST", requestBody);
    const postResponse = await routeModule.POST(postRequest);
    expect(postResponse.status).toBe(200);

    const postData = await postResponse.json();
    const generationId = postData.generationId;
    expect(generationId).toBe("550e8400-e29b-41d4-a716-446655440000");

    // Then get its status
    const getRequest = createMockRequest(
      "GET",
      undefined,
      `http://localhost:56577/api/generate?id=${generationId}`,
    );
    const getResponse = await routeModule.GET(getRequest);
    expect(getResponse.status).toBe(200);

    const getData = await getResponse.json();

    expect(getData).toMatchObject({
      id: generationId,
      status: "complete",
      progress: 100,
      downloadUrl: `/api/download/${generationId}`,
      createdAt: expect.any(String),
      completedAt: expect.any(String),
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Retrieved generation status",
      {
        id: generationId,
        status: "complete",
      },
    );
  });

  it("handles generic errors and returns 500", async () => {
    // Create a mock that throws an error
    const getRequest = createMockRequest(
      "GET",
      undefined,
      "http://localhost:56577/api/generate?id=test-id",
    );

    // Mock URL constructor to throw
    const originalURL = global.URL;
    global.URL = class extends originalURL {
      constructor(url: string | URL, base?: string | URL) {
        super(url, base);
        if (url.toString().includes("test-id")) {
          throw new Error("URL parsing error");
        }
      }
    } as typeof URL;

    const response = await routeModule.GET(getRequest);

    // Restore URL
    global.URL = originalURL;

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.code).toBe("SERVER_ERROR");
    expect(data.message).toContain("Internal server error");
  });
});
