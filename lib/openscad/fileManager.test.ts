import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STLFileManager } from "./fileManager";

describe("STLFileManager", () => {
  let fileManager: STLFileManager;
  let testTempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testTempDir = join(
      tmpdir(),
      `snap-caddy-test-${Date.now()}-${randomBytes(3).toString("hex")}`,
    );
    await fs.mkdir(testTempDir, { recursive: true });
    fileManager = new STLFileManager(testTempDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("createJobPaths", () => {
    it("creates unique job ID and directory", async () => {
      const paths1 = await fileManager.createJobPaths();
      const paths2 = await fileManager.createJobPaths();

      expect(paths1.jobId).not.toBe(paths2.jobId);
      expect(paths1.jobDir).toContain(paths1.jobId);
      expect(paths2.jobDir).toContain(paths2.jobId);
    });

    it("returns correct file paths structure", async () => {
      const paths = await fileManager.createJobPaths();

      expect(paths.svgPath).toContain("cutout.svg");
      expect(paths.scadPath).toContain("bin.scad");
      expect(paths.stlPath).toContain("bin.stl");
      expect(paths.previewPath).toContain("preview.png");
    });

    it("creates the job directory on filesystem", async () => {
      const paths = await fileManager.createJobPaths();

      const dirExists = await fs
        .stat(paths.jobDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe("getJobPaths", () => {
    it("returns paths for existing job", async () => {
      const created = await fileManager.createJobPaths();
      const retrieved = fileManager.getJobPaths(created.jobId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.jobId).toBe(created.jobId);
      expect(retrieved?.svgPath).toBe(created.svgPath);
    });

    it("handles multiple jobs correctly", async () => {
      const paths1 = await fileManager.createJobPaths();
      const paths2 = await fileManager.createJobPaths();
      const paths3 = await fileManager.createJobPaths();

      expect(fileManager.getJobPaths(paths1.jobId)).not.toBeNull();
      expect(fileManager.getJobPaths(paths2.jobId)).not.toBeNull();
      expect(fileManager.getJobPaths(paths3.jobId)).not.toBeNull();
    });
  });

  describe("getStats", () => {
    it("returns correct active job count", async () => {
      expect(fileManager.getStats().activeJobs).toBe(0);

      await fileManager.createJobPaths();
      expect(fileManager.getStats().activeJobs).toBe(1);

      await fileManager.createJobPaths();
      expect(fileManager.getStats().activeJobs).toBe(2);
    });

    it("returns correct job IDs", async () => {
      const paths1 = await fileManager.createJobPaths();
      const paths2 = await fileManager.createJobPaths();

      const stats = fileManager.getStats();
      expect(stats.jobIds).toContain(paths1.jobId);
      expect(stats.jobIds).toContain(paths2.jobId);
    });
  });

  describe("cleanupJob", () => {
    it("removes job directory", async () => {
      const paths = await fileManager.createJobPaths();

      const success = await fileManager.cleanupJob(paths.jobId);
      expect(success).toBe(true);

      const dirExists = await fs
        .stat(paths.jobDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(false);
    });

    it("returns false for unknown job", async () => {
      const success = await fileManager.cleanupJob("non-existent-job");
      expect(success).toBe(false);
    });

    it("removes job from tracking", async () => {
      const paths = await fileManager.createJobPaths();
      expect(fileManager.getStats().activeJobs).toBe(1);

      await fileManager.cleanupJob(paths.jobId);
      expect(fileManager.getStats().activeJobs).toBe(0);
      // Job should no longer be in stats
      expect(fileManager.getStats().jobIds).not.toContain(paths.jobId);
    });
  });

  describe("cleanupAllJobs", () => {
    it("removes all jobs", async () => {
      await fileManager.createJobPaths();
      await fileManager.createJobPaths();
      await fileManager.createJobPaths();

      expect(fileManager.getStats().activeJobs).toBe(3);

      const cleaned = await fileManager.cleanupAllJobs();
      expect(cleaned).toBe(3);
      expect(fileManager.getStats().activeJobs).toBe(0);
    });

    it("returns zero when no jobs exist", async () => {
      const cleaned = await fileManager.cleanupAllJobs();
      expect(cleaned).toBe(0);
    });
  });

  describe("writeSVG", () => {
    it("writes content to file", async () => {
      const paths = await fileManager.createJobPaths();
      const content = '<svg><rect width="100" height="100"/></svg>';

      await fileManager.writeSVG(paths.svgPath, content);

      const written = await fs.readFile(paths.svgPath, "utf-8");
      expect(written).toBe(content);
    });
  });

  describe("fileExists", () => {
    it("returns true for existing file", async () => {
      const paths = await fileManager.createJobPaths();
      await fileManager.writeSVG(paths.svgPath, "<svg></svg>");

      const exists = await fileManager.fileExists(paths.svgPath);
      expect(exists).toBe(true);
    });

    it("returns false for non-existing file", async () => {
      const exists = await fileManager.fileExists("/non/existent/path.txt");
      expect(exists).toBe(false);
    });

    it("works with directories", async () => {
      const paths = await fileManager.createJobPaths();
      const exists = await fileManager.fileExists(paths.jobDir);
      expect(exists).toBe(true);
    });
  });

  describe("readFile", () => {
    it("reads file as Buffer", async () => {
      const paths = await fileManager.createJobPaths();
      const content = "<svg>test content</svg>";
      await fileManager.writeSVG(paths.svgPath, content);

      const buffer = await fileManager.readFile(paths.svgPath);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString("utf-8")).toBe(content);
    });
  });

  describe("isFileExpired", () => {
    it("returns true for non-existent file", async () => {
      const expired = await fileManager.isFileExpired("/non/existent/file.txt");
      expect(expired).toBe(true);
    });

    it("returns false for recently created file with large max age", async () => {
      const paths = await fileManager.createJobPaths();
      await fileManager.writeSVG(paths.svgPath, "<svg></svg>");

      // With a very large max age, file should not be expired
      const expired = await fileManager.isFileExpired(
        paths.svgPath,
        1000 * 60 * 60 * 24,
      ); // 24 hours
      expect(expired).toBe(false);
    });

    it("returns true for file with zero max age", async () => {
      const paths = await fileManager.createJobPaths();
      await fileManager.writeSVG(paths.svgPath, "<svg></svg>");

      // With zero max age, file should be expired immediately
      const expired = await fileManager.isFileExpired(paths.svgPath, 0);
      expect(expired).toBe(true);
    });
  });

  describe("integration tests", () => {
    it("complete workflow: create, write, read, cleanup", async () => {
      // Create job
      const paths = await fileManager.createJobPaths();
      expect(paths.jobId).toBeTruthy();

      // Write SVG
      const svgContent = '<svg><rect width="100" height="100"/></svg>';
      await fileManager.writeSVG(paths.svgPath, svgContent);

      // Verify file exists
      const exists = await fileManager.fileExists(paths.svgPath);
      expect(exists).toBe(true);

      // Read file
      const buffer = await fileManager.readFile(paths.svgPath);
      expect(buffer.toString("utf-8")).toBe(svgContent);

      // Cleanup
      const success = await fileManager.cleanupJob(paths.jobId);
      expect(success).toBe(true);

      // Verify cleanup
      const existsAfter = await fileManager.fileExists(paths.svgPath);
      expect(existsAfter).toBe(false);
    });

    it("handles multiple concurrent jobs", async () => {
      // Create multiple jobs concurrently
      const paths = await Promise.all([
        fileManager.createJobPaths(),
        fileManager.createJobPaths(),
        fileManager.createJobPaths(),
      ]);

      expect(fileManager.getStats().activeJobs).toBe(3);

      // Write to all jobs
      await Promise.all(
        paths.map((p, i) =>
          fileManager.writeSVG(p.svgPath, `<svg id="${i}"></svg>`),
        ),
      );

      // Verify all files exist
      const allExist = await Promise.all(
        paths.map((p) => fileManager.fileExists(p.svgPath)),
      );
      expect(allExist.every((e) => e)).toBe(true);

      // Cleanup all
      const cleaned = await fileManager.cleanupAllJobs();
      expect(cleaned).toBe(3);
    });
  });
});
