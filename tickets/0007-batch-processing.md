# Ticket #0007: Batch Processing for Multiple Bin Generation

## Priority
**Low**

## Status
Not Started

---

## Summary

Users can currently only generate one Gridfinity bin at a time. This requires them to go through the entire workflow (capture → segment → calibrate → configure → generate) separately for each object they want to create a bin for. This is inefficient when users need to create bins for multiple objects from a single photo or want to generate variations of the same bin with different configurations.

Implementing batch processing will allow users to:
- Queue multiple items for generation in a single session
- Track progress for each item individually
- Download all generated STL files as a single ZIP archive
- Save time when creating bins for multiple objects

---

## Acceptance Criteria

### Must Have
1. **Queue Multiple Items**
   - [ ] Users can add multiple SVG/config pairs to a generation queue before starting
   - [ ] Each queued item has a unique identifier and can be individually managed
   - [ ] Users can remove items from the queue before generation starts
   - [ ] Queue persists in session state (survives page refresh during generation)

2. **Progress Tracking**
   - [ ] Display overall progress (e.g., "3 of 5 items completed")
   - [ ] Show individual progress for each item in the queue with status indicators:
     - Pending (not started)
     - Processing (currently generating)
     - Complete (STL generated successfully)
     - Error (failed with error message)
   - [ ] Display estimated time remaining for the entire batch
   - [ ] Real-time updates as items progress through generation

3. **Bulk Download as ZIP**
   - [ ] All successfully generated STL files are packaged into a single ZIP archive
   - [ ] ZIP file has a meaningful name (e.g., `gridfinity-batch-2024-01-06-abc123.zip`)
   - [ ] Each STL file within the ZIP has a descriptive name (e.g., `bin-1-2x2-42mm.stl`)
   - [ ] ZIP download is available once all items complete (with or without errors)
   - [ ] Failed items are logged in a text file included in the ZIP (e.g., `errors.txt`)
   - [ ] Option to download individual STL files for completed items before batch finishes

4. **Error Handling**
   - [ ] If an item fails, continue processing remaining items
   - [ ] Display clear error messages for failed items
   - [ ] Option to retry failed items individually
   - [ ] Don't block ZIP download if some items fail

5. **API Integration**
   - [ ] New `POST /api/generate/batch` endpoint that accepts array of generation requests
   - [ ] Returns batch ID and initial status
   - [ ] `GET /api/generate/batch?id={batchId}` endpoint for polling batch status
   - [ ] `GET /api/download/batch/{batchId}` endpoint for ZIP download
   - [ ] Proper rate limiting for batch operations (lower limit than single operations)

### Should Have
- [ ] Ability to pause/resume batch processing
- [ ] Batch history stored locally (view past batches for re-download)
- [ ] Cancel entire batch or individual items during processing
- [ ] Export batch configuration as JSON for later re-use

### Nice to Have
- [ ] Email notification when batch completes (if provided)
- [ ] Webhook support for batch completion events
- [ ] Preview thumbnails for each item in the batch
- [ ] Batch templates (pre-configured sets of common bins)

---

## Technical Approach

### 1. Backend Queue System

#### File Structure
```
lib/
├── queue/
│   ├── batchQueue.ts          # Batch queue manager
│   ├── batchProcessor.ts      # Parallel execution logic
│   └── jobScheduler.ts        # Job scheduling and prioritization
```

#### Queue Implementation
- **In-Memory Queue (MVP)**: Use a Map-based queue for simple implementation
  - Store batch jobs in memory with status tracking
  - Cleanup completed batches after 1 hour
  - Limitation: Won't survive server restarts (acceptable for MVP)

- **Future Enhancement**: Migrate to Redis-backed queue (BullMQ) for production
  - Persistent queue that survives restarts
  - Better concurrency control across multiple server instances
  - Built-in retry logic and job scheduling

#### Parallel Processing Strategy
```typescript
// Pseudo-code for parallel execution
async function processBatch(batchId: string, items: GenerationItem[]) {
  const MAX_PARALLEL = 3; // Run 3 OpenSCAD processes simultaneously

  // Process items in chunks to prevent resource exhaustion
  for (let i = 0; i < items.length; i += MAX_PARALLEL) {
    const chunk = items.slice(i, i + MAX_PARALLEL);

    // Process chunk in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      chunk.map(item => generateSTL(item))
    );

    // Update status for each item in chunk
    updateBatchProgress(batchId, results);
  }

  // Create ZIP archive once all items complete
  await createZipArchive(batchId);
}
```

### 2. API Routes

#### New Endpoints

