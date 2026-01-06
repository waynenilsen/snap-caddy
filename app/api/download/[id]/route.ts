/**
 * Download API route for generated STL files
 * GET /api/download/[id] - Download STL file by job ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { z } from 'zod';
import { stlFileManager } from '@/lib/openscad';
import { logger, metrics } from '@/lib/logger';
import { env } from '@/lib/env';

// UUID validation schema
const UUIDSchema = z.string().uuid();

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET handler for downloading STL files
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  // Validate UUID format (prevent path traversal attacks)
  const validation = UUIDSchema.safeParse(id);
  if (!validation.success) {
    logger.warn('Invalid download ID format', { id });
    return NextResponse.json(
      { error: 'Invalid file ID format' },
      { status: 400 }
    );
  }

  try {
    // Get job paths
    const paths = stlFileManager.getJobPaths(id);

    if (!paths) {
      logger.warn('Job not found', { id });
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if STL file exists
    const exists = await stlFileManager.fileExists(paths.stlPath);
    if (!exists) {
      logger.warn('STL file not found', { id, path: paths.stlPath });
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Check if file is expired
    const expired = await stlFileManager.isFileExpired(
      paths.stlPath,
      env.FILE_RETENTION_MS
    );
    if (expired) {
      logger.info('STL file expired', { id });
      // Clean up expired file
      await stlFileManager.cleanupJob(id);
      return NextResponse.json(
        { error: 'File has expired' },
        { status: 410 } // 410 Gone
      );
    }

    // Read STL file
    const fileBuffer = await fs.readFile(paths.stlPath);
    const stats = await fs.stat(paths.stlPath);

    // Generate filename with short ID
    const shortId = id.slice(0, 8);
    const filename = `gridfinity-cutout-${shortId}.stl`;

    // Log download
    logger.info('STL download', {
      id,
      filename,
      size: stats.size,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    metrics.recordDownload();

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/sla', // STL MIME type
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    logger.error('Download error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      id,
    });

    // Check for specific error types
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}

// Export runtime configuration
export const runtime = 'nodejs';
