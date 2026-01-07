# API Routes & Server Architecture

## Overview

Snap Caddy's server architecture uses Next.js 16 App Router for API routes, providing server-side processing for AI segmentation and 3D model generation. All routes follow RESTful conventions with strict type safety and validation.

### Technology Stack
- **Runtime**: Node.js (Next.js API Routes)
- **Validation**: Zod for schema validation
- **3D Generation**: OpenSCAD CLI with Gridfinity library
- **File Storage**: Temporary file system with automatic cleanup
- **Rate Limiting**: In-memory token bucket algorithm

### API Route Structure

```
app/api/
├── generate/
│   └── route.ts           # POST: OpenSCAD STL generation
├── preview/
│   └── route.ts           # POST: Quick preview generation
└── download/
    └── [id]/
        └── route.ts       # GET: STL file download
```

---

## 1. POST /api/generate

Generates STL files from SVG contours and Gridfinity configuration using OpenSCAD.

### Request Schema

```typescript
// schemas/generate.ts
import { z } from 'zod';

export const GridfinityConfigSchema = z.object({
  // Grid dimensions
  gridUnitsX: z.number().int().min(1).max(10),
  gridUnitsY: z.number().int().min(1).max(10),

  // Bin parameters
  binHeight: z.number().min(7).max(100), // mm
  cutoutDepth: z.number().min(1).max(50), // mm
  wallThickness: z.number().min(0.5).max(5).default(1.2), // mm

  // Padding around cutout
  paddingTop: z.number().min(0).max(20).default(2), // mm
  paddingBottom: z.number().min(0).max(20).default(2),
  paddingLeft: z.number().min(0).max(20).default(2),
  paddingRight: z.number().min(0).max(20).default(2),

  // Base options
  magnetHoles: z.boolean().default(true),
  screwHoles: z.boolean().default(false),
  stackingLip: z.boolean().default(true),

  // Advanced
  cornerRadius: z.number().min(0).max(5).default(0.5), // mm
  baseThickness: z.number().min(2).max(10).default(5), // mm
});

export const GenerateRequestSchema = z.object({
  svg: z.string().min(10), // SVG content
  config: GridfinityConfigSchema,
  // Optional: request async generation with webhook
  async: z.boolean().optional().default(false),
  webhookUrl: z.string().url().optional(),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GridfinityConfig = z.infer<typeof GridfinityConfigSchema>;
```

### Response Schema

```typescript
// types/api.ts
export interface GenerateResponse {
  success: boolean;
  generationId: string; // UUID for download
  status: 'queued' | 'processing' | 'complete' | 'error';
  estimatedTimeMs?: number;
  downloadUrl?: string; // Available when complete
  previewUrl?: string; // PNG preview of model
  queuePosition?: number; // If queued
}

export interface GenerateErrorResponse {
  success: false;
  error: string;
  code: 'INVALID_INPUT' | 'INVALID_SVG' | 'OPENSCAD_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR';
  details?: unknown;
}

// For polling status
export interface GenerationStatus {
  id: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  downloadUrl?: string;
  previewUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
```

### Route Implementation

```typescript
// app/api/generate/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema } from '@/schemas/generate';
import { generateSTL } from '@/lib/openscad/generator';
import { createGenerationJob, getJobStatus } from '@/lib/queue/jobs';
import { validateSVG } from '@/lib/validation/svg';
import { withRateLimit } from '@/lib/api/rateLimit';
import { withErrorHandler } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

async function generateHandler(request: NextRequest) {
  const body = await request.json();
  const parseResult = GenerateRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request parameters',
        code: 'INVALID_INPUT',
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { svg, config } = parseResult.data;

  // Validate SVG content
  const svgValidation = validateSVG(svg);
  if (!svgValidation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: svgValidation.error,
        code: 'INVALID_SVG',
      },
      { status: 400 }
    );
  }

  const generationId = randomUUID();

  try {
    // Synchronous generation
    const result = await generateSTL({
      id: generationId,
      svg,
      config,
    });

    return NextResponse.json({
      success: true,
      generationId,
      status: 'complete',
      downloadUrl: `/api/download/${generationId}`,
      previewUrl: result.previewUrl,
    });
  } catch (error) {
    logger.error('Generation error', { error, generationId });

    return NextResponse.json(
      {
        success: false,
        error: 'STL generation failed',
        code: 'OPENSCAD_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  withErrorHandler(generateHandler),
  {
    maxRequests: 5, // More restrictive for compute-heavy operations
    windowMs: 60000,
  }
);

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for STL generation
```

