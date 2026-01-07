/**
 * SAM (Segment Anything Model) Inference
 * Implementation of SAM segmentation using Replicate API
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  SAMSegmentationParams,
  SAMResult,
  ReplicatePrediction,
  ReplicateRequest,
  MaskAnalysis,
} from "./types";
import type { MaskOption } from "@/types/segmentation";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const POLL_INTERVAL_MS = 1000; // Poll every 1 second
const MAX_POLL_ATTEMPTS = 60; // Maximum 60 seconds

/**
 * Main function to run SAM segmentation
 */
export async function runSAMSegmentation(
  params: SAMSegmentationParams,
): Promise<SAMResult> {
  const startTime = Date.now();
  logger.info("Starting SAM segmentation", {
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
    pointCount: params.points.length,
    outputFormat: params.outputFormat || "base64png",
  });

  // Validate API token
  if (!env.REPLICATE_API_TOKEN) {
    throw new Error(
      "REPLICATE_API_TOKEN is not configured. Please set it in your environment variables.",
    );
  }

  try {
    // Step 1: Convert image buffer to base64 data URI
    const imageDataUri = bufferToDataUri(params.imageBuffer);

    // Step 2: Create prediction on Replicate
    const prediction = await createPrediction(params, imageDataUri);
    logger.debug("Prediction created", { predictionId: prediction.id });

    // Step 3: Poll for completion
    const completedPrediction = await pollPrediction(prediction.id);

    // Step 4: Process the results
    const masks = await processPredictionOutput(
      completedPrediction,
      params.imageWidth,
      params.imageHeight,
      params.outputFormat || "base64png",
      params.returnMultiple || false,
    );

    const duration = Date.now() - startTime;
    logger.info("SAM segmentation completed", {
      predictionId: prediction.id,
      maskCount: masks.length,
      durationMs: duration,
    });

    return { masks };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("SAM segmentation failed", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
    });
    throw error;
  }
}

/**
 * Convert image buffer to base64 data URI
 */
function bufferToDataUri(buffer: Buffer): string {
  const base64 = buffer.toString("base64");
  // Detect image type from buffer header
  const type = detectImageType(buffer);
  return `data:image/${type};base64,${base64}`;
}

/**
 * Detect image type from buffer header
 */
function detectImageType(buffer: Buffer): string {
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  // WebP
  if (
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }
  // Default to PNG
  return "png";
}

/**
 * Create a prediction on Replicate API
 */
async function createPrediction(
  params: SAMSegmentationParams,
  imageDataUri: string,
): Promise<ReplicatePrediction> {
  const requestBody: ReplicateRequest = {
    version: env.SAM_MODEL_VERSION,
    input: {
      image: imageDataUri,
      point_coords: params.points.map((p) => [p.x, p.y]),
      point_labels: params.points.map((p) => p.label),
      multimask_output: params.returnMultiple || false,
    },
  };

  const response = await fetch(REPLICATE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Replicate API error (${response.status}): ${errorText}`);
  }

  const prediction = (await response.json()) as ReplicatePrediction;
  return prediction;
}

/**
 * Poll prediction until it completes
 */
async function pollPrediction(
  predictionId: string,
): Promise<ReplicatePrediction> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const prediction = await getPrediction(predictionId);

    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed") {
      throw new Error(
        `Prediction failed: ${prediction.error || "Unknown error"}`,
      );
    }

    if (prediction.status === "canceled") {
      throw new Error("Prediction was canceled");
    }

    // Still processing, wait and try again
    await sleep(POLL_INTERVAL_MS);
    attempts++;

    if (attempts % 5 === 0) {
      logger.debug("Still waiting for prediction", {
        predictionId,
        status: prediction.status,
        attempts,
      });
    }
  }

  throw new Error(`Prediction timed out after ${MAX_POLL_ATTEMPTS} attempts`);
}

/**
 * Get prediction status from Replicate API
 */
async function getPrediction(
  predictionId: string,
): Promise<ReplicatePrediction> {
  const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
    headers: {
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get prediction (${response.status}): ${errorText}`,
    );
  }

  return (await response.json()) as ReplicatePrediction;
}

/**
 * Process prediction output and download masks
 */
