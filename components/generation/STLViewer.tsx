"use client";

import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { AlertCircle, Loader2, Move3d, RotateCcw } from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { useSTLLoader } from "@/hooks/useSTLLoader";
import { createBinMaterial } from "@/lib/three/materials";
import {
  calculateCameraPosition,
  calculateGridSize,
  isWebGLAvailable,
  QUALITY_PRESETS,
  type QualityLevel,
} from "@/lib/three/utils";

interface STLViewerProps {
  stlUrl: string;
  onError?: (error: Error) => void;
  showGrid?: boolean;
  showAxes?: boolean;
  autoRotate?: boolean;
  quality?: QualityLevel;
  color?: string;
}

interface ModelProps {
  geometry: THREE.BufferGeometry;
  color?: string;
}

interface SceneProps {
  geometry: THREE.BufferGeometry;
  showGrid: boolean;
  showAxes: boolean;
  autoRotate: boolean;
  color?: string;
  onCameraReady?: (resetCamera: () => void) => void;
}

/**
 * Inner component that renders the 3D model mesh
 */
function Model({ geometry, color = "#e0e0e0" }: ModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => createBinMaterial(color), [color]);

  // Cleanup material on unmount
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
    />
  );
}

/**
 * Camera controller component that sets up initial view and provides reset functionality
 */
function CameraController({
  geometry,
  onReady,
  autoRotate,
}: {
  geometry: THREE.BufferGeometry;
  onReady?: (resetCamera: () => void) => void;
  autoRotate: boolean;
}) {
  const { camera } = useThree();
  // biome-ignore lint/suspicious/noExplicitAny: OrbitControls from drei has complex ref type
  const controlsRef = useRef<any>(null);
  const initialPositionRef = useRef<THREE.Vector3 | null>(null);
  const initialTargetRef = useRef<THREE.Vector3 | null>(null);

  // Set initial camera position
  useEffect(() => {
    const { position, target } = calculateCameraPosition(geometry);
    camera.position.copy(position);
    camera.lookAt(target);

    initialPositionRef.current = position.clone();
    initialTargetRef.current = target.clone();

    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
  }, [geometry, camera]);

  // Provide reset function to parent
  useEffect(() => {
    if (onReady) {
      const resetCamera = () => {
        if (
          initialPositionRef.current &&
          initialTargetRef.current &&
          controlsRef.current
        ) {
          camera.position.copy(initialPositionRef.current);
          controlsRef.current.target.copy(initialTargetRef.current);
          controlsRef.current.update();
        }
      };
      onReady(resetCamera);
    }
  }, [camera, onReady]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={20}
      maxDistance={500}
      enablePan
      panSpeed={0.8}
      enableZoom
      zoomSpeed={1}
      autoRotate={autoRotate}
      autoRotateSpeed={1}
      // Touch support
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}

/**
 * Grid floor component
 */
function GridFloor({ geometry }: { geometry: THREE.BufferGeometry }) {
  const { size, divisions: _divisions } = useMemo(
    () => calculateGridSize(geometry),
    [geometry],
  );

  // Get the bottom of the geometry for grid placement
  geometry.computeBoundingBox();
  const bottomY = geometry.boundingBox?.min.y ?? 0;

  return (
    <Grid
      position={[0, bottomY - 0.5, 0]}
      args={[size, size]}
      cellSize={10}
      cellThickness={0.6}
      cellColor="#6b7280"
      sectionSize={42} // Gridfinity unit size
      sectionThickness={1}
      sectionColor="#374151"
      fadeDistance={size * 2}
      fadeStrength={1}
      followCamera={false}
    />
  );
}

/**
 * Scene component that contains all 3D elements
 */
function Scene({
  geometry,
  showGrid,
  showAxes,
  autoRotate,
  color,
  onCameraReady,
}: SceneProps) {
  // Get the bottom of the geometry for shadow placement
  geometry.computeBoundingBox();
  const bottomY = geometry.boundingBox?.min.y ?? 0;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <directionalLight position={[-30, 40, -30]} intensity={0.3} />
      <pointLight position={[0, 50, 0]} intensity={0.2} />

      {/* Model */}
      <Model geometry={geometry} color={color} />

      {/* Grid floor */}
      {showGrid && <GridFloor geometry={geometry} />}

      {/* Axes helper */}
      {showAxes && <axesHelper args={[50]} />}

      {/* Contact shadows for depth */}
      <ContactShadows
        position={[0, bottomY - 0.1, 0]}
        opacity={0.4}
        scale={150}
        blur={2}
        far={100}
      />

      {/* Camera controls */}
      <CameraController
        geometry={geometry}
        onReady={onCameraReady}
        autoRotate={autoRotate}
      />
    </>
  );
}

