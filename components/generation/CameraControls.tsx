"use client";

import { useEffect, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface KeyboardCameraControlsProps {
  enabled?: boolean;
  rotateSpeed?: number;
  zoomSpeed?: number;
  panSpeed?: number;
}

/**
 * Keyboard camera controls for accessibility
 * Allows camera manipulation using arrow keys and +/- for zoom
 *
 * Controls:
 * - Arrow keys: Rotate camera
 * - +/=: Zoom in
 * - -/_: Zoom out
 * - Shift + Arrow keys: Pan camera
 */
export function KeyboardCameraControls({
  enabled = true,
  rotateSpeed = 0.02,
  zoomSpeed = 5,
  panSpeed = 2,
}: KeyboardCameraControlsProps) {
  const { camera, gl } = useThree();

  // Track pressed keys
  const keysPressed = new Set<string>();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Only handle keyboard events when canvas is focused or document is active
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      keysPressed.add(event.key);

      // Prevent default browser behavior for our keys
      const controlKeys = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "+",
        "=",
        "-",
        "_",
      ];
      if (controlKeys.includes(event.key)) {
        event.preventDefault();
      }
    },
    [enabled],
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysPressed.delete(event.key);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Apply camera movements on each frame
  useFrame(() => {
    if (!enabled || keysPressed.size === 0) return;

    const isShiftPressed = keysPressed.has("Shift");

    // Get camera's local axes
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(camera.up, cameraDirection).normalize();

    const cameraUp = new THREE.Vector3();
    cameraUp.crossVectors(cameraDirection, cameraRight).normalize();

    // Handle rotation or panning based on shift key
    if (keysPressed.has("ArrowUp")) {
      if (isShiftPressed) {
        // Pan up
        camera.position.add(cameraUp.multiplyScalar(panSpeed));
      } else {
        // Rotate up
        camera.rotation.x -= rotateSpeed;
      }
    }

    if (keysPressed.has("ArrowDown")) {
      if (isShiftPressed) {
        // Pan down
        camera.position.add(cameraUp.multiplyScalar(-panSpeed));
      } else {
        // Rotate down
        camera.rotation.x += rotateSpeed;
      }
    }

    if (keysPressed.has("ArrowLeft")) {
      if (isShiftPressed) {
        // Pan left
        camera.position.add(cameraRight.multiplyScalar(panSpeed));
      } else {
        // Rotate left
        camera.rotation.y += rotateSpeed;
      }
    }

    if (keysPressed.has("ArrowRight")) {
      if (isShiftPressed) {
        // Pan right
        camera.position.add(cameraRight.multiplyScalar(-panSpeed));
      } else {
        // Rotate right
        camera.rotation.y -= rotateSpeed;
      }
    }

    // Handle zoom
    if (keysPressed.has("+") || keysPressed.has("=")) {
      camera.position.add(cameraDirection.multiplyScalar(zoomSpeed));
    }

    if (keysPressed.has("-") || keysPressed.has("_")) {
      camera.position.add(cameraDirection.multiplyScalar(-zoomSpeed));
    }
  });

  return null;
}

interface ViewerControlsOverlayProps {
  onResetCamera?: () => void;
  onToggleAutoRotate?: () => void;
  autoRotate?: boolean;
  showKeyboardHint?: boolean;
}

/**
 * Overlay component with viewer control buttons
 * This is a DOM overlay, not a Three.js component
 */
export function ViewerControlsOverlay({
  onResetCamera,
  onToggleAutoRotate,
  autoRotate = false,
  showKeyboardHint = false,
}: ViewerControlsOverlayProps) {
  return (
    <div className="absolute bottom-3 right-3 flex flex-col gap-2">
      {/* Keyboard controls hint for accessibility */}
      {showKeyboardHint && (
        <div
          className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded px-2 py-1"
          role="note"
          aria-label="Keyboard controls available"
        >
          <p>Keyboard: Arrow keys to rotate, +/- to zoom</p>
          <p>Shift + Arrows to pan</p>
        </div>
      )}
    </div>
  );
}
