/**
 * STL Queue Integration Tests
 * Tests hitting real Redis on port 6397
 *
 * Prerequisites:
 *   ./scripts/start-redis.sh
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import {
  getSTLQueue,
  addSTLJob,
  getJobStatus,
  getQueueHealth,
  startSTLWorker,
  stopSTLWorker,
  closeQueue,
  cleanupOldJobs,
} from "./stl-queue";
import {
  getRedisConnection,
  closeRedisConnections,
  isRedisConnected,
} from "./connection";
import type { STLJobData } from "./types";

// Test configuration
const TEST_REDIS_URL = process.env.REDIS_URL || "redis://localhost:6397";

describe("STL Queue Integration Tests", () => {
  let redisAvailable = false;

  beforeAll(async () => {
    // Check if Redis is available
    try {
      redisAvailable = await isRedisConnected();
      if (!redisAvailable) {
        console.warn("Redis not available at", TEST_REDIS_URL);
        console.warn("Run ./scripts/start-redis.sh to start Redis");
      }
    } catch {
      console.warn("Failed to connect to Redis");
    }
  });

  afterAll(async () => {
    // Clean up connections
    await closeQueue();
    await closeRedisConnections();
  });

  describe("Redis Connection", () => {
    test("should connect to Redis", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const connected = await isRedisConnected();
      expect(connected).toBe(true);
    });

    test("should get Redis connection", () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const connection = getRedisConnection();
      expect(connection).toBeDefined();
    });

    test("should ping Redis successfully", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const connection = getRedisConnection();
      const result = await connection.ping();
      expect(result).toBe("PONG");
    });
  });

  describe("Queue Operations", () => {
    beforeEach(async () => {
      if (!redisAvailable) return;

      // Clean up queue before each test
      const queue = getSTLQueue();
      await queue.obliterate({ force: true });
    });

    test("should create queue instance", () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const queue = getSTLQueue();
      expect(queue).toBeDefined();
      expect(queue.name).toBe("stl-generation");
    });

    test("should add job to queue", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const jobData: STLJobData = {
        generationId: "test-job-1",
        svg: "<svg></svg>",
        binConfig: {
          gridUnitsX: 2,
          gridUnitsY: 2,
          binHeight: 21,
          cutoutDepth: 15,
          cutoutPadding: 2,
          cutoutOffsetX: 0,
          cutoutOffsetY: 0,
          wallThickness: 1.2,
          baseType: "magnet",
          lipStyle: "normal",
        },
        createdAt: new Date().toISOString(),
      };

      const result = await addSTLJob(jobData);

      expect(result.jobId).toBeDefined();
      expect(result.queuePosition).toBeGreaterThanOrEqual(0);
    });

    test("should get job status after adding", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const generationId = `test-job-${Date.now()}`;
      const jobData: STLJobData = {
        generationId,
        svg: "<svg></svg>",
        binConfig: {
          gridUnitsX: 1,
          gridUnitsY: 1,
          binHeight: 14,
          cutoutDepth: 10,
          cutoutPadding: 2,
          cutoutOffsetX: 0,
          cutoutOffsetY: 0,
          wallThickness: 1.2,
          baseType: "solid",
          lipStyle: "none",
        },
        createdAt: new Date().toISOString(),
      };

      await addSTLJob(jobData);

      const status = await getJobStatus(generationId);

      expect(status).toBeDefined();
      expect(status?.id).toBe(generationId);
      expect(status?.status).toBe("queued");
      expect(status?.progress).toBe(0);
    });

    test("should return null for non-existent job", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const status = await getJobStatus("non-existent-job-id");
      expect(status).toBeNull();
    });

    test("should track multiple jobs in queue", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const jobs: STLJobData[] = [];
      for (let i = 0; i < 5; i++) {
        jobs.push({
          generationId: `batch-job-${i}`,
          svg: `<svg id="${i}"></svg>`,
          binConfig: {
            gridUnitsX: 1,
            gridUnitsY: 1,
            binHeight: 14,
            cutoutDepth: 10,
            cutoutPadding: 2,
            cutoutOffsetX: 0,
            cutoutOffsetY: 0,
            wallThickness: 1.2,
            baseType: "solid",
            lipStyle: "none",
          },
          createdAt: new Date().toISOString(),
        });
      }

      // Add all jobs
      const results = await Promise.all(jobs.map((job) => addSTLJob(job)));

      // Verify all were added
      expect(results).toHaveLength(5);

      // Check queue has jobs
      const queue = getSTLQueue();
      const waiting = await queue.getWaitingCount();
      expect(waiting).toBe(5);
    });
  });

  describe("Queue Health", () => {
    test("should return queue health status", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      const health = await getQueueHealth();

      expect(health.connected).toBe(true);
      expect(health.redis.ping).toBe(true);
      expect(health.redis.version).toBeDefined();
      expect(health.queue.name).toBe("stl-generation");
      expect(typeof health.queue.waiting).toBe("number");
      expect(typeof health.queue.active).toBe("number");
      expect(typeof health.queue.completed).toBe("number");
      expect(typeof health.queue.failed).toBe("number");
    });

    test("should report worker status", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      // Stop any existing worker first
      await stopSTLWorker();

      // Start worker
      startSTLWorker(2);

      // Give worker time to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));

      const health = await getQueueHealth();

      expect(health.worker.running).toBe(true);
      expect(health.worker.concurrency).toBe(2);

      // Stop worker
      await stopSTLWorker();

      const healthAfter = await getQueueHealth();
      expect(healthAfter.worker.running).toBe(false);
    });
  });

  describe("Queue Cleanup", () => {
    test("should cleanup old jobs", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      // Add a job
      const jobData: STLJobData = {
        generationId: "cleanup-test-job",
        svg: "<svg></svg>",
        binConfig: {
          gridUnitsX: 1,
          gridUnitsY: 1,
          binHeight: 14,
          cutoutDepth: 10,
          cutoutPadding: 2,
          cutoutOffsetX: 0,
          cutoutOffsetY: 0,
          wallThickness: 1.2,
          baseType: "solid",
          lipStyle: "none",
        },
        createdAt: new Date().toISOString(),
      };

      await addSTLJob(jobData);

      // Run cleanup (with 0ms retention to clean everything)
      const result = await cleanupOldJobs(0);

      // Note: cleanup only affects completed/failed jobs, not waiting jobs
      expect(typeof result.cleaned).toBe("number");
    });
  });

  describe("Worker Processing", () => {
    test("should start and stop worker", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }

      // Start worker
      const worker = startSTLWorker(1);
      expect(worker).toBeDefined();

      // Give it a moment
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop worker
      await stopSTLWorker();

      // Verify stopped
      const health = await getQueueHealth();
      expect(health.worker.running).toBe(false);
    });
  });
});

describe("Queue Connection Edge Cases", () => {
  test("should handle connection options from URL", () => {
    // This tests the URL parsing logic without needing Redis
    const url = "redis://localhost:6397";
    const parsed = new URL(url);

    expect(parsed.hostname).toBe("localhost");
    expect(parsed.port).toBe("6397");
  });

  test("should handle URL with auth", () => {
    const url = "redis://user:password@localhost:6397";
    const parsed = new URL(url);

    expect(parsed.hostname).toBe("localhost");
    expect(parsed.port).toBe("6397");
    expect(parsed.username).toBe("user");
    expect(parsed.password).toBe("password");
  });
});
