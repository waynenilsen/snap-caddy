import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { renderHook, act, waitFor } from "@testing-library/react";
import * as THREE from "three";

// Mock STLLoader
const mockParse = mock(() => {
  const geometry = new THREE.BufferGeometry();
  // Add some vertices to make it valid
  const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  return geometry;
});

mock.module("three/addons/loaders/STLLoader.js", () => ({
  STLLoader: class MockSTLLoader {
    parse = mockParse;
  },
}));

// Import hook after mocking
import { useSTLLoader } from "./useSTLLoader";

describe("useSTLLoader", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockParse.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("initial state", () => {
    it("returns null geometry when URL is null", () => {
      const { result } = renderHook(() => useSTLLoader(null));

      expect(result.current.geometry).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(0);
    });

    it("provides a retry function", () => {
      const { result } = renderHook(() => useSTLLoader(null));

      expect(typeof result.current.retry).toBe("function");
    });
  });

  describe("loading state", () => {
    it("sets loading to true when URL is provided", async () => {
      // Mock fetch to return a response that never resolves
      const mockFetch = mock(() => new Promise(() => {}));
      global.fetch = mockFetch as unknown as typeof fetch;

      const { result } = renderHook(() => useSTLLoader("/test.stl"));

      // Should immediately start loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });
    });
  });

  describe("successful loading", () => {
    it("parses STL data and returns geometry", async () => {
      // Create mock STL binary data
      const mockArrayBuffer = new ArrayBuffer(84); // Minimum STL header size
      const mockBlob = new Blob([mockArrayBuffer]);

      // Mock readable stream for progress tracking
      const mockReader = {
        read: mock()
          .mockResolvedValueOnce({
            done: false,
            value: new Uint8Array(mockArrayBuffer),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      const mockResponse = {
        ok: true,
        headers: {
          get: mock(() => "84"), // content-length
        },
        body: {
          getReader: () => mockReader,
        },
      };

      global.fetch = mock(() =>
        Promise.resolve(mockResponse)
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useSTLLoader("/test.stl"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(result.current.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("sets error when fetch fails", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        })
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useSTLLoader("/nonexistent.stl"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain("404");
      expect(result.current.geometry).toBeNull();
    });

    it("sets error when network request fails", async () => {
      global.fetch = mock(() =>
        Promise.reject(new Error("Network error"))
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useSTLLoader("/test.stl"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.geometry).toBeNull();
    });
  });

  describe("retry functionality", () => {
    it("retry triggers a new load attempt", async () => {
      let fetchCount = 0;

      // First call fails, second succeeds
      global.fetch = mock(() => {
        fetchCount++;
        if (fetchCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Server Error",
          });
        }

        const mockArrayBuffer = new ArrayBuffer(84);
        const mockReader = {
          read: mock()
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(mockArrayBuffer),
            })
            .mockResolvedValueOnce({ done: true }),
        };

        return Promise.resolve({
          ok: true,
          headers: { get: () => "84" },
          body: { getReader: () => mockReader },
        });
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useSTLLoader("/test.stl"));

      // Wait for first (failed) attempt
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Trigger retry
      act(() => {
        result.current.retry();
      });

      // Wait for second (successful) attempt
      await waitFor(() => {
        expect(result.current.geometry).toBeInstanceOf(THREE.BufferGeometry);
      });

      expect(fetchCount).toBe(2);
    });
  });

  describe("options", () => {
    it("respects center option", async () => {
      const mockArrayBuffer = new ArrayBuffer(84);
      const mockReader = {
        read: mock()
          .mockResolvedValueOnce({
            done: false,
            value: new Uint8Array(mockArrayBuffer),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          headers: { get: () => "84" },
          body: { getReader: () => mockReader },
        })
      ) as unknown as typeof fetch;

      const { result } = renderHook(() =>
        useSTLLoader("/test.stl", { center: true })
      );

      await waitFor(() => {
        expect(result.current.geometry).toBeInstanceOf(THREE.BufferGeometry);
      });

      // The mock geometry should have been processed
      expect(mockParse).toHaveBeenCalled();
    });
  });

  describe("URL changes", () => {
    it("loads new geometry when URL changes", async () => {
      const createMockFetch = () => {
        const mockArrayBuffer = new ArrayBuffer(84);
        const mockReader = {
          read: mock()
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(mockArrayBuffer),
            })
            .mockResolvedValueOnce({ done: true }),
        };

        return mock(() =>
          Promise.resolve({
            ok: true,
            headers: { get: () => "84" },
            body: { getReader: () => mockReader },
          })
        ) as unknown as typeof fetch;
      };

      global.fetch = createMockFetch();

      const { result, rerender } = renderHook(
        ({ url }) => useSTLLoader(url),
        { initialProps: { url: "/first.stl" } }
      );

      await waitFor(() => {
        expect(result.current.geometry).toBeInstanceOf(THREE.BufferGeometry);
      });

      // Change URL
      global.fetch = createMockFetch();
      rerender({ url: "/second.stl" });

      await waitFor(() => {
        expect(result.current.geometry).toBeInstanceOf(THREE.BufferGeometry);
      });
    });

    it("clears geometry when URL becomes null", async () => {
      const mockArrayBuffer = new ArrayBuffer(84);
      const mockReader = {
        read: mock()
          .mockResolvedValueOnce({
            done: false,
            value: new Uint8Array(mockArrayBuffer),
          })
          .mockResolvedValueOnce({ done: true }),
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          headers: { get: () => "84" },
          body: { getReader: () => mockReader },
        })
      ) as unknown as typeof fetch;

      const { result, rerender } = renderHook(
        ({ url }) => useSTLLoader(url),
        { initialProps: { url: "/test.stl" as string | null } }
      );

      await waitFor(() => {
        expect(result.current.geometry).toBeInstanceOf(THREE.BufferGeometry);
      });

      // Set URL to null
      rerender({ url: null });

      await waitFor(() => {
        expect(result.current.geometry).toBeNull();
      });
    });
  });
});
