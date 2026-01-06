# OpenSCAD 3D Generation System

## Overview

This document details the complete OpenSCAD integration for Snap Caddy, which converts scaled SVG silhouettes into 3D-printable STL files for Gridfinity bins with custom cutouts.

The generation pipeline:
1. Client sends scaled SVG (in mm) + Gridfinity configuration
2. Server writes SVG to temporary file
3. Server generates OpenSCAD script from template
4. OpenSCAD CLI renders script to STL
5. STL file stored with unique ID
6. Client receives download ID

**Reference**: [Gridfinity Extended OpenSCAD - Custom Cutout](https://docs.ostat.com/docs/openscad/gridfinity-extended/custom-cutout/)

---

## 1. OpenSCAD Installation & Setup

### Installing OpenSCAD on Ubuntu/Linux Server

```bash
# Update package list
sudo apt-get update

# Install OpenSCAD
sudo apt-get install -y openscad

# Verify installation
openscad --version
# Expected output: OpenSCAD version 2021.01 (or newer)

# For headless server (no X11), ensure xvfb is installed
sudo apt-get install -y xvfb

# Test headless rendering
xvfb-run -a openscad --version
```

### Installing Gridfinity Extended OpenSCAD Library

```bash
# Clone the Gridfinity library
cd /opt
sudo git clone https://github.com/ostat/gridfinity_extended_openscad.git

# Alternative: Clone to user directory
mkdir -p ~/.local/share/OpenSCAD/libraries
cd ~/.local/share/OpenSCAD/libraries
git clone https://github.com/ostat/gridfinity_extended_openscad.git gridfinity

# Verify library files
ls -la gridfinity_extended_openscad/
# Should contain: gridfinity_basic_cup.scad, gridfinity_custom_cup.scad, etc.
```

### OpenSCAD Library Path Configuration

OpenSCAD searches for libraries in these locations (in order):
1. Current working directory
2. `OPENSCADPATH` environment variable
3. `~/.local/share/OpenSCAD/libraries/`
4. Platform-specific library directories

**Recommended**: Set `OPENSCADPATH` environment variable:

```bash
# Add to /etc/environment or ~/.bashrc
export OPENSCADPATH=/opt/gridfinity_extended_openscad

# For Next.js app, set in .env.local
OPENSCADPATH=/opt/gridfinity_extended_openscad
```

### Command-Line Interface Usage

```bash
# Basic STL rendering
openscad -o output.stl input.scad

# With parameters
openscad -o output.stl -D "gridx=3" -D "gridy=2" input.scad

# Headless rendering (for servers without display)
xvfb-run -a openscad -o output.stl input.scad

# PNG preview rendering
openscad -o preview.png --imgsize=800,600 --view=axes,scales input.scad

# With camera positioning
openscad -o preview.png --camera=0,0,0,60,0,25,500 input.scad

# Verbose output for debugging
openscad -o output.stl --hardwarnings --check-parameters true input.scad
```

### Version Requirements

- **OpenSCAD**: >= 2021.01 (for proper SVG import support)
- **Gridfinity Extended**: Latest from main branch
- **Node.js**: >= 18 (for Next.js 16)
- **Available disk space**: ~100MB per concurrent render (temporary files)

---

## 2. SVG Import Requirements

### SVG Format for OpenSCAD Compatibility

OpenSCAD's SVG import has specific requirements:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="50mm"
     height="30mm"
     viewBox="0 0 50 30">
  <path d="M 10,10 L 40,10 L 40,20 L 10,20 Z"
        fill="black"
        stroke="none"/>
</svg>
```

**Key Requirements**:
- Must be valid XML
- Must include `xmlns="http://www.w3.org/2000/svg"`
- Use `<path>` elements (not `<rect>`, `<circle>`, etc.)
- Closed paths only (no open polylines)
- Simple fills, no gradients or patterns
- No transforms (should be baked into path coordinates)

### DPI Settings

**Critical**: OpenSCAD interprets SVG units at **96 DPI** by default.

```typescript
// When generating SVG from canvas/mask:
const DPI = 96;
const MM_PER_INCH = 25.4;

// Convert pixels to mm at 96 DPI
function pixelsToMM(pixels: number, pixelsPerMm: number): number {
  // pixelsPerMm is from calibration step
  return pixels / pixelsPerMm;
}

// SVG dimensions should be in mm
const svgWidth = `${widthInMM}mm`;
const svgHeight = `${heightInMM}mm`;
```

**Important**: The viewBox should match the width/height in unitless values:
```xml
<!-- If width="50mm" height="30mm" -->
<svg width="50mm" height="30mm" viewBox="0 0 50 30">
```

### Unit Handling

OpenSCAD treats SVG units as millimeters when imported:

```openscad
// In OpenSCAD
import("shape.svg", center=true, dpi=96);
// SVG width="50mm" becomes 50 units in OpenSCAD (50mm)
```

If your SVG has no explicit units, OpenSCAD assumes userspace units = mm.

### Coordinate System Orientation

SVG coordinate system (top-left origin, Y-down):
```
(0,0)────────> X
  │
  │
  ▼
  Y
```

OpenSCAD coordinate system (center origin, Y-up in 2D):
```
      Y
      ▲
      │
      │
──────┼──────> X
      │
```

**Solution**: Use `center=true` in import statement to center the shape:

```openscad
linear_extrude(height=depth)
  import("shape.svg", center=true, dpi=96);
```

### Path Simplification

To avoid OpenSCAD rendering issues, simplify SVG paths:

```typescript
// lib/canvas/svgGeneration.ts
interface SimplificationOptions {
  tolerance: number;        // 0.5-2.0 mm recommended
  highQuality: boolean;     // Use Douglas-Peucker algorithm
  minimizePoints: boolean;  // Remove redundant points
}

function simplifyPath(points: Point[], tolerance = 1.0): Point[] {
  // Douglas-Peucker algorithm
  // Reduces path complexity while maintaining shape
  // See implementation in section 5
}
```

### Testing SVG Compatibility

Test SVG before sending to OpenSCAD:

```typescript
// lib/openscad/validator.ts
export async function validateSVG(svgContent: string): Promise<ValidationResult> {
  const errors: string[] = [];

  // Parse XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  // Check for parse errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    errors.push('Invalid XML syntax');
  }

  // Check namespace
  const svg = doc.querySelector('svg');
  if (!svg?.getAttribute('xmlns')) {
    errors.push('Missing xmlns attribute');
  }

  // Check for valid dimensions
  const width = svg?.getAttribute('width');
  const height = svg?.getAttribute('height');
  if (!width || !height) {
    errors.push('Missing width or height attributes');
  }

  // Check for paths
  const paths = doc.querySelectorAll('path');
  if (paths.length === 0) {
    errors.push('No <path> elements found');
  }

  // Check for unsupported elements
  const unsupported = doc.querySelectorAll('circle, rect, ellipse, polygon, polyline');
  if (unsupported.length > 0) {
    errors.push(`Found ${unsupported.length} unsupported shape elements (use <path> only)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}
```

---

## 3. Gridfinity Configuration Types

### Complete TypeScript Interface

```typescript
// types/configuration.ts

/**
 * Gridfinity bin configuration for custom cutout generation
 * Based on: https://github.com/ostat/gridfinity_extended_openscad
 */
export interface GridfinityBinConfig {
  // Grid dimensions (1 unit = 42mm)
  gridUnitsX: number;           // Width in Gridfinity units (1-6 typical)
  gridUnitsY: number;           // Depth in Gridfinity units (1-6 typical)

  // Bin height (7mm increments standard)
  binHeight: number;            // Total height in mm (21, 28, 35, 42, etc.)

  // Cutout parameters
  cutoutDepth: number;          // How deep the cutout extrudes (mm)
  cutoutPadding: number;        // Extra space around SVG shape (mm)
  cutoutOffsetX: number;        // Horizontal position adjustment (mm)
  cutoutOffsetY: number;        // Vertical position adjustment (mm)

  // Wall configuration
  wallThickness: number;        // Minimum wall around cutout (mm, default: 2.0)

  // Base configuration
  baseType: BaseType;           // Bottom mounting options

  // Lip style (top edge)
  lipStyle: LipStyle;           // Gridfinity lip configuration

  // Advanced options
  cornerRadius?: number;        // Fillet radius for cutout corners (mm)
  taperAngle?: number;          // Draft angle for easier part removal (degrees)
  customizableHeight?: boolean; // Allow height adjustment in OpenSCAD
}

export type BaseType =
  | 'solid'           // Solid bottom, no holes
  | 'magnet'          // Magnet holes only
  | 'screw'           // Screw holes only
  | 'magnet_screw';   // Both magnet and screw holes

export type LipStyle =
  | 'normal'          // Standard Gridfinity lip
  | 'reduced'         // Reduced height lip
  | 'none';           // No lip (flat top)

// Validation constraints
export const GRIDFINITY_CONSTRAINTS = {
  GRID_UNIT_SIZE: 42,           // mm per grid unit
  MIN_GRID_UNITS: 1,
  MAX_GRID_UNITS: 10,
  MIN_BIN_HEIGHT: 7,            // Minimum height (mm)
  HEIGHT_INCREMENT: 7,          // Standard height increments (mm)
  MIN_WALL_THICKNESS: 1.0,      // Minimum wall (mm)
  RECOMMENDED_WALL: 2.0,        // Recommended wall (mm)
  MIN_CUTOUT_DEPTH: 3,          // Minimum cutout depth (mm)
  DEFAULT_PADDING: 2.0,         // Default padding (mm)
} as const;

// Default configuration
export const DEFAULT_BIN_CONFIG: GridfinityBinConfig = {
  gridUnitsX: 2,
  gridUnitsY: 2,
  binHeight: 42,              // 6 height units
  cutoutDepth: 35,            // Leave 7mm base
  cutoutPadding: 2.0,
  cutoutOffsetX: 0,
  cutoutOffsetY: 0,
  wallThickness: 2.0,
  baseType: 'magnet',
  lipStyle: 'normal',
};

/**
 * Validates Gridfinity configuration
 */
export function validateBinConfig(config: GridfinityBinConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Grid units validation
  if (config.gridUnitsX < GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS ||
      config.gridUnitsX > GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS) {
    errors.push(`gridUnitsX must be between ${GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS} and ${GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS}`);
  }

  if (config.gridUnitsY < GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS ||
      config.gridUnitsY > GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS) {
    errors.push(`gridUnitsY must be between ${GRIDFINITY_CONSTRAINTS.MIN_GRID_UNITS} and ${GRIDFINITY_CONSTRAINTS.MAX_GRID_UNITS}`);
  }

  // Height validation
  if (config.binHeight < GRIDFINITY_CONSTRAINTS.MIN_BIN_HEIGHT) {
    errors.push(`binHeight must be at least ${GRIDFINITY_CONSTRAINTS.MIN_BIN_HEIGHT}mm`);
  }

  if (config.binHeight % GRIDFINITY_CONSTRAINTS.HEIGHT_INCREMENT !== 0) {
    warnings.push(`binHeight should be in ${GRIDFINITY_CONSTRAINTS.HEIGHT_INCREMENT}mm increments for standard Gridfinity compatibility`);
  }

  // Cutout depth validation
  if (config.cutoutDepth >= config.binHeight) {
    errors.push(`cutoutDepth (${config.cutoutDepth}mm) must be less than binHeight (${config.binHeight}mm)`);
  }

  if (config.cutoutDepth < GRIDFINITY_CONSTRAINTS.MIN_CUTOUT_DEPTH) {
    errors.push(`cutoutDepth must be at least ${GRIDFINITY_CONSTRAINTS.MIN_CUTOUT_DEPTH}mm`);
  }

  // Wall thickness validation
  if (config.wallThickness < GRIDFINITY_CONSTRAINTS.MIN_WALL_THICKNESS) {
    errors.push(`wallThickness must be at least ${GRIDFINITY_CONSTRAINTS.MIN_WALL_THICKNESS}mm`);
  }

  if (config.wallThickness < GRIDFINITY_CONSTRAINTS.RECOMMENDED_WALL) {
    warnings.push(`wallThickness below ${GRIDFINITY_CONSTRAINTS.RECOMMENDED_WALL}mm may result in weak walls`);
  }

  // Padding validation
  if (config.cutoutPadding < 0) {
    errors.push('cutoutPadding cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

---

## 4. OpenSCAD Template

### Complete Template File

Create `/lib/openscad/templates/custom-cutout.scad`:

```openscad
/**
 * Gridfinity Custom Cutout Bin - Auto-generated by Snap Caddy
 * Generated: {{TIMESTAMP}}
 *
 * This file uses the Gridfinity Extended OpenSCAD library:
 * https://github.com/ostat/gridfinity_extended_openscad
 */

// Include Gridfinity library
include <gridfinity_custom_cup.scad>

/* [Bin Dimensions] */
// Grid units wide (X direction)
gridx = {{GRID_X}};
// Grid units deep (Y direction)
gridy = {{GRID_Y}};
// Bin height in mm
bin_height = {{BIN_HEIGHT}};

/* [Cutout Configuration] */
// Path to SVG file for cutout shape
svg_file = "{{SVG_FILE_PATH}}";
// Depth of cutout extrusion
cutout_depth = {{CUTOUT_DEPTH}};
// Padding around SVG shape
cutout_padding = {{CUTOUT_PADDING}};
// X offset for cutout positioning
cutout_offset_x = {{CUTOUT_OFFSET_X}};
// Y offset for cutout positioning
cutout_offset_y = {{CUTOUT_OFFSET_Y}};

/* [Wall Configuration] */
// Wall thickness around cutout
wall_thickness = {{WALL_THICKNESS}};

/* [Base Configuration] */
// Base style: 0=solid, 1=magnet, 2=screw, 3=magnet+screw
base_style = {{BASE_STYLE}};

/* [Lip Configuration] */
// Lip style: 0=normal, 1=reduced, 2=none
lip_style = {{LIP_STYLE}};

/* [Advanced Options] */
// Corner radius for cutout (0 = sharp corners)
corner_radius = {{CORNER_RADIUS}};
// Taper angle for draft (0 = vertical walls)
taper_angle = {{TAPER_ANGLE}};

/* [Hidden] */
// Grid unit size (standard Gridfinity)
grid_unit = 42;
// SVG import DPI
dpi = 96;
// Small value for CSG operations
epsilon = 0.01;

// Main bin module
module gridfinity_custom_bin() {
  difference() {
    // Create base bin
    gridfinity_cup(
      width=gridx,
      depth=gridy,
      height=bin_height,
      lip_style=lip_style_name(lip_style),
      magnet_diameter=base_has_magnets(base_style) ? 6.5 : 0,
      screw_depth=base_has_screws(base_style) ? 6 : 0,
      floor_thickness=bin_height - cutout_depth,
      wall_thickness=wall_thickness
    );

    // Create cutout from SVG
    translate([
      cutout_offset_x,
      cutout_offset_y,
      bin_height - cutout_depth
    ])
    cutout_shape();
  }
}

// Cutout shape module
module cutout_shape() {
  // Add padding around imported shape
  minkowski() {
    // Import and extrude SVG
    linear_extrude(height=cutout_depth + epsilon) {
      offset(delta=cutout_padding) {
        import(svg_file, center=true, dpi=dpi);
      }
    }

    // Apply corner radius if specified
    if (corner_radius > 0) {
      sphere(r=corner_radius, $fn=32);
    }
  }
}

// Helper functions
function lip_style_name(style) =
  style == 0 ? "normal" :
  style == 1 ? "reduced" :
  style == 2 ? "none" :
  "normal";

function base_has_magnets(style) =
  style == 1 || style == 3;

function base_has_screws(style) =
  style == 2 || style == 3;

// Render the bin
gridfinity_custom_bin();
```

### Alternative Simplified Template (If gridfinity_custom_cup.scad not available)

```openscad
/**
 * Simplified Gridfinity Custom Cutout Bin
 * Uses basic gridfinity modules
 */

include <gridfinity_basic_cup.scad>

// Parameters (same as above)
gridx = {{GRID_X}};
gridy = {{GRID_Y}};
bin_height = {{BIN_HEIGHT}};
svg_file = "{{SVG_FILE_PATH}}";
cutout_depth = {{CUTOUT_DEPTH}};
cutout_padding = {{CUTOUT_PADDING}};
cutout_offset_x = {{CUTOUT_OFFSET_X}};
cutout_offset_y = {{CUTOUT_OFFSET_Y}};
wall_thickness = {{WALL_THICKNESS}};
base_style = {{BASE_STYLE}};

// Constants
grid_unit = 42;
base_height = 7;
epsilon = 0.01;

// Main difference
difference() {
  // Basic Gridfinity cup
  union() {
    // Base with magnet/screw holes
    gridfinityBase(
      gridx=gridx,
      gridy=gridy,
      l=bin_height,
      magnet_holes=(base_style == 1 || base_style == 3),
      screw_holes=(base_style == 2 || base_style == 3)
    );
  }

  // Custom cutout
  translate([0, 0, bin_height - cutout_depth]) {
    linear_extrude(height=cutout_depth + epsilon) {
      offset(delta=cutout_padding) {
        import(svg_file, center=true, dpi=96);
      }
    }
  }
}
```

---

## 5. Template Generator Implementation

### Generator Module

Create `/lib/openscad/generator.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import type { GridfinityBinConfig } from '@/types/configuration';

/**
 * Generates OpenSCAD script from template and configuration
 */
export class OpenSCADGenerator {
  private templatePath: string;

  constructor(templatePath?: string) {
    this.templatePath = templatePath ||
      path.join(process.cwd(), 'lib', 'openscad', 'templates', 'custom-cutout.scad');
  }

  /**
   * Generate OpenSCAD file from SVG and configuration
   */
  async generate(
    svgPath: string,
    config: GridfinityBinConfig,
    outputPath: string
  ): Promise<GenerateResult> {
    try {
      // Load template
      const template = await fs.readFile(this.templatePath, 'utf-8');

      // Generate OpenSCAD script
      const scadContent = this.populateTemplate(template, svgPath, config);

      // Write to output path
      await fs.writeFile(outputPath, scadContent, 'utf-8');

      return {
        success: true,
        scadPath: outputPath,
        svgPath: svgPath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Populate template with actual values
   */
  private populateTemplate(
    template: string,
    svgPath: string,
    config: GridfinityBinConfig
  ): string {
    const replacements: Record<string, string | number> = {
      TIMESTAMP: new Date().toISOString(),
      GRID_X: config.gridUnitsX,
      GRID_Y: config.gridUnitsY,
      BIN_HEIGHT: config.binHeight,
      SVG_FILE_PATH: this.escapeScadString(svgPath),
      CUTOUT_DEPTH: config.cutoutDepth,
      CUTOUT_PADDING: config.cutoutPadding,
      CUTOUT_OFFSET_X: config.cutoutOffsetX,
      CUTOUT_OFFSET_Y: config.cutoutOffsetY,
      WALL_THICKNESS: config.wallThickness,
      BASE_STYLE: this.baseTypeToNumber(config.baseType),
      LIP_STYLE: this.lipStyleToNumber(config.lipStyle),
      CORNER_RADIUS: config.cornerRadius || 0,
      TAPER_ANGLE: config.taperAngle || 0,
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(pattern, String(value));
    }

    return result;
  }

  /**
   * Escape string for OpenSCAD
   */
  private escapeScadString(str: string): string {
    // Escape backslashes and quotes
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /**
   * Convert base type to numeric value for OpenSCAD
   */
  private baseTypeToNumber(baseType: string): number {
    switch (baseType) {
      case 'solid': return 0;
      case 'magnet': return 1;
      case 'screw': return 2;
      case 'magnet_screw': return 3;
      default: return 0;
    }
  }

  /**
   * Convert lip style to numeric value for OpenSCAD
   */
  private lipStyleToNumber(lipStyle: string): number {
    switch (lipStyle) {
      case 'normal': return 0;
      case 'reduced': return 1;
      case 'none': return 2;
      default: return 0;
    }
  }
}

export interface GenerateResult {
  success: boolean;
  scadPath?: string;
  svgPath?: string;
  error?: string;
}

// Export singleton instance
export const openscadGenerator = new OpenSCADGenerator();
```

---

## 6. OpenSCAD Executor

### Executor Module

Create `/lib/openscad/executor.ts`:

```typescript
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Executes OpenSCAD CLI to render STL files
 */
export class OpenSCADExecutor {
  private openscadBinary: string;
  private useXvfb: boolean;
  private timeout: number;

  constructor(options?: ExecutorOptions) {
    this.openscadBinary = options?.openscadBinary || 'openscad';
    this.useXvfb = options?.useXvfb ?? true;
    this.timeout = options?.timeout || 300000; // 5 minutes default
  }

  /**
   * Render OpenSCAD file to STL
   */
  async render(
    scadPath: string,
    outputPath: string,
    options?: RenderOptions
  ): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      // Build command arguments
      const args = this.buildRenderArgs(scadPath, outputPath, options);

      // Execute OpenSCAD
      const output = await this.execute(args, options?.timeout);

      // Verify output file was created
      const stats = await fs.stat(outputPath);

      return {
        success: true,
        outputPath,
        fileSize: stats.size,
        renderTime: Date.now() - startTime,
        logs: output.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        renderTime: Date.now() - startTime,
        logs: error instanceof ExecutionError ? error.output : ''
      };
    }
  }

  /**
   * Generate preview image (PNG)
   */
  async preview(
    scadPath: string,
    outputPath: string,
    options?: PreviewOptions
  ): Promise<PreviewResult> {
    const startTime = Date.now();

    try {
      const args = this.buildPreviewArgs(scadPath, outputPath, options);
      const output = await this.execute(args, options?.timeout);

      const stats = await fs.stat(outputPath);

      return {
        success: true,
        previewPath: outputPath,
        fileSize: stats.size,
        renderTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        renderTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate OpenSCAD file (syntax check)
   */
  async validate(scadPath: string): Promise<ValidationResult> {
    try {
      // Use --export-format=echo to check syntax without rendering
      const args = [
        scadPath,
        '--export-format=echo',
        '--hardwarnings',
        '--check-parameters=true'
      ];

      const output = await this.execute(args, 30000); // 30 second timeout

      // Parse output for errors/warnings
      const errors = this.parseErrors(output.stderr);
      const warnings = this.parseWarnings(output.stderr);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        warnings: []
      };
    }
  }

  /**
   * Build arguments for STL rendering
   */
  private buildRenderArgs(
    scadPath: string,
    outputPath: string,
    options?: RenderOptions
  ): string[] {
    const args = [
      '-o', outputPath,
      scadPath
    ];

    // Add custom parameters
    if (options?.parameters) {
      for (const [key, value] of Object.entries(options.parameters)) {
        args.push('-D', `${key}=${value}`);
      }
    }

    // Enable warnings
    if (options?.hardwarnings !== false) {
      args.push('--hardwarnings');
    }

    return args;
  }

  /**
   * Build arguments for preview rendering
   */
  private buildPreviewArgs(
    scadPath: string,
    outputPath: string,
    options?: PreviewOptions
  ): string[] {
    const args = [
      '-o', outputPath,
      scadPath,
      '--render',  // Use render mode for better quality
    ];

    // Image size
    const width = options?.width || 800;
    const height = options?.height || 600;
    args.push('--imgsize', `${width},${height}`);

    // Camera position (isometric view by default)
    if (options?.camera) {
      args.push('--camera', options.camera);
    } else {
      // Default isometric view
      args.push('--camera', '0,0,0,60,0,25,300');
    }

    // View options
    args.push('--view', 'axes,scales');

    return args;
  }

  /**
   * Execute OpenSCAD command
   */
  private execute(args: string[], timeout?: number): Promise<ExecutionOutput> {
    return new Promise((resolve, reject) => {
      const actualTimeout = timeout || this.timeout;
      let stdout = '';
      let stderr = '';

      // Determine command
      const command = this.useXvfb ? 'xvfb-run' : this.openscadBinary;
      const commandArgs = this.useXvfb
        ? ['-a', this.openscadBinary, ...args]
        : args;

      // Spawn process
      const proc = spawn(command, commandArgs, {
        env: {
          ...process.env,
          OPENSCADPATH: process.env.OPENSCADPATH || '/opt/gridfinity_extended_openscad'
        }
      });

      // Collect output
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle completion
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          const error = new ExecutionError(
            `OpenSCAD exited with code ${code}`,
            stdout + stderr
          );
          reject(error);
        }
      });

      // Handle errors
      proc.on('error', (error) => {
        reject(new ExecutionError(error.message, stdout + stderr));
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new ExecutionError(
          `OpenSCAD execution timed out after ${actualTimeout}ms`,
          stdout + stderr
        ));
      }, actualTimeout);

      proc.on('close', () => clearTimeout(timeoutId));
    });
  }

  /**
   * Parse errors from OpenSCAD output
   */
  private parseErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('ERROR:') || line.includes('PARSE ERROR')) {
        errors.push(line.trim());
      }
    }

    return errors;
  }

  /**
   * Parse warnings from OpenSCAD output
   */
  private parseWarnings(output: string): string[] {
    const warnings: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('WARNING:')) {
        warnings.push(line.trim());
      }
    }

    return warnings;
  }
}

