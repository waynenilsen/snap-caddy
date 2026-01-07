// Test setup file to provide DOM environment for Bun tests using happy-dom
import { GlobalWindow } from "happy-dom";

const globalWindow = new GlobalWindow();
const window = globalWindow.window;

// Type the global object properly for test environment extensions
interface GlobalWithDOM {
  window: typeof window;
  document: typeof window.document;
  navigator: typeof window.navigator;
  HTMLElement: typeof window.HTMLElement;
  Element: typeof window.Element;
  Node: typeof window.Node;
  Text: typeof window.Text;
  DocumentFragment: typeof window.DocumentFragment;
  ImageData: typeof ImageDataPolyfill;
}

// Expose globals to the test environment
const globalWithDOM = global as unknown as GlobalWithDOM;
globalWithDOM.window = window;
globalWithDOM.document = window.document;
globalWithDOM.navigator = window.navigator;
globalWithDOM.HTMLElement = window.HTMLElement;
globalWithDOM.Element = window.Element;
globalWithDOM.Node = window.Node;
globalWithDOM.Text = window.Text;
globalWithDOM.DocumentFragment = window.DocumentFragment;

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

globalWithDOM.ImageData = ImageDataPolyfill;
