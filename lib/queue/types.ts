/**
 * Queue Types
 * Type definitions for the async job queue system
 */

import type { GridfinityBinConfig } from '@/types/configuration';

/**
 * Data passed to STL generation jobs
 */
export interface STLJobData {
  generationId: string;
  svg: string;
  binConfig: GridfinityBinConfig;
  webhookUrl?: string;
  createdAt: string;
}

/**
 * Result returned by completed STL generation jobs
 */
export interface STLJobResult {
  generationId: string;
  stlPath: string;
  downloadUrl: string;
  duration: number;
}

/**
 * Job status for tracking progress
 */
export type JobStatus = 'queued' | 'processing' | 'complete' | 'error';

/**
 * Progress update from job
 */
export interface JobProgress {
  stage: 'queued' | 'writing_svg' | 'generating_scad' | 'rendering_stl' | 'complete';
  percent: number;
  message?: string;
}

/**
 * Queue health information
 */
export interface QueueHealth {
  connected: boolean;
  redis: {
    ping: boolean;
    version?: string;
    uptime?: number;
  };
  queue: {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  worker: {
    running: boolean;
    concurrency: number;
  };
}

/**
 * Queue statistics for monitoring
 */
export interface QueueStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  jobsPerMinute: number;
}

/**
 * Configuration for the queue system
 */
export interface QueueConfig {
  redisUrl: string;
  concurrency: number;
  jobTimeout: number;
  maxRetries: number;
  cleanupInterval: number;
  retentionTime: number;
}