// Types
export interface ExecutorOptions {
  openscadBinary?: string;
  useXvfb?: boolean;
  timeout?: number;
}

export interface RenderOptions {
  parameters?: Record<string, string | number>;
  hardwarnings?: boolean;
  timeout?: number;
}

export interface PreviewOptions {
  width?: number;
  height?: number;
  camera?: string;
  timeout?: number;
}

export interface RenderResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  renderTime: number;
  logs?: string;
  error?: string;
}

export interface PreviewResult {
  success: boolean;
  previewPath?: string;
  fileSize?: number;
  renderTime: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

class ExecutionError extends Error {
  constructor(message: string, public output: string) {
    super(message);
    this.name = 'ExecutionError';
  }
}

// Export singleton instance
export const openscadExecutor = new OpenSCADExecutor();
```

---

## 7. File Management

### File Manager Module

Create `/lib/openscad/fileManager.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * Manages temporary files for OpenSCAD generation
 */
export class FileManager {
  private tempDir: string;
  private maxAge: number; // milliseconds
  private maxStorageSize: number; // bytes

  constructor(options?: FileManagerOptions) {
    this.tempDir = options?.tempDir || path.join(process.cwd(), '.tmp', 'openscad');
    this.maxAge = options?.maxAge || 3600000; // 1 hour default
    this.maxStorageSize = options?.maxStorageSize || 1073741824; // 1GB default
  }