**POST /api/generate/batch**
```typescript
// Request Schema
{
  items: [
    {
      svg: string,
      config: GridfinityConfig,
      name?: string  // Optional custom name for the item
    }
  ],
  webhookUrl?: string,  // Optional webhook for completion notification
  email?: string        // Optional email for completion notification
}

// Response
{
  success: true,
  batchId: string,      // UUID for batch tracking
  status: "queued",
  itemCount: number,
  estimatedTimeMs: number
}
```

**GET /api/generate/batch?id={batchId}**
```typescript
// Response
{
  id: string,
  status: "queued" | "processing" | "complete" | "error",
  totalItems: number,
  completedItems: number,
  failedItems: number,
  progress: number,       // 0-100 overall progress
  items: [
    {
      id: string,
      name: string,
      status: "pending" | "processing" | "complete" | "error",
      progress: number,   // 0-100 individual progress
      error?: string,
      downloadUrl?: string
    }
  ],
  downloadUrl?: string,   // Available when batch complete
  createdAt: string,
  completedAt?: string
}
```

**GET /api/download/batch/{batchId}**
- Returns ZIP file with all completed STL files
- Includes errors.txt if any items failed
- Proper headers for file download

### 3. ZIP Archive Creation

Use the `archiver` npm package for reliable ZIP creation:

```bash
npm install archiver @types/archiver
```

```typescript
// lib/archive/zipCreator.ts
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

async function createBatchZip(
  batchId: string,
  stlFiles: Array<{ path: string; name: string }>,
  errors: Array<{ name: string; error: string }>
): Promise<string> {
  const zipPath = join(TEMP_DIR, batchId, 'batch.zip');
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  // Pipe archive to output file
  archive.pipe(output);

  // Add STL files
  for (const file of stlFiles) {
    archive.file(file.path, { name: file.name });
  }

  // Add errors.txt if there are any errors
  if (errors.length > 0) {
    const errorLog = errors
      .map(e => `${e.name}: ${e.error}`)
      .join('\n\n');
    archive.append(errorLog, { name: 'errors.txt' });
  }

  // Add README with batch info
  const readme = generateBatchReadme(batchId, stlFiles.length, errors.length);
  archive.append(readme, { name: 'README.txt' });

  await archive.finalize();

  return zipPath;
}
```

### 4. Frontend Changes

#### Files to Modify

**State Management**
- `contexts/WizardContext.tsx`
  - Add `batchItems` array to store queued items
  - Add `addToBatch()`, `removeFromBatch()`, `clearBatch()` methods
  - Add `currentBatch` state for tracking active batch generation

**Components to Create**
- `components/batch/BatchQueue.tsx`
  - Display queued items with edit/remove options
  - Show item count and estimated total time

- `components/batch/BatchProgress.tsx`
  - Overall progress bar
  - List of items with individual status indicators
  - Individual item progress bars

- `components/batch/BatchDownload.tsx`
  - ZIP download button (enabled when complete)
  - Individual STL download links
  - Error summary display

**Components to Modify**
- `components/wizard/ReviewStep.tsx`
  - Add "Add to Batch" button alongside "Generate"
  - Show batch queue if items are queued
  - "Generate Batch" button to start batch processing

- `components/wizard/DownloadStep.tsx`
  - Detect if single or batch generation
  - Show BatchDownload component for batch operations
  - Maintain existing single download flow

#### User Flow
```
ReviewStep:
├─ Option 1: Generate Single (existing flow)
│  └─ Direct to DownloadStep with single STL
│
└─ Option 2: Add to Batch (new)
   ├─ Item added to batch queue
   ├─ User can add more items or edit current
   ├─ "Generate Batch" button appears
   ├─ Click "Generate Batch"
   │  └─ POST /api/generate/batch
   ├─ Navigate to BatchProgressStep
   │  ├─ Poll GET /api/generate/batch?id={id}
   │  └─ Show real-time progress
   └─ When complete → Navigate to DownloadStep
      └─ Show ZIP download + individual files
```

### 5. Database Schema (Future Enhancement)

When migrating from in-memory to persistent storage:

```typescript
// Prisma schema example
model Batch {
  id          String      @id @default(uuid())
  status      BatchStatus @default(QUEUED)
  totalItems  Int
  completedItems Int      @default(0)
  failedItems Int         @default(0)
  createdAt   DateTime    @default(now())
  completedAt DateTime?
  zipPath     String?
  items       BatchItem[]
}

model BatchItem {
  id         String     @id @default(uuid())
  batchId    String
  batch      Batch      @relation(fields: [batchId], references: [id])
  name       String
  svg        String     @db.Text
  config     Json
  status     ItemStatus @default(PENDING)
  progress   Int        @default(0)
  error      String?
  stlPath    String?
  createdAt  DateTime   @default(now())
  completedAt DateTime?
}

enum BatchStatus {
  QUEUED
  PROCESSING
  COMPLETE
  ERROR
}

enum ItemStatus {
  PENDING
  PROCESSING
  COMPLETE
  ERROR
}
```