### OpenSCAD Generator Implementation

```typescript
// lib/openscad/generator.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import type { GridfinityConfig } from '@/schemas/generate';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/snap-caddy';
const OPENSCAD_PATH = process.env.OPENSCAD_PATH || 'openscad';
const GRIDFINITY_LIB_PATH = process.env.GRIDFINITY_LIB_PATH || '/usr/local/share/gridfinity';

interface GenerateSTLParams {
  id: string;
  svg: string;
  config: GridfinityConfig;
}

interface GenerateSTLResult {
  stlPath: string;
  previewUrl?: string;
}

export async function generateSTL(params: GenerateSTLParams): Promise<GenerateSTLResult> {
  const { id, svg, config } = params;

  // Ensure temp directory exists
  await mkdir(TEMP_DIR, { recursive: true });

  const workDir = join(TEMP_DIR, id);
  await mkdir(workDir, { recursive: true });

  try {
    // 1. Write SVG to file
    const svgPath = join(workDir, 'cutout.svg');
    await writeFile(svgPath, svg, 'utf-8');

    // 2. Generate OpenSCAD file
    const scadPath = join(workDir, 'gridfinity-cutout.scad');
    const scadContent = generateOpenSCADScript(svgPath, config);
    await writeFile(scadPath, scadContent, 'utf-8');

    // 3. Execute OpenSCAD to generate STL
    const stlPath = join(workDir, 'output.stl');
    await executeOpenSCAD(scadPath, stlPath);

    // 4. Optionally generate preview image
    let previewUrl: string | undefined;
    if (process.env.GENERATE_PREVIEWS === 'true') {
      const previewPath = join(workDir, 'preview.png');
      await generatePreview(scadPath, previewPath);
      previewUrl = `/api/preview/${id}`;
    }

    // 5. Schedule cleanup (delete after 1 hour)
    scheduleCleanup(workDir, 60 * 60 * 1000);

    return {
      stlPath,
      previewUrl,
    };

  } catch (error) {
    // Cleanup on error
    await cleanupDirectory(workDir);
    throw error;
  }
}

function generateOpenSCADScript(svgPath: string, config: GridfinityConfig): string {
  return `
// Generated Gridfinity Custom Cutout
// SVG: ${svgPath}

use <${GRIDFINITY_LIB_PATH}/gridfinity-rebuilt-utility.scad>

// Grid dimensions
gridx = ${config.gridUnitsX};
gridy = ${config.gridUnitsY};
gridz = ${Math.ceil(config.binHeight / 7)}; // 7mm per unit

// Cutout parameters
cutout_depth = ${config.cutoutDepth};
wall_thickness = ${config.wallThickness};
base_thickness = ${config.baseThickness};

// Padding
padding_top = ${config.paddingTop};
padding_bottom = ${config.paddingBottom};
padding_left = ${config.paddingLeft};
padding_right = ${config.paddingRight};

// Options
enable_magnets = ${config.magnetHoles ? 'true' : 'false'};
enable_screws = ${config.screwHoles ? 'true' : 'false'};
enable_lip = ${config.stackingLip ? 'true' : 'false'};
corner_radius = ${config.cornerRadius};

// Main assembly
difference() {
  // Base bin
  gridfinityBase(gridx, gridy, gridz,
    style_hole = enable_magnets ? 1 : (enable_screws ? 2 : 0),
    enable_lip = enable_lip
  );

  // Cutout from SVG
  translate([
    padding_left + wall_thickness,
    padding_bottom + wall_thickness,
    base_thickness
  ])
  linear_extrude(height = cutout_depth + 0.1)
  offset(r = corner_radius)
  scale([1, -1, 1]) // Flip Y axis for proper orientation
  import("${svgPath}", center = false);
}
`;
}

async function executeOpenSCAD(scadPath: string, outputPath: string): Promise<void> {
  const command = `${OPENSCAD_PATH} -o "${outputPath}" "${scadPath}"`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stderr && stderr.includes('ERROR')) {
      throw new Error(`OpenSCAD error: ${stderr}`);
    }

    // Verify output file was created
    if (!existsSync(outputPath)) {
      throw new Error('OpenSCAD failed to generate STL file');
    }

  } catch (error) {
    if (error instanceof Error && 'killed' in error) {
      throw new Error('OpenSCAD timeout - model too complex');
    }
    throw error;
  }
}

async function generatePreview(scadPath: string, outputPath: string): Promise<void> {
  const command = `${OPENSCAD_PATH} -o "${outputPath}" --render --imgsize=800,600 --camera=0,0,0,55,0,25,300 "${scadPath}"`;

  await execAsync(command, {
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function scheduleCleanup(directory: string, delayMs: number): void {
  setTimeout(async () => {
    try {
      await cleanupDirectory(directory);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, delayMs);
}

async function cleanupDirectory(directory: string): Promise<void> {
  const { rm } = await import('fs/promises');
  await rm(directory, { recursive: true, force: true });
}
```

