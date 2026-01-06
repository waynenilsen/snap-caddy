/**
 * Image validation module for Snap Caddy
 * Validates base64-encoded images for size and format constraints
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface ImageValidationOptions {
  maxSize: number;
  maxWidth: number;
  maxHeight: number;
  allowedFormats?: string[];
}

/**
 * Validates a base64-encoded image against the provided options
 * @param base64 - Base64 string (with or without data URI prefix)
 * @param options - Validation constraints
 * @returns Validation result with size and dimension info
 */
export function validateBase64Image(
  base64: string,
  options: ImageValidationOptions,
): ImageValidationResult {
  try {
    // Check if empty
    if (!base64 || base64.trim().length === 0) {
      return {
        valid: false,
        error: "Image data is empty",
      };
    }

    // Extract format and base64 data
    let format: string | undefined;
    let base64Data: string;

    // Check for data URI format (e.g., "data:image/png;base64,...")
    const dataUriMatch = base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (dataUriMatch) {
      format = dataUriMatch[1].toLowerCase();
      base64Data = dataUriMatch[2];
    } else {
      // Assume raw base64 without data URI prefix
      base64Data = base64;
    }

    // Validate format if specified
    if (options.allowedFormats && options.allowedFormats.length > 0) {
      if (!format) {
        return {
          valid: false,
          error:
            "Image format could not be determined. Use data URI format (e.g., data:image/png;base64,...)",
        };
      }

      const normalizedAllowedFormats = options.allowedFormats.map((f) =>
        f.toLowerCase().replace(/^\./, ""),
      );

      if (!normalizedAllowedFormats.includes(format)) {
        return {
          valid: false,
          error: `Image format '${format}' is not allowed. Allowed formats: ${options.allowedFormats.join(", ")}`,
        };
      }
    }

    // Calculate size from base64 length
    // Base64 encoding: every 3 bytes becomes 4 characters
    // Size in bytes = (base64Length * 3) / 4
    // Accounting for padding: approximately base64Length * 0.75
    const paddingChars = (base64Data.match(/=/g) || []).length;
    const size = Math.floor((base64Data.length * 3) / 4 - paddingChars);

    // Validate size
    if (size > options.maxSize) {
      return {
        valid: false,
        error: `Image size (${size} bytes) exceeds maximum allowed size (${options.maxSize} bytes)`,
        size,
      };
    }

    // Note: Width and height validation would require decoding the image
    // and using a library like 'sharp' or 'image-size' to get dimensions
    // For now, we return valid with size information
    // In a production environment, you might want to add dimension checking

    return {
      valid: true,
      size,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Image validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Decodes a base64 image string to a Buffer
 * @param base64 - Base64 string (with or without data URI prefix)
 * @returns Buffer containing the decoded image data
 */
export function decodeBase64Image(base64: string): Buffer {
  // Strip data URI prefix if present
  const base64Data = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

  // Return Buffer from base64
  return Buffer.from(base64Data, "base64");
}
