import * as THREE from "three";

/**
 * Material presets for 3D STL viewer
 * Provides reusable material configurations for consistent rendering
 */

/**
 * Default material for Gridfinity bins - semi-matte plastic finish
 */
export function createBinMaterial(color: string = "#e0e0e0"): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.35,
    metalness: 0.05,
    flatShading: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Material for transparent/ghost preview
 */
export function createGhostMaterial(color: string = "#4a9eff"): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
}

/**
 * Material for wireframe view
 */
export function createWireframeMaterial(color: string = "#333333"): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    wireframe: true,
    side: THREE.DoubleSide,
  });
}

/**
 * Common 3D printing filament colors
 */
export const FILAMENT_COLORS = {
  white: "#ffffff",
  black: "#1a1a1a",
  gray: "#808080",
  lightGray: "#e0e0e0",
  red: "#dc2626",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  brown: "#78350f",
} as const;

export type FilamentColor = keyof typeof FILAMENT_COLORS;

/**
 * Get a material with a specific filament color
 */
export function createColoredMaterial(colorName: FilamentColor): THREE.MeshStandardMaterial {
  return createBinMaterial(FILAMENT_COLORS[colorName]);
}