---

## 2. GET /api/download/[id]

Serves generated STL files with proper headers and security validation.

### Route Implementation

```typescript
// app/api/download/[id]/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/snap-caddy';

const UUIDSchema = z.string().uuid();

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  // Validate ID format (prevent path traversal)
  const validation = UUIDSchema.safeParse(id);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid file ID format' },
      { status: 400 }
    );
  }

  try {
    // Construct safe file path
    const filePath = join(TEMP_DIR, id, 'output.stl');

    // Verify file exists and get stats
    const fileStats = await stat(filePath);

    // Check if file is expired (older than 1 hour)
    const fileAge = Date.now() - fileStats.mtimeMs;
    if (fileAge > 60 * 60 * 1000) {
      return NextResponse.json(
        { error: 'File has expired' },
        { status: 410 } // Gone
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);

    // Log download
    logger.info('STL download', {
      id,
      size: fileStats.size,
      ip: request.headers.get('x-forwarded-for'),
    });

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/sla',
        'Content-Disposition': `attachment; filename="gridfinity-cutout-${id.slice(0, 8)}.stl"`,
        'Content-Length': fileStats.size.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    logger.error('Download error', { error, id });

    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
```

---

## 3. POST /api/preview

Generates quick preview images without full STL generation for faster feedback.

### Route Implementation

```typescript
// app/api/preview/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema } from '@/schemas/generate';
import { generateQuickPreview } from '@/lib/openscad/preview';
import { withRateLimit } from '@/lib/api/rateLimit';
import { withErrorHandler } from '@/lib/api/errors';

async function previewHandler(request: NextRequest) {
  const body = await request.json();
  const parseResult = GenerateRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }

  const { svg, config } = parseResult.data;

  try {
    // Generate low-poly preview (faster than full STL)
    const previewImage = await generateQuickPreview({
      svg,
      config,
      quality: 'low', // Lower quality for speed
    });

    return new NextResponse(previewImage, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=300',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Preview generation failed' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(
  withErrorHandler(previewHandler),
  { maxRequests: 20, windowMs: 60000 }
);

export const runtime = 'nodejs';
export const maxDuration = 15; // 15 seconds for preview
```

---

## 4. Shared Utilities

### Validation Module

```typescript
// lib/validation/image.ts
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface ImageValidationOptions {
  maxSize: number; // bytes
  maxWidth: number;
  maxHeight: number;
  allowedFormats?: string[];
}

export function validateBase64Image(
  base64: string,
  options: ImageValidationOptions
): ImageValidationResult {
  // Check if data URI or raw base64
  const dataUriMatch = base64.match(/^data:image\/(\w+);base64,(.+)$/);
  let format: string;
  let data: string;

  if (dataUriMatch) {
    format = dataUriMatch[1];
    data = dataUriMatch[2];
  } else {
    format = 'unknown';
    data = base64;
  }

  // Validate format
  if (options.allowedFormats && !options.allowedFormats.includes(format)) {
    return {
      valid: false,
      error: `Invalid image format. Allowed: ${options.allowedFormats.join(', ')}`,
    };
  }

  // Calculate size
  const size = Math.ceil(data.length * 0.75); // Base64 to bytes approximation

  if (size > options.maxSize) {
    return {
      valid: false,
      error: `Image too large. Max size: ${options.maxSize / 1024 / 1024}MB`,
    };
  }

  return { valid: true, size };
}

export function decodeBase64Image(base64: string): Buffer {
  // Remove data URI prefix if present
  const data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(data, 'base64');
}
```

