/**
 * Replicate API Record/Replay System
 *
 * This module provides HTTP recording and replay functionality for Replicate API calls.
 * It enables deterministic testing without making actual API calls, reducing costs
 * and improving test reliability.
 *
 * Key Features:
 * - Stable request hashing (handles JSON key ordering)
 * - File-based recording storage (checked into version control)
 * - Transparent integration with existing fetch calls
 *
 * @see docs/record-replay.md for comprehensive documentation
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { env, isDev } from "@/lib/env";
import { logger } from "@/lib/logger";

// Types
export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface RecordedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface Recording {
  timestamp: string;
  requestHash: string;
  request: RecordedRequest;
  response: RecordedResponse;
}

export interface RecordingMetadata {
  hash: string;
  filename: string;
  timestamp: string;
  method: string;
  url: string;
  description?: string;
}

// Constants
const FIXTURES_DIR = path.join(process.cwd(), "fixtures", "replicate");

/**
 * Deeply sorts object keys to ensure consistent JSON stringification.
 * This is critical for generating stable hashes regardless of property order.
 *
 * JavaScript objects don't guarantee key order for integer-like keys,
 * and JSON.stringify output can vary based on insertion order.
 * This function normalizes that behavior.
 *
 * @param obj - Any value to sort (only objects are affected)
 * @returns The input with all nested objects having sorted keys
 */
export function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return obj;
}

/**
 * Generates a stable hash for a request.
 * The hash is based on method, URL, and sorted body content.
 *
 * We exclude headers from the hash because:
 * - Authorization tokens change between sessions
 * - Timestamps and request IDs vary
 * - Only the semantic content matters for replay
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param url - Request URL
 * @param body - Request body (will be sorted before hashing)
 * @returns SHA256 hash truncated to 16 characters
 */
export function generateRequestHash(
  method: string,
  url: string,
  body?: unknown,
): string {
  // Normalize URL by removing any timestamp query params
  const normalizedUrl = normalizeUrl(url);

  // Sort body keys for consistent hashing
  const sortedBody = body ? sortObjectKeys(body) : null;

  // Create hash input
  const hashInput = JSON.stringify({
    method: method.toUpperCase(),
    url: normalizedUrl,
    body: sortedBody,
  });

  // Generate SHA256 hash, truncated for readability
  const hash = crypto.createHash("sha256").update(hashInput).digest("hex");
  return hash.substring(0, 16);
}

/**
 * Normalizes URL for consistent hashing.
 * Removes volatile query parameters that change between requests.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove timestamp-like params that might vary
    parsed.searchParams.delete("_t");
    parsed.searchParams.delete("timestamp");
    // Sort query params for consistency
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Ensures the fixtures directory exists.
 */
function ensureFixturesDir(): void {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    logger.info("Created replicate fixtures directory", { path: FIXTURES_DIR });
  }
}

/**
 * Gets the file path for a recording based on its hash.
 */
function getRecordingPath(hash: string): string {
  return path.join(FIXTURES_DIR, `${hash}.json`);
}

/**
 * Saves a recording to disk.
 *
 * @param recording - The complete recording to save
 */
export function saveRecording(recording: Recording): void {
  ensureFixturesDir();

  const filePath = getRecordingPath(recording.requestHash);
  fs.writeFileSync(filePath, JSON.stringify(recording, null, 2), "utf-8");

  logger.info("Saved replicate recording", {
    hash: recording.requestHash,
    url: recording.request.url,
    path: filePath,
  });
}

/**
 * Loads a recording from disk.
 *
 * @param hash - The request hash to look up
 * @returns The recording if found, null otherwise
 */
