/**
 * Record/Replay Recordings API
 *
 * GET: List all recordings
 * DELETE: Clear all recordings
 *
 * Only available in dev mode.
 */

import { NextResponse } from "next/server";
import { isDev } from "@/lib/env";
import { clearAllRecordings, listRecordings } from "@/lib/replicate";

export const dynamic = "force-dynamic";

export async function GET() {
  // Only accessible in dev mode
  if (!isDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const recordings = listRecordings();

  return NextResponse.json({
    recordings,
    count: recordings.length,
  });
}

export async function DELETE() {
  // Only accessible in dev mode
  if (!isDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const count = clearAllRecordings();

  return NextResponse.json({
    success: true,
    deletedCount: count,
  });
}
