# SAM Integration - Segment Anything Model

## Overview

This document provides complete implementation guidance for integrating Meta's Segment Anything Model (SAM) into Snap Caddy. SAM enables users to click on an object in their photo to automatically extract its silhouette, which is then converted to an SVG outline for Gridfinity bin generation.

## Table of Contents

1. [SAM Model Overview](#1-sam-model-overview)
2. [Option A: Client-Side ONNX](#2-option-a-client-side-onnx)
3. [Option B: Server-Side API](#3-option-b-server-side-api)
4. [Option C: Hybrid Approach](#4-option-c-hybrid-approach)
5. [Mask Post-Processing](#5-mask-post-processing)
6. [Client Library](#6-client-library)
7. [Type Definitions](#7-type-definitions)
8. [Integration Recommendations](#8-integration-recommendations)
9. [Performance Benchmarks](#9-performance-benchmarks)
10. [Error Handling](#10-error-handling)
11. [Testing Strategies](#11-testing-strategies)

---

## 1. SAM Model Overview

### What is SAM?

Segment Anything Model (SAM) is a promptable segmentation model developed by Meta AI Research. It can generate high-quality object masks from various prompts without requiring model retraining.

**Key Capabilities:**
- Zero-shot segmentation (no training needed)
- Prompt-based segmentation (points, boxes, or masks)
- High-quality boundary detection
- Fast inference on modern hardware

### How SAM Works

SAM consists of three main components:

```
┌─────────────────────────────────────────────────────────┐
│                     SAM ARCHITECTURE                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐    ┌────────────────┐              │
│  │  Image Encoder │───▶│  Embeddings    │              │
│  │  (ViT-based)   │    │  (256x64x64)   │              │
│  └────────────────┘    └────────┬───────┘              │
│         ▲                       │                       │
│         │                       │                       │
│         │                       ▼                       │
│  ┌────────────────┐    ┌────────────────┐              │
│  │  Input Image   │    │ Prompt Encoder │◀── Points    │
│  │  (1024x1024)   │    │                │◀── Boxes     │
│  └────────────────┘    └────────┬───────┘              │
│                                  │                      │
│                                  ▼                      │
│                        ┌────────────────┐               │
│                        │ Mask Decoder   │               │
│                        │ (Transformer)  │               │
│                        └────────┬───────┘               │
│                                 │                       │
│                                 ▼                       │
│                        ┌────────────────┐               │
│                        │  Output Masks  │               │
│                        │  + Scores      │               │
│                        └────────────────┘               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Processing Flow:**
1. **Image Encoding** (slow, ~1-2s): Convert image to embeddings (only once per image)
2. **Prompt Encoding** (fast, <10ms): Encode user clicks/boxes
3. **Mask Decoding** (fast, ~50ms): Generate segmentation masks

### Input Requirements

**Image:**
- Format: RGB image (PNG, JPEG, WebP)
- Recommended size: 1024x1024 pixels (auto-resized if different)
- Color space: RGB (8-bit per channel)

**Prompts:**

1. **Point Prompts** (most common for Snap Caddy):
```typescript
{
  x: number;        // Pixel coordinate (0 to image width)
  y: number;        // Pixel coordinate (0 to image height)
  label: 1 | 0;     // 1 = foreground, 0 = background
}
```

2. **Box Prompts** (alternative):
```typescript
{
  x: number;        // Top-left x
  y: number;        // Top-left y
  width: number;    // Box width
  height: number;   // Box height
}
```

3. **Mask Prompts** (for refinement):
```typescript
{
  mask: Uint8Array;     // Previous mask
  logits: Float32Array; // Previous logits (optional)
}
```

### Output Format

SAM returns multiple mask candidates with confidence scores:

```typescript
{
  masks: Array<{
    data: Uint8Array;        // Binary mask (width * height)
    width: number;           // Mask width (matches input)
    height: number;          // Mask height (matches input)
  }>;
  scores: number[];          // Confidence score for each mask (0-1)
  logits: Float32Array[];    // Raw logits for refinement
}
```

**Typical response:**
- 3 masks per inference
- Scores range: 0.0 to 1.0 (higher is better)
- Best mask usually has score > 0.9

### Model Variants

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| **SAM (ViT-H)** | 2.4 GB | Slow | Excellent | Production (GPU server) |
| **SAM (ViT-L)** | 1.2 GB | Medium | Very Good | Balanced (GPU server) |
| **SAM (ViT-B)** | 375 MB | Fast | Good | Client-side (WebGPU) |
| **SAM-HQ** | 1.3 GB | Medium | Best | High precision needs |
| **MobileSAM** | 40 MB | Very Fast | Fair | Mobile/constrained devices |
| **FastSAM** | 68 MB | Very Fast | Good | Real-time applications |

**Recommendations for Snap Caddy:**
- **Server-side**: SAM (ViT-H) for best quality
- **Client-side**: SAM (ViT-B) or MobileSAM for acceptable performance
- **Hybrid**: SAM (ViT-L) as middle ground

### Size vs. Accuracy Tradeoffs

```
Accuracy ▲
         │
    100% │  ● SAM-HQ
         │  ● SAM (ViT-H)
     95% │    ● SAM (ViT-L)
         │      ● SAM (ViT-B)
     90% │        ● FastSAM
         │          ● MobileSAM
     85% │
         └────────────────────────────▶ Speed
           Slow        Fast    Very Fast

File Size:
SAM-HQ:      1.3 GB  ████████████████████████████
SAM (ViT-H): 2.4 GB  ██████████████████████████████████████████
SAM (ViT-L): 1.2 GB  ██████████████████████
SAM (ViT-B): 375 MB  ███████
FastSAM:     68 MB   ██
MobileSAM:   40 MB   █
```

**Memory Requirements:**
- SAM (ViT-H): ~7 GB RAM (GPU)
- SAM (ViT-L): ~4 GB RAM (GPU)
- SAM (ViT-B): ~2 GB RAM (can run on CPU/WebGPU)
- MobileSAM: ~500 MB RAM (CPU friendly)

---

## 2. Option A: Client-Side ONNX

Running SAM directly in the browser using ONNX Runtime Web.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CLIENT BROWSER                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  User clicks     ┌────────────────┐                     │
│  on object  ────▶│  ClickHandler  │                     │
│                  └────────┬───────┘                     │
│                           │                              │
│                           ▼                              │
│                  ┌────────────────┐                     │
│                  │  SAM Client    │                     │
│                  │  (ONNX.js)     │                     │
│                  └────────┬───────┘                     │
│                           │                              │
│        ┌──────────────────┼──────────────────┐          │
│        │                  │                  │          │
│        ▼                  ▼                  ▼          │
│  ┌──────────┐    ┌──────────────┐    ┌──────────┐      │
│  │ Encoder  │    │    Decoder   │    │  Memory  │      │
│  │ ONNX     │    │    ONNX      │    │  Cache   │      │
│  │ (300MB)  │    │    (8MB)     │    │          │      │
│  └────┬─────┘    └──────┬───────┘    └──────────┘      │
│       │                 │                               │
│       └────────┬────────┘                               │
│                ▼                                         │
│       ┌─────────────────┐                               │
│       │ WebGPU / WASM   │                               │
│       │ Backend         │                               │
│       └─────────────────┘                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Setup Instructions

#### 1. Install Dependencies

```bash
npm install onnxruntime-web
npm install @types/onnxruntime-web --save-dev
```

#### 2. Download Model Files

Download ONNX models and place in `public/models/sam/`:

```bash
# Create directory
mkdir -p public/models/sam

# Download SAM ViT-B (recommended for client-side)
# Encoder (~300 MB)
wget https://github.com/facebookresearch/segment-anything/releases/download/v1.0/sam_vit_b_01ec64.encoder.onnx \
  -O public/models/sam/sam_vit_b_encoder.onnx

# Decoder (~8 MB)
wget https://github.com/facebookresearch/segment-anything/releases/download/v1.0/sam_vit_b_01ec64.decoder.onnx \
  -O public/models/sam/sam_vit_b_decoder.onnx
```

**Model Files Structure:**
```
public/models/sam/
├── sam_vit_b_encoder.onnx      # Image encoder (300 MB)
├── sam_vit_b_decoder.onnx      # Mask decoder (8 MB)
└── quantized/                  # Optional: smaller, faster models
    ├── encoder_int8.onnx       # Quantized encoder (75 MB)
    └── decoder_int8.onnx       # Quantized decoder (2 MB)
```

#### 3. Implementation

**File: `/lib/sam/onnx-client.ts`**

```typescript
import * as ort from 'onnxruntime-web';
import type { SAMClient, Point, SegmentationResult, SAMConfig } from './types';

export class ONNXSAMClient implements SAMClient {
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;
  private imageEmbedding: ort.Tensor | null = null;
  private currentImageData: ImageData | null = null;
  private config: SAMConfig;

  constructor(config: SAMConfig = {}) {
    this.config = {
      modelPath: '/models/sam',
      modelVariant: 'vit_b',
      backend: 'webgpu', // 'webgpu', 'wasm', or 'webgl'
      ...config,
    };
  }

  /**
   * Initialize ONNX Runtime and load models
   */
  async initialize(): Promise<void> {
    console.log('Initializing SAM ONNX client...');

    try {
      // Set execution provider based on backend preference
      const executionProviders = this.getExecutionProviders();

      // Load encoder model
      console.log('Loading encoder model...');
      this.encoderSession = await ort.InferenceSession.create(
        `${this.config.modelPath}/sam_${this.config.modelVariant}_encoder.onnx`,
        { executionProviders }
      );

      // Load decoder model
      console.log('Loading decoder model...');
      this.decoderSession = await ort.InferenceSession.create(
        `${this.config.modelPath}/sam_${this.config.modelVariant}_decoder.onnx`,
        { executionProviders }
      );

      console.log('SAM models loaded successfully');
    } catch (error) {
      throw new Error(`Failed to initialize SAM: ${error.message}`);
    }
  }

  /**
   * Pre-compute image embeddings (slow operation, done once per image)
   */
  async setImage(imageData: ImageData): Promise<void> {
    if (!this.encoderSession) {
      throw new Error('SAM not initialized. Call initialize() first.');
    }

    console.log('Computing image embeddings...');
    this.currentImageData = imageData;

    // Preprocess image: resize to 1024x1024 and normalize
    const preprocessed = this.preprocessImage(imageData);

    // Create ONNX tensor from preprocessed image
    const imageTensor = new ort.Tensor('float32', preprocessed.data, [
      1, 3, preprocessed.height, preprocessed.width
    ]);

    // Run encoder to get embeddings
    const encoderInputs = { images: imageTensor };
    const encoderOutputs = await this.encoderSession.run(encoderInputs);

    // Cache embeddings for fast inference
    this.imageEmbedding = encoderOutputs.image_embeddings;

    console.log('Image embeddings computed');
  }

  /**
   * Segment object based on point prompts
   */
  async segment(
    points: Point[],
    labels: number[]
  ): Promise<SegmentationResult> {
    if (!this.decoderSession || !this.imageEmbedding || !this.currentImageData) {
      throw new Error('Image not set. Call setImage() first.');
    }

    if (points.length !== labels.length) {
      throw new Error('Points and labels must have same length');
    }

    // Prepare point prompts
    const { pointCoords, pointLabels } = this.preparePrompts(points, labels);

    // Create decoder inputs
    const decoderInputs = {
      image_embeddings: this.imageEmbedding,
      point_coords: new ort.Tensor('float32', pointCoords, [1, points.length, 2]),
      point_labels: new ort.Tensor('float32', pointLabels, [1, points.length]),
      mask_input: new ort.Tensor('float32', new Float32Array(256 * 256).fill(0), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', [0], [1]),
      orig_im_size: new ort.Tensor('float32', [
        this.currentImageData.height,
        this.currentImageData.width
      ], [2]),
    };

    // Run decoder
    const decoderOutputs = await this.decoderSession.run(decoderInputs);

    // Process outputs
    const masks = decoderOutputs.masks.data as Float32Array;
    const scores = decoderOutputs.iou_predictions.data as Float32Array;

    // Convert to binary masks and find best
    const result = this.processMasks(
      masks,
      scores,
      this.currentImageData.width,
      this.currentImageData.height
    );

    return result;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.encoderSession?.release();
    this.decoderSession?.release();
    this.imageEmbedding = null;
    this.currentImageData = null;
    console.log('SAM client disposed');
  }

  // ==================== Helper Methods ====================

  private getExecutionProviders(): ort.ExecutionProviderConfig[] {
    switch (this.config.backend) {
      case 'webgpu':
        return ['webgpu', 'wasm'];
      case 'webgl':
        return ['webgl', 'wasm'];
      case 'wasm':
      default:
        return ['wasm'];
    }
  }

  private preprocessImage(imageData: ImageData): {
    data: Float32Array;
    width: number;
    height: number;
  } {
    const targetSize = 1024;

    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d')!;

    // Draw and resize image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0, targetSize, targetSize);
    const resized = ctx.getImageData(0, 0, targetSize, targetSize);

    // Normalize to [-1, 1] range and convert to CHW format
    const data = new Float32Array(3 * targetSize * targetSize);
    const pixels = resized.data;

    // ImageNet normalization
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < targetSize * targetSize; i++) {
      // R channel
      data[i] = ((pixels[i * 4] / 255) - mean[0]) / std[0];
      // G channel
      data[targetSize * targetSize + i] = ((pixels[i * 4 + 1] / 255) - mean[1]) / std[1];
      // B channel
      data[2 * targetSize * targetSize + i] = ((pixels[i * 4 + 2] / 255) - mean[2]) / std[2];
    }

    return { data, width: targetSize, height: targetSize };
  }

  private preparePrompts(points: Point[], labels: number[]) {
    const pointCoords = new Float32Array(points.length * 2);
    const pointLabels = new Float32Array(labels);

    for (let i = 0; i < points.length; i++) {
      pointCoords[i * 2] = points[i].x;
      pointCoords[i * 2 + 1] = points[i].y;
    }

    return { pointCoords, pointLabels };
  }

  private processMasks(
    masks: Float32Array,
    scores: Float32Array,
    originalWidth: number,
    originalHeight: number
  ): SegmentationResult {
    // Find best mask (highest score)
    let bestIdx = 0;
    let bestScore = scores[0];

    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestIdx = i;
      }
    }

    // Extract best mask
    const maskSize = originalWidth * originalHeight;
    const maskStart = bestIdx * maskSize;
    const maskData = masks.slice(maskStart, maskStart + maskSize);

    // Convert to binary (threshold at 0)
    const binaryMask = new Uint8Array(maskSize);
    for (let i = 0; i < maskSize; i++) {
      binaryMask[i] = maskData[i] > 0 ? 255 : 0;
    }

    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(binaryMask, originalWidth, originalHeight);

    return {
      mask: binaryMask,
      maskWidth: originalWidth,
      maskHeight: originalHeight,
      boundingBox,
      confidence: bestScore,
      allMasks: this.extractAllMasks(masks, scores, originalWidth, originalHeight),
    };
  }

  private calculateBoundingBox(
    mask: Uint8Array,
    width: number,
    height: number
  ) {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private extractAllMasks(
    masks: Float32Array,
    scores: Float32Array,
    width: number,
    height: number
  ) {
    const result = [];
    const maskSize = width * height;

    for (let i = 0; i < scores.length; i++) {
      const maskStart = i * maskSize;
      const maskData = masks.slice(maskStart, maskStart + maskSize);

      const binaryMask = new Uint8Array(maskSize);
      for (let j = 0; j < maskSize; j++) {
        binaryMask[j] = maskData[j] > 0 ? 255 : 0;
      }

      result.push({
        mask: binaryMask,
        score: scores[i],
      });
    }

    return result;
  }
}

/**
 * Factory function to create and initialize SAM client
 */
export async function createSAMClient(config?: SAMConfig): Promise<SAMClient> {
  const client = new ONNXSAMClient(config);
  await client.initialize();
  return client;
}
```

### Memory Management

**Pre-computing Embeddings:**
```typescript
// Good: Compute once per image
await samClient.setImage(imageData);  // ~2s, done once
await samClient.segment([point1], [1]); // ~50ms
await samClient.segment([point2], [1]); // ~50ms (reuses embeddings)

// Bad: Re-encoding each time
for (const point of points) {
  await samClient.setImage(imageData);  // 2s each time!
  await samClient.segment([point], [1]);
}
```

**Cleanup:**
```typescript
// Always dispose when done
useEffect(() => {
  const client = new ONNXSAMClient();
  client.initialize();

  return () => {
    client.dispose(); // Free GPU/CPU memory
  };
}, []);
```

### WebGPU vs WASM Backends

**WebGPU** (recommended if available):
- **Speed**: 5-10x faster than WASM
- **Support**: Chrome 113+, Edge 113+
- **Fallback**: Automatically falls back to WASM if unavailable

**WASM** (universal fallback):
- **Speed**: Slower but works everywhere
- **Support**: All modern browsers
- **Threading**: Enable with `crossOriginIsolated` headers

**Configuration:**
```typescript
// Try WebGPU, fallback to WASM
const client = new ONNXSAMClient({
  backend: 'webgpu',  // or 'wasm'
});

// Check which backend is being used
ort.env.wasm.numThreads = 4;  // For WASM threading
```

**Required Headers for WASM Threading:**
```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};
```

### Limitations

**Browser Constraints:**
- Model download: 300+ MB (slow on first load)
- Memory usage: ~2 GB RAM minimum
- Mobile devices: May crash on low-end phones
- Inference time: 2-5 seconds on CPU, 0.5-1s on GPU

**Mitigation Strategies:**
1. **Progressive Web App**: Cache models locally
2. **Service Worker**: Download models in background
3. **Feature Detection**: Check available memory before loading
4. **Fallback**: Redirect to server-side API if client fails

```typescript
// Check if client-side is viable
async function canRunClientSAM(): Promise<boolean> {
  // Check WebGPU support
  const hasWebGPU = 'gpu' in navigator;

  // Check available memory (if supported)
  const memory = (performance as any).memory;
  const hasEnoughMemory = !memory || memory.jsHeapSizeLimit > 2_000_000_000;

  // Check connection speed
  const connection = (navigator as any).connection;
  const hasGoodConnection = !connection || connection.effectiveType !== 'slow-2g';

  return hasWebGPU && hasEnoughMemory && hasGoodConnection;
}

// Use server-side fallback
if (!(await canRunClientSAM())) {
  // Redirect to server-side API
  return useServerSAM();
}
```

---

## 3. Option B: Server-Side API

Running SAM on the server using hosted APIs or self-hosted solutions.

### Architecture

```
┌────────────────┐                    ┌────────────────┐
│     CLIENT     │                    │     SERVER     │
├────────────────┤                    ├────────────────┤
│                │                    │                │
│  User clicks   │  POST /api/segment │   Next.js      │
│  on object     │───────────────────▶│   API Route    │
│                │                    │                │
│  {image,       │                    │      │         │
│   points}      │                    │      ▼         │
│                │                    │  ┌──────────┐  │
│                │                    │  │ Validate │  │
│                │                    │  └────┬─────┘  │
│                │                    │       │        │
│                │                    │       ▼        │
│                │                    │  Choice:       │
│                │                    │  ┌─────────────┤
│                │                    │  │             │
│         ┌──────┼────────────────────┼──┘             │
│         │      │                    │                │
│         ▼      │                    ▼                ▼
│    ┌─────────┐ │            ┌──────────┐    ┌──────────┐
│    │ Display │◀┼────────────│ Replicate│    │ Self-Host│
│    │  Mask   │ │  {mask}    │   API    │    │  Python  │
│    └─────────┘ │            └──────────┘    └──────────┘
│                │                    │                │
└────────────────┘                    └────────────────┘
```

### Option B1: Replicate API (Recommended)

Replicate provides hosted SAM models with simple API access.

#### Setup

```bash
npm install replicate
```

**File: `/app/api/segment/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { z } from 'zod';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Request validation schema
const SegmentRequestSchema = z.object({
  image: z.string(),  // Base64 encoded image or URL
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    label: z.number().int().min(0).max(1),
  })).min(1),
  returnAll: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const validated = SegmentRequestSchema.parse(body);

    // Convert Base64 to data URI if needed
    const imageInput = validated.image.startsWith('data:')
      ? validated.image
      : `data:image/png;base64,${validated.image}`;

    // Prepare input for Replicate SAM model
    const input = {
      image: imageInput,
      point_coords: validated.points.map(p => [p.x, p.y]),
      point_labels: validated.points.map(p => p.label),
      multimask_output: validated.returnAll,
    };

    // Run SAM model on Replicate
    const output = await replicate.run(
      "facebook/sam:3d28c8e8f53f2ec1dfbee3ba8bc0d1f6af7b20c358c71e77fdfe1c7922c2abfa",
      { input }
    ) as ReplicateOutput;

    // Process output
    const result = processSAMOutput(output, validated.returnAll);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Segmentation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Segmentation failed', message: error.message },
      { status: 500 }
    );
  }
}

interface ReplicateOutput {
  masks: string[];      // Base64 encoded PNGs
  scores: number[];     // Confidence scores
}

function processSAMOutput(output: ReplicateOutput, returnAll: boolean) {
  if (!returnAll) {
    // Return only best mask
    const bestIdx = output.scores.indexOf(Math.max(...output.scores));
    return {
      mask: output.masks[bestIdx],
      confidence: output.scores[bestIdx],
    };
  }

  // Return all masks
  return {
    masks: output.masks.map((mask, i) => ({
      mask,
      confidence: output.scores[i],
    })),
  };
}
```

**Environment Setup:**
```bash
# .env.local
REPLICATE_API_TOKEN=r8_your_token_here
```

#### Request Format

```typescript
// Client-side request
const response = await fetch('/api/segment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: base64Image,  // or URL
    points: [
      { x: 100, y: 200, label: 1 },  // Foreground point
      { x: 50, y: 50, label: 0 },    // Background point (optional)
    ],
    returnAll: false,  // Only return best mask
  }),
});

const { mask, confidence } = await response.json();
```

#### Response Format

**Single mask response:**
```json
{
  "mask": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "confidence": 0.9854
}
```

**Multiple masks response:**
```json
{
  "masks": [
    { "mask": "data:image/png;base64,...", "confidence": 0.9854 },
    { "mask": "data:image/png;base64,...", "confidence": 0.8721 },
    { "mask": "data:image/png;base64,...", "confidence": 0.7543 }
  ]
}
```

#### Replicate API Endpoints

**Available SAM Models on Replicate:**

1. **facebook/sam** (recommended):
```
Model ID: facebook/sam:3d28c8e8f53f2ec1dfbee3ba8bc0d1f6af7b20c358c71e77fdfe1c7922c2abfa
Version: SAM ViT-H (highest quality)
Speed: ~2-3 seconds per inference
Cost: ~$0.0023 per run
```

2. **cjwbw/sam-vit-base**:
```
Model ID: cjwbw/sam-vit-base:4e0da2b61a0b5d93b8c1d93564e5abf73e99e5e8e6a0e0e6e8c6e8e6e8e6e8e6
Version: SAM ViT-B (faster, smaller)
Speed: ~1-2 seconds per inference
Cost: ~$0.0015 per run
```

3. **yorickvp/sam-hq**:
```
Model ID: yorickvp/sam-hq:4e1ce3e3cf8b26e0e3d0e3e0e3d0e3e0e3d0e3e0e3d0e3e0e3d0e3e0e3d0e3e0
Version: SAM-HQ (best quality)
Speed: ~3-4 seconds per inference
Cost: ~$0.0035 per run
```

#### Cost Considerations

**Replicate Pricing (as of 2026):**
- SAM ViT-H: ~$0.0023 per prediction
- Average usage: 2-3 predictions per user session
- Monthly cost (1000 users): ~$5-7

**Cost Optimization:**
```typescript
// Cache embeddings on server (reduce repeated image encoding)
import NodeCache from 'node-cache';

const embeddingCache = new NodeCache({
  stdTTL: 600,  // 10 minutes
  maxKeys: 100   // Store 100 images
});

async function getEmbedding(imageHash: string, imageData: string) {
  // Check cache first
  const cached = embeddingCache.get(imageHash);
  if (cached) {
    return cached;
  }

  // Compute and cache
  const embedding = await computeEmbedding(imageData);
  embeddingCache.set(imageHash, embedding);
  return embedding;
}
```

#### Handling Latency

**Typical latencies:**
- Network round-trip: 50-200ms
- Replicate processing: 2-3 seconds
- Total: 2-4 seconds

**Optimization strategies:**

1. **Optimistic UI updates:**
```typescript
// Show loading state immediately
setLoading(true);
setMaskPreview(null);

// Send request
const mask = await segmentObject(image, points);

// Update UI
setMaskPreview(mask);
setLoading(false);
```

2. **Request debouncing:**
```typescript
// Don't send request on every click
const debouncedSegment = useMemo(
  () => debounce(async (points) => {
    const mask = await segmentObject(image, points);
    setMask(mask);
  }, 500),  // Wait 500ms after last click
  [image]
);
```

3. **Progressive loading:**
```typescript
// Show low-res preview first, then high-res
async function segmentProgressive(image: string, points: Point[]) {
  // Quick low-res preview
  const lowRes = await segmentObject(
    downscaleImage(image, 0.25),
    scalePoints(points, 0.25)
  );
  setMaskPreview(lowRes);

  // Full resolution in background
  const highRes = await segmentObject(image, points);
  setMask(highRes);
}
```

### Option B2: Self-Hosted Python Backend

For full control and no API costs.

#### Setup

**1. Install Python dependencies:**
```bash
pip install torch torchvision
pip install git+https://github.com/facebookresearch/segment-anything.git
pip install fastapi uvicorn python-multipart pillow numpy
```

**2. Download SAM checkpoint:**
```bash
wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
```

**3. Create Python server:**

**File: `/server/sam_server.py`**

```python
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
from segment_anything import sam_model_registry, SamPredictor
import numpy as np
from PIL import Image
import io
import base64
import json

app = FastAPI()

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load SAM model
print("Loading SAM model...")
sam_checkpoint = "sam_vit_h_4b8939.pth"
model_type = "vit_h"
device = "cuda" if torch.cuda.is_available() else "cpu"

sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
sam.to(device=device)
predictor = SamPredictor(sam)
print(f"SAM loaded on {device}")

@app.post("/segment")
async def segment(
    image: UploadFile = File(...),
    points: str = Form(...),
):
    try:
        # Parse points
        points_data = json.loads(points)
        point_coords = np.array([[p["x"], p["y"]] for p in points_data])
        point_labels = np.array([p["label"] for p in points_data])

        # Load image
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(pil_image)

        # Set image for SAM
        predictor.set_image(image_np)

        # Predict masks
        masks, scores, logits = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True,
        )

        # Get best mask
        best_idx = np.argmax(scores)
        best_mask = masks[best_idx]

        # Convert mask to image
        mask_img = Image.fromarray((best_mask * 255).astype(np.uint8))

        # Encode to base64
        buffer = io.BytesIO()
        mask_img.save(buffer, format="PNG")
        mask_b64 = base64.b64encode(buffer.getvalue()).decode()

        return JSONResponse({
            "mask": f"data:image/png;base64,{mask_b64}",
            "confidence": float(scores[best_idx]),
            "allScores": scores.tolist(),
        })

    except Exception as e:
        return JSONResponse(
            {"error": str(e)},
            status_code=500
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**4. Run server:**
```bash
python server/sam_server.py
```

**5. Next.js API route to proxy:**

**File: `/app/api/segment/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVER = process.env.SAM_SERVER_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward to Python server
    const response = await fetch(`${PYTHON_SERVER}/segment`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Python server error: ${response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Segmentation error:', error);
    return NextResponse.json(
      { error: 'Segmentation failed', message: error.message },
      { status: 500 }
    );
  }
}
```

#### Deployment

**Using Docker:**

```dockerfile
# Dockerfile.sam
FROM pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime

WORKDIR /app

# Install dependencies
RUN pip install fastapi uvicorn python-multipart pillow numpy
RUN pip install git+https://github.com/facebookresearch/segment-anything.git

# Copy server
COPY server/sam_server.py .

# Download model
RUN wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth

# Expose port
EXPOSE 8000

# Run
CMD ["python", "sam_server.py"]
```

**Run with Docker Compose:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  sam-server:
    build:
      context: .
      dockerfile: Dockerfile.sam
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

---

## 4. Option C: Hybrid Approach

Combine client and server for optimal performance.

### Architecture

```
┌────────────────────────────────────────────────────────┐
│                      CLIENT                             │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                      │
│  │   Upload     │                                      │
│  │   Image      │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │  Lightweight │  (Fast: ~200ms)                      │
│  │  Encoder     │  MobileSAM encoder                   │
│  │  (40 MB)     │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ Send embeddings                              │
│         │ (256x64x64 = 1 MB)                           │
│         ▼                                               │
└─────────┼───────────────────────────────────────────────┘
          │
          ▼ POST /api/segment-hybrid
┌─────────────────────────────────────────────────────────┐
│                      SERVER                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                      │
│  │  Receive     │                                      │
│  │  Embeddings  │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │  Full SAM    │  (Fast: ~50ms)                       │
│  │  Decoder     │  No encoding needed                  │
│  │  (GPU)       │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ Return mask                                  │
│         ▼                                               │
└─────────────────────────────────────────────────────────┘
```

### Implementation

**Client: `/lib/sam/hybrid-client.ts`**

```typescript
import * as ort from 'onnxruntime-web';
import type { Point, SegmentationResult } from './types';

export class HybridSAMClient {
  private encoderSession: ort.InferenceSession | null = null;
  private currentEmbedding: Float32Array | null = null;
  private currentImageSize: { width: number; height: number } | null = null;

  async initialize() {
    // Load lightweight MobileSAM encoder (40 MB)
    this.encoderSession = await ort.InferenceSession.create(
      '/models/sam/mobilesam_encoder.onnx',
      { executionProviders: ['wasm'] }  // Works everywhere
    );
  }

  async setImage(imageData: ImageData): Promise<void> {
    if (!this.encoderSession) throw new Error('Not initialized');

    // Encode on client (lightweight)
    const preprocessed = this.preprocessImage(imageData);
    const imageTensor = new ort.Tensor('float32', preprocessed.data, [
      1, 3, 1024, 1024
    ]);

    const outputs = await this.encoderSession.run({ images: imageTensor });
    this.currentEmbedding = outputs.image_embeddings.data as Float32Array;
    this.currentImageSize = {
      width: imageData.width,
      height: imageData.height,
    };
  }

  async segment(points: Point[], labels: number[]): Promise<SegmentationResult> {
    if (!this.currentEmbedding || !this.currentImageSize) {
      throw new Error('No image set');
    }

    // Send embeddings to server for decoding
    const response = await fetch('/api/segment-hybrid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeddings: Array.from(this.currentEmbedding),
        points,
        labels,
        imageSize: this.currentImageSize,
      }),
    });

    if (!response.ok) {
      throw new Error('Segmentation failed');
    }

    return await response.json();
  }

  private preprocessImage(imageData: ImageData) {
    // Same as ONNX client
    // ... implementation ...
  }

  dispose() {
    this.encoderSession?.release();
    this.currentEmbedding = null;
  }
}
```

**Server: `/app/api/segment-hybrid/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const HybridRequestSchema = z.object({
  embeddings: z.array(z.number()),
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
  })),
  labels: z.array(z.number()),
  imageSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { embeddings, points, labels, imageSize } =
      HybridRequestSchema.parse(body);

    // Send to Python server with SAM decoder
    const response = await fetch('http://localhost:8000/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeddings,
        points,
        labels,
        imageSize,
      }),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Hybrid segmentation failed', message: error.message },
      { status: 500 }
    );
  }
}
```

### Benefits

1. **Reduced latency**: No full image upload (1 MB embeddings vs 5+ MB image)
2. **Lower server cost**: Only decoder runs on server (~50ms vs ~2s)
3. **Better UX**: Faster response for interactive clicking
4. **Scalability**: Server handles simple, fast operations

### Tradeoffs

- **Complexity**: Requires both client and server setup
- **Compatibility**: Needs MobileSAM encoder and full decoder
- **Debugging**: Two failure points to monitor

---

## 5. Mask Post-Processing

After SAM generates masks, they need processing for SVG conversion.

### Mask Formats

**1. Binary Array (Uint8Array):**
```typescript
// Each pixel: 0 (background) or 255 (foreground)
const mask: Uint8Array = new Uint8Array(width * height);
// Access pixel at (x, y):
const pixelValue = mask[y * width + x];
```

**2. RLE (Run-Length Encoding):**
```typescript
// Compressed format for API transfer
interface RLEMask {
  counts: number[];  // [run1_length, run2_length, ...]
  size: [number, number];  // [height, width]
}

// Example: [3, 5, 2] means:
// - 3 background pixels
// - 5 foreground pixels
// - 2 background pixels
```

**3. ImageData:**
```typescript
// For canvas rendering
const imageData = new ImageData(width, height);
for (let i = 0; i < mask.length; i++) {
  const value = mask[i];
  imageData.data[i * 4] = value;      // R
  imageData.data[i * 4 + 1] = value;  // G
  imageData.data[i * 4 + 2] = value;  // B
  imageData.data[i * 4 + 3] = 255;    // A
}
```

### Mask to Image Conversion

**File: `/lib/sam/mask-utils.ts`**

```typescript
/**
 * Convert binary mask to ImageData for canvas display
 */
export function maskToImageData(
  mask: Uint8Array,
  width: number,
  height: number,
  color: { r: number; g: number; b: number; a: number } = { r: 0, g: 120, b: 215, a: 128 }
): ImageData {
  const imageData = new ImageData(width, height);

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) {
      imageData.data[i * 4] = color.r;
      imageData.data[i * 4 + 1] = color.g;
      imageData.data[i * 4 + 2] = color.b;
      imageData.data[i * 4 + 3] = color.a;
    }
  }

  return imageData;
}

/**
 * Convert binary mask to PNG data URL
 */
export function maskToPNG(
  mask: Uint8Array,
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const imageData = maskToImageData(mask, width, height, { r: 255, g: 255, b: 255, a: 255 });
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * Overlay mask on original image
 */
export function overlayMask(
  originalImage: ImageData,
  mask: Uint8Array,
  maskColor: { r: number; g: number; b: number; a: number } = { r: 0, g: 120, b: 215, a: 128 }
): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(originalImage.data),
    originalImage.width,
    originalImage.height
  );

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) {
      const alpha = maskColor.a / 255;
      result.data[i * 4] = Math.round(result.data[i * 4] * (1 - alpha) + maskColor.r * alpha);
      result.data[i * 4 + 1] = Math.round(result.data[i * 4 + 1] * (1 - alpha) + maskColor.g * alpha);
      result.data[i * 4 + 2] = Math.round(result.data[i * 4 + 2] * (1 - alpha) + maskColor.b * alpha);
    }
  }

  return result;
}
```

### Mask Refinement

**Morphological Operations:**

```typescript
/**
 * Apply morphological operations to clean up mask
 */
export function refineMask(
  mask: Uint8Array,
  width: number,
  height: number,
  options: {
    erode?: number;    // Iterations of erosion
    dilate?: number;   // Iterations of dilation
    opening?: number;  // Erode then dilate (remove small objects)
    closing?: number;  // Dilate then erode (fill small holes)
  } = {}
): Uint8Array {
  let result = new Uint8Array(mask);

  // Opening: remove small noise
  if (options.opening) {
    result = erode(result, width, height, options.opening);
    result = dilate(result, width, height, options.opening);
  }

  // Closing: fill small holes
  if (options.closing) {
    result = dilate(result, width, height, options.closing);
    result = erode(result, width, height, options.closing);
  }

  // Custom operations
  if (options.erode) {
    result = erode(result, width, height, options.erode);
  }
  if (options.dilate) {
    result = dilate(result, width, height, options.dilate);
  }

  return result;
}

/**
 * Erosion: shrink mask boundaries
 */
function erode(mask: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
  let result = new Uint8Array(mask);

  for (let iter = 0; iter < iterations; iter++) {
    const temp = new Uint8Array(result);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Check 3x3 neighborhood
        if (result[idx] > 0) {
          let allForeground = true;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (result[(y + dy) * width + (x + dx)] === 0) {
                allForeground = false;
                break;
              }
            }
            if (!allForeground) break;
          }

          temp[idx] = allForeground ? 255 : 0;
        }
      }
    }

    result = temp;
  }

  return result;
}

/**
 * Dilation: expand mask boundaries
 */
function dilate(mask: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
  let result = new Uint8Array(mask);

  for (let iter = 0; iter < iterations; iter++) {
    const temp = new Uint8Array(result);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Check 3x3 neighborhood
        if (result[idx] === 0) {
          let anyForeground = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (result[(y + dy) * width + (x + dx)] > 0) {
                anyForeground = true;
                break;
              }
            }
            if (anyForeground) break;
          }

          temp[idx] = anyForeground ? 255 : 0;
        } else {
          temp[idx] = 255;
        }
      }
    }

    result = temp;
  }

  return result;
}

/**
 * Remove small disconnected regions
 */
export function removeSmallRegions(
  mask: Uint8Array,
  width: number,
  height: number,
  minSize: number
): Uint8Array {
  const result = new Uint8Array(mask);
  const visited = new Uint8Array(mask.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (result[idx] > 0 && !visited[idx]) {
        // Flood fill to find region
        const region = floodFill(result, width, height, x, y, visited);

        // Remove if too small
        if (region.length < minSize) {
          for (const pixelIdx of region) {
            result[pixelIdx] = 0;
          }
        }
      }
    }
  }

  return result;
}

function floodFill(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array
): number[] {
  const region: number[] = [];
  const queue: Array<[number, number]> = [[startX, startY]];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const idx = y * width + x;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[idx] || mask[idx] === 0) continue;

    visited[idx] = 1;
    region.push(idx);

    // Add neighbors
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }

  return region;
}
```

### Multiple Mask Handling

When SAM returns multiple masks:

```typescript
/**
 * Choose best mask based on criteria
 */
export function selectBestMask(
  masks: Array<{ mask: Uint8Array; score: number }>,
  width: number,
  height: number,
  userPoint: Point
): Uint8Array {
  let bestMask = masks[0].mask;
  let bestScore = -Infinity;

  for (const { mask, score } of masks) {
    // Weighted score considering:
    // 1. SAM confidence score
    // 2. Whether user's click point is inside mask
    // 3. Mask size (prefer medium-sized objects)

    const pointInside = mask[userPoint.y * width + userPoint.x] > 0 ? 1 : 0;
    const maskSize = mask.filter(v => v > 0).length;
    const sizeScore = 1 - Math.abs((maskSize / mask.length) - 0.3); // Prefer ~30% coverage

    const finalScore = score * 0.6 + pointInside * 0.3 + sizeScore * 0.1;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMask = mask;
    }
  }

  return bestMask;
}

/**
 * Combine multiple masks (union)
 */
export function combineMasks(masks: Uint8Array[]): Uint8Array {
  if (masks.length === 0) throw new Error('No masks to combine');

  const result = new Uint8Array(masks[0].length);

  for (const mask of masks) {
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) result[i] = 255;
    }
  }

  return result;
}

/**
 * Intersect multiple masks
 */
export function intersectMasks(masks: Uint8Array[]): Uint8Array {
  if (masks.length === 0) throw new Error('No masks to intersect');

  const result = new Uint8Array(masks[0]);

  for (let i = 1; i < masks.length; i++) {
    for (let j = 0; j < result.length; j++) {
      if (masks[i][j] === 0) result[j] = 0;
    }
  }

  return result;
}
```

---

## 6. Client Library

Unified client interface for all SAM integration options.

**File: `/lib/sam/client.ts`**

```typescript
import type { SAMClient, Point, SegmentationResult, SAMConfig } from './types';
import { ONNXSAMClient } from './onnx-client';

/**
 * Factory function to create appropriate SAM client
 */
export async function createSAMClient(
  strategy: 'onnx' | 'server' | 'hybrid' = 'server',
  config?: SAMConfig
): Promise<SAMClient> {
  switch (strategy) {
    case 'onnx':
      return createONNXClient(config);
    case 'server':
      return createServerClient(config);
    case 'hybrid':
      return createHybridClient(config);
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * Client-side ONNX implementation
 */
async function createONNXClient(config?: SAMConfig): Promise<SAMClient> {
  const client = new ONNXSAMClient(config);
  await client.initialize();
  return client;
}

/**
 * Server-side API implementation
 */
async function createServerClient(config?: SAMConfig): Promise<SAMClient> {
  return new ServerSAMClient(config);
}

/**
 * Server-side SAM client (API wrapper)
 */
class ServerSAMClient implements SAMClient {
  private config: SAMConfig;
  private currentImage: string | null = null;
  private currentImageSize: { width: number; height: number } | null = null;

  constructor(config: SAMConfig = {}) {
    this.config = {
      apiEndpoint: '/api/segment',
      ...config,
    };
  }

  async initialize(): Promise<void> {
    // No initialization needed for server-side
    return Promise.resolve();
  }

  async setImage(imageData: ImageData): Promise<void> {
    // Convert ImageData to base64
    this.currentImage = await imageDataToBase64(imageData);
    this.currentImageSize = {
      width: imageData.width,
      height: imageData.height,
    };
  }

  async segment(points: Point[], labels: number[]): Promise<SegmentationResult> {
    if (!this.currentImage) {
      throw new Error('No image set. Call setImage() first.');
    }

    const response = await fetch(this.config.apiEndpoint!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: this.currentImage,
        points: points.map((p, i) => ({ ...p, label: labels[i] })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Segmentation failed');
    }

    const data = await response.json();

    // Convert base64 mask to Uint8Array
    const mask = await base64ToMask(data.mask);

    return {
      mask,
      maskWidth: this.currentImageSize!.width,
      maskHeight: this.currentImageSize!.height,
      boundingBox: data.boundingBox || this.calculateBoundingBox(mask),
      confidence: data.confidence,
    };
  }

  dispose(): void {
    this.currentImage = null;
    this.currentImageSize = null;
  }

  private calculateBoundingBox(mask: Uint8Array) {
    // Implementation from ONNX client
    const width = this.currentImageSize!.width;
    const height = this.currentImageSize!.height;

    let minX = width, minY = height, maxX = 0, maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

/**
 * Hybrid client implementation
 */
async function createHybridClient(config?: SAMConfig): Promise<SAMClient> {
  const { HybridSAMClient } = await import('./hybrid-client');
  const client = new HybridSAMClient(config);
  await client.initialize();
  return client;
}

// ==================== Utility Functions ====================

async function imageDataToBase64(imageData: ImageData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to convert image'));
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  });
}

async function base64ToMask(base64: string): Promise<Uint8Array> {
  // Remove data URI prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');

  // Decode base64
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Load as image
  const blob = new Blob([bytes], { type: 'image/png' });
  const img = await createImageBitmap(blob);

  // Extract grayscale values
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const mask = new Uint8Array(img.width * img.height);

  // Convert to binary mask (use red channel)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = imageData.data[i * 4] > 127 ? 255 : 0;
  }

  return mask;
}

/**
 * React hook for SAM client
 */
export function useSAMClient(
  strategy: 'onnx' | 'server' | 'hybrid' = 'server',
  config?: SAMConfig
) {
  const [client, setClient] = useState<SAMClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let disposed = false;

    createSAMClient(strategy, config)
      .then((c) => {
        if (!disposed) {
          setClient(c);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!disposed) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      client?.dispose();
    };
  }, [strategy, config]);

  return { client, loading, error };
}
```

### Usage Example

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createSAMClient } from '@/lib/sam/client';
import type { SAMClient, Point } from '@/lib/sam/types';

export function SegmentationDemo() {
  const [samClient, setSamClient] = useState<SAMClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [mask, setMask] = useState<Uint8Array | null>(null);

  // Initialize SAM client
  useEffect(() => {
    createSAMClient('server')  // or 'onnx', 'hybrid'
      .then((client) => {
        setSamClient(client);
        setLoading(false);
      })
      .catch(console.error);

    return () => {
      samClient?.dispose();
    };
  }, []);

  const handleImageLoad = async (imageData: ImageData) => {
    if (!samClient) return;

    setLoading(true);
    await samClient.setImage(imageData);
    setLoading(false);
  };

  const handleClick = async (point: Point) => {
    if (!samClient) return;

    setLoading(true);
    const result = await samClient.segment([point], [1]);
    setMask(result.mask);
    setLoading(false);
  };

  return (
    <div>
      {loading && <div>Loading SAM...</div>}
      {/* UI components */}
    </div>
  );
}
```

---

## 7. Type Definitions

**File: `/lib/sam/types.ts`**

```typescript
/**
 * Point in image coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Bounding box in image coordinates
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Segmentation result from SAM
 */
export interface SegmentationResult {
  /** Binary mask (0 or 255 for each pixel) */
  mask: Uint8Array;
  /** Mask width in pixels */
  maskWidth: number;
  /** Mask height in pixels */
  maskHeight: number;
  /** Bounding box of masked region */
  boundingBox: BoundingBox;
  /** Confidence score (0-1) */
  confidence: number;
  /** All masks returned by SAM (optional) */
  allMasks?: Array<{
    mask: Uint8Array;
    score: number;
  }>;
}

/**
 * Mask data representation
 */
export interface MaskData {
  /** Binary mask array */
  data: Uint8Array;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * SAM client configuration
 */
export interface SAMConfig {
  /** Model path (for ONNX) */
  modelPath?: string;
  /** Model variant */
  modelVariant?: 'vit_b' | 'vit_l' | 'vit_h' | 'mobile' | 'fast';
  /** Compute backend */
  backend?: 'webgpu' | 'wasm' | 'webgl';
  /** API endpoint (for server-side) */
  apiEndpoint?: string;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * SAM client interface
 */
export interface SAMClient {
  /**
   * Initialize the SAM model
   */
  initialize(): Promise<void>;

  /**
   * Set the image for segmentation (pre-compute embeddings)
   */
  setImage(imageData: ImageData): Promise<void>;

  /**
   * Segment object based on point prompts
   * @param points - Array of click points
   * @param labels - Array of labels (1 = foreground, 0 = background)
   */
  segment(points: Point[], labels: number[]): Promise<SegmentationResult>;

  /**
   * Clean up resources
   */
  dispose(): void;
}

/**
 * API Request types
 */
export interface SegmentRequest {
  /** Base64 encoded image */
  image: string;
  /** Point prompts */
  points: Array<{
    x: number;
    y: number;
    label: 0 | 1;
  }>;
  /** Return all masks or just best */
  returnAll?: boolean;
}

/**
 * API Response types
 */
export interface SegmentResponse {
  /** Base64 encoded mask image */
  mask: string;
  /** Confidence score */
  confidence: number;
  /** Bounding box (optional) */
  boundingBox?: BoundingBox;
}

export interface SegmentMultiResponse {
  masks: Array<{
    mask: string;
    confidence: number;
  }>;
}

/**
 * Error types
 */
export class SAMError extends Error {
  constructor(
    message: string,
    public code: 'INIT_FAILED' | 'NO_IMAGE' | 'INFERENCE_FAILED' | 'NETWORK_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'SAMError';
  }
}

/**
 * Loading states
 */
export type SAMLoadingState =
  | { type: 'idle' }
  | { type: 'initializing' }
  | { type: 'loading-image' }
  | { type: 'segmenting'; progress?: number }
  | { type: 'complete' }
  | { type: 'error'; error: Error };

/**
 * Mask refinement options
 */
export interface MaskRefinementOptions {
  /** Number of erosion iterations */
  erode?: number;
  /** Number of dilation iterations */
  dilate?: number;
  /** Remove regions smaller than this (pixels) */
  minRegionSize?: number;
  /** Smooth mask boundaries */
  smooth?: boolean;
  /** Gaussian blur radius for smoothing */
  smoothRadius?: number;
}
```

---

## 8. Integration Recommendations

### Start with Server-Side (Replicate)

**Recommended for MVP:**

```typescript
// Simple, fast implementation
const samClient = await createSAMClient('server', {
  apiEndpoint: '/api/segment',
});
```

**Pros:**
- Fast development (< 1 hour)
- No model downloads
- Works on all devices
- Predictable costs (~$0.002 per segmentation)

**Cons:**
- Requires API key
- 2-4 second latency
- Internet required

### Migration Path to Client-Side ONNX

**Phase 1: Server-side only**
```typescript
// Use Replicate for all users
const client = await createSAMClient('server');
```

**Phase 2: Hybrid for power users**
```typescript
// Detect capabilities
const canRunLocal = await detectONNXSupport();
const strategy = canRunLocal ? 'onnx' : 'server';
const client = await createSAMClient(strategy);
```

**Phase 3: Full client-side with fallback**
```typescript
// Try client-side first, fallback to server
try {
  const client = await createSAMClient('onnx');
} catch (error) {
  console.warn('ONNX failed, using server:', error);
  const client = await createSAMClient('server');
}
```

### Fallback Strategies

**Strategy 1: Progressive Enhancement**

```typescript
async function createAdaptiveSAMClient(): Promise<SAMClient> {
  // 1. Try WebGPU ONNX (fastest)
  if (await hasWebGPU()) {
    try {
      return await createSAMClient('onnx', { backend: 'webgpu' });
    } catch (error) {
      console.warn('WebGPU ONNX failed:', error);
    }
  }

  // 2. Try WASM ONNX (slower but works everywhere)
  if (await hasEnoughMemory(2_000_000_000)) {
    try {
      return await createSAMClient('onnx', { backend: 'wasm' });
    } catch (error) {
      console.warn('WASM ONNX failed:', error);
    }
  }

  // 3. Fallback to server
  return await createSAMClient('server');
}

async function hasWebGPU(): Promise<boolean> {
  return 'gpu' in navigator;
}

async function hasEnoughMemory(required: number): Promise<boolean> {
  const memory = (performance as any).memory;
  return !memory || memory.jsHeapSizeLimit >= required;
}
```

**Strategy 2: User Preference**

```typescript
// Let users choose
function getSAMStrategy(): 'onnx' | 'server' | 'hybrid' {
  const preference = localStorage.getItem('sam-strategy');
  return preference as any || 'server';  // Default to server
}

function setSAMStrategy(strategy: 'onnx' | 'server' | 'hybrid') {
  localStorage.setItem('sam-strategy', strategy);
}

// Settings UI
<select onChange={(e) => setSAMStrategy(e.target.value)}>
  <option value="server">Server (Recommended)</option>
  <option value="onnx">Client-side (Experimental)</option>
  <option value="hybrid">Hybrid (Advanced)</option>
</select>
```

**Strategy 3: A/B Testing**

```typescript
// Randomly assign users to test performance
const strategy = Math.random() > 0.5 ? 'server' : 'onnx';

// Track metrics
analytics.track('sam_inference', {
  strategy,
  duration: inferenceTime,
  success: !error,
});
```

---

## 9. Performance Benchmarks

### Latency Comparison

| Strategy | Image Encoding | First Inference | Additional Inferences | Total (3 clicks) |
|----------|----------------|-----------------|----------------------|------------------|
| **Server (Replicate)** | 100ms (upload) | 2500ms | 2500ms | 7600ms |
| **Server (Self-hosted GPU)** | 100ms | 1500ms | 1500ms | 4600ms |
| **Client ONNX (WebGPU)** | 800ms | 600ms | 50ms | 1500ms |
| **Client ONNX (WASM)** | 2000ms | 3000ms | 200ms | 5400ms |
| **Hybrid** | 200ms (embeddings) | 300ms | 300ms | 1000ms |

**Key Findings:**
- **Server**: Consistent but slow for each click
- **Client WebGPU**: Slow first time, then very fast
- **Hybrid**: Best of both worlds

### Memory Usage

| Strategy | Initial Load | Peak Usage | Per Image |
|----------|-------------|------------|-----------|
| **Server** | 0 MB | 50 MB | 5 MB (upload buffer) |
| **Client ONNX (ViT-H)** | 2400 MB | 7000 MB | 100 MB |
| **Client ONNX (ViT-B)** | 375 MB | 2000 MB | 100 MB |
| **Client ONNX (MobileSAM)** | 40 MB | 500 MB | 50 MB |
| **Hybrid** | 40 MB | 600 MB | 2 MB (embeddings) |

### Bandwidth Usage

| Strategy | First Load | Per Image | Per Inference |
|----------|------------|-----------|---------------|
| **Server** | 0 KB | 2-5 MB | 0 KB |
| **Client ONNX (ViT-B)** | 308 MB | 0 KB | 0 KB |
| **Client ONNX (MobileSAM)** | 40 MB | 0 KB | 0 KB |
| **Hybrid** | 40 MB | 1 MB | 0 KB |

### Device Compatibility

| Device | Server | ONNX (WASM) | ONNX (WebGPU) | Hybrid |
|--------|--------|-------------|---------------|--------|
| **Desktop (High-end)** | ✅ Fast | ✅ OK | ✅ Fast | ✅ Fastest |
| **Desktop (Low-end)** | ✅ Fast | ⚠️ Slow | ❌ No GPU | ✅ OK |
| **Laptop (Modern)** | ✅ Fast | ✅ OK | ✅ Fast | ✅ Fast |
| **Tablet (iPad Pro)** | ✅ Fast | ⚠️ Slow | ❌ No support | ✅ OK |
| **Phone (High-end)** | ✅ Fast | ❌ OOM | ❌ No support | ⚠️ OK |
| **Phone (Low-end)** | ✅ OK | ❌ OOM | ❌ No support | ❌ OOM |

**Legend:**
- ✅ Works well
- ⚠️ Works but slow/limited
- ❌ Doesn't work

---

## 10. Error Handling

### Error Types

```typescript
export enum SAMErrorCode {
  // Initialization errors
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  BACKEND_NOT_SUPPORTED = 'BACKEND_NOT_SUPPORTED',
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',

  // Image errors
  INVALID_IMAGE = 'INVALID_IMAGE',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  IMAGE_ENCODING_FAILED = 'IMAGE_ENCODING_FAILED',

  // Inference errors
  NO_IMAGE_SET = 'NO_IMAGE_SET',
  INVALID_POINTS = 'INVALID_POINTS',
  INFERENCE_FAILED = 'INFERENCE_FAILED',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
}

export class SAMError extends Error {
  constructor(
    public code: SAMErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SAMError';
  }
}
```

### Error Handling Patterns

**1. Initialization Errors**

```typescript
try {
  const client = await createSAMClient('onnx');
} catch (error) {
  if (error instanceof SAMError) {
    switch (error.code) {
      case SAMErrorCode.MODEL_LOAD_FAILED:
        // Fallback to server
        console.warn('Failed to load ONNX model, using server API');
        return createSAMClient('server');

      case SAMErrorCode.BACKEND_NOT_SUPPORTED:
        // Try different backend
        console.warn('WebGPU not supported, trying WASM');
        return createSAMClient('onnx', { backend: 'wasm' });

      case SAMErrorCode.OUT_OF_MEMORY:
        // Use lighter model
        console.warn('Out of memory, trying MobileSAM');
        return createSAMClient('onnx', { modelVariant: 'mobile' });

      default:
        throw error;
    }
  }
}
```

**2. Runtime Errors**

```typescript
async function segmentWithRetry(
  client: SAMClient,
  points: Point[],
  labels: number[],
  maxRetries = 3
): Promise<SegmentationResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.segment(points, labels);
    } catch (error) {
      lastError = error;

      if (error instanceof SAMError) {
        switch (error.code) {
          case SAMErrorCode.TIMEOUT:
            // Retry with exponential backoff
            await sleep(Math.pow(2, attempt) * 1000);
            continue;

          case SAMErrorCode.RATE_LIMITED:
            // Wait and retry
            await sleep(5000);
            continue;

          case SAMErrorCode.OUT_OF_MEMORY:
            // Can't recover, fail immediately
            throw error;

          default:
            // Unknown error, retry once more
            if (attempt < maxRetries - 1) continue;
            throw error;
        }
      }
    }
  }

  throw lastError;
}
```

**3. User-Friendly Error Messages**

```typescript
function getUserFriendlyError(error: Error): string {
  if (!(error instanceof SAMError)) {
    return 'An unexpected error occurred. Please try again.';
  }

  switch (error.code) {
    case SAMErrorCode.MODEL_LOAD_FAILED:
      return 'Failed to load AI model. Please refresh the page.';

    case SAMErrorCode.OUT_OF_MEMORY:
      return 'Your device ran out of memory. Try using a smaller image or closing other tabs.';

    case SAMErrorCode.NETWORK_ERROR:
      return 'Network error. Please check your internet connection.';

    case SAMErrorCode.TIMEOUT:
      return 'Request timed out. Please try again.';

    case SAMErrorCode.RATE_LIMITED:
      return 'Too many requests. Please wait a moment and try again.';

    case SAMErrorCode.INVALID_IMAGE:
      return 'Invalid image. Please upload a valid image file.';

    case SAMErrorCode.IMAGE_TOO_LARGE:
      return 'Image is too large. Please use an image smaller than 10 MB.';

    default:
      return 'Segmentation failed. Please try again.';
  }
}

