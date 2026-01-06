/**
 * Gridfinity bin configuration types
 *
 * NOTE: This file defines the BACKEND configuration format used by OpenSCAD generation.
 * The FRONTEND uses GridfinityConfig from types/gridfinity.ts which is converted
 * to this format by the API route (app/api/generate/route.ts).
 *
 * Key differences:
 * - Backend uses baseType enum (solid/magnet/screw/magnet_screw)
 * - Frontend uses magnetHoles and screwHoles booleans
 * - Backend uses single cutoutPadding value
 * - Frontend uses individual paddingTop/Bottom/Left/Right values
 */

export type BaseType = 'solid' | 'magnet' | 'screw' | 'magnet_screw';
export type LipStyle = 'normal' | 'reduced' | 'none';

/**
 * GridfinityBinConfig - Backend configuration for OpenSCAD generation
 *
 * This is the internal format used by the OpenSCAD generator.
 * API requests use GridfinityConfig (from types/gridfinity.ts) which is
 * converted to this format by apiConfigToBinConfig() in app/api/generate/route.ts
 */
export interface GridfinityBinConfig {
  // Grid dimensions (1 unit = 42mm)
  gridUnitsX: number;
  gridUnitsY: number;

  // Bin height (7mm increments standard)
  binHeight: number;

  // Cutout parameters
  cutoutDepth: number;
  cutoutPadding: number;
  cutoutOffsetX: number;
  cutoutOffsetY: number;

  // Wall configuration
  wallThickness: number;

  // Base configuration
  baseType: BaseType;

  // Lip style (top edge)
  lipStyle: LipStyle;

  // Advanced options
  cornerRadius?: number;
  taperAngle?: number;
}

// Validation constraints
export const GRIDFINITY_CONSTRAINTS = {
  GRID_UNIT_SIZE: 42,
  MIN_GRID_UNITS: 1,
  MAX_GRID_UNITS: 10,
  MIN_BIN_HEIGHT: 7,
  HEIGHT_INCREMENT: 7,
  MIN_WALL_THICKNESS: 1.0,
  RECOMMENDED_WALL: 2.0,
  MIN_CUTOUT_DEPTH: 3,
  DEFAULT_PADDING: 2.0,
  MAX_BIN_HEIGHT: 100,
} as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates Gridfinity configuration
 */
export function validateBinConfig(config: GridfinityBinConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    config.gridUnitsX < GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS ||
    config.gridUnitsX > GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS
  ) {
    errors.push(
      `gridUnitsX must be between ${GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS} and ${GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS}`
    );
  }

  if (
    config.gridUnitsY < GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS ||
    config.gridUnitsY > GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS
  ) {
    errors.push(
      `gridUnitsY must be between ${GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS} and ${GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS}`
    );
  }

  if (config.binHeight < GRIDFINITY_CONSTRAINTS.MIN_BIN_HEIGHT) {
    errors.push(`binHeight must be at least ${GRIDFINITY_CONSTRAINTS.MIN_BIN_HEIGHT}mm`);
  }

  if (config.binHeight > GRIDFINITY_CONSTRAINTS.MAX_BIN_HEIGHT) {
    errors.push(`binHeight must be at most ${GRIDFINITY_CONSTRAINTS.MAX_BIN_HEIGHT}mm`);
  }

  if (config.binHeight % GRIDFINITY_CONSTRAINTS.HEIGHT_INCREMENT !== 0) {
    warnings.push(
      `binHeight should be in ${GRIDFINITY_CONSTRAINTS.HEIGHT_INCREMENT}mm increments for standard Gridfinity compatibility`
    );
  }

  if (config.cutoutDepth >= config.binHeight) {
    errors.push(`cutoutDepth (${config.cutoutDepth}mm) must be less than binHeight (${config.binHeight}mm)`);
  }

  if (config.cutoutDepth < GRIDFINITY_CONSTRAINTS.MIN_CUTOUT_DEPTH) {
    errors.push(`cutoutDepth must be at least ${GRIDFINITY_CONSTRAINTS.MIN_CUTOUT_DEPTH}mm`);
  }

  if (config.wallThickness < GRIDFINITY_CONSTRAINTS.MIN_WALL_THICKNESS) {
    errors.push(`wallThickness must be at least ${GRIDFINITY_CONSTRAINTS.MIN_WALL_THICKNESS}mm`);
  }

  if (config.wallThickness < GRIDFINITY_CONSTRAINTS.RECOMMENDED_WALL) {
    warnings.push(`wallThickness below ${GRIDFINITY_CONSTRAINTS.RECOMMENDED_WALL}mm may result in weak walls`);
  }

  if (config.cutoutPadding < 0) {
    errors.push('cutoutPadding cannot be negative');
  }

  return { valid: errors.length === 0, errors, warnings };
}
