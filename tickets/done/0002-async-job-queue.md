# Ticket #0002: Implement Async Job Queue for Background STL Generation

**Status:** Done
**Priority:** High
**Created:** 2026-01-06
**Assignee:** TBD
**Labels:** `backend`, `infrastructure`, `critical-ux`

---

## Summary

Async STL generation is currently stubbed and non-functional. When users request async generation (`async: true`), jobs are marked as "queued" but never actually process, leaving users stuck in a pending state indefinitely.

**Current Behavior:**
- Jobs return `status: "queued"` immediately
- Jobs are stored in an in-memory `Map<string, GenerationStatusResponse>`
- No background processing occurs
- Jobs remain in "queued" state forever
- Warning logged: `"Async generation not yet implemented - job will remain queued"`

**Location:** `/home/user/snap-caddy/app/api/generate/route.ts` lines 172-189

```typescript
// Current stub implementation
if (request.async) {
  logger.info('Queued async generation', { generationId });

  const response: GenerateResponse = {
    success: true,
    generationId,
    status: 'queued',
    queuePosition: 1, // For future implementation with real queue
    estimatedTimeMs: 30000,
  };

  // Note: In a real implementation, you would queue this job for background processing
  // For now, we just return the queued status but don't actually process it
  logger.warn('Async generation not yet implemented - job will remain queued', {
    generationId,
  });

  return NextResponse.json(response);
}
```

---

## Impact

**User Experience:**
- Users selecting async mode experience broken functionality
- No feedback or progress updates
- Frontend polling returns "queued" indefinitely
- Forces users to use synchronous mode (60s timeout risk)

**System Performance:**
- Cannot handle long-running OpenSCAD renders (>60s)
- Cannot parallelize generation requests
- API route maxDuration=60s blocks thread during sync processing
- No ability to scale horizontally with multiple workers

**Production Readiness:**
- Blocks deployment for larger/complex models
- No retry mechanism for failed renders
- No job prioritization or rate limiting per user

---

## Acceptance Criteria

### Core Functionality
- [ ] Async jobs (`async: true`) are actually queued and processed in background
- [ ] Jobs transition through states: `queued → processing → complete/error`
- [ ] Multiple jobs can be processed concurrently (configurable worker count)
- [ ] Job status polling (`GET /api/generate?id={id}`) returns accurate real-time status
- [ ] Failed jobs automatically retry (configurable retry count)
- [ ] Jobs include progress updates (0-100%)

### API Compatibility
- [ ] Existing API contract preserved (no breaking changes)
- [ ] `GenerateResponse` and `GenerationStatusResponse` types unchanged
- [ ] Synchronous mode (`async: false`) continues to work
- [ ] Status polling works for both sync and async jobs

### Persistence & Reliability
- [ ] Job state persists across server restarts (if using Redis/DB)
- [ ] Jobs timeout after configurable duration (e.g., 5 minutes)
- [ ] Stale jobs are cleaned up automatically
- [ ] Job results (STL files) are cleaned up after expiration (currently 1 hour)

### Observability
- [ ] Job metrics tracked (queue length, processing time, success/failure rate)
- [ ] Errors logged with full context for debugging
- [ ] Queue health monitoring endpoint (`GET /api/queue/health`)

### Optional Enhancements
- [ ] Webhook callbacks when job completes (if `webhookUrl` provided)
- [ ] Job priority queue (user-tier based or explicit priority)
- [ ] Rate limiting per user/IP for queue submissions
- [ ] Dashboard to view queue status and statistics

---

## Technical Approach

### Option 1: BullMQ + Redis (Recommended for Production)

**Pros:**
- Battle-tested, production-ready solution
- Built-in retry logic, delayed jobs, priorities
- Persistent job storage (survives restarts)
- Web UI for monitoring (Bull Board)
- Scales horizontally with multiple workers
- Job events for webhooks/progress tracking

**Cons:**
- Requires Redis infrastructure
- Additional dependency complexity
- Learning curve for BullMQ API

**Implementation:**
```typescript
// lib/queue/stl-queue.ts
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const stlQueue = new Queue('stl-generation', { connection });

export interface STLJobData {
  generationId: string;
  svg: string;
  binConfig: GridfinityBinConfig;
  webhookUrl?: string;
}

// Worker process (can run separately)
const worker = new Worker<STLJobData>(
  'stl-generation',
  async (job: Job<STLJobData>) => {
    const { generationId, svg, binConfig } = job.data;

    // Update progress
    await job.updateProgress(10);

    // Process STL generation (existing logic)
    const jobPaths = await stlFileManager.createJobPathsWithId(generationId);
    await stlFileManager.writeSVG(jobPaths.svgPath, svg);
    await job.updateProgress(30);

    const scadResult = await openscadGenerator.generate(
      jobPaths.svgPath,
      binConfig,
      jobPaths.scadPath
    );
    await job.updateProgress(60);

    const renderResult = await openscadExecutor.render(
      scadResult.scadPath!,
      jobPaths.stlPath
    );
    await job.updateProgress(100);

    return { stlPath: renderResult.outputPath };
  },
  {
    connection,
    concurrency: 3, // Process 3 jobs concurrently
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 500 }, // Keep last 500 failed jobs
  }
);

worker.on('completed', async (job) => {
  // Send webhook if provided
  if (job.data.webhookUrl) {
    await fetch(job.data.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationId: job.data.generationId,
        status: 'complete',
        downloadUrl: `/api/download/${job.data.generationId}`,
      }),
    });
  }
});
```