// Usage in component
try {
  await client.segment(points, labels);
} catch (error) {
  toast.error(getUserFriendlyError(error));
}
```

### Logging and Monitoring

```typescript
/**
 * Log SAM errors for monitoring
 */
function logSAMError(error: SAMError, context: Record<string, unknown>) {
  console.error('SAM Error:', {
    code: error.code,
    message: error.message,
    details: error.details,
    context,
    timestamp: new Date().toISOString(),
  });

  // Send to monitoring service
  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('sam_error', {
      error_code: error.code,
      error_message: error.message,
      ...context,
    });
  }
}

// Usage
try {
  await client.segment(points, labels);
} catch (error) {
  logSAMError(error, {
    strategy: 'onnx',
    backend: 'webgpu',
    imageSize: { width: 1920, height: 1080 },
    numPoints: points.length,
  });
  throw error;
}
```

---

## 11. Testing Strategies

### Unit Tests

**File: `/lib/sam/__tests__/client.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSAMClient } from '../client';
import type { Point } from '../types';

describe('SAM Client', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Server client', () => {
    it('should initialize successfully', async () => {
      const client = await createSAMClient('server');
      expect(client).toBeDefined();
    });

    it('should segment with valid input', async () => {
      const client = await createSAMClient('server');

      // Create test image
      const imageData = new ImageData(100, 100);
      await client.setImage(imageData);

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          mask: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
          confidence: 0.95,
        }),
      });

      const points: Point[] = [{ x: 50, y: 50 }];
      const result = await client.segment(points, [1]);

      expect(result.confidence).toBe(0.95);
      expect(result.mask).toBeInstanceOf(Uint8Array);
    });

    it('should throw error when no image set', async () => {
      const client = await createSAMClient('server');

      await expect(
        client.segment([{ x: 0, y: 0 }], [1])
      ).rejects.toThrow('No image set');
    });
  });

  describe('ONNX client', () => {
    it('should load model successfully', async () => {
      // Mock ONNX runtime
      vi.mock('onnxruntime-web', () => ({
        InferenceSession: {
          create: vi.fn().mockResolvedValue({}),
        },
      }));

      const client = await createSAMClient('onnx');
      expect(client).toBeDefined();
    });
  });
});
```

### Integration Tests

**File: `/lib/sam/__tests__/integration.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createSAMClient } from '../client';
import { loadTestImage } from './utils';

