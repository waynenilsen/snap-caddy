import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  GenerateResponse,
  GenerationStatusResponse,
  SegmentResponse,
} from "@/types/api";
import type { GridfinityConfig } from "@/types/gridfinity";
import { APIClientError, SnapCaddyAPI } from "./client";

// Helper to create a valid GridfinityConfig for tests
const createTestConfig = (
  overrides: Partial<GridfinityConfig> = {},
): GridfinityConfig => ({
  gridUnitsX: 2,
  gridUnitsY: 2,
  binHeight: 21,
  cutoutDepth: 10,
  wallThickness: 1.2,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 2,
  paddingRight: 2,
  magnetHoles: false,
  screwHoles: false,
  stackingLip: true,
  cornerRadius: 0.5,
  baseThickness: 5,
  ...overrides,
});

describe("APIClientError", () => {
  it("should set message, code, and statusCode correctly", () => {
    const error = new APIClientError("Test error", "TEST_CODE", 404);

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.statusCode).toBe(404);
  });

  it("should set name to APIClientError", () => {
    const error = new APIClientError("Test error", "TEST_CODE", 500);

    expect(error.name).toBe("APIClientError");
  });

  it("should be an instance of Error", () => {
    const error = new APIClientError("Test error", "TEST_CODE", 400);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(APIClientError);
  });

  it("should capture stack trace when Error.captureStackTrace is available", () => {
    const error = new APIClientError("Test error", "TEST_CODE", 500);

    // Stack trace should be present (V8 engines like Bun support this)
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("APIClientError");
  });
});