**Dependencies:**
```json
{
  "dependencies": {
    "bullmq": "^5.34.4",
    "ioredis": "^5.5.1"
  },
  "devDependencies": {
    "@types/ioredis": "^5.0.0"
  }
}
```

**Environment Variables:**
```bash
REDIS_URL=redis://localhost:6379
QUEUE_CONCURRENCY=3
QUEUE_JOB_TIMEOUT=300000  # 5 minutes
```

---

### Option 2: Simple In-Memory Queue (Development/MVP)

**Pros:**
- No external dependencies
- Simple to implement
- Good for development/testing
- Sufficient for single-instance deployments

**Cons:**
- Jobs lost on server restart
- Cannot scale horizontally
- No persistence
- Manual retry logic required

**Implementation:**
```typescript
// lib/queue/simple-queue.ts
import EventEmitter from 'events';

interface QueueJob<T> {
  id: string;
  data: T;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retries: number;
}

export class SimpleJobQueue<T> extends EventEmitter {
  private queue: QueueJob<T>[] = [];
  private jobs = new Map<string, QueueJob<T>>();
  private processing = 0;
  private concurrency: number;
  private processor: (job: T) => Promise<void>;

  constructor(processor: (job: T) => Promise<void>, concurrency = 2) {
    super();
    this.processor = processor;
    this.concurrency = concurrency;
    this.processNext();
  }

  async add(id: string, data: T): Promise<void> {
    const job: QueueJob<T> = {
      id,
      data,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      retries: 0,
    };

    this.jobs.set(id, job);
    this.queue.push(job);
    this.emit('added', job);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing >= this.concurrency) return;

    const job = this.queue.shift();
    if (!job) return;

    this.processing++;
    job.status = 'processing';
    job.startedAt = new Date();
    this.emit('processing', job);

    try {
      await this.processor(job.data);
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      this.emit('completed', job);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();

      // Retry logic
      if (job.retries < 3) {
        job.retries++;
        job.status = 'queued';
        job.progress = 0;
        this.queue.push(job);
        this.emit('retrying', job);
      } else {
        this.emit('failed', job);
      }
    } finally {
      this.processing--;
      setImmediate(() => this.processNext());
    }
  }

  getStatus(id: string): QueueJob<T> | undefined {
    return this.jobs.get(id);
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
```

---

### Option 3: Serverless Queue (Vercel/Render)

**Pros:**
- Platform-native solution
- No infrastructure management
- Auto-scaling

**Cons:**
- Platform lock-in
- Limited control over workers
- Potential cost implications

**Implementation (Vercel Queue):**
```typescript
// Using Vercel Queue (if deployed on Vercel)
import { Queue } from '@vercel/queue';

export const stlQueue = new Queue('stl-generation');

// Queue job
await stlQueue.enqueue('generate', jobData);

// Consumer function (separate API route)
export async function POST(req: Request) {
  const jobData = await req.json();
  // Process STL generation
}
```

---

## Recommended Approach: BullMQ + Redis

**Rationale:**
- Production-grade reliability
- Scales with multiple instances
- Built-in monitoring and debugging
- Active maintenance and community support
- Easy migration from simple queue later

**Fallback:** Start with Option 2 (Simple Queue) for MVP, migrate to BullMQ when needed.

---

## Files to Modify/Create

### Core Queue Infrastructure
- [ ] **`lib/queue/stl-queue.ts`** (new) - Queue and worker configuration
- [ ] **`lib/queue/types.ts`** (new) - Job data interfaces
- [ ] **`lib/queue/worker.ts`** (new) - Background worker process
- [ ] **`lib/queue/health.ts`** (new) - Queue health monitoring

### API Routes
- [ ] **`app/api/generate/route.ts`** - Replace stub with real queue submission
- [ ] **`app/api/queue/health/route.ts`** (new) - Queue health endpoint
- [ ] **`app/api/queue/stats/route.ts`** (new, optional) - Queue statistics

### OpenSCAD Module Updates
- [ ] **`lib/openscad/fileManager.ts`** - Add `createJobPathsWithId(id: string)` method
- [ ] **`lib/openscad/generator.ts`** - Add progress callback support
- [ ] **`lib/openscad/executor.ts`** - Add progress callback support

### Configuration
- [ ] **`.env.example`** - Add Redis and queue configuration variables
- [ ] **`lib/config/queue.ts`** (new) - Queue configuration loader
- [ ] **`package.json`** - Add BullMQ and Redis dependencies

