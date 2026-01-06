/**
 * File Management Utilities
 * Handles temporary file creation, storage, and cleanup
 */

import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const TEMP_DIR = env.TEMP_DIR;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_AGE = env.FILE_RETENTION_MS;

/**
 * Generates a random file ID
 */
function generateFileId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * File Manager for handling temporary files
 */
export class FileManager {
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private autoCleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureTempDir();
    this.startAutoCleanup();
  }

  /**
   * Ensures the temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      logger.debug("Temp directory initialized", { path: TEMP_DIR });
    } catch (error) {
      logger.error("Failed to create temp directory", {
        path: TEMP_DIR,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Starts automatic cleanup of old files
   */
  private startAutoCleanup(): void {
    if (this.autoCleanupTimer) return;

    this.autoCleanupTimer = setInterval(async () => {
      try {
        const cleaned = await this.cleanupOldFiles(DEFAULT_MAX_AGE);
        if (cleaned > 0) {
          logger.info("Auto-cleanup completed", { filesRemoved: cleaned });
        }
      } catch (error) {
        logger.error("Auto-cleanup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, CLEANUP_INTERVAL);

    // Don't prevent process from exiting
    this.autoCleanupTimer.unref();
  }

  /**
   * Creates a temporary file with the given content
   *
   * @param content - File content (string or Buffer)
   * @param ext - File extension (with or without leading dot)
   * @returns Promise resolving to the file ID
   *
   * @example
   * ```ts
   * const fileId = await fileManager.createTempFile('Hello World', '.txt');
   * ```
   */
  async createTempFile(content: string | Buffer, ext: string): Promise<string> {
    await this.ensureTempDir();

    const fileId = generateFileId();
    const extension = ext.startsWith(".") ? ext : `.${ext}`;
    const dirPath = join(TEMP_DIR, fileId);
    const filePath = join(dirPath, `file${extension}`);

    try {
      // Create directory for this file
      await fs.mkdir(dirPath, { recursive: true });

      // Write content
      await fs.writeFile(filePath, content);

      logger.debug("Created temp file", {
        fileId,
        extension,
        size: content.length,
      });

      return fileId;
    } catch (error) {
      logger.error("Failed to create temp file", {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets the full path to a temporary file
   *
   * @param id - File ID
   * @param filename - Optional filename (defaults to 'file' with no extension)
   * @returns Full file path
   *
   * @example
   * ```ts
   * const path = fileManager.getTempFilePath(fileId, 'output.stl');
   * ```
   */
  getTempFilePath(id: string, filename: string = "file"): string {
    return join(TEMP_DIR, id, filename);
  }

  /**
   * Cleans up a specific file by ID
   *
   * @param id - File ID to clean up
   *
   * @example
   * ```ts
   * await fileManager.cleanupFile(fileId);
   * ```
   */
  async cleanupFile(id: string): Promise<void> {
    const dirPath = join(TEMP_DIR, id);

    // Cancel scheduled cleanup if exists
    const timer = this.cleanupTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(id);
    }

    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      logger.debug("Cleaned up temp file", { fileId: id });
    } catch (error) {
      // Ignore errors if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn("Failed to cleanup file", {
          fileId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Schedules a file for cleanup after a delay
   *
   * @param id - File ID to clean up
   * @param delayMs - Delay in milliseconds before cleanup
   *
   * @example
   * ```ts
   * // Clean up after 1 hour
   * fileManager.scheduleCleanup(fileId, 3600000);
   * ```
   */
  scheduleCleanup(id: string, delayMs: number): void {
    // Clear existing timer if any
    const existingTimer = this.cleanupTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      await this.cleanupFile(id);
      this.cleanupTimers.delete(id);
    }, delayMs);

    // Don't prevent process from exiting
    timer.unref();

    this.cleanupTimers.set(id, timer);

    logger.debug("Scheduled file cleanup", { fileId: id, delayMs });
  }

  /**
   * Cleans up files older than the specified age
   *
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns Promise resolving to the number of files cleaned up
   *
   * @example
   * ```ts
   * // Clean up files older than 1 hour
   * const cleaned = await fileManager.cleanupOldFiles(3600000);
   * ```
   */
  async cleanupOldFiles(maxAgeMs: number): Promise<number> {
    let cleanedCount = 0;

    try {
      await this.ensureTempDir();

      const entries = await fs.readdir(TEMP_DIR, { withFileTypes: true });
      const now = Date.now();

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirPath = join(TEMP_DIR, entry.name);

        try {
          const stats = await fs.stat(dirPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.rm(dirPath, { recursive: true, force: true });
            cleanedCount++;
            logger.debug("Cleaned up old file", {
              fileId: entry.name,
              ageMs: age,
            });
          }
        } catch (error) {
          // Skip files that can't be accessed
          logger.warn("Failed to check file age", {
            fileId: entry.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      logger.error("Failed to cleanup old files", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return cleanedCount;
  }

  /**
   * Stops all cleanup timers
   * Useful for graceful shutdown
   */
  shutdown(): void {
    if (this.autoCleanupTimer) {
      clearInterval(this.autoCleanupTimer);
      this.autoCleanupTimer = null;
    }

    for (const timer of Array.from(this.cleanupTimers.values())) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    logger.info("File manager shutdown complete");
  }
}

/**
 * Singleton file manager instance
 * Use this throughout your application
 */
export const fileManager = new FileManager();
