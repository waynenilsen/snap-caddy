# SAM 2 Integration Quick Start

## Setup

1. **Get a Replicate API Token**
   - Sign up at https://replicate.com
   - Go to Account Settings > API Tokens
   - Copy your token

2. **Set Environment Variable**
   ```bash
   export REPLICATE_API_TOKEN=r8_your_token_here
   ```

## How SAM 2 Works

Unlike SAM 1 which required point prompts, **SAM 2 automatically detects all objects** in an image and returns them as individual masks. Users then toggle which masks to include.

```
Image → SAM 2 API → All Masks → User Selection → Combined Mask → SVG
```

## Basic Usage

```typescript
import { runSAMSegmentation } from '@/lib/sam';
import { readFile } from 'fs/promises';

// Load image
const imageBuffer = await readFile('path/to/image.png');

// Run segmentation - no points needed!
const result = await runSAMSegmentation({
  imageBuffer,
  imageWidth: 800,
  imageHeight: 600,
});

// Result contains URLs to all detected masks
console.log('Found', result.individualMaskUrls.length, 'objects');
console.log('Combined mask:', result.combinedMaskUrl);

// Each individual mask is a separate image
result.individualMaskUrls.forEach((url, i) => {
  console.log(`Mask ${i}:`, url);
});
```

## In a Next.js API Route

```typescript
// app/api/segment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runSAMSegmentation } from '@/lib/sam';
import { decodeBase64Image } from '@/lib/validation/image';

export async function POST(request: NextRequest) {
  try {
    const { image, imageWidth, imageHeight } = await request.json();

    // Decode base64 image to buffer
    const imageBuffer = decodeBase64Image(image);

    // Run SAM 2 - returns all masks automatically
    const result = await runSAMSegmentation({
      imageBuffer,
      imageWidth,
      imageHeight,
    });

    return NextResponse.json({
      success: true,
      combinedMaskUrl: result.combinedMaskUrl,
      individualMaskUrls: result.individualMaskUrls,
      maskCount: result.individualMaskUrls.length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
```

## Fine-Tuning Parameters

```typescript
const result = await runSAMSegmentation({
  imageBuffer,
  imageWidth: 800,
  imageHeight: 600,

  // Adjust detection sensitivity
  pointsPerSide: 32,         // 16-64, higher = more masks, slower
  predIouThresh: 0.88,       // 0-1, higher = stricter quality filter
  stabilityScoreThresh: 0.95, // 0-1, higher = more stable masks only
  useM2M: true,              // Enable mask refinement
});
```

### Parameter Guide

| Want | Adjust |
|------|--------|
| More objects detected | Lower `pointsPerSide` or `predIouThresh` |
| Fewer, higher quality masks | Raise `predIouThresh` and `stabilityScoreThresh` |
| Faster processing | Lower `pointsPerSide` (e.g., 16) |
| Better mask boundaries | Keep `useM2M: true` |

## Frontend Integration

The Snap Caddy frontend handles mask selection automatically:

1. **SelectStep** calls the API when an image is uploaded
2. **MaskToggleOverlay** displays all masks with distinct colors
3. Users tap/click masks to toggle selection
4. Selected masks are combined and converted to SVG

```typescript
// In your component
import { SelectStep } from '@/components/segmentation';

<SelectStep
  imageUrl={capturedImage}
  onMasksSelected={(selectedMasks) => {
    // selectedMasks is MaskData[] with only user-selected masks
    console.log('User selected', selectedMasks.length, 'masks');
  }}
/>
```

## Error Handling

```typescript
try {
  const result = await runSAMSegmentation(params);
} catch (error) {
  if (error.message.includes('REPLICATE_API_TOKEN')) {
    // API token not configured
    console.error('Set REPLICATE_API_TOKEN environment variable');
  } else if (error.message.includes('timed out')) {
    // Request took too long (>120 seconds)
    console.error('Try a smaller image or retry later');
  } else if (error.message.includes('No individual masks')) {
    // No objects detected
    console.error('No objects found in image');
  }
}
```

## Performance Tips

- **Timeout**: 120 seconds max (SAM 2 can be slow)
- **Image Size**: Smaller images process faster (max 4096x4096)
- **Mask Count**: Expect 10-50 masks per image
- **CDN URLs**: Mask URLs are temporary - process them promptly

## Common Issues

### "REPLICATE_API_TOKEN is not configured"
Set the environment variable or add to `.env.local`:
```bash
REPLICATE_API_TOKEN=r8_your_token_here
```

### "Prediction timed out"
- Image too large (try resizing to under 2000px)
- Replicate service overloaded (retry later)
- Check Replicate status: https://status.replicate.com

### "No individual masks returned"
- Image may not contain distinct objects
- Try adjusting `pointsPerSide` lower (e.g., 16)
- Ensure image has good contrast

### Masks look wrong
- Adjust `predIouThresh` (lower = more permissive)
- Adjust `stabilityScoreThresh` (lower = include less stable masks)
- Check image quality and lighting

## Next Steps

- See `README.md` for detailed API documentation
- Check `inference.ts` for implementation details
- Replicate SAM 2 docs: https://replicate.com/meta/sam-2