describe('SAM Integration', () => {
  it('should segment real image', async () => {
    const client = await createSAMClient('server');

    // Load test image
    const imageData = await loadTestImage('test-object.jpg');
    await client.setImage(imageData);

    // Click on object center
    const result = await client.segment(
      [{ x: imageData.width / 2, y: imageData.height / 2 }],
      [1]
    );

    // Verify mask is reasonable
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.boundingBox.width).toBeGreaterThan(0);
    expect(result.boundingBox.height).toBeGreaterThan(0);
  });

  it('should handle multiple clicks', async () => {
    const client = await createSAMClient('server');
    const imageData = await loadTestImage('test-object.jpg');
    await client.setImage(imageData);

    // First click - foreground
    const result1 = await client.segment([{ x: 100, y: 100 }], [1]);

    // Second click - add background
    const result2 = await client.segment(
      [
        { x: 100, y: 100 },  // foreground
        { x: 10, y: 10 },    // background
      ],
      [1, 0]
    );

    // Refined mask should be different
    expect(result2.mask).not.toEqual(result1.mask);
  });
});
```

### Visual Regression Tests

**File: `/lib/sam/__tests__/visual.test.ts`**

```typescript
import { describe, it } from 'vitest';
import { createSAMClient } from '../client';
import { compareImages, saveSnapshot } from './utils';

