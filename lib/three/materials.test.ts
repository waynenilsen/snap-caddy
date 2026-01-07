import { afterEach, describe, expect, it } from "bun:test";
import * as THREE from "three";
import {
  createBinMaterial,
  createColoredMaterial,
  createGhostMaterial,
  createWireframeMaterial,
  FILAMENT_COLORS,
} from "./materials";

describe("materials", () => {
  let material: THREE.Material | null = null;

  afterEach(() => {
    // Dispose material to prevent memory leaks
    if (material) {
      material.dispose();
      material = null;
    }
  });

  describe("createBinMaterial", () => {
    it("creates a MeshStandardMaterial with default color", () => {
      material = createBinMaterial();

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(
        (material as THREE.MeshStandardMaterial).color.getHexString(),
      ).toBe("e0e0e0");
    });

    it("creates a MeshStandardMaterial with custom color", () => {
      material = createBinMaterial("#ff0000");

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(
        (material as THREE.MeshStandardMaterial).color.getHexString(),
      ).toBe("ff0000");
    });

    it("has semi-matte plastic finish properties", () => {
      material = createBinMaterial();
      const standardMaterial: THREE.MeshStandardMaterial =
        material instanceof THREE.MeshStandardMaterial
          ? material
          : new THREE.MeshStandardMaterial();

      expect(standardMaterial.roughness).toBeGreaterThan(0.2);
      expect(standardMaterial.roughness).toBeLessThan(0.5);
      expect(standardMaterial.metalness).toBeLessThan(0.2);
      expect(standardMaterial.flatShading).toBe(false);
      expect(standardMaterial.side).toBe(THREE.DoubleSide);
    });
  });

  describe("createGhostMaterial", () => {
    it("creates a transparent MeshStandardMaterial", () => {
      material = createGhostMaterial();

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect((material as THREE.MeshStandardMaterial).transparent).toBe(true);
      expect((material as THREE.MeshStandardMaterial).opacity).toBeLessThan(1);
    });

    it("creates material with custom color", () => {
      material = createGhostMaterial("#00ff00");

      expect(
        (material as THREE.MeshStandardMaterial).color.getHexString(),
      ).toBe("00ff00");
    });

    it("has appropriate transparency level", () => {
      material = createGhostMaterial() as THREE.MeshStandardMaterial;

      expect(material.opacity).toBeGreaterThan(0.4);
      expect(material.opacity).toBeLessThan(0.8);
    });
  });

  describe("createWireframeMaterial", () => {
    it("creates a wireframe MeshBasicMaterial", () => {
      material = createWireframeMaterial();

      expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect((material as THREE.MeshBasicMaterial).wireframe).toBe(true);
    });

    it("creates material with custom color", () => {
      material = createWireframeMaterial("#0000ff");

      expect((material as THREE.MeshBasicMaterial).color.getHexString()).toBe(
        "0000ff",
      );
    });

    it("has DoubleSide rendering", () => {
      material = createWireframeMaterial() as THREE.MeshBasicMaterial;

      expect(material.side).toBe(THREE.DoubleSide);
    });
  });

  describe("FILAMENT_COLORS", () => {
    it("contains common 3D printing colors", () => {
      expect(FILAMENT_COLORS.white).toBe("#ffffff");
      expect(FILAMENT_COLORS.black).toBe("#1a1a1a");
      expect(FILAMENT_COLORS.red).toBeDefined();
      expect(FILAMENT_COLORS.blue).toBeDefined();
      expect(FILAMENT_COLORS.green).toBeDefined();
    });

    it("has valid hex color format for all colors", () => {
      const hexRegex = /^#[0-9a-f]{6}$/i;

      for (const [_name, color] of Object.entries(FILAMENT_COLORS)) {
        expect(hexRegex.test(color)).toBe(true);
      }
    });
  });

  describe("createColoredMaterial", () => {
    it("creates material with specified filament color", () => {
      material = createColoredMaterial("red");

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(
        (material as THREE.MeshStandardMaterial).color.getHexString(),
      ).toBe(FILAMENT_COLORS.red.replace("#", ""));
    });

    it("works with all filament colors", () => {
      const colorNames = Object.keys(FILAMENT_COLORS) as Array<
        keyof typeof FILAMENT_COLORS
      >;

      for (const colorName of colorNames) {
        const mat = createColoredMaterial(colorName);
        expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
        mat.dispose();
      }
    });
  });
});
