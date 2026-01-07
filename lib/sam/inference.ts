/**
 * SAM 2 (Segment Anything Model 2) Inference
 * Implementation of SAM 2 segmentation using Replicate API
 *
 * SAM 2 uses automatic mask generation - returns all detected masks
 * which users can then toggle on/off to select what to include.
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  createRecordedFetch,
  getRecordMode,
  getReplicateBaseUrl,
} from "@/lib/replicate";
import type {
  ReplicatePrediction,
  SAMResult,
  SAMSegmentationParams,
} from "./types";

// Use the models API for named models (meta/sam-2)
// Base URL is now configurable via REPLICATE_BASE_URL env var
const getModelsApiUrl = () => `${getReplicateBaseUrl()}/v1/models`;
const getPredictionsApiUrl = () => `${getReplicateBaseUrl()}/v1/predictions`;

const POLL_INTERVAL_MS = 1000; // Poll every 1 second
const MAX_POLL_ATTEMPTS = 120; // Maximum 120 seconds (SAM 2 can take longer)

// Get fetch function based on record mode
const getRecordableFetch = () => {
  const mode = getRecordMode();
  if (mode === "off") {
    return globalThis.fetch;
  }
  logger.debug("Using recorded fetch", { mode });
  return createRecordedFetch(globalThis.fetch);
};

/**
 * Main function to run SAM 2 segmentation
 * Returns URLs to all auto-generated masks
 */
export async function runSAMSegmentation(
  params: SAMSegmentationParams,
): Promise<SAMResult> {
  const startTime = Date.now();
  logger.info("Starting SAM 2 segmentation", {
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
    pointsPerSide: params.pointsPerSide ?? 32,
    predIouThresh: params.predIouThresh ?? 0.88,
    stabilityScoreThresh: params.stabilityScoreThresh ?? 0.95,
    useM2M: params.useM2M ?? true,
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

    // Step 4: Extract mask URLs from result
    const result = processPredictionOutput(completedPrediction);

    const duration = Date.now() - startTime;
    logger.info("SAM 2 segmentation completed", {
      predictionId: prediction.id,
      maskCount: result.individualMaskUrls.length,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("SAM 2 segmentation failed", {
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
 * Create a prediction on Replicate API for SAM 2
 * Uses the models API endpoint: POST /v1/models/{owner}/{name}/predictions
 */
async function createPrediction(
  params: SAMSegmentationParams,
  imageDataUri: string,
): Promise<ReplicatePrediction> {
  // Build the request body (no version needed for models API)
  const requestBody = {
    input: {
      image: imageDataUri,
      points_per_side: params.pointsPerSide ?? 32,
      pred_iou_thresh: params.predIouThresh ?? 0.88,
      stability_score_thresh: params.stabilityScoreThresh ?? 0.95,
      use_m2m: params.useM2M ?? true,
    },
  };

  // Use the models API endpoint: /v1/models/meta/sam-2/predictions
  const modelName = env.SAM_MODEL_VERSION; // e.g., "meta/sam-2"
  const apiUrl = `${getModelsApiUrl()}/${modelName}/predictions`;

  const recordableFetch = getRecordableFetch();
  const response = await recordableFetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
      Prefer: "wait", // Replicate recommends this for sync-style usage
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
 * Uses the predictions endpoint directly
 */
async function getPrediction(
  predictionId: string,
): Promise<ReplicatePrediction> {
  // The predictions endpoint is separate from the models endpoint
  const predictionsUrl = `${getPredictionsApiUrl()}/${predictionId}`;

  const recordableFetch = getRecordableFetch();
  const response = await recordableFetch(predictionsUrl, {
    headers: {
      Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
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
 * Process SAM 2 prediction output
 * Returns URLs to combined mask and individual masks
 */
function processPredictionOutput(prediction: ReplicatePrediction): SAMResult {
  // Log the actual output structure for debugging
  logger.debug("Processing SAM 2 prediction output", {
    hasOutput: !!prediction.output,
    outputKeys: prediction.output ? Object.keys(prediction.output) : [],
    outputValue: JSON.stringify(prediction.output, null, 2).substring(0, 500),
  });

  if (!prediction.output) {
    logger.error("No output in prediction", {
      predictionId: prediction.id,
    });
    throw new Error("No output returned from prediction");
  }

  const { combined_mask, individual_masks } = prediction.output;

  if (!combined_mask) {
    logger.error("No combined_mask in prediction output", {
      output: prediction.output,
    });
    throw new Error("No combined mask returned from prediction");
  }

  if (!individual_masks || individual_masks.length === 0) {
    logger.error("No individual_masks in prediction output", {
      output: prediction.output,
    });
    throw new Error("No individual masks returned from prediction");
  }

  logger.debug("SAM 2 masks extracted", {
    combinedMaskUrl: combined_mask,
    individualMaskCount: individual_masks.length,
  });

  return {
    combinedMaskUrl: combined_mask,
    individualMaskUrls: individual_masks,
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
