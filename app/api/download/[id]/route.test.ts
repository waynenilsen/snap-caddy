/**
 * Unit tests for download API route
 * Tests file download functionality, validation, and error handling
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";
import type { JobPaths } from "@/lib/openscad/fileManager";
import { GET } from "./route";

// Mock modules
const mockStlFileManager = {
  getJobPaths: mock((_id: string) => null as JobPaths | null),
  fileExists: mock(async (_path: string) => false),
  isFileExpired: mock(async (_path: string, _maxAge?: number) => false),
  cleanupJob: mock(async (_id: string) => true),
};

const mockLogger = {
  // biome-ignore lint/suspicious/noExplicitAny: Test mock - meta can be any object
  warn: mock((_message: string, _meta?: any) => {}),
  // biome-ignore lint/suspicious/noExplicitAny: Test mock - meta can be any object
  info: mock((_message: string, _meta?: any) => {}),
  // biome-ignore lint/suspicious/noExplicitAny: Test mock - meta can be any object
  error: mock((_message: string, _meta?: any) => {}),
  // biome-ignore lint/suspicious/noExplicitAny: Test mock - meta can be any object
  debug: mock((_message: string, _meta?: any) => {}),
};

const mockMetrics = {
  recordDownload: mock(() => {}),
};

const mockEnv = {
  FILE_RETENTION_MS: 3600000, // 1 hour
};

const mockFs = {
  readFile: mock(async (_path: string) => Buffer.from("mock STL data")),
  stat: mock(async (_path: string) => ({
    size: 12345,
    isDirectory: () => false,
    isFile: () => true,
    mtime: new Date(),
  })),
};

// Mock imports
mock.module("@/lib/openscad", () => ({
  stlFileManager: mockStlFileManager,
}));

mock.module("@/lib/logger", () => ({
  logger: mockLogger,
  metrics: mockMetrics,
}));

mock.module("@/lib/env", () => ({
  env: mockEnv,
}));

mock.module("fs", () => ({
  promises: mockFs,
}));

describe("GET /api/download/[id]", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";
  const invalidId = "not-a-uuid";
  const mockJobPaths: JobPaths = {
    jobId: validUUID,
    jobDir: `/tmp/stl-jobs/${validUUID}`,
    svgPath: `/tmp/stl-jobs/${validUUID}/cutout.svg`,
    scadPath: `/tmp/stl-jobs/${validUUID}/bin.scad`,
    stlPath: `/tmp/stl-jobs/${validUUID}/bin.stl`,
    previewPath: `/tmp/stl-jobs/${validUUID}/preview.png`,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    mockStlFileManager.getJobPaths.mockClear();
    mockStlFileManager.fileExists.mockClear();
    mockStlFileManager.isFileExpired.mockClear();
    mockStlFileManager.cleanupJob.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockMetrics.recordDownload.mockClear();
    mockFs.readFile.mockClear();
    mockFs.stat.mockClear();

    // Set default mock implementations
    mockStlFileManager.getJobPaths.mockImplementation((id: string) => {
      if (id === validUUID) {
        return mockJobPaths;
      }
      return null;
    });

    mockStlFileManager.fileExists.mockImplementation(async (path: string) => {
      return path === mockJobPaths.stlPath;
    });

    mockStlFileManager.isFileExpired.mockImplementation(
      async (_path: string, _maxAge?: number) => false,
    );

    mockFs.readFile.mockImplementation(async (_path: string) => {
      return Buffer.from("mock STL file content");
    });

    mockFs.stat.mockImplementation(async (_path: string) => ({
      size: 12345,
      isDirectory: () => false,
      isFile: () => true,
      mtime: new Date(),
      atime: new Date(),
      ctime: new Date(),
      birthtime: new Date(),
      mode: 0o644,
      uid: 1000,
      gid: 1000,
      ino: 123,
      nlink: 1,
      rdev: 0,
      blksize: 4096,
      blocks: 24,
      dev: 2049,
      atimeMs: Date.now(),
      mtimeMs: Date.now(),
      ctimeMs: Date.now(),
      birthtimeMs: Date.now(),
    }));
  });

  describe("UUID validation", () => {
    it("should return 400 for invalid UUID format", async () => {
      const request = new NextRequest(
        "http://localhost/api/download/invalid-id",
      );
      const params = Promise.resolve({ id: invalidId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid file ID format" });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid download ID format",
        {
          id: invalidId,
        },
      );
    });

    it("should return 400 for empty string", async () => {
      const request = new NextRequest("http://localhost/api/download/");
      const params = Promise.resolve({ id: "" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid file ID format" });
    });

    it("should return 400 for malformed UUID", async () => {
      const request = new NextRequest("http://localhost/api/download/550e8400");
      const params = Promise.resolve({ id: "550e8400" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid file ID format" });
    });

    it("should accept valid UUID v4 format", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      // Mock successful file operations
      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(mockStlFileManager.getJobPaths).toHaveBeenCalledWith(validUUID);
    });
  });

  describe("Job not found", () => {
    it("should return 404 when job does not exist", async () => {
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";
      const request = new NextRequest(
        `http://localhost/api/download/${nonExistentId}`,
      );
      const params = Promise.resolve({ id: nonExistentId });

      mockStlFileManager.getJobPaths.mockReturnValue(null);

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Job not found" });
      expect(mockLogger.warn).toHaveBeenCalledWith("Job not found", {
        id: nonExistentId,
      });
      expect(mockStlFileManager.getJobPaths).toHaveBeenCalledWith(
        nonExistentId,
      );
    });

    it("should not proceed to file checks when job not found", async () => {
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";
      const request = new NextRequest(
        `http://localhost/api/download/${nonExistentId}`,
      );
      const params = Promise.resolve({ id: nonExistentId });

      mockStlFileManager.getJobPaths.mockReturnValue(null);

      await GET(request, { params });

      // Should not check file existence if job doesn't exist
      expect(mockStlFileManager.fileExists).not.toHaveBeenCalled();
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });
  });

  describe("File existence checks", () => {
    it("should return 404 when STL file does not exist", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(false);

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "File not found" });
      expect(mockLogger.warn).toHaveBeenCalledWith("STL file not found", {
        id: validUUID,
        path: mockJobPaths.stlPath,
      });
      expect(mockStlFileManager.fileExists).toHaveBeenCalledWith(
        mockJobPaths.stlPath,
      );
    });

    it("should check file existence before reading", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(false);

      await GET(request, { params });

      // Should not attempt to read file if it doesn't exist
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });
  });

  describe("File expiration", () => {
    it("should return 410 when file has expired", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(true);

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data).toEqual({ error: "File has expired" });
      expect(mockLogger.info).toHaveBeenCalledWith("STL file expired", {
        id: validUUID,
      });
    });

    it("should cleanup expired files", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(true);

      await GET(request, { params });

      expect(mockStlFileManager.cleanupJob).toHaveBeenCalledWith(validUUID);
    });

    it("should pass FILE_RETENTION_MS to expiration check", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      await GET(request, { params });

      expect(mockStlFileManager.isFileExpired).toHaveBeenCalledWith(
        mockJobPaths.stlPath,
        mockEnv.FILE_RETENTION_MS,
      );
    });

    it("should not read file if expired", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(true);

      await GET(request, { params });

      expect(mockFs.readFile).not.toHaveBeenCalled();
    });
  });

  describe("Successful download", () => {
    it("should return STL file with correct headers", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const mockBuffer = Buffer.from("STL binary data");
      mockFs.readFile.mockResolvedValue(mockBuffer);
      mockFs.stat.mockResolvedValue({
        size: mockBuffer.length,
        isDirectory: () => false,
        isFile: () => true,
        // biome-ignore lint/suspicious/noExplicitAny: Test mock for fs.stat
      } as any);

      const response = await GET(request, { params });

      expect(response.status).toBe(200);

      // Check headers
      expect(response.headers.get("Content-Type")).toBe("application/sla");
      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="gridfinity-cutout-${validUUID.slice(0, 8)}.stl"`,
      );
      expect(response.headers.get("Content-Length")).toBe(
        mockBuffer.length.toString(),
      );
      expect(response.headers.get("Cache-Control")).toBe(
        "private, max-age=3600",
      );
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");

      // Check body
      const responseBuffer = await response.arrayBuffer();
      expect(Buffer.from(responseBuffer)).toEqual(mockBuffer);
    });

    it("should read file from correct path", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      await GET(request, { params });

      expect(mockFs.readFile).toHaveBeenCalledWith(mockJobPaths.stlPath);
      expect(mockFs.stat).toHaveBeenCalledWith(mockJobPaths.stlPath);
    });

    it("should generate filename with short ID", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const response = await GET(request, { params });
      const shortId = validUUID.slice(0, 8);
      const expectedFilename = `gridfinity-cutout-${shortId}.stl`;

      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="${expectedFilename}"`,
      );
    });

    it("should log download with metadata", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
        {
          headers: {
            "x-forwarded-for": "192.168.1.100",
          },
        },
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const mockBuffer = Buffer.from("STL data");
      mockFs.readFile.mockResolvedValue(mockBuffer);
      mockFs.stat.mockResolvedValue({
        size: mockBuffer.length,
        // biome-ignore lint/suspicious/noExplicitAny: Test mock for fs.stat
      } as any);

      await GET(request, { params });

      const shortId = validUUID.slice(0, 8);
      expect(mockLogger.info).toHaveBeenCalledWith("STL download", {
        id: validUUID,
        filename: `gridfinity-cutout-${shortId}.stl`,
        size: mockBuffer.length,
        ip: "192.168.1.100",
      });
    });

    it("should use x-real-ip header if x-forwarded-for not present", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
        {
          headers: {
            "x-real-ip": "10.0.0.5",
          },
        },
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      await GET(request, { params });

      expect(mockLogger.info).toHaveBeenCalledWith(
        "STL download",
        expect.objectContaining({
          ip: "10.0.0.5",
        }),
      );
    });

    it("should record download metric", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      await GET(request, { params });

      expect(mockMetrics.recordDownload).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("should return 404 for ENOENT error when reading file", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const enoentError = new Error(
        "ENOENT: no such file or directory",
      ) as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      mockFs.readFile.mockRejectedValue(enoentError);

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "File not found" });
      expect(mockLogger.error).toHaveBeenCalledWith("Download error", {
        error: "ENOENT: no such file or directory",
        id: validUUID,
      });
    });

    it("should return 500 for other file system errors", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const permissionError = new Error(
        "EACCES: permission denied",
      ) as NodeJS.ErrnoException;
      permissionError.code = "EACCES";
      mockFs.readFile.mockRejectedValue(permissionError);

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to retrieve file" });
      expect(mockLogger.error).toHaveBeenCalledWith("Download error", {
        error: "EACCES: permission denied",
        id: validUUID,
      });
    });

    it("should handle unknown errors gracefully", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      mockFs.readFile.mockRejectedValue("Unknown error");

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to retrieve file" });
      expect(mockLogger.error).toHaveBeenCalledWith("Download error", {
        error: "Unknown error",
        id: validUUID,
      });
    });

    it("should log non-Error exceptions", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const stringError = "String error thrown";
      mockFs.readFile.mockRejectedValue(stringError);

      await GET(request, { params });

      expect(mockLogger.error).toHaveBeenCalledWith("Download error", {
        error: "Unknown error",
        id: validUUID,
      });
    });

    it("should handle error during stat call", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(Buffer.from("data"));

      const statError = new Error("Failed to stat") as NodeJS.ErrnoException;
      statError.code = "EIO";
      mockFs.stat.mockRejectedValue(statError);

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to retrieve file" });
    });
  });

  describe("Content-Type header", () => {
    it("should use application/sla as Content-Type for STL files", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const response = await GET(request, { params });

      expect(response.headers.get("Content-Type")).toBe("application/sla");
    });
  });

  describe("Security headers", () => {
    it("should include X-Content-Type-Options: nosniff", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const response = await GET(request, { params });

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("should set private cache control", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);

      const response = await GET(request, { params });

      expect(response.headers.get("Cache-Control")).toBe(
        "private, max-age=3600",
      );
    });
  });

  describe("Path traversal protection", () => {
    it("should reject path traversal attempts in ID", async () => {
      const maliciousId = "../../../etc/passwd";
      const request = new NextRequest(
        `http://localhost/api/download/${maliciousId}`,
      );
      const params = Promise.resolve({ id: maliciousId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid file ID format" });
      expect(mockStlFileManager.getJobPaths).not.toHaveBeenCalled();
    });

    it("should only accept UUID format to prevent path manipulation", async () => {
      const testCases = [
        "../file",
        "../../file",
        "file/../../etc/passwd",
        "file%2F..%2F..%2Fetc%2Fpasswd",
        "..\\..\\windows\\system32",
      ];

      for (const maliciousId of testCases) {
        const request = new NextRequest(
          `http://localhost/api/download/${maliciousId}`,
        );
        const params = Promise.resolve({ id: maliciousId });

        const response = await GET(request, { params });

        expect(response.status).toBe(400);
        expect(mockStlFileManager.getJobPaths).not.toHaveBeenCalled();
      }
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete successful download flow", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      const mockBuffer = Buffer.from("Complete STL file data");
      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(false);
      mockFs.readFile.mockResolvedValue(mockBuffer);
      // biome-ignore lint/suspicious/noExplicitAny: Test mock for fs.stat
      mockFs.stat.mockResolvedValue({ size: mockBuffer.length } as any);

      const response = await GET(request, { params });

      // Verify complete flow
      expect(mockStlFileManager.getJobPaths).toHaveBeenCalledWith(validUUID);
      expect(mockStlFileManager.fileExists).toHaveBeenCalledWith(
        mockJobPaths.stlPath,
      );
      expect(mockStlFileManager.isFileExpired).toHaveBeenCalledWith(
        mockJobPaths.stlPath,
        mockEnv.FILE_RETENTION_MS,
      );
      expect(mockFs.readFile).toHaveBeenCalledWith(mockJobPaths.stlPath);
      expect(mockFs.stat).toHaveBeenCalledWith(mockJobPaths.stlPath);
      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockMetrics.recordDownload).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("should handle expired file cleanup flow", async () => {
      const request = new NextRequest(
        `http://localhost/api/download/${validUUID}`,
      );
      const params = Promise.resolve({ id: validUUID });

      mockStlFileManager.getJobPaths.mockReturnValue(mockJobPaths);
      mockStlFileManager.fileExists.mockResolvedValue(true);
      mockStlFileManager.isFileExpired.mockResolvedValue(true);

      const response = await GET(request, { params });

      // Verify cleanup flow
      expect(mockStlFileManager.isFileExpired).toHaveBeenCalledWith(
        mockJobPaths.stlPath,
        mockEnv.FILE_RETENTION_MS,
      );
      expect(mockStlFileManager.cleanupJob).toHaveBeenCalledWith(validUUID);
      expect(mockLogger.info).toHaveBeenCalledWith("STL file expired", {
        id: validUUID,
      });
      expect(response.status).toBe(410);
      expect(mockFs.readFile).not.toHaveBeenCalled();
      expect(mockMetrics.recordDownload).not.toHaveBeenCalled();
    });
  });
});
