/**
 * SVG validation and sanitization module for Snap Caddy
 * Validates SVG content for security and size constraints
 */

export interface SVGValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
}

// Maximum SVG file size: 1 MB
export const MAX_SVG_SIZE = 1024 * 1024; // 1 MB in bytes

// Dangerous tags that should not be present in SVG files
export const DANGEROUS_TAGS = ["script", "iframe", "embed", "object"];

/**
 * Validates an SVG string for security and format compliance
 * @param svg - SVG content as string
 * @returns Validation result with dimensions if available
 */
export function validateSVG(svg: string): SVGValidationResult {
  try {
    // Check if empty
    if (!svg || svg.trim().length === 0) {
      return {
        valid: false,
        error: "SVG content is empty",
      };
    }

    // Check size (in bytes)
    const size = Buffer.byteLength(svg, "utf8");
    if (size > MAX_SVG_SIZE) {
      return {
        valid: false,
        error: `SVG size (${size} bytes) exceeds maximum allowed size (${MAX_SVG_SIZE} bytes)`,
      };
    }

    // Trim whitespace for checking
    const trimmedSvg = svg.trim();

    // Check basic SVG format
    const isValidSvgStart =
      trimmedSvg.startsWith("<svg") ||
      trimmedSvg.startsWith("<?xml") ||
      trimmedSvg.startsWith("<!DOCTYPE svg");

    if (!isValidSvgStart) {
      return {
        valid: false,
        error:
          "Invalid SVG format. SVG must start with <svg, <?xml, or <!DOCTYPE svg",
      };
    }

    // Check for dangerous tags (security)
    const lowerCaseSvg = svg.toLowerCase();
    for (const tag of DANGEROUS_TAGS) {
      const tagPattern = new RegExp(`<${tag}[\\s>]`, "i");
      if (tagPattern.test(lowerCaseSvg)) {
        return {
          valid: false,
          error: `SVG contains dangerous tag: <${tag}>`,
        };
      }
    }

    // Check for javascript: protocol in attributes (common XSS vector)
    if (/javascript:/i.test(svg)) {
      return {
        valid: false,
        error: "SVG contains dangerous javascript: protocol",
      };
    }

    // Check for on* event handlers (e.g., onclick, onload)
    if (/\son\w+\s*=/i.test(svg)) {
      return {
        valid: false,
        error: "SVG contains dangerous event handlers",
      };
    }

    // Extract width and height if available
    let width: number | undefined;
    let height: number | undefined;

    // Try to extract width and height attributes from <svg> tag
    const svgTagMatch = svg.match(/<svg[^>]*>/i);
    if (svgTagMatch) {
      const svgTag = svgTagMatch[0];

      // Extract width
      const widthMatch = svgTag.match(/\swidth=["']?(\d+(?:\.\d+)?)/i);
      if (widthMatch) {
        width = parseFloat(widthMatch[1]);
      }

      // Extract height
      const heightMatch = svgTag.match(/\sheight=["']?(\d+(?:\.\d+)?)/i);
      if (heightMatch) {
        height = parseFloat(heightMatch[1]);
      }
    }

    return {
      valid: true,
      width,
      height,
    };
  } catch (error) {
    return {
      valid: false,
      error: `SVG validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Sanitizes an SVG string by removing dangerous elements
 * @param svg - SVG content as string
 * @returns Sanitized SVG string
 */
export function sanitizeSVG(svg: string): string {
  let sanitized = svg;

  // Remove dangerous tags
  for (const tag of DANGEROUS_TAGS) {
    // Remove opening and closing tags along with their content
    const tagRegex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, "gis");
    sanitized = sanitized.replace(tagRegex, "");

    // Remove self-closing tags
    const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, "gi");
    sanitized = sanitized.replace(selfClosingRegex, "");
  }

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, "");

  // Remove event handlers (on* attributes)
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");

  // Remove data: URIs that might contain scripts (but keep safe ones)
  // This is a conservative approach - you might want to whitelist specific safe data URIs
  sanitized = sanitized.replace(/data:text\/html[^"'\s)]*/gi, "");
  sanitized = sanitized.replace(/data:image\/svg\+xml[^"'\s)]*/gi, "");

  return sanitized;
}
