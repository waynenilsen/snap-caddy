# SAM (Segment Anything Model) Integration

This directory contains the integration for Meta's Segment Anything Model (SAM) using the Replicate API.

## Overview

The SAM integration allows you to perform image segmentation by providing point prompts (foreground/background) to generate precise object masks.

## Files

- **`types.ts`**: TypeScript type definitions for SAM integration
- **`inference.ts`**: Main implementation with Replicate API integration
- **`index.ts`**: Public API exports
- **`example.ts`**: Usage examples and patterns

## Configuration

Set the following environment variables:

```bash
# Required: Your Replicate API token
REPLICATE_API_TOKEN=r8_your_token_here

# Optional: SAM model version (default: meta/sam-2-hiera-large)
SAM_MODEL_VERSION=meta/sam-2-hiera-large
```

## Usage

### Basic Example

```typescript
import { runSAMSegmentation } from '@/lib/sam';

const imageBuffer = await readFile('image.png');

const result = await runSAMSegmentation({
  imageBuffer,
  points: [
    { x: 100, y: 100, label: 1 }, // Foreground point
  ],
  imageWidth: 800,
  imageHeight: 600,
  outputFormat: 'base64png',
  returnMultiple: false,
});

console.log('Masks:', result.masks);
```

### Advanced Example with Multiple Points

```typescript
const result = await runSAMSegmentation({
  imageBuffer,
  points: [
    { x: 150, y: 200, label: 1 }, // Foreground
    { x: 160, y: 210, label: 1 }, // Foreground
    { x: 50, y: 50, label: 0 },   // Background
  ],
  imageWidth: 800,
  imageHeight: 600,
  outputFormat: 'rle',
  returnMultiple: true,
});
```

## API Reference

### `runSAMSegmentation(params: SAMSegmentationParams): Promise<SAMResult>`

Main function to run SAM segmentation.

**Parameters:**
- `imageBuffer`: Buffer - The image data
- `points`: Array - Point prompts with x, y coordinates and label (0=background, 1=foreground)
- `imageWidth`: number - Image width in pixels
- `imageHeight`: number - Image height in pixels
- `outputFormat`: 'base64png' | 'rle' | 'binary' - Output format (default: 'base64png')
- `returnMultiple`: boolean - Return multiple mask options (default: false)

**Returns:**
```typescript
{
  masks: Array<{
    mask: string;           // Base64 PNG or RLE encoded
    confidence: number;     // 0-1 score
    boundingBox: {          // Tight bounding box
      x: number;
      y: number;
      width: number;
      height: number;
    };
    area: number;           // Pixel count
  }>
}
```

### Helper Functions

#### `analyzeMask(maskBuffer: Buffer, width: number, height: number): MaskAnalysis`

Analyzes a mask to calculate bounding box and area.

#### `encodeRLE(maskBuffer: Buffer, width: number, height: number): string`

Encodes a mask using Run-Length Encoding for compact representation.

## Implementation Details

### Replicate API Integration

1. **Image Upload**: Converts image buffer to base64 data URI
2. **Prediction Creation**: POSTs to Replicate API with model version and input parameters
3. **Polling**: Polls prediction status every 1 second (max 60 seconds)
4. **Result Processing**: Downloads mask images and processes them
5. **Format Conversion**: Converts masks to requested format (base64png, RLE, or binary)
6. **Analysis**: Calculates bounding box and area for each mask

### Error Handling

The implementation includes comprehensive error handling:

- **Missing API Token**: Throws descriptive error if `REPLICATE_API_TOKEN` is not set
- **API Failures**: Captures and reports Replicate API errors
- **Timeouts**: Fails gracefully after 60 seconds
- **Network Issues**: Handles download failures
- **Invalid Inputs**: Validates parameters before processing

### Logging

All operations are logged using the project's logger:

- Info: Start/completion of segmentation with metrics
- Debug: Prediction creation and polling status
- Error: Failures with detailed context

## Performance

- **Typical Duration**: 2-10 seconds depending on image size and model load
- **Timeout**: 60 seconds maximum
- **Poll Interval**: 1 second between status checks

## Output Formats

### base64png (default)
Base64-encoded PNG image of the mask. Easy to use but larger size.

### rle (Run-Length Encoding)
Compact string representation: `width,height:run1,run2,run3,...`

### binary
Raw binary mask data (still base64-encoded for transport).

## Error Codes

Common errors you might encounter:

- `REPLICATE_API_TOKEN is not configured`: Set the environment variable
- `Prediction failed`: Check Replicate API status and logs
- `Prediction timed out`: Image too large or service overloaded
- `Failed to download mask`: Network issue or invalid URL

## Testing

See `example.ts` for comprehensive usage examples and test patterns.

## Dependencies

- `@/lib/env`: Environment configuration
- `@/lib/logger`: Logging utilities
- `@/types/api`: API type definitions
- Replicate API: External service (requires API token)

## Notes

- The mask analysis functions use heuristics for PNG files. For production use, consider using a proper image processing library like `sharp` or `jimp` for accurate mask analysis.
- RLE encoding is simplified and suitable for binary masks. For complex scenarios, consider more advanced compression.
- Multiple masks are sorted by confidence score when `returnMultiple: true`.
