/**
 * OpenSCAD Executor
 * Handles execution of OpenSCAD commands for rendering STL files and previews
 */

import { spawn } from "node:child_process";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Result of rendering operation
 */
export interface RenderResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  stderr?: string;
  stdout?: string;
  duration?: number;
}

/**
 * Result of preview generation
 */
export interface PreviewResult {
  success: boolean;
  previewPath?: string;
  error?: string;
  stderr?: string;
  stdout?: string;
  duration?: number;
}

/**
 * OpenSCAD execution options
 */
export interface ExecuteOptions {
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Render options for STL generation
 */
export interface RenderOptions extends ExecuteOptions {
  colorscheme?: string;
  viewall?: boolean;
}

/**
 * Preview options for image generation
 */
export interface PreviewOptions extends ExecuteOptions {
  colorscheme?: string;
  viewall?: boolean;
  camera?: string;
  imgsize?: string;
}

/**
 * OpenSCAD Executor
 */
export class OpenSCADExecutor {
  private openscadBinary: string;
  private useXvfb: boolean;
  private defaultTimeout: number;

  constructor(options?: {
    openscadBinary?: string;
    useXvfb?: boolean;
    timeout?: number;
  }) {
    this.openscadBinary = options?.openscadBinary || env.OPENSCAD_PATH;
    this.useXvfb = options?.useXvfb ?? env.OPENSCAD_USE_XVFB;
    this.defaultTimeout = options?.timeout || env.OPENSCAD_TIMEOUT;
  }

  /**
   * Render an STL file from an OpenSCAD file
   */
  async render(
    scadPath: string,
    outputPath: string,
    options?: RenderOptions,
  ): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      logger.info("Starting OpenSCAD render", { scadPath, outputPath });

      const args: string[] = ["-o", outputPath, "--export-format", "binstl"];

      // Add optional parameters
      if (options?.colorscheme) {
        args.push("--colorscheme", options.colorscheme);
      }

      if (options?.viewall) {
        args.push("--viewall");
      }

      // Add input file
      args.push(scadPath);

      const result = await this.execute(args, options);
      const duration = Date.now() - startTime;

      if (result.success) {
        logger.info("OpenSCAD render completed", { outputPath, duration });
        return {
          success: true,
          outputPath,
          stdout: result.stdout,
          stderr: result.stderr,
          duration,
        };
      }

      logger.error("OpenSCAD render failed", {
        scadPath,
        error: result.error,
        stderr: result.stderr,
      });

      return {
        success: false,
        error: result.error,
        stderr: result.stderr,
        stdout: result.stdout,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("OpenSCAD render exception", {
        error: errorMessage,
        scadPath,
      });

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Generate a preview image from an OpenSCAD file
   */
  async preview(
    scadPath: string,
    outputPath: string,
    options?: PreviewOptions,
  ): Promise<PreviewResult> {
    const startTime = Date.now();

    try {
      logger.info("Starting OpenSCAD preview", { scadPath, outputPath });

      const args: string[] = ["-o", outputPath, "--render"];

      // Add optional parameters
      if (options?.colorscheme) {
        args.push("--colorscheme", options.colorscheme);
      }

      if (options?.viewall) {
        args.push("--viewall");
      }

      if (options?.camera) {
        args.push("--camera", options.camera);
      }

      if (options?.imgsize) {
        args.push("--imgsize", options.imgsize);
      }

      // Add input file
      args.push(scadPath);

      const result = await this.execute(args, options);
      const duration = Date.now() - startTime;

      if (result.success) {
        logger.info("OpenSCAD preview completed", { outputPath, duration });
        return {
          success: true,
          previewPath: outputPath,
          stdout: result.stdout,
          stderr: result.stderr,
          duration,
        };
      }

      logger.error("OpenSCAD preview failed", {
        scadPath,
        error: result.error,
        stderr: result.stderr,
      });

      return {
        success: false,
        error: result.error,
        stderr: result.stderr,
        stdout: result.stdout,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("OpenSCAD preview exception", {
        error: errorMessage,
        scadPath,
      });

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Execute OpenSCAD command
   */
  private async execute(
    args: string[],
    options?: ExecuteOptions,
  ): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const timeout = options?.timeout || this.defaultTimeout;
      const processEnv = {
        ...process.env,
        ...options?.env,
      };

      // Prepare command and arguments
      let command: string;
      let commandArgs: string[];

      if (this.useXvfb) {
        // Use xvfb-run for headless rendering
        command = "xvfb-run";
        commandArgs = [
          "-a",
          "-s",
          "-screen 0 1024x768x24",
          this.openscadBinary,
          ...args,
        ];
      } else {
        command = this.openscadBinary;
        commandArgs = args;
      }

      logger.debug("Executing OpenSCAD", { command, args: commandArgs });

      const child = spawn(command, commandArgs, {
        env: processEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let killed = false;

      // Set timeout
      const timer = setTimeout(() => {
        killed = true;
        child.kill("SIGTERM");

        // Force kill after 5 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 5000);
      }, timeout);

      // Collect stdout
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // Handle completion
      child.on("close", (code) => {
        clearTimeout(timer);

        if (killed) {
          resolve({
            success: false,
            stdout,
            stderr,
            error: `OpenSCAD execution timeout after ${timeout}ms`,
          });
          return;
        }

        if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr,
          });
        } else {
          resolve({
            success: false,
            stdout,
            stderr,
            error: `OpenSCAD exited with code ${code}`,
          });
        }
      });

      // Handle errors
      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout,
          stderr,
          error: error.message,
        });
      });
    });
  }
}

// Export singleton instance
export const openscadExecutor = new OpenSCADExecutor();
