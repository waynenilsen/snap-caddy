/**
 * Gridfinity bin configuration types
 */

export interface GridfinityConfig {
  // Grid dimensions
  gridUnitsX: number; // Width in Gridfinity units (42mm each)
  gridUnitsY: number; // Depth in Gridfinity units

  // Bin parameters
  binHeight: number; // Total height in mm
  cutoutDepth: number; // How deep the cutout goes in mm
  wallThickness: number; // mm around cutout

  // Padding around cutout
  paddingTop: number; // mm
  paddingBottom: number; // mm
  paddingLeft: number; // mm
  paddingRight: number; // mm

  // Base options
  magnetHoles: boolean; // Bottom magnet holes
  screwHoles: boolean; // Bottom screw holes
  stackingLip: boolean; // Top lip for stacking

  // Advanced options
  cornerRadius: number; // Fillet radius for corners in mm
  baseThickness: number; // Bottom thickness in mm
}

export interface BinConfigState extends GridfinityConfig {
  tolerance: number; // Fit tolerance in mm
  error: string | null;
}

export interface BinDimensions {
  innerWidth: number; // mm
  innerDepth: number; // mm
  outerWidth: number; // mm
  outerDepth: number; // mm
  totalHeight: number; // mm
}

/**
 * Calculate bin dimensions from configuration
 */
export function calculateBinDimensions(config: GridfinityConfig): BinDimensions {
  const outerWidth = config.gridUnitsX * 42;
  const outerDepth = config.gridUnitsY * 42;
  const innerWidth = outerWidth - config.wallThickness * 2;
  const innerDepth = outerDepth - config.wallThickness * 2;

  return {
    innerWidth,
    innerDepth,
    outerWidth,
    outerDepth,
    totalHeight: config.binHeight,
  };
}

/**
 * Validate if cutout fits in bin dimensions
 */
export function validateBinFit(
  cutoutDimensions: { widthMm: number; heightMm: number },
  config: GridfinityConfig
): { fits: boolean; message?: string } {
  const binDims = calculateBinDimensions(config);

  if (cutoutDimensions.widthMm > binDims.innerWidth) {
    return {
      fits: false,
      message: `Cutout width (${cutoutDimensions.widthMm.toFixed(1)}mm) exceeds bin width (${binDims.innerWidth.toFixed(1)}mm)`,
    };
  }

  if (cutoutDimensions.heightMm > binDims.innerDepth) {
    return {
      fits: false,
      message: `Cutout depth (${cutoutDimensions.heightMm.toFixed(1)}mm) exceeds bin depth (${binDims.innerDepth.toFixed(1)}mm)`,
    };
  }

  return { fits: true };
}
