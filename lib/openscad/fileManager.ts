/**
 * STL File Manager
 * Manages file operations for OpenSCAD/STL generation jobs
 */

import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Job paths for STL generation
 */
export interface JobPaths {
  jobId: string;
  jobDir: string;
  svgPath: string;
  scadPath: string;
  stlPath: string;
  previewPath: string;
}

/**
 * STL File Manager
 * Handles file operations for STL generation jobs
 */
export class STLFileManager {
  private tempDir: string;
  private jobDirs: Map<string, string>;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || env.TEMP_DIR;
    this.jobDirs = new Map();
  }

  /**
   * Create a unique job directory with all necessary paths
   */
  async createJobPaths(): Promise<JobPaths> {
    try {
      // Generate unique job ID
      const jobId = this.generateJobId();

      // Create job directory path
      const jobDir = join(this.tempDir, 'stl-jobs', jobId);

      // Create the directory
      await mkdir(jobDir, { recursive: true });

      // Store job directory
      this.jobDirs.set(jobId, jobDir);

      // Define file paths
      const paths: JobPaths = {
        jobId,
        jobDir,
        svgPath: join(jobDir, 'cutout.svg'),
        scadPath: join(jobDir, 'bin.scad'),
        stlPath: join(jobDir, 'bin.stl'),
        previewPath: join(jobDir, 'preview.png'),
      };

      logger.debug('Created job paths', { jobId, jobDir });

      return paths;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create job paths', { error: errorMessage });
      throw new Error(`Failed to create job paths: ${errorMessage}`);
    }
  }

  /**
   * Create job directory with a specific ID
   * Used by async queue to ensure consistent job IDs across requests
   */
  async createJobPathsWithId(jobId: string): Promise<JobPaths> {
    try {
      // Create job directory path
      const jobDir = join(this.tempDir, 'stl-jobs', jobId);

      // Create the directory
      await mkdir(jobDir, { recursive: true });

      // Store job directory
      this.jobDirs.set(jobId, jobDir);

      // Define file paths
      const paths: JobPaths = {
        jobId,
        jobDir,
        svgPath: join(jobDir, 'cutout.svg'),
        scadPath: join(jobDir, 'bin.scad'),
        stlPath: join(jobDir, 'bin.stl'),
        previewPath: join(jobDir, 'preview.png'),
      };

      logger.debug('Created job paths with ID', { jobId, jobDir });

      return paths;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create job paths with ID', { error: errorMessage, jobId });
      throw new Error(`Failed to create job paths: ${errorMessage}`);
    }
  }

  /**
   * Write SVG content to file
   */
  async writeSVG(path: string, content: string): Promise<void> {
    try {
      await writeFile(path, content, 'utf-8');
      logger.debug('SVG file written', { path });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to write SVG file', { error: errorMessage, path });
      throw new Error(`Failed to write SVG file: ${errorMessage}`);
    }
  }

  /**
   * Get job paths for an existing job
   */
  getJobPaths(jobId: string): JobPaths | null {
    const jobDir = this.jobDirs.get(jobId);

    if (!jobDir) {
      logger.warn('Job not found', { jobId });
      return null;
    }

    return {
      jobId,
      jobDir,
      svgPath: join(jobDir, 'cutout.svg'),
      scadPath: join(jobDir, 'bin.scad'),
      stlPath: join(jobDir, 'bin.stl'),
      previewPath: join(jobDir, 'preview.png'),
    };
  }

  /**
   * Clean up job directory and files
   */
  async cleanupJob(jobId: string): Promise<boolean> {
    try {
      const jobDir = this.jobDirs.get(jobId);

      if (!jobDir) {
        logger.warn('Job not found for cleanup', { jobId });
        return false;
      }

      // Remove directory and all contents
      await rm(jobDir, { recursive: true, force: true });

      // Remove from tracking
      this.jobDirs.delete(jobId);

      logger.info('Job cleaned up', { jobId });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to cleanup job', { error: errorMessage, jobId });
      return false;
    }
  }

  /**
   * Clean up all job directories
   */
  async cleanupAllJobs(): Promise<number> {
    let cleaned = 0;

    for (const jobId of Array.from(this.jobDirs.keys())) {
      const success = await this.cleanupJob(jobId);
      if (success) {
        cleaned++;
      }
    }

    logger.info('Cleaned up all jobs', { count: cleaned });
    return cleaned;
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    const timestamp = Date.now();
    const random = randomBytes(8).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Get statistics about managed jobs
   */
  getStats(): {
    activeJobs: number;
    jobIds: string[];
  } {
    return {
      activeJobs: this.jobDirs.size,
      jobIds: Array.from(this.jobDirs.keys()),
    };
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const { access } = await import('fs/promises');
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file is expired based on modification time
   */
  async isFileExpired(filePath: string, maxAgeMs?: number): Promise<boolean> {
    try {
      const { stat } = await import('fs/promises');
      const stats = await stat(filePath);
      const age = Date.now() - stats.mtimeMs;
      const maxAge = maxAgeMs ?? env.FILE_RETENTION_MS;
      return age > maxAge;
    } catch {
      return true;
    }
  }

  /**
   * Read a file as Buffer
   */
  async readFile(filePath: string): Promise<Buffer> {
    const { readFile } = await import('fs/promises');
    return readFile(filePath);
  }
}

// Export singleton instance
export const stlFileManager = new STLFileManager();