---

## Files to Modify/Create

### Backend

**New Files**
- `/app/api/generate/batch/route.ts` - Batch generation endpoint
- `/app/api/download/batch/[id]/route.ts` - Batch download endpoint
- `/lib/queue/batchQueue.ts` - Queue manager
- `/lib/queue/batchProcessor.ts` - Parallel execution
- `/lib/queue/types.ts` - Queue type definitions
- `/lib/archive/zipCreator.ts` - ZIP creation utility
- `/schemas/batch.ts` - Zod schemas for batch operations

**Modified Files**
- `/types/api.ts` - Add batch-related types
- `/lib/logger.ts` - Add batch-specific logging
- `/lib/openscad/executor.ts` - Ensure thread-safe parallel execution

### Frontend

**New Files**
- `/components/batch/BatchQueue.tsx` - Queue display and management
- `/components/batch/BatchProgress.tsx` - Progress tracking UI
- `/components/batch/BatchDownload.tsx` - Download interface
- `/components/batch/BatchItemCard.tsx` - Individual item in queue
- `/hooks/useBatchGeneration.ts` - Batch generation hook
- `/hooks/useBatchPolling.ts` - Polling hook for batch status

**Modified Files**
- `/contexts/WizardContext.tsx` - Add batch state management
- `/components/wizard/ReviewStep.tsx` - Add batch queue UI
- `/components/wizard/DownloadStep.tsx` - Support batch downloads
- `/components/wizard/WizardNavigation.tsx` - Handle batch flow

### Documentation

**New Files**
- `/docs/07-BATCH-PROCESSING.md` - Batch processing architecture

**Modified Files**
- `/docs/05-API-ARCHITECTURE.md` - Document new batch endpoints
- `/docs/06-STATE-MANAGEMENT.md` - Document batch state flow
- `/README.md` - Move batch processing from "Planned" to "Implemented"

---

## Dependencies

### Required npm Packages
```json
{
  "archiver": "^7.0.0",
  "@types/archiver": "^6.0.2"
}
```

### Optional (for future enhancement)
```json
{
  "bullmq": "^5.0.0",          // Redis-backed queue
  "ioredis": "^5.3.0",          // Redis client
  "nodemailer": "^6.9.0",       // Email notifications
  "@types/nodemailer": "^6.4.0"
}
```

---

## Testing Requirements

### Unit Tests

**Queue Manager** (`lib/queue/batchQueue.test.ts`)
- [ ] Create batch with multiple items
- [ ] Add/remove items from queue
- [ ] Update item status
- [ ] Calculate overall progress
- [ ] Handle concurrent batch operations

**Batch Processor** (`lib/queue/batchProcessor.test.ts`)
- [ ] Process items in parallel
- [ ] Respect MAX_PARALLEL limit
- [ ] Handle individual item failures gracefully
- [ ] Continue processing after partial failures
- [ ] Update progress correctly

**ZIP Creator** (`lib/archive/zipCreator.test.ts`)
- [ ] Create ZIP with multiple STL files
- [ ] Include error log when items fail
- [ ] Generate proper README
- [ ] Handle large files efficiently
- [ ] Proper file naming in archive

### Integration Tests

**Batch API Flow** (`__tests__/integration/batch-generation.test.ts`)
- [ ] Complete flow: queue → process → download
- [ ] Batch with all successful items
- [ ] Batch with some failed items
- [ ] Batch with all failed items
- [ ] Concurrent batch requests
- [ ] Batch polling returns correct status

### Load Tests

**Parallel Processing** (`__tests__/load/batch-load.test.ts`)
- [ ] Process batch of 10 items
- [ ] Process batch of 50 items
- [ ] Multiple concurrent batches
- [ ] Resource usage during parallel OpenSCAD execution
- [ ] Memory cleanup after batch completion

### E2E Tests

**User Flow** (`__tests__/e2e/batch-workflow.test.ts`)
- [ ] Add multiple items to batch queue
- [ ] Remove item from queue
- [ ] Start batch generation
- [ ] Monitor progress updates
- [ ] Download ZIP file
- [ ] Extract and verify STL files
- [ ] Retry failed item

---

## Performance Considerations

