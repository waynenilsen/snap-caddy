# SAM 2 (Segment Anything Model 2) Integration

This directory contains the integration for Meta's Segment Anything Model 2 (SAM 2) using the Replicate API.

## Overview

SAM 2 uses **automatic mask generation** - it detects and returns all object masks in an image without requiring point prompts. Users can then toggle masks on/off in the UI to select which segments to include.

### Key Differences from SAM 1

| Feature | SAM 1 | SAM 2 (Current) |
|---------|-------|-----------------|
| Input | Point prompts (foreground/background) | Image only |
| Output | Single mask based on points | All detected masks |
| User Flow | Click to prompt | Toggle masks on/off |
| API Calls | Multiple (per selection) | Single call |

## Files

- **`types.ts`**: TypeScript type definitions for SAM 2 integration
- **`inference.ts`**: Main implementation with Replicate API integration
- **`index.ts`**: Public API exports

## Configuration

Set the following environment variables:

```bash
# Required: Your Replicate API token
REPLICATE_API_TOKEN=r8_your_token_here

# Optional: SAM model version (default: meta/sam-2)
SAM_MODEL_VERSION=meta/sam-2
```

## Usage

### Basic Example

```typescript
import { runSAMSegmentation } from '@/lib/sam';

const imageBuffer = await readFile('image.png');

const result = await runSAMSegmentation({
  imageBuffer,
  imageWidth: 800,
  imageHeight: 600,
});

console.log('Combined mask URL:', result.combinedMaskUrl);
console.log('Individual masks:', result.individualMaskUrls.length);

// Each URL points to a mask image on Replicate's CDN
for (const maskUrl of result.individualMaskUrls) {
  console.log('Mask:', maskUrl);
}
```

### With Custom Parameters

```typescript
const result = await runSAMSegmentation({
  imageBuffer,
  imageWidth: 800,
  imageHeight: 600,
  // Fine-tune mask generation
  pointsPerSide: 32,        // Grid density for detection (default: 32)
  predIouThresh: 0.88,      // Quality threshold (default: 0.88)
  stabilityScoreThresh: 0.95, // Stability threshold (default: 0.95)
  useM2M: true,             // Mask refinement (default: true)
});
```

## API Reference

### `runSAMSegmentation(params: SAMSegmentationParams): Promise<SAMResult>`

Main function to run SAM 2 automatic mask generation.

**Parameters:**
- `imageBuffer`: Buffer - The image data
- `imageWidth`: number - Image width in pixels
- `imageHeight`: number - Image height in pixels
- `pointsPerSide`: number (optional) - Grid density for automatic point sampling (default: 32)
- `predIouThresh`: number (optional) - Minimum quality threshold for masks (default: 0.88)
- `stabilityScoreThresh`: number (optional) - Minimum stability for mask inclusion (default: 0.95)
- `useM2M`: boolean (optional) - Enable mask-to-mask refinement (default: true)

**Returns:**
```typescript
{
  combinedMaskUrl: string;      // URL to image showing all masks combined
  individualMaskUrls: string[]; // URLs to individual mask images
}
```

### Types

```typescript
interface SAMSegmentationParams {
  imageBuffer: Buffer;
  imageWidth: number;
  imageHeight: number;
  pointsPerSide?: number;
  predIouThresh?: number;
  stabilityScoreThresh?: number;
  useM2M?: boolean;
}

interface SAMResult {
  combinedMaskUrl: string;
  individualMaskUrls: string[];
}
```

## Implementation Details

### Replicate API Integration

1. **Image Upload**: Converts image buffer to base64 data URI
2. **Prediction Creation**: POSTs to Replicate models API (`/v1/models/meta/sam-2/predictions`)
3. **Polling**: Polls prediction status every 1 second (max 120 seconds)
4. **Result Extraction**: Extracts `combined_mask` and `individual_masks` URLs from output

### Frontend Integration

The frontend (`components/segmentation/`) handles mask display and selection:

1. `SelectStep.tsx` - Calls API when image loads, manages mask selection state
2. `MaskToggleOverlay.tsx` - Canvas-based display with click-to-toggle interaction
3. Selected masks are combined using OR operation before SVG generation

### Error Handling

The implementation includes comprehensive error handling:

- **Missing API Token**: Throws descriptive error if `REPLICATE_API_TOKEN` is not set
- **API Failures**: Captures and reports Replicate API errors
- **Timeouts**: Fails gracefully after 120 seconds
- **No Masks**: Throws error if no masks returned

### Logging

All operations are logged using the project's logger:

- Info: Start/completion of segmentation with metrics
- Debug: Prediction creation, polling status, output structure
- Error: Failures with detailed context

## Performance

- **Typical Duration**: 5-30 seconds depending on image size and complexity
- **Timeout**: 120 seconds maximum
- **Poll Interval**: 1 second between status checks
- **Max Masks**: Varies by image (typically 10-50 objects detected)

## SAM 2 Parameters Explained

| Parameter | Default | Effect |
|-----------|---------|--------|
| `points_per_side` | 32 | Higher = more detection points, more masks, slower |
| `pred_iou_thresh` | 0.88 | Higher = stricter quality filter, fewer masks |
| `stability_score_thresh` | 0.95 | Higher = only very stable masks included |
| `use_m2m` | true | Enables mask refinement for better boundaries |

## Error Codes

Common errors you might encounter:

- `REPLICATE_API_TOKEN is not configured`: Set the environment variable
- `Prediction failed`: Check Replicate API status and logs
- `Prediction timed out after 120 attempts`: Image too large or service overloaded
- `No combined mask returned`: API response format issue
- `No individual masks returned`: No objects detected in image

## Dependencies

- `@/lib/env`: Environment configuration
- `@/lib/logger`: Logging utilities
- Replicate API: External service (requires API token)

## Notes

- Mask URLs are temporary (hosted on Replicate's CDN) - download/process them promptly
- The frontend loads all mask images in parallel for fast display
- Masks are binary images (white = object, black = background)
- The `combined_mask` shows all detected objects; `individual_masks` are per-object
