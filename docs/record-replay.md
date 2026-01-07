# Replicate API Record/Replay Strategy

This document provides comprehensive documentation for the record/replay system used to mock Replicate API calls during development and testing.

## Table of Contents

- [Overview](#overview)
- [Why Record/Replay?](#why-recordreplay)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Technical Details](#technical-details)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The record/replay system intercepts HTTP requests to the Replicate API and provides two modes:

1. **Record Mode**: Captures real API responses and saves them to disk
2. **Replay Mode**: Returns cached responses without making actual API calls

This enables deterministic testing, faster development cycles, and significant cost savings.

## Why Record/Replay?

### Problem Statement

The Snap Caddy application relies on Replicate's SAM 2 (Segment Anything Model) API for image segmentation. This presents several challenges:

1. **Cost**: Each API call costs money (~$0.0022 per prediction)
2. **Latency**: SAM 2 predictions take 10-30 seconds
3. **Flakiness**: Network issues can cause intermittent test failures
4. **Development Speed**: Waiting for API responses slows iteration

### Why Not Traditional Mocks?

Traditional mocking approaches have limitations:

| Approach | Limitation |
|----------|------------|
| In-code mocks | Require manual maintenance, diverge from reality |
| Mock servers | Complex setup, need to define responses |
| VCR-style | Often language-specific, complex configuration |
| Environment switching | Still requires real calls in "record" phase |

### Why Record/Replay?

Record/replay combines the best of both worlds:

- **Realistic**: Responses are from actual API calls
- **Deterministic**: Same input always produces same output
- **Fast**: Replay requires no network calls
- **Simple**: No mock server infrastructure needed
- **Version Controlled**: Recordings are checked in with the code

### Cost-Benefit Analysis

| Factor | Without Record/Replay | With Record/Replay |
|--------|----------------------|-------------------|
| Test runtime | ~30s per segmentation test | ~10ms per test |
| API costs | $0.0022 per test run | $0.0022 once per unique request |
| Network dependency | Required | Only for recording |
| Test reliability | Varies with network/API | 100% deterministic |

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Code                          │
├─────────────────────────────────────────────────────────────────┤
│  lib/sam/inference.ts                                            │
│  ├── Uses getRecordableFetch() for all HTTP calls               │
│  └── Base URL configurable via REPLICATE_BASE_URL               │
├─────────────────────────────────────────────────────────────────┤
│  lib/replicate/recorder.ts                                       │
│  ├── createRecordedFetch() - Wraps fetch with record/replay     │
│  ├── generateRequestHash() - Creates stable request hashes      │
│  ├── saveRecording() / loadRecording() - File I/O               │
│  └── sortObjectKeys() - Ensures JSON key order consistency      │
├─────────────────────────────────────────────────────────────────┤
│  fixtures/replicate/                                             │
│  └── {hash}.json - Recorded request/response pairs              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Record Mode
```
Request → generateHash() → Make real API call → Save to fixtures/{hash}.json → Return response
```

#### Replay Mode
```
Request → generateHash() → Load from fixtures/{hash}.json → Return cached response
           │
           └── If not found → Throw error (prevents accidental API calls)
```

### File Storage

Recordings are stored in `fixtures/replicate/` as JSON files:

```
fixtures/replicate/
├── README.md
├── a1b2c3d4e5f67890.json
├── f0e1d2c3b4a59876.json
└── ...
```

Each file contains:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestHash": "a1b2c3d4e5f67890",
  "request": {
    "method": "POST",
    "url": "https://api.replicate.com/v1/models/meta/sam-2/predictions",
    "headers": { "Content-Type": "application/json" },
    "body": { "input": { "image": "data:image/png;base64,..." } }
  },
  "response": {
    "status": 200,
    "statusText": "OK",
    "headers": { "content-type": "application/json" },
    "body": { "id": "abc123", "status": "succeeded", "output": {...} }
  }
}
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `STAGE` | `dev`, `staging`, `production` | `dev` | Application stage |
| `REPLICATE_RECORD_MODE` | `off`, `record`, `replay` | `off` | Record/replay mode |
| `REPLICATE_BASE_URL` | Any URL | `https://api.replicate.com` | Override API base URL |

### Example Configurations

**.env.development**
```bash
# Normal development (no recording)
STAGE=dev
REPLICATE_RECORD_MODE=off
REPLICATE_API_TOKEN=r8_xxx
```

**.env.test**
```bash
# Testing with replay
STAGE=dev
REPLICATE_RECORD_MODE=replay
# No API token needed for replay!
```

**.env.record**
```bash
# Recording new fixtures
STAGE=dev
REPLICATE_RECORD_MODE=record
REPLICATE_API_TOKEN=r8_xxx
```

## Usage Guide

### Recording New Responses

1. Set environment variable:
   ```bash
   export REPLICATE_RECORD_MODE=record
   ```

2. Run the application and trigger the API call:
   ```bash
   bun dev
   # Navigate to app, upload image, run segmentation
   ```

3. Verify recording was created:
   ```bash
   ls fixtures/replicate/
   # Should see new .json file
   ```

4. Commit the recording:
   ```bash
   git add fixtures/replicate/
   git commit -m "chore: add replicate recording for segmentation test"
   ```

### Using Replay Mode

1. Set environment variable:
   ```bash
   export REPLICATE_RECORD_MODE=replay
   ```

2. Run tests or development server:
   ```bash
   bun test
   # or
   bun dev
   ```

3. API calls will use cached responses instantly.

### Managing Recordings via Dev Page

Access the dev management page at `/dev/record-replay` (only when `STAGE=dev`):

- View current configuration
- List all recordings with metadata
- Delete individual recordings
- Clear all recordings

### API Endpoints

The dev page uses these API endpoints (also dev-only):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dev/record-replay/status` | GET | Current configuration |
| `/api/dev/record-replay/recordings` | GET | List all recordings |
| `/api/dev/record-replay/recordings` | DELETE | Clear all recordings |
| `/api/dev/record-replay/recordings/[hash]` | GET | Get specific recording |
| `/api/dev/record-replay/recordings/[hash]` | DELETE | Delete specific recording |

## Technical Details

### Hash Generation

The request hash is critical for matching requests to recordings. It's generated from:

1. **HTTP Method**: Normalized to uppercase (GET, POST, etc.)
2. **URL**: Normalized (sorted query params, removed volatile params)
3. **Request Body**: With keys sorted recursively

#### Why Sort Keys?

JavaScript objects don't guarantee property order:

```javascript
// These are semantically identical but stringify differently
const a = { z: 1, a: 2 };
const b = { a: 2, z: 1 };

JSON.stringify(a); // '{"z":1,"a":2}'
JSON.stringify(b); // '{"a":2,"z":1}'
```

The `sortObjectKeys()` function ensures consistent hashing:

```javascript
sortObjectKeys({ z: 1, a: 2 }); // { a: 2, z: 1 }
```

#### Hash Algorithm

```typescript
function generateRequestHash(method: string, url: string, body?: unknown): string {
  const hashInput = JSON.stringify({
    method: method.toUpperCase(),
    url: normalizeUrl(url),
    body: sortObjectKeys(body),
  });

  return crypto.createHash("sha256")
    .update(hashInput)
    .digest("hex")
    .substring(0, 16);  // Truncated for readability
}
```

### What's NOT Included in Hash

- **Headers**: Authorization tokens change between sessions
- **Timestamps**: Would create unique hashes for every request
- **Request IDs**: Same reason as timestamps

### Security Considerations

- Authorization headers are stripped from recordings
- Recordings may contain image data (review before committing)
- Dev endpoints are only accessible when `STAGE=dev`

### Base URL Override

The `REPLICATE_BASE_URL` environment variable allows pointing to:

- A local mock server
- A proxy for debugging
- A staging environment

```bash
# Point to local mock server
REPLICATE_BASE_URL=http://localhost:8080 bun dev
```

## Best Practices

### Do's

1. **Commit recordings** - They're part of your test fixtures
2. **Use descriptive commits** - "Add recording for multi-mask segmentation"
3. **Review recordings** - Check for sensitive data before committing
4. **Keep recordings minimal** - Only record what tests need
5. **Update recordings** when API responses change

### Don'ts

1. **Don't commit API tokens** - Recordings don't need them
2. **Don't record in production** - Only use in dev/test
3. **Don't record large images** - Use small test images
4. **Don't ignore hash mismatches** - They indicate request changes

### Test Organization

```typescript
describe("SAM Segmentation", () => {
  beforeAll(() => {
    // Ensure replay mode for tests
    process.env.REPLICATE_RECORD_MODE = "replay";
  });

  it("should segment an image", async () => {
    // This will use recorded response
    const result = await runSAMSegmentation(testParams);
    expect(result.individualMaskUrls).toHaveLength(5);
  });
});
```

### CI/CD Integration

```yaml
# GitHub Actions example
test:
  runs-on: ubuntu-latest
  env:
    REPLICATE_RECORD_MODE: replay
    STAGE: dev
  steps:
    - uses: actions/checkout@v4
    - run: bun install
    - run: bun test
```

## Troubleshooting

### "No recording found for request"

**Cause**: Replay mode is active but no matching recording exists.

**Solution**:
1. Switch to record mode: `REPLICATE_RECORD_MODE=record`
2. Run the operation to create a recording
3. Switch back to replay mode

### Hash mismatch after code changes

**Cause**: Request body changed (e.g., new parameter added).

**Solution**:
1. Delete the old recording
2. Re-record with updated request

### Recordings not loading

**Cause**: File permissions or path issues.

**Check**:
```bash
ls -la fixtures/replicate/
cat fixtures/replicate/{hash}.json | head
```

### Tests pass locally but fail in CI

**Cause**: Missing recording or environment variable not set.

**Solution**:
1. Ensure all recordings are committed
2. Verify CI sets `REPLICATE_RECORD_MODE=replay`

### Large recording files

**Cause**: Images are stored as base64 in recordings.

**Solution**:
1. Use smaller test images
2. Consider compressing images before testing
3. Add image-heavy recordings to `.gitattributes` for Git LFS

---

## Summary

The record/replay system provides:

- **Fast tests**: Milliseconds instead of seconds
- **Cost savings**: Pay once per unique request
- **Reliability**: No network flakiness
- **Simplicity**: No mock server infrastructure
- **Realism**: Real API responses

For questions or issues, see the dev page at `/dev/record-replay` or check the recordings in `fixtures/replicate/`.