### Resource Management
- **OpenSCAD Processes**: Limit to 3 parallel processes to prevent CPU/memory exhaustion
  - Each OpenSCAD render can use 500MB-2GB RAM
  - Adjust MAX_PARALLEL based on available system resources

- **Temporary File Storage**:
  - Clean up batch directories after download or 1 hour (whichever comes first)
  - Implement disk space monitoring to prevent storage exhaustion
  - Consider moving to object storage (S3) for large deployments

### Rate Limiting
```typescript
// Adjust rate limits for batch operations
export const POST = withRateLimit(batchHandler, {
  maxRequests: 2,        // Only 2 batch requests per minute (vs 5 for single)
  windowMs: 60000,
  maxItemsPerBatch: 20   // Limit items per batch to prevent abuse
});
```

### Caching Strategies
- Cache identical SVG generations (same SVG + config = same STL)
- Store hash of SVG+config as cache key
- Reuse cached STL if available (saves OpenSCAD execution time)

---

## Security Considerations

### Input Validation
- [ ] Validate batch size limits (max 20 items per batch)
- [ ] Validate total SVG size across all items (max 10MB total)
- [ ] Sanitize custom item names to prevent path traversal
- [ ] Rate limit batch operations more aggressively than single operations

### Resource Protection
- [ ] Implement queue size limits (max 100 concurrent batches globally)
- [ ] Add timeout for entire batch operation (max 15 minutes)
- [ ] Monitor and alert on excessive resource usage
- [ ] Implement circuit breaker pattern for OpenSCAD executor

### Data Privacy
- [ ] Auto-cleanup batch files after 1 hour (no long-term storage)
- [ ] Don't log SVG content or user-provided names
- [ ] Sanitize error messages before including in ZIP
- [ ] Secure batch IDs (UUID v4 to prevent enumeration)

---

## Migration Path

### Phase 1: MVP (This Ticket)
- In-memory queue
- Basic batch processing with parallel execution
- ZIP download
- Frontend queue management

### Phase 2: Production Enhancements
- Migrate to Redis-backed queue (BullMQ)
- Add database persistence for batch history
- Implement caching for duplicate generations
- Add email notifications

### Phase 3: Advanced Features
- Pause/resume support
- Batch templates
- Webhook integrations
- Advanced scheduling (priority queues)

---

## Rollout Strategy

1. **Development** (Week 1-2)
   - Implement backend queue and batch endpoints
   - Create ZIP archive functionality
   - Unit test coverage

2. **Integration** (Week 3)
   - Frontend batch queue UI
   - Progress tracking components
   - Integration tests

3. **Testing** (Week 4)
   - E2E testing
   - Load testing with various batch sizes
   - Fix bugs and optimize performance

4. **Soft Launch** (Week 5)
   - Deploy to staging environment
   - Internal testing with real-world scenarios
   - Monitor resource usage

5. **Release** (Week 6)
   - Deploy to production
   - Enable for all users
   - Monitor metrics and error rates

---

## Success Metrics

### Quantitative
- **Usage**: % of users who use batch generation vs single
- **Batch Size**: Average number of items per batch
- **Success Rate**: % of batches that complete successfully
- **Processing Time**: Average time per item in batch vs single generation
- **Resource Efficiency**: CPU/memory usage during batch operations

### Qualitative
- User feedback on batch processing experience
- Reduction in support requests about multiple generations
- User satisfaction with ZIP download feature

---

## Related Issues/Tickets

- **Ticket #0001**: Async generation implementation (foundation for batch)
- **Ticket #0004**: OpenSCAD performance optimization (affects batch speed)
- **Ticket #0006**: Rate limiting improvements (batch-specific limits)

---

## References

- [BullMQ Documentation](https://docs.bullmq.io/) - For future Redis queue migration
- [Archiver npm Package](https://www.npmjs.com/package/archiver) - ZIP creation
- [OpenSCAD CLI Documentation](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Using_OpenSCAD_in_a_command_line_environment)
- Current API Architecture: `/docs/05-API-ARCHITECTURE.md`
- Current State Management: `/docs/06-STATE-MANAGEMENT.md`

---

## Notes

- This feature was requested implicitly by the current single-item limitation
- Batch processing is listed as "Planned" in README.md
- The async flag in current `/api/generate` endpoint is not fully implemented but provides a foundation for batch processing
- Consider user education: many users may not be familiar with batch workflows, so clear UI guidance is essential
- ZIP file naming should be consistent and include timestamp for easy organization
- Error handling is critical - one failed item shouldn't block the entire batch

---

**Created**: 2024-01-06
**Last Updated**: 2024-01-06
**Estimated Effort**: 4-6 weeks (including testing and documentation)
**Dependencies**: None (standalone feature)