  /**
   * Initialize temp directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Create unique file paths for a generation job
   */
  async createJobPaths(): Promise<JobPaths> {
    const jobId = randomUUID();
    const jobDir = path.join(this.tempDir, jobId);

    await fs.mkdir(jobDir, { recursive: true });

    return {
      jobId,
      jobDir,
      svgPath: path.join(jobDir, 'shape.svg'),
      scadPath: path.join(jobDir, 'bin.scad'),
      stlPath: path.join(jobDir, 'bin.stl'),
      previewPath: path.join(jobDir, 'preview.png'),
    };
  }

  /**
   * Write SVG content to file
   */
  async writeSVG(svgPath: string, svgContent: string): Promise<void> {
    await fs.writeFile(svgPath, svgContent, 'utf-8');
  }

  /**
   * Get file info by job ID
   */
  async getJobPaths(jobId: string): Promise<JobPaths | null> {
    const jobDir = path.join(this.tempDir, jobId);

    try {
      await fs.access(jobDir);

      return {
        jobId,
        jobDir,
        svgPath: path.join(jobDir, 'shape.svg'),
        scadPath: path.join(jobDir, 'bin.scad'),
        stlPath: path.join(jobDir, 'bin.stl'),
        previewPath: path.join(jobDir, 'preview.png'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Clean up job directory
   */
  async cleanupJob(jobId: string): Promise<void> {
    const jobDir = path.join(this.tempDir, jobId);

    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to cleanup job ${jobId}:`, error);
    }
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(): Promise<CleanupStats> {
    const now = Date.now();
    let deletedCount = 0;
    let freedSpace = 0;

    try {
      const entries = await fs.readdir(this.tempDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const jobPath = path.join(this.tempDir, entry.name);
        const stat = await fs.stat(jobPath);
        const age = now - stat.mtimeMs;

        if (age > this.maxAge) {
          const size = await this.getDirectorySize(jobPath);
          await fs.rm(jobPath, { recursive: true, force: true });
          deletedCount++;
          freedSpace += size;
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    return { deletedCount, freedSpace };
  }

  /**
   * Check and enforce storage limits
   */
  async enforceStorageLimit(): Promise<void> {
    const totalSize = await this.getDirectorySize(this.tempDir);

    if (totalSize > this.maxStorageSize) {
      // Delete oldest files until under limit
      const entries = await fs.readdir(this.tempDir, { withFileTypes: true });
      const jobs: Array<{ name: string; mtime: number; path: string }> = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const jobPath = path.join(this.tempDir, entry.name);
        const stat = await fs.stat(jobPath);
        jobs.push({ name: entry.name, mtime: stat.mtimeMs, path: jobPath });
      }

      // Sort by modification time (oldest first)
      jobs.sort((a, b) => a.mtime - b.mtime);

      let currentSize = totalSize;
      for (const job of jobs) {
        if (currentSize <= this.maxStorageSize * 0.8) break; // Target 80% of limit

        const size = await this.getDirectorySize(job.path);
        await fs.rm(job.path, { recursive: true, force: true });
        currentSize -= size;
      }
    }
  }

  /**
   * Get size of directory recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          size += stat.size;
        }
      }
    } catch {
      // Directory might not exist or be accessible
    }

    return size;
  }

  /**
   * Schedule periodic cleanup
   */
  startPeriodicCleanup(intervalMs: number = 600000): NodeJS.Timeout {
    return setInterval(async () => {
      await this.cleanupOldFiles();
      await this.enforceStorageLimit();
    }, intervalMs);
  }
}

// Types
export interface FileManagerOptions {
  tempDir?: string;
  maxAge?: number;
  maxStorageSize?: number;
}

export interface JobPaths {
  jobId: string;
  jobDir: string;
  svgPath: string;
  scadPath: string;
  stlPath: string;
  previewPath: string;
}

export interface CleanupStats {
  deletedCount: number;
  freedSpace: number;
}

// Export singleton instance
export const fileManager = new FileManager();

// Initialize on module load
fileManager.initialize().catch(console.error);

// Start periodic cleanup (every 10 minutes)
fileManager.startPeriodicCleanup(600000);
```

---

## 8. API Route - Generate

### POST /api/generate/route.ts

Create `/app/api/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fileManager } from '@/lib/openscad/fileManager';
import { openscadGenerator } from '@/lib/openscad/generator';
import { openscadExecutor } from '@/lib/openscad/executor';
import { validateBinConfig, type GridfinityBinConfig } from '@/types/configuration';

// Request validation schema
const GenerateRequestSchema = z.object({
  svg: z.string().min(1, 'SVG content is required'),
  config: z.object({
    gridUnitsX: z.number().int().min(1).max(10),
    gridUnitsY: z.number().int().min(1).max(10),
    binHeight: z.number().min(7),
    cutoutDepth: z.number().min(3),
    cutoutPadding: z.number().min(0),
    cutoutOffsetX: z.number(),
    cutoutOffsetY: z.number(),
    wallThickness: z.number().min(1),
    baseType: z.enum(['solid', 'magnet', 'screw', 'magnet_screw']),
    lipStyle: z.enum(['normal', 'reduced', 'none']),
    cornerRadius: z.number().optional(),
    taperAngle: z.number().optional(),
  }),
  generatePreview: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json();
    const validation = GenerateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { svg, config, generatePreview } = validation.data;

    // Validate Gridfinity configuration
    const configValidation = validateBinConfig(config as GridfinityBinConfig);
    if (!configValidation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid configuration',
          errors: configValidation.errors,
          warnings: configValidation.warnings
        },
        { status: 400 }
      );
    }

    // Create job paths
    const paths = await fileManager.createJobPaths();

    try {
      // Write SVG file
      await fileManager.writeSVG(paths.svgPath, svg);

      // Generate OpenSCAD file
      const generateResult = await openscadGenerator.generate(
        paths.svgPath,
        config as GridfinityBinConfig,
        paths.scadPath
      );

      if (!generateResult.success) {
        throw new Error(`Failed to generate OpenSCAD file: ${generateResult.error}`);
      }

      // Render STL
      const renderResult = await openscadExecutor.render(
        paths.scadPath,
        paths.stlPath
      );

      if (!renderResult.success) {
        throw new Error(`Failed to render STL: ${renderResult.error}`);
      }

      // Optionally generate preview
      let previewGenerated = false;
      if (generatePreview) {
        const previewResult = await openscadExecutor.preview(
          paths.scadPath,
          paths.previewPath,
          { width: 800, height: 600 }
        );
        previewGenerated = previewResult.success;
      }

      // Return success response
      return NextResponse.json({
        success: true,
        jobId: paths.jobId,
        downloadUrl: `/api/download/${paths.jobId}`,
        previewUrl: previewGenerated ? `/api/preview/${paths.jobId}` : null,
        renderTime: renderResult.renderTime,
        fileSize: renderResult.fileSize,
        warnings: configValidation.warnings,
      });

    } catch (error) {
      // Clean up on error
      await fileManager.cleanupJob(paths.jobId);
      throw error;
    }

  } catch (error) {
    console.error('Generation error:', error);

    return NextResponse.json(
      {
        error: 'Generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
```

---

## 9. API Route - Download

### GET /api/download/[id]/route.ts

Create `/app/api/download/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileManager } from '@/lib/openscad/fileManager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate job ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Get job paths
    const paths = await fileManager.getJobPaths(id);

    if (!paths) {
      return NextResponse.json(
        { error: 'Job not found or expired' },
        { status: 404 }
      );
    }

    // Check if STL file exists
    try {
      await fs.access(paths.stlPath);
    } catch {
      return NextResponse.json(
        { error: 'STL file not found' },
        { status: 404 }
      );
    }

    // Read STL file
    const stlBuffer = await fs.readFile(paths.stlPath);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `gridfinity-custom-${timestamp}-${id.slice(0, 8)}.stl`;

    // Create response with file
    const response = new NextResponse(stlBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/sla',  // or 'model/stl'
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stlBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

    // Schedule cleanup after download (optional - or keep for re-download)
    // Uncomment to auto-delete after first download:
    // setTimeout(() => fileManager.cleanupJob(id), 5000);

    return response;

  } catch (error) {
    console.error('Download error:', error);

    return NextResponse.json(
      {
        error: 'Download failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Prevent path traversal attacks
function isValidJobId(id: string): boolean {
  // Only allow UUID format
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
```

### GET /api/preview/[id]/route.ts (Optional)

Create `/app/api/preview/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { fileManager } from '@/lib/openscad/fileManager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate job ID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Get job paths
    const paths = await fileManager.getJobPaths(id);

    if (!paths) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if preview exists
    try {
      await fs.access(paths.previewPath);
    } catch {
      return NextResponse.json(
        { error: 'Preview not available' },
        { status: 404 }
      );
    }

    // Read preview image
    const imageBuffer = await fs.readFile(paths.previewPath);

    // Return image
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Preview error:', error);

    return NextResponse.json(
      { error: 'Preview failed' },
      { status: 500 }
    );
  }
}
```

---

## 10. Preview Generation

### OpenSCAD Preview vs. STL Rendering

Two approaches for generating 3D previews:

#### Option A: OpenSCAD PNG Export (Implemented Above)

```typescript
// Generate preview during STL generation
const previewResult = await openscadExecutor.preview(
  paths.scadPath,
  paths.previewPath,
  {
    width: 800,
    height: 600,
    camera: '0,0,0,60,0,25,300'  // Isometric view
  }
);
```

**Pros**:
- Simple, uses existing OpenSCAD
- Same rendering engine as STL
- No additional dependencies

**Cons**:
- Static image only
- Limited interactivity
- Adds to generation time

#### Option B: Client-Side STL Viewer (Recommended for Production)

Use a library like `three.js` to render STL in browser:

```typescript
// components/generation/STLPreview.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export function STLPreview({ stlUrl }: { stlUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 50, 100);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    containerRef.current.appendChild(renderer.domElement);

    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement);

    // Add lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    // Load STL
    const loader = new STLLoader();
    loader.load(stlUrl, (geometry) => {
      const material = new THREE.MeshPhongMaterial({
        color: 0x2196f3,
        specular: 0x111111,
        shininess: 200
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Center geometry
      geometry.center();

      scene.add(mesh);

      // Fit camera to object
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5; // Add margin

      camera.position.set(center.x, center.y, center.z + cameraZ);
      camera.lookAt(center);
      controls.target.copy(center);
      controls.update();
    });

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [stlUrl]);

  return <div ref={containerRef} className="w-full h-96" />;
}
```

#### Option C: Thumbnail Generation (V1 Approach - Skip Full Preview)

For MVP, skip preview entirely:

```typescript
// Just return download link immediately
return NextResponse.json({
  success: true,
  jobId: paths.jobId,
  downloadUrl: `/api/download/${paths.jobId}`,
  // No preview - user downloads and opens in slicer
});
```

---

## Testing the Generation Pipeline

### Unit Tests

```typescript
// __tests__/openscad/generator.test.ts
import { describe, it, expect } from '@jest/globals';
import { OpenSCADGenerator } from '@/lib/openscad/generator';
import { DEFAULT_BIN_CONFIG } from '@/types/configuration';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('OpenSCADGenerator', () => {
  it('should generate valid OpenSCAD file', async () => {
    const generator = new OpenSCADGenerator();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scad-test-'));

    const svgPath = path.join(tempDir, 'test.svg');
    const scadPath = path.join(tempDir, 'test.scad');

    // Create test SVG
    const testSVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="30mm" viewBox="0 0 50 30">
  <path d="M 10,10 L 40,10 L 40,20 L 10,20 Z" fill="black"/>
</svg>`;

    await fs.writeFile(svgPath, testSVG);

    // Generate
    const result = await generator.generate(
      svgPath,
      DEFAULT_BIN_CONFIG,
      scadPath
    );

    expect(result.success).toBe(true);

    // Verify file was created
    const content = await fs.readFile(scadPath, 'utf-8');
    expect(content).toContain('gridfinity');
    expect(content).toContain(svgPath);

    // Cleanup
    await fs.rm(tempDir, { recursive: true });
  });
});
```

### Integration Tests

```bash
# Test OpenSCAD installation
openscad --version

# Test library path
OPENSCADPATH=/opt/gridfinity_extended_openscad openscad --version

# Test basic render (create test.scad first)
cat > test.scad << 'EOF'
cube([10, 10, 10]);
EOF

openscad -o test.stl test.scad
ls -lh test.stl

# Test with xvfb
xvfb-run -a openscad -o test.stl test.scad
```

### Manual End-to-End Test

```bash
# 1. Create test SVG
cat > /tmp/test-shape.svg << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="30mm" height="20mm" viewBox="0 0 30 20">
  <path d="M 5,5 L 25,5 L 25,15 L 5,15 Z" fill="black"/>
</svg>
EOF

# 2. Test API endpoint
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "svg": "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"30mm\" height=\"20mm\" viewBox=\"0 0 30 20\"><path d=\"M 5,5 L 25,5 L 25,15 L 5,15 Z\" fill=\"black\"/></svg>",
  "config": {
    "gridUnitsX": 2,
    "gridUnitsY": 2,
    "binHeight": 42,
    "cutoutDepth": 35,
    "cutoutPadding": 2,
    "cutoutOffsetX": 0,
    "cutoutOffsetY": 0,
    "wallThickness": 2,
    "baseType": "magnet",
    "lipStyle": "normal"
  },
  "generatePreview": false
}
EOF

# 3. Download generated STL
# (use jobId from response)
curl http://localhost:3000/api/download/{jobId} -o output.stl

# 4. Verify STL
file output.stl
# Should output: "output.stl: data"
```

---

## Error Scenarios & Handling

### Common Errors

#### 1. OpenSCAD Not Installed

```
Error: spawn openscad ENOENT
```

**Solution**: Install OpenSCAD or check PATH
```bash
which openscad
sudo apt-get install openscad
```

#### 2. Library Not Found

```
WARNING: Can't open library 'gridfinity_custom_cup.scad'
```

**Solution**: Set OPENSCADPATH
```bash
export OPENSCADPATH=/opt/gridfinity_extended_openscad
```

#### 3. Invalid SVG

```
ERROR: import() failed for 'shape.svg'
```

**Solution**: Validate SVG format, ensure proper XML and namespace

#### 4. Timeout During Rendering

```
OpenSCAD execution timed out after 300000ms
```

**Solution**:
- Increase timeout for complex models
- Simplify SVG paths
- Check server resources

#### 5. Disk Space Issues

```
ENOSPC: no space left on device
```

**Solution**:
- Implement aggressive cleanup
- Reduce maxStorageSize
- Monitor disk usage

### Error Response Format

All API errors should return consistent format:

```typescript
{
  error: string;        // User-friendly error message
  code?: string;        // Error code for client handling
  details?: unknown;    // Additional error details
  message?: string;     // Technical error message
}
```

---

## Performance Considerations

### Render Times

Typical OpenSCAD render times on modern server:
- Simple cutout (< 100 path points): 5-15 seconds
- Medium complexity (100-500 points): 15-45 seconds
- Complex (> 500 points): 45-120 seconds

**Optimization strategies**:
1. Simplify SVG paths (Douglas-Peucker algorithm)
2. Use render caching for identical configs
3. Implement job queue for concurrent requests
4. Consider GPU-accelerated OpenSCAD builds

### Concurrent Rendering

```typescript
// lib/openscad/queue.ts
import PQueue from 'p-queue';

const renderQueue = new PQueue({
  concurrency: 2,  // Max 2 simultaneous renders
  timeout: 300000  // 5 minute timeout per job
});

export async function queueRender(
  scadPath: string,
  outputPath: string
): Promise<RenderResult> {
  return renderQueue.add(() =>
    openscadExecutor.render(scadPath, outputPath)
  );
}
```

### Memory Management

OpenSCAD can use significant memory (500MB-2GB per render):

```typescript
// Monitor memory usage
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning') {
    console.warn('Memory warning:', warning);
    // Trigger cleanup
    fileManager.enforceStorageLimit();
  }
});
```

---

## Environment Variables

```bash
# .env.local

