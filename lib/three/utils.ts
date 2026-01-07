import * as THREE from "three";

/**
 * Three.js utility functions for STL viewer
 */

/**
 * Calculate optimal camera position and distance to fit a geometry in view
 * @param geometry - The geometry to frame
 * @param fov - Camera field of view in degrees
 * @param aspect - Camera aspect ratio
 * @returns Object with camera position and target
 */
export function calculateCameraPosition(
  geometry: THREE.BufferGeometry,
  fov: number = 50,
  aspect: number = 1
): { position: THREE.Vector3; target: THREE.Vector3 } {
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox;

  if (!boundingBox) {
    return {
      position: new THREE.Vector3(100, 100, 100),
      target: new THREE.Vector3(0, 0, 0),
    };
  }

  const center = new THREE.Vector3();
  boundingBox.getCenter(center);

  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  // Get the maximum dimension
  const maxDim = Math.max(size.x, size.y, size.z);

  // Calculate distance needed to fit the object in view
  const fovRad = (fov * Math.PI) / 180;
  const distance = maxDim / (2 * Math.tan(fovRad / 2));

  // Add some padding
  const padding = 1.5;
  const cameraDistance = distance * padding;

  // Position camera at a 45-degree angle from above
  const position = new THREE.Vector3(
    center.x + cameraDistance * 0.6,
    center.y + cameraDistance * 0.7,
    center.z + cameraDistance * 0.6
  );

  return { position, target: center };
}

/**
 * Get the bounding box dimensions of a geometry
 */
export function getGeometryDimensions(
  geometry: THREE.BufferGeometry
): { width: number; height: number; depth: number } {
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox;

  if (!boundingBox) {
    return { width: 0, height: 0, depth: 0 };
  }

  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  return {
    width: size.x,
    height: size.y,
    depth: size.z,
  };
}

/**
 * Calculate grid size based on geometry dimensions
 * @param geometry - The geometry to base grid size on
 * @param padding - Extra space around the geometry (multiplier)
 * @returns Grid size and divisions
 */
export function calculateGridSize(
  geometry: THREE.BufferGeometry,
  padding: number = 1.5
): { size: number; divisions: number } {
  const dims = getGeometryDimensions(geometry);
  const maxDim = Math.max(dims.width, dims.depth);

  // Round up to nearest 10 for clean grid lines
  const size = Math.ceil((maxDim * padding) / 10) * 10;

  // Use divisions that result in ~10mm grid squares
  const divisions = Math.max(size / 10, 10);

  return { size, divisions };
}

/**
 * Dispose of Three.js resources properly to prevent memory leaks
 */
export function disposeResources(
  geometry?: THREE.BufferGeometry | null,
  material?: THREE.Material | THREE.Material[] | null
): void {
  if (geometry) {
    geometry.dispose();
  }

  if (material) {
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }
  }
}

/**
 * Check if WebGL is available in the browser
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Check if WebGL2 is available in the browser
 */
export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * Detect if the device is likely a low-end device
 * Based on available memory and hardware concurrency
 */
export function isLowEndDevice(): boolean {
  // Check device memory (in GB, only available in some browsers)
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (deviceMemory && deviceMemory < 4) {
    return true;
  }

  // Check CPU cores
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    return true;
  }

  return false;
}

/**
 * Get recommended quality settings based on device capabilities
 */
export function getRecommendedQuality(): "low" | "medium" | "high" {
  if (!isWebGLAvailable()) {
    return "low";
  }

  if (isLowEndDevice()) {
    return "low";
  }

  if (!isWebGL2Available()) {
    return "medium";
  }

  return "high";
}

/**
 * Quality settings presets
 */
export const QUALITY_PRESETS = {
  low: {
    antialias: false,
    shadowMapEnabled: false,
    shadowMapSize: 512,
    pixelRatio: 1,
  },
  medium: {
    antialias: true,
    shadowMapEnabled: true,
    shadowMapSize: 1024,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
  },
  high: {
    antialias: true,
    shadowMapEnabled: true,
    shadowMapSize: 2048,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  },
} as const;

export type QualityLevel = keyof typeof QUALITY_PRESETS;