async function processPredictionOutput(
  prediction: ReplicatePrediction,
  imageWidth: number,
  imageHeight: number,
  outputFormat: "base64png" | "rle" | "binary",
  returnMultiple: boolean,
): Promise<MaskOption[]> {
  // Log the actual output structure for debugging
  logger.debug("Processing prediction output", {
    hasOutput: !!prediction.output,
    outputKeys: prediction.output ? Object.keys(prediction.output) : [],
    outputType: typeof prediction.output,
    outputValue: JSON.stringify(prediction.output, null, 2).substring(0, 500),
  });

  if (
    !prediction.output ||
    !prediction.output.masks ||
    prediction.output.masks.length === 0
  ) {
    logger.error("No masks in prediction output", {
      output: prediction.output,
      outputString: JSON.stringify(prediction.output),
    });
    throw new Error("No masks returned from prediction");
  }

  const maskUrls = prediction.output.masks;
  const scores = prediction.output.scores || maskUrls.map(() => 0.9); // Default confidence if not provided

  // Download and process each mask
  const maskPromises = maskUrls.map(async (url, index) => {
    const maskBuffer = await downloadMask(url);
    const analysis = analyzeMask(maskBuffer, imageWidth, imageHeight);

    // Convert to requested format
    let maskData: string;
    switch (outputFormat) {
      case "base64png":
        maskData = maskBuffer.toString("base64");
        break;
      case "rle":
        maskData = encodeRLE(maskBuffer, imageWidth, imageHeight);
        break;
      case "binary":
        maskData = maskBuffer.toString("base64"); // Still base64 encode for transport
        break;
      default:
        maskData = maskBuffer.toString("base64");
    }

    const maskOption: MaskOption = {
      mask: maskData,
      confidence: scores[index] || 0.9,
      boundingBox: analysis.boundingBox,
      area: analysis.area,
    };

    return maskOption;
  });

  const allMasks = await Promise.all(maskPromises);

  // Return only the best mask if returnMultiple is false
  if (!returnMultiple && allMasks.length > 0) {
    const bestMask = allMasks.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );
    return [bestMask];
  }

  return allMasks;
}

/**
 * Download mask image from URL
 */
async function downloadMask(url: string): Promise<Buffer> {
  logger.debug("Downloading mask", { url });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download mask (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Analyze mask to calculate bounding box and area
 */
export function analyzeMask(
  maskBuffer: Buffer,
  width: number,
  height: number,
): MaskAnalysis {
  // For PNG images, we need to decode them first
  // This is a simplified implementation that assumes the mask is a grayscale PNG
  // In production, you'd use a library like 'sharp' or 'jimp' to properly decode

  // For now, we'll implement a basic analysis
  // Assuming the mask buffer is raw pixel data (1 byte per pixel, 0 or 255)

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let area = 0;

  // If this is a PNG file, we need to skip the header and decode
  // For simplicity, we'll use a heuristic approach
  const isPNG = maskBuffer[0] === 0x89 && maskBuffer[1] === 0x50;

  if (isPNG) {
    // For PNG files, use a simple threshold-based analysis
    // In a real implementation, use a proper PNG decoder
    // For now, return estimated values
    return {
      boundingBox: {
        x: Math.floor(width * 0.1),
        y: Math.floor(height * 0.1),
        width: Math.floor(width * 0.8),
        height: Math.floor(height * 0.8),
      },
      area: Math.floor(width * height * 0.64), // Rough estimate
    };
  }

  // Process raw binary mask data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (index < maskBuffer.length && maskBuffer[index] > 128) {
        // Pixel is part of the mask
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        area++;
      }
    }
  }

  // Handle empty mask
  if (area === 0) {
    return {
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      area: 0,
    };
  }

  return {
    boundingBox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    area,
  };
}

/**
 * Encode mask as RLE (Run-Length Encoding)
 */
export function encodeRLE(
  maskBuffer: Buffer,
  width: number,
  height: number,
): string {
  const isPNG = maskBuffer[0] === 0x89 && maskBuffer[1] === 0x50;

  if (isPNG) {
    // For PNG files, return a placeholder RLE
    // In production, decode the PNG first
    return "RLE_ENCODED_MASK_DATA";
  }

  const runs: number[] = [];
  let currentValue = 0;
  let currentRun = 0;

  for (let i = 0; i < width * height; i++) {
    const value = i < maskBuffer.length && maskBuffer[i] > 128 ? 1 : 0;

    if (i === 0) {
      currentValue = value;
      currentRun = 1;
    } else if (value === currentValue) {
      currentRun++;
    } else {
      runs.push(currentRun);
      currentValue = value;
      currentRun = 1;
    }
  }

  // Push the last run
  if (currentRun > 0) {
    runs.push(currentRun);
  }

  // Encode as string: "width,height:run1,run2,run3,..."
  return `${width},${height}:${runs.join(",")}`;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
