/**
 * STL Generation Queue
 * BullMQ-based queue for async STL file generation
 */

import { Queue, Worker, Job, QueueEvents } from "bullmq";
import { getBullMQConnectionOptions, getRedisConnection } from "./connection";
import { stlFileManager } from "@/lib/openscad/fileManager";
import { openscadGenerator } from "@/lib/openscad/generator";
import { openscadExecutor } from "@/lib/openscad/executor";
import { logger, metrics } from "@/lib/logger";
import type {
  STLJobData,
  STLJobResult,
  QueueHealth,
  JobProgress,
} from "./types";
import type { GenerationStatusResponse } from "@/types/api";

// Queue name
const QUEUE_NAME = "stl-generation";

// Default configuration
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_JOB_TIMEOUT = 300000; // 5 minutes
const DEFAULT_MAX_RETRIES = 3;

// In-memory job status store (synced with Bull job state)
const jobStatusStore = new Map<string, GenerationStatusResponse>();

// Singleton instances
let stlQueue: Queue<STLJobData, STLJobResult> | null = null;
let stlWorker: Worker<STLJobData, STLJobResult> | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Get or create the STL generation queue
 */
export function getSTLQueue(): Queue<STLJobData, STLJobResult> {
  if (!stlQueue) {
    const connectionOptions = getBullMQConnectionOptions();

    stlQueue = new Queue<STLJobData, STLJobResult>(QUEUE_NAME, {
      connection: connectionOptions,
      defaultJobOptions: {
        attempts: DEFAULT_MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
        },
      },
    });

    logger.info("STL queue initialized", { name: QUEUE_NAME });
  }

  return stlQueue;
}

/**
 * Get queue events for monitoring
 */
export function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    const connectionOptions = getBullMQConnectionOptions();
    queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: connectionOptions,
    });

    // Listen for job events
    queueEvents.on("completed", ({ jobId, returnvalue }) => {
      logger.info("Job completed", { jobId, result: returnvalue });
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      logger.error("Job failed", { jobId, reason: failedReason });
    });

    queueEvents.on("progress", ({ jobId, data }) => {
      logger.debug("Job progress", { jobId, progress: data });
    });
  }

  return queueEvents;
}

/**
 * Process an STL generation job
 */
