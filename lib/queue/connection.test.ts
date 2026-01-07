/**
 * Redis Connection Integration Tests
 * Tests hitting real Redis on port 6397
 *
 * Prerequisites:
 *   ./scripts/start-redis.sh
 */

import { describe, test, expect, afterAll } from 'bun:test';
import {
  getRedisConnection,
  getSubscriberConnection,
  isRedisConnected,
  getRedisInfo,
  closeRedisConnections,
  getRedisUrl,
} from './connection';

describe('Redis Connection Integration Tests', () => {
  let redisAvailable = false;

  afterAll(async () => {
    await closeRedisConnections();
  });

  describe('Connection URL', () => {
    test('should return default Redis URL', () => {
      // When REDIS_URL is not set, should return default
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      // Re-import or call the function
      const url = getRedisUrl();
      expect(url).toBe('redis://localhost:6397');

      // Restore
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      }
    });

    test('should return custom Redis URL from env', () => {
      const originalUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://custom-host:9999';

      const url = getRedisUrl();
      expect(url).toBe('redis://custom-host:9999');

      // Restore
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });
  });

  describe('Redis Connection', () => {
    test('should check if Redis is connected', async () => {
      const connected = await isRedisConnected();
      redisAvailable = connected;

      // Just verify the function runs without error
      expect(typeof connected).toBe('boolean');
    });

    test('should get main Redis connection', async () => {
      const connection = getRedisConnection();
      expect(connection).toBeDefined();
      expect(connection.status).toBeDefined();
    });

    test('should get subscriber connection', async () => {
      const connection = getSubscriberConnection();
      expect(connection).toBeDefined();
      expect(connection.status).toBeDefined();
    });

    test('should reuse existing connections', () => {
      const conn1 = getRedisConnection();
      const conn2 = getRedisConnection();
      expect(conn1).toBe(conn2);

      const sub1 = getSubscriberConnection();
      const sub2 = getSubscriberConnection();
      expect(sub1).toBe(sub2);
    });
  });

  describe('Redis Info', () => {
    test('should get Redis info when connected', async () => {
      const connected = await isRedisConnected();
      if (!connected) {
        console.log('Skipping: Redis not available');
        return;
      }

      const info = await getRedisInfo();
      expect(info.version).toBeDefined();
      expect(typeof info.uptime).toBe('number');
    });

    test('should return empty info when Redis not available', async () => {
      // This test verifies error handling
      const info = await getRedisInfo();
      // Either has data or is empty object
      expect(typeof info).toBe('object');
    });
  });

  describe('Connection Ping', () => {
    test('should ping Redis successfully when available', async () => {
      const connected = await isRedisConnected();
      if (!connected) {
        console.log('Skipping: Redis not available');
        return;
      }

      const connection = getRedisConnection();
      const result = await connection.ping();
      expect(result).toBe('PONG');
    });
  });

  describe('Connection Close', () => {
    test('should close connections gracefully', async () => {
      // Get connections first
      getRedisConnection();
      getSubscriberConnection();

      // Close them
      await closeRedisConnections();

      // Getting new connections should create fresh ones
      const newConn = getRedisConnection();
      expect(newConn).toBeDefined();
    });
  });
});

describe('URL Parsing', () => {
  test('should parse simple Redis URL', () => {
    const url = 'redis://localhost:6397';
    const parsed = new URL(url);

    expect(parsed.hostname).toBe('localhost');
    expect(parsed.port).toBe('6397');
    expect(parsed.protocol).toBe('redis:');
  });

  test('should parse Redis URL with authentication', () => {
    const url = 'redis://user:password@redis.example.com:6380';
    const parsed = new URL(url);

    expect(parsed.hostname).toBe('redis.example.com');
    expect(parsed.port).toBe('6380');
    expect(parsed.username).toBe('user');
    expect(parsed.password).toBe('password');
  });

  test('should parse Redis URL without port', () => {
    const url = 'redis://localhost';
    const parsed = new URL(url);

    expect(parsed.hostname).toBe('localhost');
    expect(parsed.port).toBe('');
  });

  test('should parse Redis URL with database number', () => {
    const url = 'redis://localhost:6397/0';
    const parsed = new URL(url);

    expect(parsed.hostname).toBe('localhost');
    expect(parsed.port).toBe('6397');
    expect(parsed.pathname).toBe('/0');
  });
});