export function loadRecording(hash: string): Recording | null {
  const filePath = getRecordingPath(hash);

  if (!fs.existsSync(filePath)) {
    logger.debug("No recording found for hash", { hash, path: filePath });
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const recording = JSON.parse(content) as Recording;
    logger.debug("Loaded replicate recording", {
      hash,
      url: recording.request.url,
    });
    return recording;
  } catch (error) {
    logger.error("Failed to load recording", {
      hash,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Lists all available recordings.
 *
 * @returns Array of recording metadata
 */
export function listRecordings(): RecordingMetadata[] {
  ensureFixturesDir();

  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  const recordings: RecordingMetadata[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(FIXTURES_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const recording = JSON.parse(content) as Recording;
      recordings.push({
        hash: recording.requestHash,
        filename: file,
        timestamp: recording.timestamp,
        method: recording.request.method,
        url: recording.request.url,
      });
    } catch {
      // Skip invalid files
    }
  }

  return recordings.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Deletes a recording by hash.
 *
 * @param hash - The request hash to delete
 * @returns true if deleted, false if not found
 */
export function deleteRecording(hash: string): boolean {
  const filePath = getRecordingPath(hash);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  logger.info("Deleted replicate recording", { hash });
  return true;
}

/**
 * Deletes all recordings.
 *
 * @returns Number of recordings deleted
 */
export function clearAllRecordings(): number {
  ensureFixturesDir();

  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  let count = 0;

  for (const file of files) {
    try {
      fs.unlinkSync(path.join(FIXTURES_DIR, file));
      count++;
    } catch {
      // Ignore errors
    }
  }

  logger.info("Cleared all replicate recordings", { count });
  return count;
}

/**
 * Gets the current record/replay mode.
 */
export function getRecordMode(): "off" | "record" | "replay" {
  return env.REPLICATE_RECORD_MODE;
}

/**
 * Checks if recording is currently enabled.
 */
export function isRecordingEnabled(): boolean {
  return env.REPLICATE_RECORD_MODE === "record";
}

/**
 * Checks if replay is currently enabled.
 */
export function isReplayEnabled(): boolean {
  return env.REPLICATE_RECORD_MODE === "replay";
}

/**
 * Checks if the dev page should be accessible.
 * Only available in dev stage.
 */
export function isDevPageAccessible(): boolean {
  return isDev();
}

/**
 * A fetch-like function type for the recorder
 */
type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Creates a recorded fetch wrapper.
 * This intercepts fetch calls to record/replay responses.
 *
 * @param originalFetch - The original fetch function
 * @returns A wrapped fetch function with record/replay capability
 */
export function createRecordedFetch(
  originalFetch: FetchFunction = globalThis.fetch,
): FetchFunction {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    let body: unknown;

    // Parse body if present
    if (init?.body) {
      try {
        body =
          typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      } catch {
        body = init.body;
      }
    }

    const requestHash = generateRequestHash(method, url, body);
    const mode = getRecordMode();

    // Replay mode: try to load from cache first, then fall through to real API
    if (mode === "replay") {
      const recording = loadRecording(requestHash);
      if (recording) {
        logger.info("Replaying recorded response", {
          hash: requestHash,
          url,
          method,
        });

        // Create a mock Response object
        return new Response(JSON.stringify(recording.response.body), {
          status: recording.response.status,
          statusText: recording.response.statusText,
          headers: recording.response.headers,
        });
      }
      // No recording found - fall through to real API and record for next time
      logger.info("No recording found, proxying to real API", {
        hash: requestHash,
        url,
        method,
      });
    }

    // Make the actual request
    const response = await originalFetch(input, init);

    // Record mode OR replay mode cache miss: save the response
    if (mode === "record" || mode === "replay") {
      // Clone response so we can read the body
      const clonedResponse = response.clone();
      const responseBody = await clonedResponse.json().catch(() => null);

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Filter sensitive headers from request
      const requestHeaders: Record<string, string> = {};
      if (init?.headers) {
        const headers =
          init.headers instanceof Headers
            ? init.headers
            : new Headers(init.headers as HeadersInit);
        headers.forEach((value, key) => {
          // Don't record sensitive headers
          if (key.toLowerCase() !== "authorization") {
            requestHeaders[key] = value;
          }
        });
      }

      const recording: Recording = {
        timestamp: new Date().toISOString(),
        requestHash,
        request: {
          method,
          url,
          headers: requestHeaders,
          body,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
        },
      };

      saveRecording(recording);
    }

    return response;
  };
}

/**
 * Gets the Replicate API base URL.
 * Returns the override URL if set, otherwise the default.
 */
export function getReplicateBaseUrl(): string {
  return env.REPLICATE_BASE_URL ?? "https://api.replicate.com";
}

/**
 * Gets the fixture directory path.
 */
export function getFixturesDir(): string {
  return FIXTURES_DIR;
}
