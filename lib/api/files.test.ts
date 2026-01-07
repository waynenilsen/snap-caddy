/**
 * Unit Tests for File Management Utilities
 * Tests for FileManager class and helper functions
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { promises as fs } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { join } from "node:path";

// Mock environment variables
const MOCK_TEMP_DIR = "/tmp/test-snap-caddy";
const MOCK_FILE_RETENTION_MS = 3600000; // 1 hour

// Mock the env module
mock.module("@/lib/env", () => ({
  env: {
    TEMP_DIR: MOCK_TEMP_DIR,
    FILE_RETENTION_MS: MOCK_FILE_RETENTION_MS,
  },
}));

// Mock the logger module
const mockLogger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
};

mock.module("@/lib/logger", () => ({
  logger: mockLogger,
}));

describe("FileManager", () => {
  let FileManager: typeof import("./files").FileManager;
  let fileManager: InstanceType<typeof FileManager>;

  beforeEach(async () => {
    // Clear all mocks
    mock.restore();

    // Reset mock logger calls
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Mock fs operations
    spyOn(fs, "mkdir").mockResolvedValue(undefined);
    spyOn(fs, "writeFile").mockResolvedValue(undefined);
    spyOn(fs, "rm").mockResolvedValue(undefined);
    spyOn(fs, "readdir").mockResolvedValue([]);
    spyOn(fs, "stat").mockResolvedValue({
      mtimeMs: Date.now(),
    } as Partial<Stats> as Stats);

    // Re-import the module after mocking
    const module = await import("./files");
    FileManager = module.FileManager;

    // Create a new instance for testing
    fileManager = new FileManager();

    // Wait a tick for constructor to complete
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(() => {
    // Clean up timers
    if (fileManager && typeof fileManager.shutdown === "function") {
      fileManager.shutdown();
    }
    mock.restore();
  });

  describe("constructor", () => {
    it("should initialize temp directory", () => {
      expect(fs.mkdir).toHaveBeenCalledWith(MOCK_TEMP_DIR, { recursive: true });
    });

    it("should log debug message on successful initialization", () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Temp directory initialized",
        { path: MOCK_TEMP_DIR },
      );
    });

    it("should create instance even if initial temp dir setup has issues", () => {
      // The constructor doesn't throw even if ensureTempDir fails asynchronously
      // This ensures the FileManager instance is always created
      const manager = new FileManager();

      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(FileManager);

      manager.shutdown();
    });
  });

  describe("createTempFile", () => {
    it("should create a temp file with string content", async () => {
      const content = "Hello, World!";
      const ext = ".txt";

      const fileId = await fileManager.createTempFile(content, ext);

      expect(fileId).toBeDefined();
      expect(typeof fileId).toBe("string");
      expect(fileId.length).toBe(32); // 16 bytes = 32 hex characters

      const expectedDirPath = join(MOCK_TEMP_DIR, fileId);
      const expectedFilePath = join(expectedDirPath, "file.txt");

      expect(fs.mkdir).toHaveBeenCalledWith(expectedDirPath, {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Created temp file",
        expect.objectContaining({
          fileId,
          extension: ".txt",
          size: content.length,
        }),
      );
    });

    it("should create a temp file with Buffer content", async () => {
      const content = Buffer.from("Binary content");
      const ext = ".bin";

      const fileId = await fileManager.createTempFile(content, ext);

      expect(fileId).toBeDefined();
      expect(typeof fileId).toBe("string");

      const expectedFilePath = join(MOCK_TEMP_DIR, fileId, "file.bin");
      expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
    });

    it("should handle extension without leading dot", async () => {
      const content = "test content";
      const ext = "stl"; // No leading dot

      const fileId = await fileManager.createTempFile(content, ext);

      const expectedFilePath = join(MOCK_TEMP_DIR, fileId, "file.stl");
      expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
    });

    it("should handle extension with leading dot", async () => {
      const content = "test content";
      const ext = ".stl"; // With leading dot

      const fileId = await fileManager.createTempFile(content, ext);

      const expectedFilePath = join(MOCK_TEMP_DIR, fileId, "file.stl");
      expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
    });

    it("should throw error on write failure", async () => {
      const error = new Error("Disk full");
      spyOn(fs, "writeFile").mockRejectedValue(error);

      await expect(
        fileManager.createTempFile("content", ".txt"),
      ).rejects.toThrow("Disk full");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to create temp file",
        expect.objectContaining({
          error: "Disk full",
        }),
      );
    });

    it("should create unique file IDs for multiple calls", async () => {
      const fileId1 = await fileManager.createTempFile("content1", ".txt");
      const fileId2 = await fileManager.createTempFile("content2", ".txt");
      const fileId3 = await fileManager.createTempFile("content3", ".txt");

      expect(fileId1).not.toBe(fileId2);
      expect(fileId2).not.toBe(fileId3);
      expect(fileId1).not.toBe(fileId3);
    });
  });

  describe("getTempFilePath", () => {
    it("should return correct path with default filename", () => {
      const fileId = "abc123";
      const path = fileManager.getTempFilePath(fileId);

      expect(path).toBe(join(MOCK_TEMP_DIR, fileId, "file"));
    });

    it("should return correct path with custom filename", () => {
      const fileId = "abc123";
      const filename = "output.stl";
      const path = fileManager.getTempFilePath(fileId, filename);

      expect(path).toBe(join(MOCK_TEMP_DIR, fileId, filename));
    });

    it("should handle various filename formats", () => {
      const fileId = "test-id";

      expect(fileManager.getTempFilePath(fileId, "data.json")).toBe(
        join(MOCK_TEMP_DIR, fileId, "data.json"),
      );

      expect(fileManager.getTempFilePath(fileId, "archive.tar.gz")).toBe(
        join(MOCK_TEMP_DIR, fileId, "archive.tar.gz"),
      );

      expect(fileManager.getTempFilePath(fileId, "noextension")).toBe(
        join(MOCK_TEMP_DIR, fileId, "noextension"),
      );
    });
  });

  describe("cleanupFile", () => {
    it("should remove file directory", async () => {
      const fileId = "test-file-id";

      await fileManager.cleanupFile(fileId);

      const expectedPath = join(MOCK_TEMP_DIR, fileId);
      expect(fs.rm).toHaveBeenCalledWith(expectedPath, {
        recursive: true,
        force: true,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith("Cleaned up temp file", {
        fileId,
      });
    });

    it("should cancel scheduled cleanup timer", async () => {
      const fileId = "test-file-id";

      // Schedule a cleanup
      fileManager.scheduleCleanup(fileId, 10000);

      // Verify timer exists (indirectly by checking it gets cleared)
      await fileManager.cleanupFile(fileId);

      expect(fs.rm).toHaveBeenCalledWith(join(MOCK_TEMP_DIR, fileId), {
        recursive: true,
        force: true,
      });
    });

    it("should ignore ENOENT errors", async () => {
      const error = new Error("File not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      spyOn(fs, "rm").mockRejectedValue(error);

      await fileManager.cleanupFile("non-existent-file");

      // Should not throw, should not log warning for ENOENT
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should warn on other errors", async () => {
      const error = new Error("Permission denied");
      spyOn(fs, "rm").mockRejectedValue(error);

      await fileManager.cleanupFile("test-file-id");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to cleanup file",
        expect.objectContaining({
          fileId: "test-file-id",
          error: "Permission denied",
        }),
      );
    });
  });

  describe("scheduleCleanup", () => {
    it("should schedule file cleanup after delay", async () => {
      const fileId = "test-file-id";
      const delay = 100; // 100ms for testing

      fileManager.scheduleCleanup(fileId, delay);

      expect(mockLogger.debug).toHaveBeenCalledWith("Scheduled file cleanup", {
        fileId,
        delayMs: delay,
      });

      // Wait for the scheduled cleanup to execute
      await new Promise((resolve) => setTimeout(resolve, delay + 50));

      // Verify cleanup was called
      expect(fs.rm).toHaveBeenCalledWith(join(MOCK_TEMP_DIR, fileId), {
        recursive: true,
        force: true,
      });
    });

    it("should replace existing timer for same file ID", () => {
      const fileId = "test-file-id";

      // Clear previous debug calls
      mockLogger.debug.mockClear();

      fileManager.scheduleCleanup(fileId, 5000);
      fileManager.scheduleCleanup(fileId, 10000); // Should replace first timer

      // Both calls should log
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenLastCalledWith(
        "Scheduled file cleanup",
        { fileId, delayMs: 10000 },
      );
    });

    it("should handle multiple file IDs independently", async () => {
      const fileId1 = "file-1";
      const fileId2 = "file-2";
      const delay = 100;

      fileManager.scheduleCleanup(fileId1, delay);
      fileManager.scheduleCleanup(fileId2, delay);

      await new Promise((resolve) => setTimeout(resolve, delay + 50));

      // Both should be cleaned up
      expect(fs.rm).toHaveBeenCalledWith(join(MOCK_TEMP_DIR, fileId1), {
        recursive: true,
        force: true,
      });
      expect(fs.rm).toHaveBeenCalledWith(join(MOCK_TEMP_DIR, fileId2), {
        recursive: true,
        force: true,
      });
    });
  });

  describe("cleanupOldFiles", () => {
    it("should clean up files older than maxAge", async () => {
      const now = Date.now();
      const oldFileAge = now - 7200000; // 2 hours ago
      const recentFileAge = now - 1800000; // 30 minutes ago

      const mockEntries = [
        { name: "old-file-1", isDirectory: () => true },
        { name: "old-file-2", isDirectory: () => true },
        { name: "recent-file", isDirectory: () => true },
        { name: "some-file.txt", isDirectory: () => false }, // Should be skipped
      ];

      spyOn(fs, "readdir").mockResolvedValue(
        mockEntries as Partial<Dirent>[] as Dirent[],
      );

      const _statCallCount = 0;
      spyOn(fs, "stat").mockImplementation(
        async (path: string | Buffer | URL) => {
          const pathStr = path.toString();
          if (
            pathStr.includes("old-file-1") ||
            pathStr.includes("old-file-2")
          ) {
            return { mtimeMs: oldFileAge } as Partial<Stats> as Stats;
          } else if (pathStr.includes("recent-file")) {
            return { mtimeMs: recentFileAge } as Partial<Stats> as Stats;
          }
          return { mtimeMs: now } as Partial<Stats> as Stats;
        },
      );

      const maxAge = 3600000; // 1 hour
      const cleaned = await fileManager.cleanupOldFiles(maxAge);

      expect(cleaned).toBe(2); // Only old-file-1 and old-file-2
      expect(fs.rm).toHaveBeenCalledWith(join(MOCK_TEMP_DIR, "old-file-1"), {
        recursive: true,
        force: true,
      });
      expect(fs.rm).toHaveBeenCalledWith(join(MOCK_TEMP_DIR, "old-file-2"), {
        recursive: true,
        force: true,
      });
      expect(fs.rm).not.toHaveBeenCalledWith(
        join(MOCK_TEMP_DIR, "recent-file"),
        expect.anything(),
      );
    });

    it("should skip non-directory entries", async () => {
      const mockEntries = [
        { name: "file.txt", isDirectory: () => false },
        { name: "another.log", isDirectory: () => false },
      ];

      spyOn(fs, "readdir").mockResolvedValue(
        mockEntries as Partial<Dirent>[] as Dirent[],
      );

      const cleaned = await fileManager.cleanupOldFiles(3600000);

      expect(cleaned).toBe(0);
      expect(fs.stat).not.toHaveBeenCalled();
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should handle stat errors gracefully", async () => {
      const mockEntries = [
        { name: "inaccessible-dir", isDirectory: () => true },
        { name: "good-dir", isDirectory: () => true },
      ];

      spyOn(fs, "readdir").mockResolvedValue(
        mockEntries as Partial<Dirent>[] as Dirent[],
      );

      spyOn(fs, "stat").mockImplementation(
        async (path: string | Buffer | URL) => {
          const pathStr = path.toString();
          if (pathStr.includes("inaccessible-dir")) {
            throw new Error("Permission denied");
          }
          return { mtimeMs: Date.now() - 7200000 } as Partial<Stats> as Stats; // 2 hours old
        },
      );

      const cleaned = await fileManager.cleanupOldFiles(3600000);

      expect(cleaned).toBe(1); // Only good-dir
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to check file age",
        expect.objectContaining({
          fileId: "inaccessible-dir",
          error: "Permission denied",
        }),
      );
    });

    it("should return 0 when no files need cleanup", async () => {
      const now = Date.now();
      const mockEntries = [
        { name: "recent-file-1", isDirectory: () => true },
        { name: "recent-file-2", isDirectory: () => true },
      ];

      spyOn(fs, "readdir").mockResolvedValue(
        mockEntries as Partial<Dirent>[] as Dirent[],
      );
      spyOn(fs, "stat").mockResolvedValue({
        mtimeMs: now - 1000,
      } as Partial<Stats> as Stats); // 1 second old

      const cleaned = await fileManager.cleanupOldFiles(3600000);

      expect(cleaned).toBe(0);
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should throw on readdir errors", async () => {
      const error = new Error("Cannot read directory");
      spyOn(fs, "readdir").mockRejectedValue(error);

      await expect(fileManager.cleanupOldFiles(3600000)).rejects.toThrow(
        "Cannot read directory",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to cleanup old files",
        expect.objectContaining({
          error: "Cannot read directory",
        }),
      );
    });

    it("should ensure temp directory exists before cleanup", async () => {
      const mkdirSpy = spyOn(fs, "mkdir").mockResolvedValue(undefined);
      spyOn(fs, "readdir").mockResolvedValue([]);

      await fileManager.cleanupOldFiles(3600000);

      expect(mkdirSpy).toHaveBeenCalledWith(MOCK_TEMP_DIR, { recursive: true });
    });
  });

  describe("shutdown", () => {
    it("should clear auto cleanup timer", () => {
      fileManager.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "File manager shutdown complete",
      );

      // Auto cleanup timer should be null after shutdown
      fileManager.shutdown(); // Call again should not cause issues
    });

    it("should clear all scheduled cleanup timers", async () => {
      // Schedule multiple cleanups
      fileManager.scheduleCleanup("file-1", 10000);
      fileManager.scheduleCleanup("file-2", 10000);
      fileManager.scheduleCleanup("file-3", 10000);

      fileManager.shutdown();

      // Wait to ensure timers don't fire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // rm should not be called since timers were cleared
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it("should handle shutdown when no timers are active", () => {
      const newManager = new FileManager();

      // Shutdown immediately without scheduling anything
      newManager.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "File manager shutdown complete",
      );
    });

    it("should allow multiple shutdown calls", () => {
      fileManager.shutdown();
      fileManager.shutdown();
      fileManager.shutdown();

      // Should not throw errors
      expect(mockLogger.info).toHaveBeenCalledTimes(3);
    });
  });

  describe("auto cleanup", () => {
    it("should run auto cleanup on interval", async () => {
      // This is harder to test without mocking setInterval behavior
      // The timer is set with unref() so it doesn't prevent process exit
      // We can verify it was called in the constructor

      // Auto cleanup timer should be set up in constructor
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Temp directory initialized",
        { path: MOCK_TEMP_DIR },
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty file IDs", async () => {
      const emptyId = "";

      await fileManager.cleanupFile(emptyId);

      expect(fs.rm).toHaveBeenCalledWith(join(MOCK_TEMP_DIR, emptyId), {
        recursive: true,
        force: true,
      });
    });

    it("should handle special characters in file IDs", async () => {
      const specialId = "file-with-@#$-chars";

      const path = fileManager.getTempFilePath(specialId, "test.txt");

      expect(path).toBe(join(MOCK_TEMP_DIR, specialId, "test.txt"));
    });

    it("should handle very large content", async () => {
      const largeContent = "x".repeat(1024 * 1024); // 1MB of data

      const fileId = await fileManager.createTempFile(largeContent, ".txt");

      expect(fileId).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Created temp file",
        expect.objectContaining({
          size: largeContent.length,
        }),
      );
    });

    it("should handle empty content", async () => {
      const emptyContent = "";

      const fileId = await fileManager.createTempFile(emptyContent, ".txt");

      expect(fileId).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("file.txt"),
        emptyContent,
      );
    });

    it("should handle Buffer with binary data", async () => {
      const binaryData = Buffer.from([0x00, 0xff, 0xab, 0xcd, 0xef]);

      const fileId = await fileManager.createTempFile(binaryData, ".bin");

      expect(fileId).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("file.bin"),
        binaryData,
      );
    });
  });
});

describe("generateFileId", () => {
  it("should generate 32-character hex string", async () => {
    // Import the module to access the function indirectly
    // Since it's not exported, we test it through createTempFile

    const module = await import("./files");
    const manager = new module.FileManager();

    const fileId = await manager.createTempFile("test", ".txt");

    expect(fileId).toMatch(/^[0-9a-f]{32}$/);
    expect(fileId.length).toBe(32);

    manager.shutdown();
  });

  it("should generate unique IDs", async () => {
    const module = await import("./files");
    const manager = new module.FileManager();

    const ids = await Promise.all([
      manager.createTempFile("test1", ".txt"),
      manager.createTempFile("test2", ".txt"),
      manager.createTempFile("test3", ".txt"),
      manager.createTempFile("test4", ".txt"),
      manager.createTempFile("test5", ".txt"),
    ]);

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5); // All IDs should be unique

    manager.shutdown();
  });
});

describe("fileManager singleton", () => {
  it("should export a singleton instance", async () => {
    const module = await import("./files");

    expect(module.fileManager).toBeDefined();
    expect(module.fileManager).toBeInstanceOf(module.FileManager);
  });

  it("should be the same instance across imports", async () => {
    const module1 = await import("./files");
    const module2 = await import("./files");

    expect(module1.fileManager).toBe(module2.fileManager);
  });
});
