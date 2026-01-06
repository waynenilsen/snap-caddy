// Test setup file to provide DOM environment for Bun tests using happy-dom
import { GlobalWindow } from 'happy-dom';

const globalWindow = new GlobalWindow();
const window = globalWindow.window;

// Expose globals to the test environment
(global as any).window = window;
(global as any).document = window.document;
(global as any).navigator = window.navigator;
(global as any).HTMLElement = window.HTMLElement;
(global as any).Element = window.Element;
(global as any).Node = window.Node;
(global as any).Text = window.Text;
(global as any).DocumentFragment = window.DocumentFragment;

// Create ImageData polyfill for happy-dom (which doesn't include it)
class ImageDataPolyfill {
  public width: number;
  public height: number;
  public data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

(global as any).ImageData = ImageDataPolyfill;
