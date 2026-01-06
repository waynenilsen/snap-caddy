/**
 * Generate API Route
 * Handles STL file generation from SVG cutouts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema } from '@/schemas/generate';
import { validateSVG } from '@/lib/validation/svg';
import { validateBinConfig } from '@/types/configuration';
import { stlFileManager } from '@/lib/openscad/fileManager';
import { openscadGenerator } from '@/lib/openscad/generator';
import { openscadExecutor } from '@/lib/openscad/executor';
import { withRateLimit } from '@/lib/api/rateLimit';
import { withErrorHandler, APIError } from '@/lib/api/errors';
import { logger, metrics } from '@/lib/logger';
import type { GenerateResponse, GenerationStatusResponse } from '@/types/api';
import type { GridfinityBinConfig } from '@/types/configuration';

// Runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 60;

// In-memory job status store (use Redis/database for production)
const jobStatusStore = new Map<string, GenerationStatusResponse>();

/**
 * Convert API GridfinityConfig to GridfinityBinConfig
 * Applies defaults for optional values
 */
function apiConfigToBinConfig(config: {
  gridUnitsX: number;
  gridUnitsY: number;
  binHeight: number;
  cutoutDepth: number;
  wallThickness?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  magnetHoles?: boolean;
  screwHoles?: boolean;
  stackingLip?: boolean;
  cornerRadius?: number;
  baseThickness?: number;
}): GridfinityBinConfig {
  // Apply defaults
  const wallThickness = config.wallThickness ?? 1.2;
  const paddingTop = config.paddingTop ?? 2;
  const paddingBottom = config.paddingBottom ?? 2;
  const paddingLeft = config.paddingLeft ?? 2;
  const paddingRight = config.paddingRight ?? 2;
  const magnetHoles = config.magnetHoles ?? true;
  const screwHoles = config.screwHoles ?? false;
  const stackingLip = config.stackingLip ?? true;
  const cornerRadius = config.cornerRadius ?? 0.5;

  return {
    gridUnitsX: config.gridUnitsX,
    gridUnitsY: config.gridUnitsY,
    binHeight: config.binHeight,
    cutoutDepth: config.cutoutDepth,
    cutoutPadding: (paddingTop + paddingBottom + paddingLeft + paddingRight) / 4,
    cutoutOffsetX: 0,
    cutoutOffsetY: 0,
    wallThickness,
    baseType: magnetHoles && screwHoles
      ? 'magnet_screw'
      : magnetHoles
        ? 'magnet'
        : screwHoles
          ? 'screw'
          : 'solid',
    lipStyle: stackingLip ? 'normal' : 'none',
    cornerRadius,
  };
}

/**
 * POST /api/generate
 * Generate an STL file from SVG and configuration
 */
