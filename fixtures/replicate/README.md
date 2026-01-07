# Replicate API Recordings

This directory contains recorded Replicate API responses for use in development and testing.

## Purpose

These recordings enable:
- **Faster development**: No API calls needed during replay mode
- **Cost savings**: Avoid repeated Replicate API charges
- **Deterministic testing**: Consistent responses for predictable tests
- **Offline development**: Work without internet connectivity

## File Format

Each recording is a JSON file named by request hash:

```
{hash}.json
```

The hash is generated from:
- HTTP method
- URL (normalized)
- Request body (with sorted keys for consistency)

## Usage

Set the `REPLICATE_RECORD_MODE` environment variable:

```bash
# Record new responses
REPLICATE_RECORD_MODE=record bun dev

# Replay recorded responses
REPLICATE_RECORD_MODE=replay bun dev

# Normal operation (no recording)
REPLICATE_RECORD_MODE=off bun dev
```

## Managing Recordings

Use the dev page at `/dev/record-replay` (only available when `STAGE=dev`) to:
- View all recordings
- Delete individual recordings
- Clear all recordings

## Adding New Recordings

1. Set `REPLICATE_RECORD_MODE=record`
2. Trigger the API call (e.g., run segmentation)
3. The response is automatically saved here
4. Commit the new recording file

## Notes

- Recordings don't include sensitive headers (like Authorization)
- Only JSON response bodies are recorded
- Files are sorted by timestamp (newest first)

See `/docs/record-replay.md` for comprehensive documentation.
