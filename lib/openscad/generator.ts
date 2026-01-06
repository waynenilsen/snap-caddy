/**
 * OpenSCAD Template Generator
 * Populates OpenSCAD templates with configuration parameters
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { GridfinityBinConfig, BaseType, LipStyle } from '@/types/configuration';
import { logger } from '@/lib/logger';

/**
 * Result of template generation
 */
export interface GenerateResult {
  success: boolean;
  scadPath?: string;
  error?: string;
}

/**
 * Template variable mapping
 */
interface TemplateVariables {
  GRID_X: string;
  GRID_Y: string;
  BIN_HEIGHT: string;
  SVG_FILE_PATH: string;
  CUTOUT_DEPTH: string;
  WALL_THICKNESS: string;
  BASE_STYLE: string;
  LIP_STYLE: string;
  CORNER_RADIUS: string;
  PADDING_TOP: string;
  PADDING_BOTTOM: string;
  PADDING_LEFT: string;
  PADDING_RIGHT: string;
  BASE_THICKNESS: string;
  TIMESTAMP: string;
}

/**
 * OpenSCAD Template Generator
 */
export class OpenSCADGenerator {
  private templatePath: string;

  constructor(templatePath?: string) {
    this.templatePath =
      templatePath || join(__dirname, 'templates', 'custom-cutout.scad');
  }

  /**
   * Generate an OpenSCAD file from template and configuration
   */
  async generate(
    svgPath: string,
    config: GridfinityBinConfig,
    outputPath: string
  ): Promise<GenerateResult> {
    try {
      logger.debug('Generating OpenSCAD file', {
        svgPath,
        outputPath,
        config,
      });

      // Read template
      const template = await readFile(this.templatePath, 'utf-8');

      // Populate template with configuration
      const populated = this.populateTemplate(template, svgPath, config);

      // Write output file
      await writeFile(outputPath, populated, 'utf-8');

      logger.info('OpenSCAD file generated successfully', { outputPath });

      return {
        success: true,
        scadPath: outputPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to generate OpenSCAD file', {
        error: errorMessage,
        svgPath,
        outputPath,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Populate template with configuration values
   */
  populateTemplate(
    template: string,
    svgPath: string,
    config: GridfinityBinConfig
  ): string {
    // Calculate padding from single cutoutPadding value
    const paddingTop = config.cutoutPadding;
    const paddingBottom = config.cutoutPadding;
    const paddingLeft = config.cutoutPadding;
    const paddingRight = config.cutoutPadding;

    // Calculate base thickness (default to 5mm if not specified)
    const baseThickness = 5;

    // Create variable mapping
    const variables: TemplateVariables = {
      GRID_X: String(config.gridUnitsX),
      GRID_Y: String(config.gridUnitsY),
      BIN_HEIGHT: String(config.binHeight),
      SVG_FILE_PATH: this.escapeScadString(svgPath),
      CUTOUT_DEPTH: String(config.cutoutDepth),
      WALL_THICKNESS: String(config.wallThickness),
      BASE_STYLE: String(this.baseTypeToNumber(config.baseType)),
      LIP_STYLE: String(this.lipStyleToNumber(config.lipStyle)),
      CORNER_RADIUS: String(config.cornerRadius ?? 0.5),
      PADDING_TOP: String(paddingTop),
      PADDING_BOTTOM: String(paddingBottom),
      PADDING_LEFT: String(paddingLeft),
      PADDING_RIGHT: String(paddingRight),
      BASE_THICKNESS: String(baseThickness),
      TIMESTAMP: new Date().toISOString(),
    };

    // Replace all placeholders
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.split(placeholder).join(value);
    }

    return result;
  }

  /**
   * Convert BaseType enum to OpenSCAD numeric value
   */
  private baseTypeToNumber(baseType: BaseType): number {
    const mapping: Record<BaseType, number> = {
      solid: 0,
      magnet: 1,
      screw: 2,
      magnet_screw: 3,
    };
    return mapping[baseType] ?? 0;
  }

  /**
   * Convert LipStyle enum to OpenSCAD numeric value
   */
  private lipStyleToNumber(lipStyle: LipStyle): number {
    const mapping: Record<LipStyle, number> = {
      normal: 0,
      reduced: 1,
      none: 2,
    };
    return mapping[lipStyle] ?? 0;
  }

  /**
   * Escape string for use in OpenSCAD
   * Handles backslashes and quotes
   */
  private escapeScadString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

// Export singleton instance
export const openscadGenerator = new OpenSCADGenerator();
