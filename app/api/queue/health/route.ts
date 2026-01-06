/**
 * Queue Health API Route
 * Returns health status of the job queue system
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getQueueHealth, initializeQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// Initialize queue on first request
let initialized = false;

/**
 * GET /api/queue/health
 * Get queue health status
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // Initialize queue if not already done
    if (!initialized) {
      try {
        initializeQueue();
        initialized = true;
      } catch (error) {
        logger.warn('Queue not initialized', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const health = await getQueueHealth();

    // Determine overall health status
    const isHealthy = health.connected && health.redis.ping;
    const status = isHealthy ? 'healthy' : 'unhealthy';

    logger.debug('Queue health check', { status, ...health });

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        ...health,
      },
      {
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Queue health check failed', { error: errorMessage });

    return NextResponse.json(
      {
        status: 'error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
