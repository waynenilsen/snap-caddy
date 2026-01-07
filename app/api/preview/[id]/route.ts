/**
 * Preview retrieval API route
 * GET /api/preview/[id] - Get preview image for a generated job
 */

import { promises as fs } from "node:fs";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { stlFileManager } from "@/lib/openscad";

// UUID validation schema
const UUIDSchema = z.string().uuid();

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET handler for retrieving preview images
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  // Validate UUID format (prevent path traversal attacks)
  const validation = UUIDSchema.safeParse(id);
  if (!validation.success) {
    logger.warn("Invalid preview ID format", { id });
    return NextResponse.json(
      { error: "Invalid job ID format" },
      { status: 400 },
    );
  }

  try {
    // Get job paths
    const paths = stlFileManager.getJobPaths(id);

    if (!paths) {
      logger.warn("Job not found", { id });
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Check if preview file exists
    const exists = await stlFileManager.fileExists(paths.previewPath);
    if (!exists) {
      logger.warn("Preview file not found", { id, path: paths.previewPath });
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    // Read preview image
    const imageBuffer = await fs.readFile(paths.previewPath);
    const stats = await fs.stat(paths.previewPath);

    logger.debug("Preview retrieved", {
      id,
      size: stats.size,
    });

    // Return image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": stats.size.toString(),
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error("Preview retrieval error", {
      error: error instanceof Error ? error.message : "Unknown error",
      id,
    });

    // Check for specific error types
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to retrieve preview" },
      { status: 500 },
    );
  }
}

// Export runtime configuration
export const runtime = "nodejs";