# OpenSCAD configuration
OPENSCAD_BINARY=openscad
OPENSCADPATH=/opt/gridfinity_extended_openscad
OPENSCAD_USE_XVFB=true
OPENSCAD_TIMEOUT=300000

# File management
OPENSCAD_TEMP_DIR=.tmp/openscad
OPENSCAD_MAX_FILE_AGE=3600000
OPENSCAD_MAX_STORAGE_SIZE=1073741824

# Generation options
OPENSCAD_ENABLE_PREVIEW=false
OPENSCAD_MAX_CONCURRENT_RENDERS=2
```

---

## Production Checklist

- [ ] OpenSCAD installed and accessible
- [ ] Gridfinity library cloned and path configured
- [ ] xvfb installed for headless rendering
- [ ] Temp directory created with proper permissions
- [ ] Environment variables set
- [ ] File cleanup cron job or periodic task running
- [ ] Disk space monitoring configured
- [ ] Rate limiting on generation endpoint
- [ ] Logging configured for render errors
- [ ] Health check endpoint for OpenSCAD availability
- [ ] Backup strategy for critical generated files (if keeping)
- [ ] Security audit of file paths (prevent traversal)

---

## Next Steps

After implementing this system:
1. Test complete pipeline locally
2. Deploy to staging environment
3. Load test with concurrent requests
4. Monitor render times and optimize
5. Implement job queue if needed
6. Add render caching for common configurations
7. Consider adding STL validation/repair
8. Implement client-side 3D preview

---

## References

- [OpenSCAD Documentation](https://openscad.org/documentation.html)
- [Gridfinity Extended OpenSCAD](https://github.com/ostat/gridfinity_extended_openscad)
- [Custom Cutout Guide](https://docs.ostat.com/docs/openscad/gridfinity-extended/custom-cutout/)
- [SVG Import in OpenSCAD](https://openscad.org/documentation.html#import)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