async function processSTLJob(
  job: Job<STLJobData, STLJobResult>,
): Promise<STLJobResult> {
  const { generationId, svg, binConfig } = job.data;
  const startTime = Date.now();

  logger.info("Processing STL job", { jobId: job.id, generationId });

  try {
    // Update progress: Starting
    await job.updateProgress({
      stage: "writing_svg",
      percent: 10,
      message: "Writing SVG file",
    } as JobProgress);
    updateJobStatus(generationId, { status: "processing", progress: 10 });

    // Create job paths with specific ID
    const jobPaths = await stlFileManager.createJobPathsWithId(generationId);

    // Write SVG file
    await stlFileManager.writeSVG(jobPaths.svgPath, svg);
    logger.debug("SVG file written", { path: jobPaths.svgPath });

    // Update progress: SVG written
    await job.updateProgress({
      stage: "generating_scad",
      percent: 30,
      message: "Generating OpenSCAD file",
    } as JobProgress);
    updateJobStatus(generationId, { progress: 30 });

    // Generate OpenSCAD file
    const scadResult = await openscadGenerator.generate(
      jobPaths.svgPath,
      binConfig,
      jobPaths.scadPath,
    );

    if (!scadResult.success || !scadResult.scadPath) {
      throw new Error(scadResult.error || "Failed to generate OpenSCAD file");
    }

    logger.debug("OpenSCAD file generated", { path: scadResult.scadPath });

    // Update progress: SCAD generated
    await job.updateProgress({
      stage: "rendering_stl",
      percent: 50,
      message: "Rendering STL file",
    } as JobProgress);
    updateJobStatus(generationId, { progress: 50 });

    // Render STL file
    const renderResult = await openscadExecutor.render(
      scadResult.scadPath,
      jobPaths.stlPath,
    );

    if (!renderResult.success || !renderResult.outputPath) {
      throw new Error(renderResult.error || "Failed to render STL file");
    }

    const duration = Date.now() - startTime;
    logger.info("STL file rendered successfully", {
      path: renderResult.outputPath,
      duration,
    });

    // Update progress: Complete
    await job.updateProgress({
      stage: "complete",
      percent: 100,
      message: "Generation complete",
    } as JobProgress);

    const downloadUrl = `/api/download/${generationId}`;

    // Update job status
    updateJobStatus(generationId, {
      status: "complete",
      progress: 100,
      downloadUrl,
      completedAt: new Date().toISOString(),
    });

    // Record metrics
    metrics.recordGeneration(duration);

    // Send webhook if provided
    if (job.data.webhookUrl) {
      sendWebhook(job.data.webhookUrl, {
        generationId,
        status: "complete",
        downloadUrl,
        duration,
      }).catch((error) => {
        logger.error("Webhook delivery failed", {
          generationId,
          webhookUrl: job.data.webhookUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return {
      generationId,
      stlPath: renderResult.outputPath,
      downloadUrl,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("STL job failed", {
      jobId: job.id,
      generationId,
      error: errorMessage,
      attempt: job.attemptsMade,
    });

    // Update job status on final failure
    if (job.attemptsMade >= (job.opts.attempts || DEFAULT_MAX_RETRIES)) {
      updateJobStatus(generationId, {
        status: "error",
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });

      // Send error webhook if provided
      if (job.data.webhookUrl) {
        sendWebhook(job.data.webhookUrl, {
          generationId,
          status: "error",
          error: errorMessage,
        }).catch(() => {
          // Ignore webhook errors for failed jobs
        });
      }
    }

    throw error;
  }
}

/**
 * Start the STL worker
 */
export function startSTLWorker(
  concurrency?: number,
): Worker<STLJobData, STLJobResult> {
  if (stlWorker) {
    logger.warn("STL worker already running");
    return stlWorker;
  }

  const connectionOptions = getBullMQConnectionOptions();
  const workerConcurrency =
    concurrency ||
    Number.parseInt(
      process.env.QUEUE_CONCURRENCY || String(DEFAULT_CONCURRENCY),
      10,
    );

  stlWorker = new Worker<STLJobData, STLJobResult>(QUEUE_NAME, processSTLJob, {
    connection: connectionOptions,
    concurrency: workerConcurrency,
    lockDuration: DEFAULT_JOB_TIMEOUT,
    stalledInterval: 30000,
  });

  stlWorker.on("completed", (job, result) => {
    logger.info("Worker completed job", {
      jobId: job.id,
      generationId: result.generationId,
      duration: result.duration,
    });
  });

  stlWorker.on("failed", (job, error) => {
    logger.error("Worker job failed", {
      jobId: job?.id,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  stlWorker.on("error", (error) => {
    logger.error("Worker error", { error: error.message });
  });

  logger.info("STL worker started", { concurrency: workerConcurrency });

  return stlWorker;
}

/**
 * Stop the STL worker
 */
export async function stopSTLWorker(): Promise<void> {
  if (stlWorker) {
    logger.info("Stopping STL worker");
    await stlWorker.close();
    stlWorker = null;
    logger.info("STL worker stopped");
  }
}

/**
 * Add a job to the STL queue
 */
export async function addSTLJob(
  data: STLJobData,
): Promise<{ jobId: string; queuePosition: number }> {
  const queue = getSTLQueue();

  // Initialize job status
  const jobStatus: GenerationStatusResponse = {
    id: data.generationId,
    status: "queued",
    progress: 0,
    createdAt: data.createdAt,
  };
  jobStatusStore.set(data.generationId, jobStatus);

  // Add job to queue
  const job = await queue.add("generate-stl", data, {
    jobId: data.generationId,
  });

  // Get queue position
  const waiting = await queue.getWaitingCount();

  logger.info("Job added to queue", {
    jobId: job.id,
    generationId: data.generationId,
    queuePosition: waiting,
  });

  return {
    jobId: job.id || data.generationId,
    queuePosition: waiting,
  };
}

/**
 * Get job status from store or Bull job
 */
export async function getJobStatus(
  generationId: string,
): Promise<GenerationStatusResponse | null> {
  // First check in-memory store
  const cached = jobStatusStore.get(generationId);
  if (cached) {
    // If not terminal state, refresh from Bull
    if (cached.status !== "complete" && cached.status !== "error") {
      const queue = getSTLQueue();
      const job = await queue.getJob(generationId);

      if (job) {
        const state = await job.getState();
        const progress = job.progress as JobProgress | number;

        // Update cached status
        cached.status = mapBullStateToStatus(state);
        cached.progress =
          typeof progress === "number"
            ? progress
            : progress?.percent || cached.progress;
      }
    }
    return cached;
  }

  // Try to get from Bull
  const queue = getSTLQueue();
  const job = await queue.getJob(generationId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress as JobProgress | number;

  const status: GenerationStatusResponse = {
    id: generationId,
    status: mapBullStateToStatus(state),
    progress: typeof progress === "number" ? progress : progress?.percent || 0,
    createdAt: new Date(job.timestamp).toISOString(),
  };

  if (state === "completed" && job.returnvalue) {
    status.downloadUrl = job.returnvalue.downloadUrl;
    status.completedAt = new Date(job.finishedOn || Date.now()).toISOString();
  }

  if (state === "failed") {
    status.error = job.failedReason;
    status.completedAt = new Date(job.finishedOn || Date.now()).toISOString();
  }

  // Cache the status
  jobStatusStore.set(generationId, status);

  return status;
}

/**
 * Update job status in store
 */
function updateJobStatus(
  generationId: string,
  updates: Partial<GenerationStatusResponse>,
): void {
  const current = jobStatusStore.get(generationId);
  if (current) {
    Object.assign(current, updates);
  }
}

/**
 * Map Bull job state to our status enum
 */
function mapBullStateToStatus(
  state: string,
): "queued" | "processing" | "complete" | "error" {
  switch (state) {
    case "completed":
      return "complete";
    case "failed":
      return "error";
    case "active":
      return "processing";
    case "waiting":
    case "delayed":
    case "prioritized":
    default:
      return "queued";
  }
}

/**
 * Send webhook notification
 */
async function sendWebhook(
  url: string,
  data: {
    generationId: string;
    status: string;
    downloadUrl?: string;
    duration?: number;
    error?: string;
  },
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`);
  }

  logger.info("Webhook delivered", { url, generationId: data.generationId });
}

/**
 * Get queue health information
 */
export async function getQueueHealth(): Promise<QueueHealth> {
  const queue = getSTLQueue();

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    const connection = getRedisConnection();
    let pingResult = false;
    let redisVersion: string | undefined;
    let redisUptime: number | undefined;

    try {
      pingResult = (await connection.ping()) === "PONG";
      const info = await connection.info("server");
      const versionMatch = info.match(/redis_version:(.+)/);
      const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
      redisVersion = versionMatch ? versionMatch[1].trim() : undefined;
      redisUptime = uptimeMatch
        ? Number.parseInt(uptimeMatch[1], 10)
        : undefined;
    } catch {
      // Redis not available
    }

    return {
      connected: pingResult,
      redis: {
        ping: pingResult,
        version: redisVersion,
        uptime: redisUptime,
      },
      queue: {
        name: QUEUE_NAME,
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
      worker: {
        running: stlWorker !== null,
        concurrency: stlWorker?.opts.concurrency || 0,
      },
    };
  } catch (error) {
    logger.error("Failed to get queue health", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      connected: false,
      redis: {
        ping: false,
      },
      queue: {
        name: QUEUE_NAME,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      },
      worker: {
        running: false,
        concurrency: 0,
      },
    };
  }
}

/**
 * Clean up completed and failed jobs older than retention time
 */
export async function cleanupOldJobs(retentionMs?: number): Promise<{
  cleaned: number;
}> {
  const queue = getSTLQueue();
  const retention = retentionMs || 3600000; // Default 1 hour
  const grace = retention; // Grace period same as retention

  const cleaned = await queue.clean(grace, 1000, "completed");
  const cleanedFailed = await queue.clean(grace, 1000, "failed");

  const totalCleaned = cleaned.length + cleanedFailed.length;

  if (totalCleaned > 0) {
    logger.info("Cleaned up old jobs", {
      completed: cleaned.length,
      failed: cleanedFailed.length,
    });
  }

  // Also clean up job status store
  const now = Date.now();
  for (const [id, status] of jobStatusStore.entries()) {
    if (
      (status.status === "complete" || status.status === "error") &&
      status.completedAt
    ) {
      const completedAt = new Date(status.completedAt).getTime();
      if (now - completedAt > retention) {
        jobStatusStore.delete(id);
      }
    }
  }

  return { cleaned: totalCleaned };
}

/**
 * Close all queue connections
 */
export async function closeQueue(): Promise<void> {
  logger.info("Closing queue connections");

  await stopSTLWorker();

  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }

  if (stlQueue) {
    await stlQueue.close();
    stlQueue = null;
  }

  logger.info("Queue connections closed");
}

/**
 * Initialize the queue system
 * Call this on server startup
 */
export function initializeQueue(): void {
  // Initialize queue
  getSTLQueue();

  // Start worker
  startSTLWorker();

  // Initialize queue events
  getQueueEvents();

  logger.info("Queue system initialized");
}