```typescript
// lib/validation/svg.ts
export interface SVGValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
}

const MAX_SVG_SIZE = 1024 * 1024; // 1MB
const DANGEROUS_TAGS = ['script', 'iframe', 'embed', 'object'];

export function validateSVG(svg: string): SVGValidationResult {
  // Size check
  if (svg.length > MAX_SVG_SIZE) {
    return {
      valid: false,
      error: 'SVG file too large',
    };
  }

  // Basic format check
  if (!svg.trim().startsWith('<svg') && !svg.trim().startsWith('<?xml')) {
    return {
      valid: false,
      error: 'Invalid SVG format',
    };
  }

  // Security check: no dangerous tags
  for (const tag of DANGEROUS_TAGS) {
    if (svg.toLowerCase().includes(`<${tag}`)) {
      return {
        valid: false,
        error: `SVG contains disallowed tag: ${tag}`,
      };
    }
  }

  // Extract dimensions if available
  const widthMatch = svg.match(/width="(\d+(?:\.\d+)?)(px|mm)?"/);
  const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)(px|mm)?"/);

  return {
    valid: true,
    width: widthMatch ? parseFloat(widthMatch[1]) : undefined,
    height: heightMatch ? parseFloat(heightMatch[1]) : undefined,
  };
}
```

### Error Handling

```typescript
// lib/api/errors.ts
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function withErrorHandler<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      logger.error('API error', { error, url: req.url });

      if (error instanceof APIError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.code,
            details: error.details,
          },
          { status: error.statusCode }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          code: 'SERVER_ERROR',
        },
        { status: 500 }
      );
    }
  };
}
```

### Rate Limiting

```typescript
// lib/api/rateLimit.ts
import { type NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: NextRequest) => string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (use Redis for production)
const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 5 * 60 * 1000);

export function withRateLimit<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  const { maxRequests, windowMs, keyGenerator } = config;

  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const key = keyGenerator
      ? keyGenerator(req)
      : req.headers.get('x-forwarded-for') || 'anonymous';

    const now = Date.now();
    const record = store[key];

    if (!record || record.resetTime < now) {
      // New window
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      // Existing window
      if (record.count >= maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);

        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT',
            retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': record.resetTime.toString(),
            },
          }
        );
      }

      record.count++;
    }

    const response = await handler(req, ...args);

    // Add rate limit headers
    const record2 = store[key];
    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', (maxRequests - record2.count).toString());
    response.headers.set('X-RateLimit-Reset', record2.resetTime.toString());

    return response;
  };
}
```

### File Management

```typescript
// lib/api/files.ts
import { mkdir, writeFile, unlink, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/snap-caddy';

export class FileManager {
  async createTempFile(content: string | Buffer, ext: string): Promise<string> {
    const id = randomUUID();
    const dir = join(TEMP_DIR, id);
    await mkdir(dir, { recursive: true });

    const filePath = join(dir, `file.${ext}`);
    await writeFile(filePath, content);

    return id;
  }

  getTempFilePath(id: string, filename: string = 'output.stl'): string {
    return join(TEMP_DIR, id, filename);
  }

  async cleanupFile(id: string): Promise<void> {
    const dir = join(TEMP_DIR, id);
    const { rm } = await import('fs/promises');
    await rm(dir, { recursive: true, force: true });
  }

  scheduleCleanup(id: string, delayMs: number): void {
    setTimeout(async () => {
      try {
        await this.cleanupFile(id);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, delayMs);
  }

  async cleanupOldFiles(maxAgeMs: number): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    try {
      const entries = await readdir(TEMP_DIR);

      for (const entry of entries) {
        const entryPath = join(TEMP_DIR, entry);
        const stats = await stat(entryPath);

        if (stats.isDirectory() && now - stats.mtimeMs > maxAgeMs) {
          await this.cleanupFile(entry);
          cleaned++;
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    return cleaned;
  }
}

export const fileManager = new FileManager();

// Run cleanup every hour
setInterval(async () => {
  const cleaned = await fileManager.cleanupOldFiles(60 * 60 * 1000); // 1 hour
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old files`);
  }
}, 60 * 60 * 1000);
```

---

## 5. Environment Variables

```bash
# .env.local

# OpenSCAD
OPENSCAD_PATH=/usr/bin/openscad
GRIDFINITY_LIB_PATH=/usr/local/share/gridfinity