/**
 * Loading indicator component
 */
function LoadingIndicator({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm">
      <div className="text-center text-muted-foreground">
        <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin" />
        <p className="text-sm font-medium">Loading 3D model...</p>
        {progress > 0 && progress < 100 && (
          <p className="text-xs mt-1">{Math.round(progress)}%</p>
        )}
      </div>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm p-6">
      <div className="text-center text-destructive">
        <AlertCircle className="w-12 h-12 mx-auto mb-3" />
        <p className="text-sm font-medium mb-2">Failed to load 3D model</p>
        <p className="text-xs mb-4 max-w-[200px]">{error.message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      </div>
    </div>
  );
}

/**
 * Controls hint overlay
 */
function ControlsHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute bottom-3 left-3 right-3 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground">
        <Move3d className="w-3.5 h-3.5" />
        <span>
          Click and drag to rotate • Scroll to zoom • Right-click to pan
        </span>
      </div>
    </div>
  );
}

/**
 * WebGL not available message
 */
function WebGLNotAvailable() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted p-6">
      <div className="text-center text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-3" />
        <p className="text-sm font-medium mb-2">WebGL Not Available</p>
        <p className="text-xs">
          Your browser doesn&apos;t support WebGL, which is required for 3D
          rendering.
        </p>
      </div>
    </div>
  );
}

/**
 * Main STLViewer component
 * Renders an interactive 3D view of an STL file using Three.js
 */
export function STLViewer({
  stlUrl,
  onError,
  showGrid = true,
  showAxes = false,
  autoRotate = false,
  quality = "medium",
  color = "#e0e0e0",
}: STLViewerProps) {
  const [resetCamera, setResetCamera] = useState<(() => void) | null>(null);
  const { geometry, loading, error, progress, retry } = useSTLLoader(stlUrl);
  const qualitySettings = QUALITY_PRESETS[quality];

  // Check WebGL availability
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  useEffect(() => {
    setWebGLAvailable(isWebGLAvailable());
  }, []);

  // Report errors to parent
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleCameraReady = useCallback((reset: () => void) => {
    setResetCamera(() => reset);
  }, []);

  if (!webGLAvailable) {
    return (
      <div
        className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden"
        role="img"
        aria-label="3D model viewer - WebGL not available"
      >
        <WebGLNotAvailable />
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden"
      role="img"
      aria-label="Interactive 3D model viewer"
    >
      {/* Three.js Canvas */}
      {geometry && !loading && (
        <Canvas
          camera={{ fov: 50, near: 0.1, far: 2000 }}
          shadows={qualitySettings.shadowMapEnabled}
          dpr={qualitySettings.pixelRatio}
          gl={{
            antialias: qualitySettings.antialias,
            preserveDrawingBuffer: true,
          }}
          style={{ touchAction: "none" }}
        >
          <Suspense fallback={null}>
            <Scene
              geometry={geometry}
              showGrid={showGrid}
              showAxes={showAxes}
              autoRotate={autoRotate}
              color={color}
              onCameraReady={handleCameraReady}
            />
          </Suspense>
        </Canvas>
      )}

      {/* Loading overlay */}
      {loading && <LoadingIndicator progress={progress} />}

      {/* Error overlay */}
      {error && !loading && <ErrorDisplay error={error} onRetry={retry} />}

      {/* Reset camera button */}
      {geometry && !loading && !error && resetCamera && (
        <Button
          variant="outline"
          size="icon"
          className="absolute top-3 right-3 w-8 h-8 bg-background/80 backdrop-blur-sm"
          onClick={resetCamera}
          title="Reset camera view"
          aria-label="Reset camera to initial view"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      )}

      {/* Controls hint */}
      {geometry && !loading && !error && <ControlsHint />}
    </div>
  );
}
