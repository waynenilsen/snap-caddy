/**
 * Environment Configuration
 * Validates and provides typed access to environment variables
 */

import { z } from 'zod';

const envSchema = z.object({
  // SAM Segmentation
  REPLICATE_API_TOKEN: z.string().min(1).optional(),
  SAM_MODEL_VERSION: z.string().default('meta/sam-2-hiera-large'),

  // OpenSCAD
  OPENSCAD_PATH: z.string().default('openscad'),
  GRIDFINITY_LIB_PATH: z.string().default('/usr/local/share/gridfinity'),
  OPENSCAD_USE_XVFB: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .pipe(z.boolean())
    .catch(true),
  OPENSCAD_TIMEOUT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 300000))
    .pipe(z.number().positive())
    .catch(300000),

  // File Storage
  TEMP_DIR: z.string().default('/tmp/snap-caddy'),
  MAX_FILE_SIZE: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 10485760))
    .pipe(z.number().positive())
    .catch(10485760),
  FILE_RETENTION_MS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3600000))
    .pipe(z.number().positive())
    .catch(3600000),

  // Rate Limiting
  RATE_LIMIT_REQUESTS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 10))
    .pipe(z.number().int().positive())
    .catch(10),
  RATE_LIMIT_WINDOW: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 60000))
    .pipe(z.number().int().positive())
    .catch(60000),

  // Features
  GENERATE_PREVIEWS: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .pipe(z.boolean())
    .catch(false),
  ENABLE_ASYNC_GENERATION: z
    .string()
    .optional()
    .transform((v) => v === 'true')
    .pipe(z.boolean())
    .catch(false),

  // Redis/Queue Configuration
  REDIS_URL: z.string().default('redis://localhost:6397'),
  QUEUE_CONCURRENCY: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3))
    .pipe(z.number().int().positive())
    .catch(3),
  QUEUE_JOB_TIMEOUT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 300000))
    .pipe(z.number().positive())
    .catch(300000),
  QUEUE_MAX_RETRIES: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3))
    .pipe(z.number().int().min(0))
    .catch(3),
  QUEUE_CLEANUP_INTERVAL: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3600000))
    .pipe(z.number().positive())
    .catch(3600000),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Parse environment variables
function parseEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    // Return defaults instead of throwing in development
    return envSchema.parse({});
  }

  return parsed.data;
}

export const env = parseEnv();

// Export typed environment access
export type Env = z.infer<typeof envSchema>;