# File Storage
TEMP_DIR=/tmp/snap-caddy
MAX_FILE_SIZE=10485760  # 10MB
FILE_RETENTION_MS=3600000  # 1 hour

# Rate Limiting
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60000  # 1 minute

# Features
GENERATE_PREVIEWS=true
ENABLE_ASYNC_GENERATION=false

# Logging
LOG_LEVEL=info
```

### Environment Validation

```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  OPENSCAD_PATH: z.string().default('openscad'),
  GRIDFINITY_LIB_PATH: z.string().default('/usr/local/share/gridfinity'),
  TEMP_DIR: z.string().default('/tmp/snap-caddy'),
  MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().positive()).default('10485760'),
  FILE_RETENTION_MS: z.string().transform(Number).pipe(z.number().positive()).default('3600000'),
  RATE_LIMIT_REQUESTS: z.string().transform(Number).pipe(z.number().int().positive()).default('10'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).pipe(z.number().int().positive()).default('60000'),
  GENERATE_PREVIEWS: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
  ENABLE_ASYNC_GENERATION: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);
```

---

## 6. Client API Wrapper

Complete type-safe API client for frontend usage.

```typescript
// lib/api/client.ts
import type {
  SegmentRequest,
  SegmentResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationStatus
} from '@/types/api';

