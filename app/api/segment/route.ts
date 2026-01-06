/**
 * Segment API Route
 * Handles SAM (Segment Anything Model) segmentation requests
 */

import { type NextRequest, NextResponse } from 'next/server';
import { SegmentRequestSchema } from '@/schemas/segment';
import { validateBase64Image, decodeBase64Image } from '@/lib/validation/image';
import { runSAMSegmentation } from '@/lib/sam/inference';
import { withRateLimit } from '@/lib/api/rateLimit';
import { withErrorHandler, APIError } from '@/lib/api/errors';
import { logger, metrics } from '@/lib/logger';
import type { SegmentResponse } from '@/types/api';

// Runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/segment
 * Segment an image using SAM
 */
async function segmentHandler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await req.json();

    // Validate request with Zod schema
    const parseResult = SegmentRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues;
      logger.warn('Invalid segment request', {
        errors: issues,
      });

      throw new APIError(
        `Invalid request: ${issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'INVALID_INPUT',
        400,
        issues
      );
    }

    const request = parseResult.data;

    // Validate image size and dimensions
    const imageValidation = validateBase64Image(request.image, {
      maxSize: 10 * 1024 * 1024, // 10MB
      maxWidth: 4096,
      maxHeight: 4096,
      allowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
    });

    if (!imageValidation.valid) {
      logger.warn('Image validation failed', {
        error: imageValidation.error,
        size: imageValidation.size,
      });

      throw new APIError(
        imageValidation.error || 'Image validation failed',
        'INVALID_INPUT',
        400
      );
    }

    // Validate dimensions
    if (request.imageWidth > 4096 || request.imageHeight > 4096) {
      throw new APIError(
        'Image dimensions exceed maximum allowed size (4096x4096)',
        'IMAGE_TOO_LARGE',
        400
      );
    }

    logger.info('Processing segmentation request', {
      imageWidth: request.imageWidth,
      imageHeight: request.imageHeight,
      pointCount: request.points.length,
      imageSize: imageValidation.size,
    });

    // Decode image to buffer
    const imageBuffer = decodeBase64Image(request.image);

    // Run SAM segmentation
    const samResult = await runSAMSegmentation({
      imageBuffer,
      points: request.points,
      imageWidth: request.imageWidth,
      imageHeight: request.imageHeight,
      returnMultiple: request.returnMultipleMasks,
      outputFormat: request.maskFormat,
    });

    const processingTimeMs = Date.now() - startTime;

    // Record metrics
    metrics.recordSegmentation(processingTimeMs);

    // Build response
    const response: SegmentResponse = {
      success: true,
      masks: samResult.masks,
      imageWidth: request.imageWidth,
      imageHeight: request.imageHeight,
      processingTimeMs,
    };

    logger.info('Segmentation completed successfully', {
      maskCount: samResult.masks.length,
      processingTimeMs,
    });

    return NextResponse.json(response);
  } catch (error) {
    // APIError will be handled by withErrorHandler
    if (error instanceof APIError) {
      throw error;
    }

    // Handle SAM-specific errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Segmentation error', {
      error: errorMessage,
      duration: Date.now() - startTime,
    });

    // Check if it's a SAM/Replicate error
    if (errorMessage.includes('Replicate') || errorMessage.includes('prediction')) {
      throw new APIError(
        'SAM segmentation service error',
        'SAM_ERROR',
        503,
        { originalError: errorMessage }
      );
    }

    // Generic server error
    throw new APIError(
      'Internal server error during segmentation',
      'SERVER_ERROR',
      500,
      { originalError: errorMessage }
    );
  }
}

// Export wrapped handler with middleware
export const POST = withErrorHandler(
  withRateLimit(segmentHandler, {
    maxRequests: 10,
    windowMs: 60000, // 10 requests per minute
  })
);