describe("SnapCaddyAPI", () => {
  let api: SnapCaddyAPI;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should use empty string as default baseUrl", () => {
      api = new SnapCaddyAPI();
      expect(api).toBeDefined();
    });

    it("should accept custom baseUrl", () => {
      api = new SnapCaddyAPI("https://api.example.com");
      expect(api).toBeDefined();
    });
  });

  describe("segment", () => {
    beforeEach(() => {
      api = new SnapCaddyAPI("https://api.example.com");
    });

    it("should make correct POST request to /api/segment", async () => {
      const mockResponse: SegmentResponse = {
        success: true,
        masks: [
          {
            mask: "base64-encoded-mask",
            confidence: 0.95,
            boundingBox: { x: 10, y: 10, width: 100, height: 100 },
            area: 10000,
          },
        ],
        imageWidth: 800,
        imageHeight: 600,
        processingTimeMs: 1234,
      };

      const fetchMock = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.example.com/api/segment");
        expect(options.method).toBe("POST");
        expect(options.headers).toEqual({
          "Content-Type": "application/json",
        });

        const body = JSON.parse(options.body as string);
        expect(body.image).toBe("base64-image");
        expect(body.points).toEqual([{ x: 100, y: 200, label: 1 }]);
        expect(body.imageWidth).toBe(800);
        expect(body.imageHeight).toBe(600);
        expect(body.returnMultipleMasks).toBe(true);

        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.segment({
        image: "base64-image",
        points: [{ x: 100, y: 200, label: 1 }],
        imageWidth: 800,
        imageHeight: 600,
        returnMultipleMasks: true,
      });

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should handle optional returnMultipleMasks parameter", async () => {
      const mockResponse: SegmentResponse = {
        success: true,
        masks: [
          {
            mask: "mask-data",
            confidence: 0.9,
            boundingBox: { x: 5, y: 5, width: 50, height: 50 },
            area: 2500,
          },
        ],
        imageWidth: 800,
        imageHeight: 600,
        processingTimeMs: 500,
      };

      const fetchMock = mock(async (_url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string);
        expect(body.returnMultipleMasks).toBeUndefined();

        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      globalThis.fetch = fetchMock as any;

      await api.segment({
        image: "base64-image",
        points: [{ x: 100, y: 200, label: 1 }],
        imageWidth: 800,
        imageHeight: 600,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("generate", () => {
    beforeEach(() => {
      api = new SnapCaddyAPI("https://api.example.com");
    });

    it("should make correct POST request to /api/generate", async () => {
      const config = createTestConfig();

      const mockResponse: GenerateResponse = {
        success: true,
        generationId: "gen-123",
        status: "processing",
      };

      const fetchMock = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.example.com/api/generate");
        expect(options.method).toBe("POST");

        const body = JSON.parse(options.body as string);
        expect(body.svg).toBe("<svg>...</svg>");
        expect(body.config).toEqual(config);
        expect(body.async).toBe(true);

        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.generate({
        svg: "<svg>...</svg>",
        config,
        async: true,
      });

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should handle optional async parameter", async () => {
      const config = createTestConfig({
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 14,
      });

      const mockResponse: GenerateResponse = {
        success: true,
        generationId: "gen-456",
        status: "complete",
        downloadUrl: "https://api.example.com/api/download/gen-456",
      };

      const fetchMock = mock(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.generate({
        svg: "<svg>test</svg>",
        config,
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getGenerationStatus", () => {
    beforeEach(() => {
      api = new SnapCaddyAPI("https://api.example.com");
    });

    it("should make correct GET request to /api/generate with id param", async () => {
      const mockResponse: GenerationStatusResponse = {
        id: "gen-123",
        status: "processing",
        progress: 50,
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      const fetchMock = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.example.com/api/generate?id=gen-123");
        expect(options.method).toBeUndefined(); // GET is default

        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.getGenerationStatus("gen-123");

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should handle complete status with downloadUrl", async () => {
      const mockResponse: GenerationStatusResponse = {
        id: "gen-456",
        status: "complete",
        progress: 100,
        createdAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:05:00.000Z",
        downloadUrl: "https://api.example.com/api/download/gen-456",
      };

      const fetchMock = mock(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.getGenerationStatus("gen-456");

      expect(result.status).toBe("complete");
      expect(result.downloadUrl).toBe(
        "https://api.example.com/api/download/gen-456",
      );
    });

    it("should handle error status", async () => {
      const mockResponse: GenerationStatusResponse = {
        id: "gen-error",
        status: "error",
        progress: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        error: "Generation failed due to invalid SVG",
      };

      const fetchMock = mock(async () => {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.getGenerationStatus("gen-error");

      expect(result.status).toBe("error");
      expect(result.error).toBe("Generation failed due to invalid SVG");
    });
  });

  describe("downloadSTL", () => {
    beforeEach(() => {
      api = new SnapCaddyAPI("https://api.example.com");
    });

    it("should fetch blob from /api/download/:id", async () => {
      const mockBlob = new Blob(["STL data"], { type: "model/stl" });

      const fetchMock = mock(async (url: string) => {
        expect(url).toBe("https://api.example.com/api/download/gen-123");

        return new Response(mockBlob, {
          status: 200,
          headers: { "Content-Type": "model/stl" },
        });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.downloadSTL("gen-123");

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe("model/stl");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should throw APIClientError when download fails", async () => {
      const fetchMock = mock(async () => {
        return new Response(
          JSON.stringify({ error: "File not found", code: "NOT_FOUND" }),
          { status: 404 },
        );
      });

      globalThis.fetch = fetchMock as any;

      await expect(api.downloadSTL("gen-invalid")).rejects.toThrow(
        APIClientError,
      );
    });
  });

  describe("getPreview", () => {
    beforeEach(() => {
      api = new SnapCaddyAPI("https://api.example.com");
    });

    it("should make POST request and return blob", async () => {
      const config = createTestConfig();

      const mockBlob = new Blob(["PNG data"], { type: "image/png" });

      const fetchMock = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.example.com/api/preview");
        expect(options.method).toBe("POST");
        expect(options.headers).toEqual({
          "Content-Type": "application/json",
        });

        const body = JSON.parse(options.body as string);
        expect(body.svg).toBe("<svg>preview</svg>");
        expect(body.config).toEqual(config);

        return new Response(mockBlob, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.getPreview({
        svg: "<svg>preview</svg>",
        config,
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe("image/png");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      api = new SnapCaddyAPI("https://api.example.com");
    });

    it("should throw APIClientError with error details from JSON response", async () => {
      const fetchMock = mock(async () => {
        return new Response(
          JSON.stringify({
            error: "Invalid request",
            code: "INVALID_REQUEST",
          }),
          { status: 400, statusText: "Bad Request" },
        );
      });

      globalThis.fetch = fetchMock as any;

      try {
        await api.segment({
          image: "invalid",
          points: [],
          imageWidth: 0,
          imageHeight: 0,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIClientError);
        if (error instanceof APIClientError) {
          expect(error.message).toBe("Invalid request");
          expect(error.code).toBe("INVALID_REQUEST");
          expect(error.statusCode).toBe(400);
        }
      }
    });

    it("should use default error message when JSON parsing fails", async () => {
      const fetchMock = mock(async () => {
        return new Response("Plain text error", {
          status: 500,
          statusText: "Internal Server Error",
        });
      });

      globalThis.fetch = fetchMock as any;

      try {
        await api.getGenerationStatus("gen-123");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIClientError);
        if (error instanceof APIClientError) {
          expect(error.message).toBe("HTTP 500: Internal Server Error");
          expect(error.code).toBe("UNKNOWN_ERROR");
          expect(error.statusCode).toBe(500);
        }
      }
    });

    it("should handle blob fetch errors with JSON error response", async () => {
      const fetchMock = mock(async () => {
        return new Response(
          JSON.stringify({
            error: "Generation not complete",
            code: "NOT_READY",
          }),
          { status: 409, statusText: "Conflict" },
        );
      });

      globalThis.fetch = fetchMock as any;

      try {
        await api.downloadSTL("gen-pending");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIClientError);
        if (error instanceof APIClientError) {
          expect(error.message).toBe("Generation not complete");
          expect(error.code).toBe("NOT_READY");
          expect(error.statusCode).toBe(409);
        }
      }
    });

    it("should handle blob fetch errors with non-JSON response", async () => {
      const fetchMock = mock(async () => {
        return new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        });
      });

      globalThis.fetch = fetchMock as any;

      try {
        await api.getPreview({
          svg: "<svg>test</svg>",
          config: createTestConfig({
            gridUnitsX: 1,
            gridUnitsY: 1,
            binHeight: 7,
          }),
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIClientError);
        if (error instanceof APIClientError) {
          expect(error.message).toBe("HTTP 404: Not Found");
          expect(error.code).toBe("UNKNOWN_ERROR");
          expect(error.statusCode).toBe(404);
        }
      }
    });
  });

  describe("generateAndDownload", () => {
    beforeEach(() => {
      api = new SnapCaddyAPI("https://api.example.com");
    });

    it("should poll until complete and return blob", async () => {
      const config = createTestConfig();

      const mockBlob = new Blob(["STL data"], { type: "model/stl" });
      let pollCount = 0;

      const fetchMock = mock(async (url: string) => {
        // Initial generation request
        if (url.includes("/api/generate") && !url.includes("?id=")) {
          return new Response(
            JSON.stringify({
              success: true,
              generationId: "gen-poll-test",
              status: "processing",
            }),
            { status: 200 },
          );
        }

        // Status polling
        if (url.includes("/api/generate?id=gen-poll-test")) {
          pollCount++;

          if (pollCount === 1) {
            return new Response(
              JSON.stringify({
                id: "gen-poll-test",
                status: "processing",
                progress: 30,
                createdAt: "2024-01-01T00:00:00.000Z",
              }),
              { status: 200 },
            );
          } else if (pollCount === 2) {
            return new Response(
              JSON.stringify({
                id: "gen-poll-test",
                status: "processing",
                progress: 60,
                createdAt: "2024-01-01T00:00:00.000Z",
              }),
              { status: 200 },
            );
          } else {
            return new Response(
              JSON.stringify({
                id: "gen-poll-test",
                status: "complete",
                progress: 100,
                createdAt: "2024-01-01T00:00:00.000Z",
                completedAt: "2024-01-01T00:05:00.000Z",
              }),
              {
                status: 200,
              },
            );
          }
        }

        // Download request
        if (url.includes("/api/download/gen-poll-test")) {
          return new Response(mockBlob, { status: 200 });
        }

        return new Response("Not found", { status: 404 });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.generateAndDownload({
        svg: "<svg>test</svg>",
        config,
        pollingInterval: 10, // Fast polling for test
      });

      expect(result).toBeInstanceOf(Blob);
      expect(pollCount).toBe(3);
    });

    it("should call onProgress callback during polling", async () => {
      const config = createTestConfig({
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 7,
      });

      const mockBlob = new Blob(["STL data"], { type: "model/stl" });
      const progressUpdates: GenerationStatusResponse[] = [];
      let pollCount = 0;

      const fetchMock = mock(async (url: string) => {
        if (url.includes("/api/generate") && !url.includes("?id=")) {
          return new Response(
            JSON.stringify({
              success: true,
              generationId: "gen-progress",
              status: "processing",
            }),
            { status: 200 },
          );
        }

        if (url.includes("/api/generate?id=gen-progress")) {
          pollCount++;
          if (pollCount === 1) {
            return new Response(
              JSON.stringify({
                id: "gen-progress",
                status: "processing",
                progress: 50,
                createdAt: "2024-01-01T00:00:00.000Z",
              }),
              { status: 200 },
            );
          } else {
            return new Response(
              JSON.stringify({
                id: "gen-progress",
                status: "complete",
                progress: 100,
                createdAt: "2024-01-01T00:00:00.000Z",
                completedAt: "2024-01-01T00:05:00.000Z",
              }),
              {
                status: 200,
              },
            );
          }
        }

        if (url.includes("/api/download/gen-progress")) {
          return new Response(mockBlob, { status: 200 });
        }

        return new Response("Not found", { status: 404 });
      });

      globalThis.fetch = fetchMock as any;

      await api.generateAndDownload({
        svg: "<svg>test</svg>",
        config,
        pollingInterval: 10,
        onProgress: (status) => {
          progressUpdates.push(status);
        },
      });

      expect(progressUpdates.length).toBe(2);
      expect(progressUpdates[0].status).toBe("processing");
      expect(progressUpdates[0].progress).toBe(50);
      expect(progressUpdates[1].status).toBe("complete");
    });

    it("should throw error when generation fails", async () => {
      const config = createTestConfig({
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 7,
      });

      const fetchMock = mock(async (url: string) => {
        if (url.includes("/api/generate") && !url.includes("?id=")) {
          return new Response(
            JSON.stringify({
              success: true,
              generationId: "gen-error",
              status: "processing",
            }),
            { status: 200 },
          );
        }

        if (url.includes("/api/generate?id=gen-error")) {
          return new Response(
            JSON.stringify({
              id: "gen-error",
              status: "error",
              progress: 0,
              createdAt: "2024-01-01T00:00:00.000Z",
              error: "Invalid SVG format",
            }),
            { status: 200 },
          );
        }

        return new Response("Not found", { status: 404 });
      });

      globalThis.fetch = fetchMock as any;

      try {
        await api.generateAndDownload({
          svg: "<svg>invalid</svg>",
          config,
          pollingInterval: 10,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIClientError);
        if (error instanceof APIClientError) {
          expect(error.message).toBe("Invalid SVG format");
          expect(error.code).toBe("GENERATION_ERROR");
          expect(error.statusCode).toBe(500);
        }
      }
    });

    it("should use default error message when generation error has no message", async () => {
      const config = createTestConfig({
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 7,
      });

      const fetchMock = mock(async (url: string) => {
        if (url.includes("/api/generate") && !url.includes("?id=")) {
          return new Response(
            JSON.stringify({
              success: true,
              generationId: "gen-error-no-msg",
              status: "processing",
            }),
            { status: 200 },
          );
        }

        if (url.includes("/api/generate?id=gen-error-no-msg")) {
          return new Response(
            JSON.stringify({
              id: "gen-error-no-msg",
              status: "error",
              progress: 0,
              createdAt: "2024-01-01T00:00:00.000Z",
            }),
            {
              status: 200,
            },
          );
        }

        return new Response("Not found", { status: 404 });
      });

      globalThis.fetch = fetchMock as any;

      try {
        await api.generateAndDownload({
          svg: "<svg>test</svg>",
          config,
          pollingInterval: 10,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIClientError);
        if (error instanceof APIClientError) {
          expect(error.message).toBe("Generation failed");
          expect(error.code).toBe("GENERATION_ERROR");
        }
      }
    });

    it("should use default polling interval of 1000ms when not specified", async () => {
      const config = createTestConfig({
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 7,
      });

      const mockBlob = new Blob(["STL data"], { type: "model/stl" });
      const _startTime = Date.now();

      const fetchMock = mock(async (url: string) => {
        if (url.includes("/api/generate") && !url.includes("?id=")) {
          return new Response(
            JSON.stringify({
              success: true,
              generationId: "gen-default-interval",
              status: "processing",
            }),
            { status: 200 },
          );
        }

        if (url.includes("/api/generate?id=gen-default-interval")) {
          // Complete immediately on first poll
          return new Response(
            JSON.stringify({
              id: "gen-default-interval",
              status: "complete",
              progress: 100,
              createdAt: "2024-01-01T00:00:00.000Z",
              completedAt: "2024-01-01T00:05:00.000Z",
            }),
            {
              status: 200,
            },
          );
        }

        if (url.includes("/api/download/gen-default-interval")) {
          return new Response(mockBlob, { status: 200 });
        }

        return new Response("Not found", { status: 404 });
      });

      globalThis.fetch = fetchMock as any;

      const result = await api.generateAndDownload({
        svg: "<svg>test</svg>",
        config,
        // No pollingInterval specified, should use default 1000ms
      });

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe("createDownloadLink", () => {
    let mockCreateObjectURL: ReturnType<typeof mock>;
    let originalCreateObjectURL: typeof URL.createObjectURL;

    beforeEach(() => {
      api = new SnapCaddyAPI();
      originalCreateObjectURL = URL.createObjectURL;

      mockCreateObjectURL = mock((_blob: Blob) => {
        return `blob:http://localhost/${Math.random()}`;
      });

      URL.createObjectURL = mockCreateObjectURL as any;
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
    });

    it("should create object URL from blob", () => {
      const blob = new Blob(["test data"], { type: "text/plain" });
      const url = api.createDownloadLink(blob);

      expect(url).toStartWith("blob:");
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    });

    it("should accept optional filename parameter", () => {
      const blob = new Blob(["test data"], { type: "text/plain" });
      const url = api.createDownloadLink(blob, "test.txt");

      expect(url).toStartWith("blob:");
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    });
  });

  describe("triggerDownload", () => {
    let mockCreateObjectURL: ReturnType<typeof mock>;
    let mockRevokeObjectURL: ReturnType<typeof mock>;
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;
    let mockDocument: any;

    beforeEach(() => {
      api = new SnapCaddyAPI();

      // Mock URL methods
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;

      mockCreateObjectURL = mock(() => "blob:http://localhost/test-blob");
      mockRevokeObjectURL = mock(() => {});

      URL.createObjectURL = mockCreateObjectURL as any;
      URL.revokeObjectURL = mockRevokeObjectURL as any;

      // Mock document
      const mockAnchor = {
        href: "",
        download: "",
        style: { display: "" },
        click: mock(() => {}),
      };

      mockDocument = {
        createElement: mock(() => mockAnchor),
        body: {
          appendChild: mock(() => {}),
          removeChild: mock(() => {}),
        },
      };

      (globalThis as any).document = mockDocument;
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      delete (globalThis as any).document;
    });

    it("should create anchor element and trigger download", () => {
      const blob = new Blob(["STL data"], { type: "model/stl" });

      api.triggerDownload(blob, "test.stl");

      expect(mockDocument.createElement).toHaveBeenCalledWith("a");
      expect(mockDocument.body.appendChild).toHaveBeenCalledTimes(1);
      expect(mockDocument.body.removeChild).toHaveBeenCalledTimes(1);
    });

    it("should set correct anchor properties", () => {
      const blob = new Blob(["STL data"], { type: "model/stl" });
      let anchorElement: any;

      mockDocument.createElement = mock((_tag: string) => {
        anchorElement = {
          href: "",
          download: "",
          style: { display: "" },
          click: mock(() => {}),
        };
        return anchorElement;
      });

      api.triggerDownload(blob, "my-bin.stl");

      expect(anchorElement.href).toBe("blob:http://localhost/test-blob");
      expect(anchorElement.download).toBe("my-bin.stl");
      expect(anchorElement.style.display).toBe("none");
      expect(anchorElement.click).toHaveBeenCalledTimes(1);
    });

    it("should revoke object URL after timeout", async () => {
      const blob = new Blob(["STL data"], { type: "model/stl" });

      api.triggerDownload(blob, "test.stl");

      // URL should not be revoked immediately
      expect(mockRevokeObjectURL).not.toHaveBeenCalled();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // URL should be revoked after 100ms
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(
        "blob:http://localhost/test-blob",
      );
    });
  });

  describe("singleton instance", () => {
    it("should export singleton api instance", async () => {
      // Import the singleton
      const { api: singletonApi } = await import("./client");

      expect(singletonApi).toBeDefined();
      expect(singletonApi).toBeInstanceOf(SnapCaddyAPI);
    });
  });

  describe("baseUrl integration", () => {
    it("should correctly combine baseUrl with endpoints", async () => {
      api = new SnapCaddyAPI("https://custom.api.com");

      const fetchMock = mock(async (url: string) => {
        expect(url).toStartWith("https://custom.api.com/api/");
        return new Response(JSON.stringify({ status: "complete" }), {
          status: 200,
        });
      });

      globalThis.fetch = fetchMock as any;

      await api.getGenerationStatus("test-id");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should work with empty baseUrl", async () => {
      api = new SnapCaddyAPI("");

      const fetchMock = mock(async (url: string) => {
        expect(url).toBe("/api/generate?id=test");
        return new Response(JSON.stringify({ status: "complete" }), {
          status: 200,
        });
      });

      globalThis.fetch = fetchMock as any;

      await api.getGenerationStatus("test");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
