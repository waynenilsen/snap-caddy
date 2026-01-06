/**
 * Unit tests for OpenSCAD Executor
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { OpenSCADExecutor } from './executor';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Mock logger to avoid console output during tests
mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
}));

// Mock env module
mock.module('@/lib/env', () => ({
  env: {
    OPENSCAD_PATH: '/usr/bin/openscad',
    OPENSCAD_USE_XVFB: false,
    OPENSCAD_TIMEOUT: 30000,
  },
}));

// Create a mock child process
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(signal?: string) {
    this.killed = true;
    // Simulate process being killed
    setTimeout(() => {
      this.emit('close', null);
    }, 10);
    return true;
  }
}

describe('OpenSCADExecutor', () => {
  let mockSpawn: ReturnType<typeof mock>;
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    // Create a fresh mock child process for each test
    mockChildProcess = new MockChildProcess();

    // Mock child_process.spawn
    mockSpawn = mock((command: string, args: string[], options: any) => {
      return mockChildProcess;
    });

    mock.module('child_process', () => ({
      spawn: mockSpawn,
    }));
  });

  afterEach(() => {
    // Clean up any pending timers
    mockChildProcess.removeAllListeners();
  });

  describe('Constructor', () => {
    it('should set defaults from env variables', () => {
      const executor = new OpenSCADExecutor();

      // We can't directly access private properties, but we can verify behavior
      // by checking the spawn call arguments in subsequent tests
      expect(executor).toBeDefined();
    });

    it('should accept custom openscadBinary option', async () => {
      const executor = new OpenSCADExecutor({
        openscadBinary: '/custom/path/openscad',
      });

      const renderPromise = executor.render('/test.scad', '/test.stl');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [command] = mockSpawn.mock.calls[0];
      expect(command).toBe('/custom/path/openscad');
    });

    it('should accept custom timeout option', async () => {
      const executor = new OpenSCADExecutor({
        timeout: 50, // Very short timeout for testing
      });

      const renderPromise = executor.render('/test.scad', '/test.stl');

      // Don't emit close event - let it timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChildProcess.killed).toBe(true);

      // Now await the result to complete the promise
      const result = await renderPromise;
      expect(result.success).toBe(false);
    });

    it('should accept custom useXvfb option', async () => {
      const executor = new OpenSCADExecutor({
        useXvfb: true,
      });

      const renderPromise = executor.render('/test.scad', '/test.stl');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [command, args] = mockSpawn.mock.calls[0];
      expect(command).toBe('xvfb-run');
      expect(args).toContain('-a');
      expect(args).toContain('-s');
      expect(args).toContain('-screen 0 1024x768x24');
    });
  });

  describe('render()', () => {
    it('should build correct command args for basic render', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      const result = await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [command, args] = mockSpawn.mock.calls[0];
      expect(command).toBe('/usr/bin/openscad');
      expect(args).toEqual([
        '-o',
        '/output.stl',
        '--export-format',
        'binstl',
        '/input.scad',
      ]);
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/output.stl');
    });

    it('should include colorscheme option when provided', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl', {
        colorscheme: 'Tomorrow Night',
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--colorscheme');
      expect(args).toContain('Tomorrow Night');
    });

    it('should include viewall option when provided', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl', {
        viewall: true,
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--viewall');
    });

    it('should include both colorscheme and viewall when provided', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl', {
        colorscheme: 'Cornfield',
        viewall: true,
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--colorscheme');
      expect(args).toContain('Cornfield');
      expect(args).toContain('--viewall');
    });

    it('should return success with stdout and stderr on successful execution', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Simulate stdout and stderr output
      setTimeout(() => {
        mockChildProcess.stdout.emit('data', Buffer.from('Compiling design...\n'));
        mockChildProcess.stdout.emit('data', Buffer.from('Rendering...\n'));
        mockChildProcess.stderr.emit('data', Buffer.from('Warning: test warning\n'));
        mockChildProcess.emit('close', 0);
      }, 10);

      const result = await renderPromise;

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/output.stl');
      expect(result.stdout).toBe('Compiling design...\nRendering...\n');
      expect(result.stderr).toBe('Warning: test warning\n');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return error when process exits with non-zero code', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Simulate failed execution
      setTimeout(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('ERROR: Syntax error\n'));
        mockChildProcess.emit('close', 1);
      }, 10);

      const result = await renderPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenSCAD exited with code 1');
      expect(result.stderr).toBe('ERROR: Syntax error\n');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle spawn errors', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Simulate spawn error
      setTimeout(() => {
        mockChildProcess.emit('error', new Error('Command not found'));
      }, 10);

      const result = await renderPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command not found');
    });

    it('should handle exceptions during render', async () => {
      // Mock spawn to throw an error
      const errorSpawn = mock(() => {
        throw new Error('Unexpected error');
      });
      mock.module('child_process', () => ({
        spawn: errorSpawn,
      }));

      const executor = new OpenSCADExecutor();
      const result = await executor.render('/input.scad', '/output.stl');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('preview()', () => {
    it('should build correct command args for basic preview', async () => {
      const executor = new OpenSCADExecutor();
      const previewPromise = executor.preview('/input.scad', '/output.png');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      const result = await previewPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [command, args] = mockSpawn.mock.calls[0];
      expect(command).toBe('/usr/bin/openscad');
      expect(args).toEqual([
        '-o',
        '/output.png',
        '--render',
        '/input.scad',
      ]);
      expect(result.success).toBe(true);
      expect(result.previewPath).toBe('/output.png');
    });

    it('should include camera option when provided', async () => {
      const executor = new OpenSCADExecutor();
      const previewPromise = executor.preview('/input.scad', '/output.png', {
        camera: '0,0,0,55,0,25,500',
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await previewPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--camera');
      expect(args).toContain('0,0,0,55,0,25,500');
    });

    it('should include imgsize option when provided', async () => {
      const executor = new OpenSCADExecutor();
      const previewPromise = executor.preview('/input.scad', '/output.png', {
        imgsize: '800,600',
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await previewPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--imgsize');
      expect(args).toContain('800,600');
    });

    it('should include colorscheme and viewall options when provided', async () => {
      const executor = new OpenSCADExecutor();
      const previewPromise = executor.preview('/input.scad', '/output.png', {
        colorscheme: 'Tomorrow Night',
        viewall: true,
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await previewPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--colorscheme');
      expect(args).toContain('Tomorrow Night');
      expect(args).toContain('--viewall');
    });

    it('should include all options when provided', async () => {
      const executor = new OpenSCADExecutor();
      const previewPromise = executor.preview('/input.scad', '/output.png', {
        colorscheme: 'Cornfield',
        viewall: true,
        camera: '0,0,0,55,0,25,500',
        imgsize: '1024,768',
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await previewPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--colorscheme');
      expect(args).toContain('Cornfield');
      expect(args).toContain('--viewall');
      expect(args).toContain('--camera');
      expect(args).toContain('0,0,0,55,0,25,500');
      expect(args).toContain('--imgsize');
      expect(args).toContain('1024,768');
    });

    it('should return success with previewPath on successful execution', async () => {
      const executor = new OpenSCADExecutor();
      const previewPromise = executor.preview('/input.scad', '/output.png');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.stdout.emit('data', Buffer.from('Generating preview...\n'));
        mockChildProcess.emit('close', 0);
      }, 10);

      const result = await previewPromise;

      expect(result.success).toBe(true);
      expect(result.previewPath).toBe('/output.png');
      expect(result.stdout).toBe('Generating preview...\n');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return error when process exits with non-zero code', async () => {
      const executor = new OpenSCADExecutor();
      const previewPromise = executor.preview('/input.scad', '/output.png');

      // Simulate failed execution
      setTimeout(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('ERROR: Cannot generate preview\n'));
        mockChildProcess.emit('close', 1);
      }, 10);

      const result = await previewPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenSCAD exited with code 1');
      expect(result.stderr).toBe('ERROR: Cannot generate preview\n');
    });

    it('should handle exceptions during preview', async () => {
      // Mock spawn to throw an error
      const errorSpawn = mock(() => {
        throw new Error('Preview error');
      });
      mock.module('child_process', () => ({
        spawn: errorSpawn,
      }));

      const executor = new OpenSCADExecutor();
      const result = await executor.preview('/input.scad', '/output.png');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Preview error');
    });
  });

  describe('Timeout handling', () => {
    it('should kill process and return timeout error when timeout is exceeded', async () => {
      const executor = new OpenSCADExecutor({
        timeout: 100, // Very short timeout
      });

      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Don't emit close event immediately - let it timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockChildProcess.killed).toBe(true);

      const result = await renderPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout after 100ms');
    });

    it('should use per-operation timeout when provided', async () => {
      const executor = new OpenSCADExecutor({
        timeout: 5000,
      });

      const renderPromise = executor.render('/input.scad', '/output.stl', {
        timeout: 50, // Override with shorter timeout
      });

      // Let it timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChildProcess.killed).toBe(true);

      const result = await renderPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout after 50ms');
    });

    it('should clear timeout on successful completion', async () => {
      const executor = new OpenSCADExecutor({
        timeout: 1000,
      });

      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Complete before timeout
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      const result = await renderPromise;

      // If timeout wasn't cleared, the process would still be killed
      expect(result.success).toBe(true);
      expect(mockChildProcess.killed).toBe(false);
    });
  });

  describe('xvfb-run support', () => {
    it('should use xvfb-run when useXvfb is true', async () => {
      const executor = new OpenSCADExecutor({
        useXvfb: true,
      });

      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [command, args] = mockSpawn.mock.calls[0];
      expect(command).toBe('xvfb-run');
      expect(args[0]).toBe('-a');
      expect(args[1]).toBe('-s');
      expect(args[2]).toBe('-screen 0 1024x768x24');
      expect(args[3]).toBe('/usr/bin/openscad');
      expect(args[4]).toBe('-o');
      expect(args[5]).toBe('/output.stl');
    });

    it('should not use xvfb-run when useXvfb is false', async () => {
      const executor = new OpenSCADExecutor({
        useXvfb: false,
      });

      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [command, args] = mockSpawn.mock.calls[0];
      expect(command).toBe('/usr/bin/openscad');
      expect(args[0]).toBe('-o');
      expect(command).not.toBe('xvfb-run');
    });

    it('should work with xvfb-run for preview operations', async () => {
      const executor = new OpenSCADExecutor({
        useXvfb: true,
      });

      const previewPromise = executor.preview('/input.scad', '/output.png', {
        camera: '0,0,0,55,0,25,500',
        imgsize: '800,600',
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await previewPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [command, args] = mockSpawn.mock.calls[0];
      expect(command).toBe('xvfb-run');
      expect(args).toContain('/usr/bin/openscad');
      expect(args).toContain('--camera');
      expect(args).toContain('--imgsize');
    });
  });

  describe('Custom environment variables', () => {
    it('should pass custom environment variables to spawn', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl', {
        env: {
          CUSTOM_VAR: 'custom_value',
        },
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, , options] = mockSpawn.mock.calls[0];
      expect(options.env.CUSTOM_VAR).toBe('custom_value');
    });

    it('should merge custom env with process.env', async () => {
      const executor = new OpenSCADExecutor();
      const originalPath = process.env.PATH;

      const renderPromise = executor.render('/input.scad', '/output.stl', {
        env: {
          CUSTOM_VAR: 'test',
        },
      });

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, , options] = mockSpawn.mock.calls[0];
      expect(options.env.CUSTOM_VAR).toBe('test');
      expect(options.env.PATH).toBe(originalPath);
    });
  });

  describe('Process stdio configuration', () => {
    it('should configure stdio correctly', async () => {
      const executor = new OpenSCADExecutor();
      const renderPromise = executor.render('/input.scad', '/output.stl');

      // Simulate successful execution
      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 10);

      await renderPromise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, , options] = mockSpawn.mock.calls[0];
      expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
    });
  });
});