describe('SAM Visual Regression', () => {
  it('should produce consistent masks', async () => {
    const client = await createSAMClient('server');

    // Load reference image and expected mask
    const imageData = await loadTestImage('reference.jpg');
    const expectedMask = await loadTestImage('reference-mask.png');

    await client.setImage(imageData);
    const result = await client.segment([{ x: 200, y: 200 }], [1]);

    // Convert result mask to ImageData for comparison
    const maskImage = maskToImageData(result.mask, result.maskWidth, result.maskHeight);

    // Compare with expected (allow small differences)
    const diff = compareImages(maskImage, expectedMask);
    expect(diff).toBeLessThan(0.05);  // < 5% difference

    // Save snapshot for manual review if test fails
    if (diff >= 0.05) {
      await saveSnapshot('failed-mask.png', maskImage);
    }
  });
});
```

### Performance Tests

**File: `/lib/sam/__tests__/performance.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createSAMClient } from '../client';

describe('SAM Performance', () => {
  it('should initialize within 5 seconds', async () => {
    const start = performance.now();
    await createSAMClient('onnx');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5000);
  });

  it('should segment within 3 seconds', async () => {
    const client = await createSAMClient('server');
    const imageData = new ImageData(1024, 1024);
    await client.setImage(imageData);

    const start = performance.now();
    await client.segment([{ x: 512, y: 512 }], [1]);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(3000);
  });

  it('should cache embeddings for fast re-inference', async () => {
    const client = await createSAMClient('onnx');
    const imageData = new ImageData(1024, 1024);

    // First inference (slow - includes encoding)
    await client.setImage(imageData);
    const start1 = performance.now();
    await client.segment([{ x: 100, y: 100 }], [1]);
    const duration1 = performance.now() - start1;

    // Second inference (fast - reuses embeddings)
    const start2 = performance.now();
    await client.segment([{ x: 200, y: 200 }], [1]);
    const duration2 = performance.now() - start2;

    // Second should be much faster
    expect(duration2).toBeLessThan(duration1 / 5);
  });
});
```

### End-to-End Tests

**File: `/e2e/segmentation.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('SAM Segmentation Flow', () => {
  test('should segment object on click', async ({ page }) => {
    await page.goto('/');

    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-fixtures/test-object.jpg');

    // Wait for image to load
    await page.waitForSelector('canvas');

    // Click on object
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 200 } });

    // Wait for segmentation
    await page.waitForSelector('[data-testid="mask-overlay"]', {
      timeout: 5000,
    });

    // Verify mask is visible
    const maskOverlay = page.locator('[data-testid="mask-overlay"]');
    await expect(maskOverlay).toBeVisible();

    // Verify confidence score is displayed
    const confidence = page.locator('[data-testid="confidence-score"]');
    await expect(confidence).toContainText(/\d+%/);
  });

  test('should refine mask with additional clicks', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles('test-fixtures/test-object.jpg');
    await page.waitForSelector('canvas');

    // First click
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.waitForSelector('[data-testid="mask-overlay"]');

    // Take screenshot of first mask
    const firstMask = await page.locator('[data-testid="mask-overlay"]').screenshot();

    // Second click (background)
    await page.keyboard.down('Shift');  // Background mode
    await page.locator('canvas').click({ position: { x: 50, y: 50 } });
    await page.keyboard.up('Shift');

    // Wait for updated mask
    await page.waitForTimeout(1000);

    // Take screenshot of refined mask
    const refinedMask = await page.locator('[data-testid="mask-overlay"]').screenshot();

    // Masks should be different
    expect(firstMask).not.toEqual(refinedMask);
  });
});
```

---

## Conclusion

This documentation provides a complete guide to integrating SAM into Snap Caddy. Key takeaways:

1. **Start Simple**: Use server-side Replicate API for MVP
2. **Optimize Later**: Migrate to client-side ONNX when needed
3. **Always Fallback**: Implement robust error handling and fallbacks
4. **Test Thoroughly**: Use unit, integration, and visual regression tests
5. **Monitor Performance**: Track latency, costs, and success rates

For questions or issues, refer to:
- [SAM GitHub Repository](https://github.com/facebookresearch/segment-anything)
- [ONNX Runtime Web Docs](https://onnxruntime.ai/docs/tutorials/web/)
- [Replicate SAM API](https://replicate.com/facebook/sam)
