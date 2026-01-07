/**
 * Record/Replay Individual Recording API
 *
 * DELETE: Delete a specific recording by hash
 *
 * Only available in dev mode.
 */

import { type NextRequest, NextResponse } from "next/server";
import { isDev } from "@/lib/env";
import { deleteRecording, loadRecording } from "@/lib/replicate";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    hash: string;
  }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  // Only accessible in dev mode
  if (!isDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { hash } = await params;

  // Validate hash format (should be 16 hex characters)
  if (!/^[a-f0-9]{16}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
  }

  const recording = loadRecording(hash);

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  return NextResponse.json({ recording });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  // Only accessible in dev mode
  if (!isDev()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { hash } = await params;

  // Validate hash format (should be 16 hex characters)
  if (!/^[a-f0-9]{16}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
  }

  const deleted = deleteRecording(hash);

  if (!deleted) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    hash,
  });
}
