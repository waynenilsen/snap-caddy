/**
 * Redis Connection Management
 * Handles Redis connection for BullMQ queue system
 */

import Redis, { type RedisOptions } from "ioredis";
import { logger } from "@/lib/logger";

// Default Redis URL using non-standard port to avoid collisions
const DEFAULT_REDIS_URL = "redis://localhost:6397";

let redisConnection: Redis | null = null;
let subscriberConnection: Redis | null = null;

/**
 * Get the Redis URL from environment or default
 */
export function getRedisUrl(): string {
  return process.env.REDIS_URL || DEFAULT_REDIS_URL;
}

/**
 * Create Redis connection options from URL
 * Exported so BullMQ can create its own connections
 */
export function createConnectionOptions(url: string): RedisOptions {
  const parsed = new URL(url);

  const options: RedisOptions = {
    host: parsed.hostname || "localhost",
    port: Number.parseInt(parsed.port, 10) || 6397,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error("Redis connection failed after 10 retries");
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis connection retry ${times}, waiting ${delay}ms`);
      return delay;
    },
  };

  if (parsed.password) {
    options.password = parsed.password;
  }

  if (parsed.username) {
    options.username = parsed.username;
  }

  return options;
}

/**
 * Get or create the main Redis connection
 * Used for queue operations
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const url = getRedisUrl();
    logger.info("Creating Redis connection", {
      url: url.replace(/\/\/.*@/, "//***@"),
    });

    const options = createConnectionOptions(url);
    redisConnection = new Redis(options);

    redisConnection.on("connect", () => {
      logger.info("Redis connected");
    });

    redisConnection.on("error", (error) => {
      logger.error("Redis connection error", { error: error.message });
    });

    redisConnection.on("close", () => {
      logger.warn("Redis connection closed");
    });
  }

  return redisConnection;
}

/**
 * Get or create a subscriber connection
 * BullMQ requires separate connections for pub/sub
 */
export function getSubscriberConnection(): Redis {
  if (!subscriberConnection) {
    const url = getRedisUrl();
    logger.debug("Creating Redis subscriber connection");

    const options = createConnectionOptions(url);
    subscriberConnection = new Redis(options);

    subscriberConnection.on("error", (error) => {
      logger.error("Redis subscriber error", { error: error.message });
    });
  }

  return subscriberConnection;
}

/**
 * Check if Redis is connected and responsive
 */
export async function isRedisConnected(): Promise<boolean> {
  try {
    const conn = getRedisConnection();
    const result = await conn.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * Get Redis server info
 */
export async function getRedisInfo(): Promise<{
  version?: string;
  uptime?: number;
  connectedClients?: number;
  usedMemory?: number;
}> {
  try {
    const conn = getRedisConnection();
    const info = await conn.info("server");
    const memory = await conn.info("memory");
    const clients = await conn.info("clients");

    const parseInfo = (text: string, key: string): string | undefined => {
      const match = text.match(new RegExp(`${key}:(.+)`));
      return match ? match[1].trim() : undefined;
    };

    return {
      version: parseInfo(info, "redis_version"),
      uptime: Number.parseInt(parseInfo(info, "uptime_in_seconds") || "0", 10),
      connectedClients: Number.parseInt(
        parseInfo(clients, "connected_clients") || "0",
        10,
      ),
      usedMemory: Number.parseInt(parseInfo(memory, "used_memory") || "0", 10),
    };
  } catch (error) {
    logger.error("Failed to get Redis info", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  logger.info("Closing Redis connections");

  const closePromises: Promise<void>[] = [];

  if (redisConnection) {
    closePromises.push(
      redisConnection.quit().then(() => {
        redisConnection = null;
      }),
    );
  }

  if (subscriberConnection) {
    closePromises.push(
      subscriberConnection.quit().then(() => {
        subscriberConnection = null;
      }),
    );
  }

  await Promise.all(closePromises);
  logger.info("Redis connections closed");
}

/**
 * Get connection options for BullMQ
 * Returns raw options so BullMQ creates connections with its bundled ioredis
 */
export function getBullMQConnectionOptions(): RedisOptions {
  return createConnectionOptions(getRedisUrl());
}
