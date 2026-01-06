# SAM Integration Quick Start

## Setup

1. **Get a Replicate API Token**
   - Sign up at https://replicate.com
   - Go to Account Settings > API Tokens
   - Copy your token

2. **Set Environment Variable**
   ```bash
   export REPLICATE_API_TOKEN=r8_your_token_here
   ```

## Basic Usage

```typescript
import { runSAMSegmentation } from '@/lib/sam';
import { readFile } from 'fs/promises';

// Load image
const imageBuffer = await readFile('path/to/image.png');

// Run segmentation with a single point
const result = await runSAMSegmentation({
  imageBuffer,
  points: [
    { x: 150, y: 200, label: 1 } // Click on object
  ],
  imageWidth: 800,
  imageHeight: 600,
});

// Use the mask
const mask = result.masks[0];
console.log('Confidence:', mask.confidence);
console.log('Bounding Box:', mask.boundingBox);
console.log('Area:', mask.area, 'pixels');
console.log('Mask Data:', mask.mask); // Base64 PNG
```

## In a Next.js API Route

```typescript
// app/api/segment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runSAMSegmentation } from '@/lib/sam';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const points = JSON.parse(formData.get('points') as string);

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const result = await runSAMSegmentation({
      imageBuffer,
      points,
      imageWidth: parseInt(formData.get('width') as string),
      imageHeight: parseInt(formData.get('height') as string),
      outputFormat: 'base64png',
      returnMultiple: false,
    });

    return NextResponse.json({
      success: true,
      masks: result.masks,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
```

## Advanced: Multiple Points

```typescript
const result = await runSAMSegmentation({
  imageBuffer,
  points: [
    { x: 100, y: 100, label: 1 }, // Include this area
    { x: 120, y: 110, label: 1 }, // Include this area too
    { x: 50, y: 50, label: 0 },   // Exclude this area
  ],
  imageWidth: 800,
  imageHeight: 600,
  returnMultiple: true, // Get multiple mask options
});

// Get best mask
const bestMask = result.masks.reduce((best, current) =>
  current.confidence > best.confidence ? current : best
);
```

## Output Formats

### Base64 PNG (default)
```typescript
outputFormat: 'base64png'
// Returns: "iVBORw0KGgoAAAANSUhEUgAA..."
```

### RLE (Compact)
```typescript
outputFormat: 'rle'
// Returns: "800,600:1234,567,890,..."
```

### Binary (Raw)
```typescript
outputFormat: 'binary'
// Returns: base64 encoded binary data
```

## Error Handling

```typescript
try {
  const result = await runSAMSegmentation(params);
} catch (error) {
  if (error.message.includes('REPLICATE_API_TOKEN')) {
    // API token not configured
  } else if (error.message.includes('timed out')) {
    // Request took too long
  } else if (error.message.includes('failed')) {
    // API request failed
  }
}
```

## Performance Tips

- **Timeout**: Default 60 seconds max
- **Image Size**: Smaller images process faster
- **Multiple Masks**: Set `returnMultiple: false` for single best mask
- **Format**: Use RLE for smaller payload sizes

## Common Issues

### "REPLICATE_API_TOKEN is not configured"
Set the environment variable or add to `.env.local`:
```bash
REPLICATE_API_TOKEN=r8_your_token_here
```

### "Prediction timed out"
- Image too large (try resizing)
- Replicate service overloaded (retry later)
- Increase MAX_POLL_ATTEMPTS in inference.ts

### "No masks returned"
- Points may be outside image bounds
- Image format not supported
- Try different point coordinates

## Next Steps

- See `example.ts` for more usage patterns
- Read `README.md` for detailed API documentation
- Check Replicate docs: https://replicate.com/meta/sam-2