class SnapCaddyAPI {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate STL file from SVG and configuration
   */
  async generate(params: {
    svg: string;
    config: GenerateRequest['config'];
  }): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params satisfies GenerateRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIClientError(error.error, error.code, response.status);
    }

    return response.json();
  }

  /**
   * Download generated STL file
   */
  async downloadSTL(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/download/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new APIClientError(error.error, 'DOWNLOAD_ERROR', response.status);
    }

    return response.blob();
  }

  /**
   * Get preview image
   */
  async getPreview(params: {
    svg: string;
    config: GenerateRequest['config'];
  }): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new APIClientError('Preview failed', 'PREVIEW_ERROR', response.status);
    }

    return response.blob();
  }

  /**
   * Generate and download STL in one call
   */
  async generateAndDownload(params: {
    svg: string;
    config: GenerateRequest['config'];
  }): Promise<Blob> {
    const generateResult = await this.generate(params);

    if (generateResult.status !== 'complete') {
      throw new Error('Generation did not complete');
    }

    return this.downloadSTL(generateResult.generationId);
  }

  /**
   * Helper: Convert blob to download link
   */
  createDownloadLink(blob: Blob, filename: string): string {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    return url;
  }

  /**
   * Helper: Trigger download
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export class APIClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'APIClientError';
  }
}

// Export singleton instance
export const api = new SnapCaddyAPI();

// Export class for custom instances
export { SnapCaddyAPI };
```

### React Hooks for API Integration

```typescript
// hooks/useGeneration.ts
import { useState, useCallback } from 'react';
import { api, APIClientError } from '@/lib/api/client';
import type { GenerateResponse } from '@/types/api';

interface UseGenerationResult {
  generate: (params: {
    svg: string;
    config: Parameters<typeof api.generate>[0]['config'];
  }) => Promise<string | null>; // Returns generation ID
  download: (id: string) => Promise<void>;
  isGenerating: boolean;
  isDownloading: boolean;
  error: string | null;
  generationId: string | null;
}

export function useGeneration(): UseGenerationResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);

  const generate = useCallback(async (params: Parameters<typeof api.generate>[0]) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.generate(params);
      setGenerationId(response.generationId);
      return response.generationId;
    } catch (err) {
      const errorMessage = err instanceof APIClientError
        ? err.message
        : 'Generation failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (id: string) => {
    setIsDownloading(true);
    setError(null);

    try {
      const blob = await api.downloadSTL(id);
      api.triggerDownload(blob, `gridfinity-cutout-${id.slice(0, 8)}.stl`);
    } catch (err) {
      const errorMessage = err instanceof APIClientError
        ? err.message
        : 'Download failed';
      setError(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { generate, download, isGenerating, isDownloading, error, generationId };
}
```

---

## 7. Testing Strategies

### Unit Tests for API Routes

```typescript
// __tests__/api/generate.test.ts
import { POST } from '@/app/api/generate/route';
import { NextRequest } from 'next/server';

describe('POST /api/generate', () => {
  it('should validate request schema', async () => {
    const request = new NextRequest('http://localhost/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        svg: '',
        config: {},
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.code).toBe('INVALID_INPUT');
  });

  it('should successfully generate STL', async () => {
    const request = new NextRequest('http://localhost/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        svg: '<svg>...</svg>',
        config: {
          gridUnitsX: 2,
          gridUnitsY: 2,
          binHeight: 42,
          cutoutDepth: 10,
          wallThickness: 1.2,
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.generationId).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/generation-flow.test.ts
import { api } from '@/lib/api/client';

describe('Full generation flow', () => {
  it('should complete paint -> generate -> download', async () => {
    // 1. Paint mask (client-side)
    const svg = createSVGFromMask(paintedMask);

    // 2. Generate STL
    const generateResult = await api.generate({
      svg,
      config: {
        gridUnitsX: 2,
        gridUnitsY: 2,
        binHeight: 42,
        cutoutDepth: 10,
        wallThickness: 1.2,
      },
    });

    expect(generateResult.generationId).toBeDefined();
    expect(generateResult.status).toBe('complete');

    // 3. Download
    const stlBlob = await api.downloadSTL(generateResult.generationId);
    expect(stlBlob.size).toBeGreaterThan(0);
    expect(stlBlob.type).toBe('application/sla');
  }, 60000); // 60 second timeout
});
```

### Load Testing

```typescript
// scripts/load-test.ts
import { performance } from 'perf_hooks';

async function loadTest() {
  const concurrentRequests = 10;
  const iterations = 5;

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    await Promise.all(
      Array.from({ length: concurrentRequests }, async () => {
        const response = await fetch('http://localhost:56577/api/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: testImageBase64,
            points: [{ x: 100, y: 100, label: 1 }],
            imageWidth: 500,
            imageHeight: 500,
          }),
        });

        return response.json();
      })
    );

    const duration = performance.now() - start;
    times.push(duration);

    console.log(`Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
  }

  console.log({
    avgTime: times.reduce((a, b) => a + b) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
  });
}

loadTest();
```

---

## 8. Production Deployment Checklist

### Infrastructure Requirements

- [ ] OpenSCAD installed on server (`apt-get install openscad`)
- [ ] Gridfinity library cloned to `/usr/local/share/gridfinity`
- [ ] Temporary directory with write permissions (`/tmp/snap-caddy`)
- [ ] Environment variables configured
- [ ] Rate limiting configured (consider Redis for multi-instance)
- [ ] File cleanup cron job scheduled

### Security Hardening

- [ ] Input validation on all endpoints
- [ ] File path traversal protection
- [ ] SVG XSS protection (sanitize dangerous tags)
- [ ] Rate limiting per IP
- [ ] CORS configuration
- [ ] Request size limits
- [ ] Timeout limits on long-running processes

### Monitoring

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Track metrics
export const metrics = {
  segmentationRequests: 0,
  generationRequests: 0,
  downloads: 0,
  errors: 0,

  recordSegmentation(durationMs: number) {
    this.segmentationRequests++;
    logger.info('Segmentation metric', { durationMs });
  },

  recordGeneration(durationMs: number) {
    this.generationRequests++;
    logger.info('Generation metric', { durationMs });
  },

  recordError(error: Error, context?: unknown) {
    this.errors++;
    logger.error('Error metric', { error, context });
  },
};
```

### Performance Optimization

1. **Caching**: Cache SAM model embeddings for repeated images
2. **Queue System**: Use BullMQ for async generation queue
3. **CDN**: Serve generated STLs from CDN after creation
4. **Compression**: Enable gzip/brotli for API responses
5. **Image Optimization**: Resize large images before SAM processing

---

## 9. API Reference Summary

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/generate` | POST | STL generation | 5 req/min |
| `/api/download/{id}` | GET | Download STL | 20 req/min |
| `/api/preview` | POST | Quick preview | 20 req/min |

### Response Codes

- `200 OK`: Success
- `400 Bad Request`: Invalid input
- `404 Not Found`: Resource not found
- `410 Gone`: File expired
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Additional Resources

- [Next.js API Routes Documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Zod Validation](https://zod.dev/)
- [OpenSCAD Manual](https://openscad.org/documentation.html)
- [Gridfinity OpenSCAD Library](https://github.com/ostat/gridfinity_extended_openscad)
