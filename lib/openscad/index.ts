/**
 * OpenSCAD Integration Module
 *
 * Provides complete OpenSCAD integration for Snap Caddy, including:
 * - Template generation for custom Gridfinity bins
 * - STL file rendering
 * - Preview image generation
 * - File management for generation jobs
 */

// Export executor
export {
  type ExecuteOptions,
  OpenSCADExecutor,
  openscadExecutor,
  type PreviewOptions,
  type PreviewResult,
  type RenderOptions,
  type RenderResult,
} from "./executor";
// Export file manager
export {
  type JobPaths,
  STLFileManager,
  stlFileManager,
} from "./fileManager";
// Export generator
export {
  type GenerateResult,
  OpenSCADGenerator,
  openscadGenerator,
} from "./generator";
