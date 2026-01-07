/**
 * Record/Replay Status API
 *
 * Returns current configuration for the record/replay system.
 * Only available in dev mode.
 */

import { NextResponse } from "next/server";
import { env, isDev } from "@/lib/env";
import {
  getFixturesDir,
  getRecordMode,
  getReplicateBaseUrl,
  listRecordings,
} from "@/lib/replicate";

export const dynamic = "force-dynamic";

export async function GET() {
  // Only accessible in dev mode
  if (!isDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const recordings = listRecordings();

  return NextResponse.json({
    stage: env.STAGE,
    recordMode: getRecordMode(),
    baseUrl: getReplicateBaseUrl(),
    fixturesDir: getFixturesDir(),
    recordingsCount: recordings.length,
  });
}
