import { describe, it, expect, afterEach, mock, beforeEach } from "bun:test";
import * as THREE from "three";
import {
  calculateCameraPosition,
  getGeometryDimensions,
  calculateGridSize,
  disposeResources,
  QUALITY_PRESETS,
} from "./utils";

describe("Three.js utilities", () => {
  let geometry: THREE.BufferGeometry | null = null;

  beforeEach(() => {
    // Create a simple box geometry for testing
    geometry = new THREE.BoxGeometry(100, 50, 75);
  });

  afterEach(() => {
    if (geometry) {
      geometry.dispose();
      geometry = null;
    }
  });

  describe("calculateCameraPosition", () => {
    it("returns position and target vectors", () => {
      const result = calculateCameraPosition(geometry!);

      expect(result.position).toBeInstanceOf(THREE.Vector3);
      expect(result.target).toBeInstanceOf(THREE.Vector3);
    });

    it("positions camera away from the geometry", () => {
      const result = calculateCameraPosition(geometry!);

      // Camera should be at a distance from the origin (centered geometry)
      const distance = result.position.length();
      expect(distance).toBeGreaterThan(50); // Should be farther than half the max dimension
    });

    it("targets the center of the geometry", () => {
      const result = calculateCameraPosition(geometry!);

      // For centered geometry, target should be near origin
      expect(result.target.length()).toBeLessThan(1);
    });

    it("respects FOV parameter", () => {
      const narrowFov = calculateCameraPosition(geometry!, 30);
      const wideFov = calculateCameraPosition(geometry!, 90);

      // Narrower FOV should result in farther camera position
      const narrowDistance = narrowFov.position.length();
      const wideDistance = wideFov.position.length();

      expect(narrowDistance).toBeGreaterThan(wideDistance);
    });

    it("handles geometry without bounding box gracefully", () => {
      const emptyGeometry = new THREE.BufferGeometry();
      const result = calculateCameraPosition(emptyGeometry);

      // Empty geometry has a computed bounding box with zero size
      // so the camera position should be valid vectors
      expect(result.position).toBeInstanceOf(THREE.Vector3);
      expect(result.target).toBeInstanceOf(THREE.Vector3);
      // Position should not contain NaN values
      expect(Number.isNaN(result.position.x)).toBe(false);
      expect(Number.isNaN(result.position.y)).toBe(false);
      expect(Number.isNaN(result.position.z)).toBe(false);

      emptyGeometry.dispose();
    });
  });

  describe("getGeometryDimensions", () => {
    it("returns correct dimensions for box geometry", () => {
      const dims = getGeometryDimensions(geometry!);

      expect(dims.width).toBeCloseTo(100, 1);
      expect(dims.height).toBeCloseTo(50, 1);
      expect(dims.depth).toBeCloseTo(75, 1);
    });

    it("returns zeros for empty geometry", () => {
      const emptyGeometry = new THREE.BufferGeometry();
      const dims = getGeometryDimensions(emptyGeometry);

      expect(dims.width).toBe(0);
      expect(dims.height).toBe(0);
      expect(dims.depth).toBe(0);

      emptyGeometry.dispose();
    });

    it("returns correct dimensions for sphere geometry", () => {
      const sphereGeometry = new THREE.SphereGeometry(50, 32, 32);
      const dims = getGeometryDimensions(sphereGeometry);

      // Sphere with radius 50 should have diameter 100 in all directions
      expect(dims.width).toBeCloseTo(100, 0);
      expect(dims.height).toBeCloseTo(100, 0);
      expect(dims.depth).toBeCloseTo(100, 0);

      sphereGeometry.dispose();
    });
  });

  describe("calculateGridSize", () => {
    it("returns size and divisions", () => {
      const result = calculateGridSize(geometry!);

      expect(typeof result.size).toBe("number");
      expect(typeof result.divisions).toBe("number");
      expect(result.size).toBeGreaterThan(0);
      expect(result.divisions).toBeGreaterThan(0);
    });

    it("grid size is larger than geometry", () => {
      const result = calculateGridSize(geometry!);
      const dims = getGeometryDimensions(geometry!);
      const maxDim = Math.max(dims.width, dims.depth);

      expect(result.size).toBeGreaterThan(maxDim);
    });

    it("respects padding parameter", () => {
      const smallPadding = calculateGridSize(geometry!, 1.1);
      const largePadding = calculateGridSize(geometry!, 2.0);

      expect(largePadding.size).toBeGreaterThan(smallPadding.size);
    });

    it("divisions result in approximately 10mm grid squares", () => {
      const result = calculateGridSize(geometry!);

      // Grid square size should be around 10mm
      const gridSquareSize = result.size / result.divisions;
      expect(gridSquareSize).toBeGreaterThanOrEqual(5);
      expect(gridSquareSize).toBeLessThanOrEqual(20);
    });
  });

  describe("disposeResources", () => {
    it("disposes geometry", () => {
      const testGeometry = new THREE.BoxGeometry(10, 10, 10);
      const disposeSpy = mock(() => {});
      testGeometry.dispose = disposeSpy;

      disposeResources(testGeometry);

      expect(disposeSpy).toHaveBeenCalled();
    });

    it("disposes material", () => {
      const testMaterial = new THREE.MeshBasicMaterial();
      const disposeSpy = mock(() => {});
      testMaterial.dispose = disposeSpy;

      disposeResources(null, testMaterial);

      expect(disposeSpy).toHaveBeenCalled();
    });

    it("disposes array of materials", () => {
      const materials = [
        new THREE.MeshBasicMaterial(),
        new THREE.MeshStandardMaterial(),
      ];

      const disposeSpies = materials.map((m) => {
        const spy = mock(() => {});
        m.dispose = spy;
        return spy;
      });

      disposeResources(null, materials);

      for (const spy of disposeSpies) {
        expect(spy).toHaveBeenCalled();
      }
    });

    it("handles null/undefined gracefully", () => {
      // Should not throw
      expect(() => disposeResources(null, null)).not.toThrow();
      expect(() => disposeResources(undefined, undefined)).not.toThrow();
    });
  });

  describe("QUALITY_PRESETS", () => {
    it("has low, medium, and high presets", () => {
      expect(QUALITY_PRESETS.low).toBeDefined();
      expect(QUALITY_PRESETS.medium).toBeDefined();
      expect(QUALITY_PRESETS.high).toBeDefined();
    });

    it("low preset has reduced quality settings", () => {
      expect(QUALITY_PRESETS.low.antialias).toBe(false);
      expect(QUALITY_PRESETS.low.shadowMapEnabled).toBe(false);
      expect(QUALITY_PRESETS.low.pixelRatio).toBe(1);
    });

    it("high preset has enhanced quality settings", () => {
      expect(QUALITY_PRESETS.high.antialias).toBe(true);
      expect(QUALITY_PRESETS.high.shadowMapEnabled).toBe(true);
      expect(QUALITY_PRESETS.high.shadowMapSize).toBeGreaterThanOrEqual(2048);
    });

    it("shadow map sizes increase with quality", () => {
      expect(QUALITY_PRESETS.low.shadowMapSize).toBeLessThanOrEqual(
        QUALITY_PRESETS.medium.shadowMapSize,
      );
      expect(QUALITY_PRESETS.medium.shadowMapSize).toBeLessThanOrEqual(
        QUALITY_PRESETS.high.shadowMapSize,
      );
    });
  });
});
