/**
 * OpenSCAD Integration Module
 *
 * Provides complete OpenSCAD integration for Snap Caddy, including:
 * - Template generation for custom Gridfinity bins
 * - STL file rendering
 * - Preview image generation
 * - File management for generation jobs
 */

// Export generator
export {
  OpenSCADGenerator,
  openscadGenerator,
  type GenerateResult,
} from "./generator";

// Export executor
export {
  OpenSCADExecutor,
  openscadExecutor,
  type RenderResult,
  type PreviewResult,
  type ExecuteOptions,
  type RenderOptions,
  type PreviewOptions,
} from "./executor";

// Export file manager
export {
  STLFileManager,
  stlFileManager,
  type JobPaths,
} from "./fileManager";
