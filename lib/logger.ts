/**
 * Simple logger utility for Snap Caddy
 * Provides structured logging for API routes
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'];

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context));
    }
  },

  error(message: string, context?: LogContext): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, context));
    }
  },
};

// Metrics tracking
export const metrics = {
  segmentationRequests: 0,
  generationRequests: 0,
  downloads: 0,
  errors: 0,

  recordSegmentation(durationMs: number): void {
    this.segmentationRequests++;
    logger.info('Segmentation metric', { durationMs, total: this.segmentationRequests });
  },

  recordGeneration(durationMs: number): void {
    this.generationRequests++;
    logger.info('Generation metric', { durationMs, total: this.generationRequests });
  },

  recordDownload(): void {
    this.downloads++;
    logger.info('Download metric', { total: this.downloads });
  },

  recordError(error: Error, context?: LogContext): void {
    this.errors++;
    logger.error('Error metric', { error: error.message, ...context, totalErrors: this.errors });
  },

  getStats(): Record<string, number> {
    return {
      segmentationRequests: this.segmentationRequests,
      generationRequests: this.generationRequests,
      downloads: this.downloads,
      errors: this.errors,
    };
  },
};