async function generateHandler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await req.json();

    // Validate request with Zod schema
    const parseResult = GenerateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues;
      logger.warn('Invalid generate request', {
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

    // Validate SVG
    const svgValidation = validateSVG(request.svg);
    if (!svgValidation.valid) {
      logger.warn('SVG validation failed', {
        error: svgValidation.error,
      });

      throw new APIError(
        svgValidation.error || 'SVG validation failed',
        'INVALID_SVG',
        400
      );
    }

    // Convert and validate bin config
    const binConfig = apiConfigToBinConfig(request.config);
    const configValidation = validateBinConfig(binConfig);

    if (!configValidation.valid) {
      logger.warn('Config validation failed', {
        errors: configValidation.errors,
      });

      throw new APIError(
        `Invalid configuration: ${configValidation.errors.join(', ')}`,
        'INVALID_INPUT',
        400,
        { errors: configValidation.errors, warnings: configValidation.warnings }
      );
    }

    // Log warnings if any
    if (configValidation.warnings.length > 0) {
      logger.info('Config validation warnings', {
        warnings: configValidation.warnings,
      });
    }

    logger.info('Processing generation request', {
      async: request.async,
      config: binConfig,
    });

    // Create job paths
    const jobPaths = await stlFileManager.createJobPaths();
    const generationId = jobPaths.jobId;

    // Initialize job status
    const jobStatus: GenerationStatusResponse = {
      id: generationId,
      status: request.async ? 'queued' : 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    jobStatusStore.set(generationId, jobStatus);

    // If async, return immediately with queued status
    if (request.async) {
      logger.info('Queued async generation', { generationId });

      const response: GenerateResponse = {
        success: true,
        generationId,
        status: 'queued',
        queuePosition: 1, // For future implementation with real queue
        estimatedTimeMs: 30000,
      };

      // Note: In a real implementation, you would queue this job for background processing
      // For now, we just return the queued status but don't actually process it
      logger.warn('Async generation not yet implemented - job will remain queued', {
        generationId,
      });

      return NextResponse.json(response);
    }

    // Synchronous processing
    try {
      // Update status
      jobStatus.status = 'processing';
      jobStatus.progress = 10;

      // Write SVG file
      await stlFileManager.writeSVG(jobPaths.svgPath, request.svg);
      logger.debug('SVG file written', { path: jobPaths.svgPath });

      jobStatus.progress = 20;

      // Generate OpenSCAD file
      const scadResult = await openscadGenerator.generate(
        jobPaths.svgPath,
        binConfig,
        jobPaths.scadPath
      );

      if (!scadResult.success || !scadResult.scadPath) {
        throw new APIError(
          scadResult.error || 'Failed to generate OpenSCAD file',
          'OPENSCAD_ERROR',
          500
        );
      }

      logger.debug('OpenSCAD file generated', { path: scadResult.scadPath });
      jobStatus.progress = 40;

      // Render STL file
      const renderResult = await openscadExecutor.render(
        scadResult.scadPath,
        jobPaths.stlPath
      );

      if (!renderResult.success || !renderResult.outputPath) {
        logger.error('OpenSCAD render failed', {
          error: renderResult.error,
          stderr: renderResult.stderr,
        });

        throw new APIError(
          renderResult.error || 'Failed to render STL file',
          'OPENSCAD_ERROR',
          500,
          { stderr: renderResult.stderr }
        );
      }

      logger.info('STL file rendered successfully', {
        path: renderResult.outputPath,
        duration: renderResult.duration,
      });

      jobStatus.progress = 100;
      jobStatus.status = 'complete';
      jobStatus.completedAt = new Date().toISOString();
      jobStatus.downloadUrl = `/api/download/${generationId}`;

      const processingTimeMs = Date.now() - startTime;

      // Record metrics
      metrics.recordGeneration(processingTimeMs);

      // Build response
      const response: GenerateResponse = {
        success: true,
        generationId,
        status: 'complete',
        downloadUrl: `/api/download/${generationId}`,
        estimatedTimeMs: processingTimeMs,
      };

      logger.info('Generation completed successfully', {
        generationId,
        processingTimeMs,
      });

      return NextResponse.json(response);
    } catch (error) {
      // Update job status to error
      jobStatus.status = 'error';
      jobStatus.error = error instanceof Error ? error.message : 'Unknown error';
      jobStatus.completedAt = new Date().toISOString();

      throw error;
    }
  } catch (error) {
    // APIError will be handled by withErrorHandler
    if (error instanceof APIError) {
      throw error;
    }

    // Generic server error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Generation error', {
      error: errorMessage,
      duration: Date.now() - startTime,
    });

    throw new APIError(
      'Internal server error during generation',
      'SERVER_ERROR',
      500,
      { originalError: errorMessage }
    );
  }
}

/**
 * GET /api/generate
 * Get generation status by ID
 */
async function getStatusHandler(req: NextRequest): Promise<NextResponse> {
  try {
    // Get id from query params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new APIError(
        'Missing id query parameter',
        'INVALID_INPUT',
        400
      );
    }

    // Get job status
    const jobStatus = jobStatusStore.get(id);

    if (!jobStatus) {
      throw new APIError(
        'Generation not found',
        'INVALID_INPUT',
        404
      );
    }

    logger.debug('Retrieved generation status', { id, status: jobStatus.status });

    return NextResponse.json(jobStatus);
  } catch (error) {
    // APIError will be handled by withErrorHandler
    if (error instanceof APIError) {
      throw error;
    }

    // Generic server error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Get status error', {
      error: errorMessage,
    });

    throw new APIError(
      'Internal server error',
      'SERVER_ERROR',
      500,
      { originalError: errorMessage }
    );
  }
}

// Export wrapped handlers with middleware
export const POST = withErrorHandler(
  withRateLimit(generateHandler, {
    maxRequests: 5,
    windowMs: 60000, // 5 requests per minute
  })
);

export const GET = withErrorHandler(getStatusHandler);