### Utilities
- [ ] **`lib/queue/cleanup.ts`** (new) - Job cleanup cron
- [ ] **`lib/queue/metrics.ts`** (new) - Queue metrics tracking
- [ ] **`lib/logger.ts`** - Add queue-specific logging

### Scripts
- [ ] **`scripts/worker.ts`** (new, optional) - Standalone worker process
- [ ] **`scripts/queue-dashboard.ts`** (new, optional) - Bull Board integration

---

## Dependencies

### Required (BullMQ Approach)
```bash
npm install bullmq ioredis
npm install --save-dev @types/ioredis
```

### Optional (Monitoring)
```bash
npm install @bull-board/express @bull-board/api
```

### Infrastructure
- **Redis Server**
  - Development: `docker run -d -p 6379:6379 redis:alpine`
  - Production: Managed Redis (Render, Upstash, Redis Cloud)
  - Render.com: Add Redis service to `render.yaml`

---

## Testing Requirements

### Unit Tests
- [ ] Queue job creation and submission
- [ ] Job status transitions (queued → processing → complete)
- [ ] Job retry logic on failure
- [ ] Progress updates
- [ ] Job timeout handling
- [ ] Cleanup of completed jobs

### Integration Tests
- [ ] End-to-end async generation flow
- [ ] Multiple concurrent jobs
- [ ] Job status polling accuracy
- [ ] Webhook callback delivery
- [ ] Queue recovery after restart (BullMQ only)

### Load Tests
- [ ] 100 concurrent jobs queued
- [ ] Worker concurrency limits respected
- [ ] Queue performance under load
- [ ] Memory usage with large queue

### Manual Tests
- [ ] Submit async job via frontend
- [ ] Poll status and verify transitions
- [ ] Download STL when complete
- [ ] Verify webhook delivery (if implemented)
- [ ] Test job failure and retry
- [ ] Verify cleanup of expired STL files

---

## Implementation Plan

### Phase 1: Core Queue (1-2 days)
1. Add BullMQ and Redis dependencies
2. Create queue infrastructure (`lib/queue/`)
3. Implement worker with basic STL processing
4. Update `/api/generate` to queue jobs
5. Test with single job processing

### Phase 2: Status & Monitoring (1 day)
1. Implement accurate status updates from Bull jobs
2. Add progress tracking (0-100%)
3. Create health endpoint
4. Add queue metrics logging
5. Test status polling frontend

### Phase 3: Production Hardening (1 day)
1. Add retry logic and error handling
2. Implement job timeouts
3. Add cleanup for old jobs
4. Configure worker concurrency
5. Load testing and optimization

### Phase 4: Optional Enhancements (1 day)
1. Webhook callbacks
2. Bull Board dashboard
3. Job priority queue
4. Rate limiting per user
5. Advanced metrics

---

## Success Metrics

- Async jobs complete successfully within expected time (30-60s typical)
- Status polling shows accurate progress (not stuck at "queued")
- Failed jobs automatically retry up to 3 times
- Queue can handle 100+ concurrent jobs without degradation
- Job state persists across server restarts (BullMQ)
- Zero "jobs stuck forever" incidents

---

## Deployment Notes

### Render.com Configuration

Update `render.yaml`:
```yaml
services:
  - type: web
    name: snap-caddy
    env: node
    # ... existing config ...
    envVars:
      - key: REDIS_URL
        fromService:
          type: redis
          name: snap-caddy-redis
          property: connectionString

  - type: redis
    name: snap-caddy-redis
    plan: starter  # Free tier
    ipAllowList: []  # Allow all (or restrict to web service)
```

### Environment Variables
```bash
# Required
REDIS_URL=redis://...

# Optional (with defaults)
QUEUE_CONCURRENCY=3
QUEUE_JOB_TIMEOUT=300000
QUEUE_CLEANUP_INTERVAL=3600000
QUEUE_MAX_RETRIES=3
```

---

## Related Documentation

- `/home/user/snap-caddy/docs/05-API-ARCHITECTURE.md` - Current API architecture
- `/home/user/snap-caddy/app/api/generate/route.ts` - Current stub implementation
- [BullMQ Documentation](https://docs.bullmq.io/)
- [BullMQ Best Practices](https://docs.bullmq.io/guide/best-practices)

---

## Notes

- Current in-memory `jobStatusStore` can be migrated to Bull job metadata
- Existing synchronous mode should continue to work unchanged
- Consider rate limiting queue submissions to prevent abuse
- Monitor Redis memory usage with large queue sizes
- STL file cleanup (1 hour TTL) is separate from job cleanup

---

## Questions/Decisions Needed

1. **Redis hosting:** Self-hosted Docker vs. managed service (Upstash, Render)?
2. **Worker deployment:** Same process vs. separate worker instances?
3. **Concurrency:** How many concurrent OpenSCAD renders? (Default: 3)
4. **Job retention:** How long to keep completed/failed jobs? (Default: 1 hour)
5. **Webhooks:** Priority for webhook implementation? (Optional)
6. **Monitoring:** Deploy Bull Board dashboard? (Recommended for production)
