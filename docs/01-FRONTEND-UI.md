# Frontend UI Components Documentation

## Overview

This document provides comprehensive specifications for all frontend UI components in the Snap Caddy application. Each component includes TypeScript interfaces, state management patterns, event handlers, accessibility considerations, and implementation guidelines using shadcn/ui and Tailwind CSS.

## Table of Contents

1. [Page Layout & Navigation](#1-page-layout--navigation)
2. [Image Capture Components](#2-image-capture-components)
3. [Segmentation Components](#3-segmentation-components)
4. [Calibration Components](#4-calibration-components)
5. [Editor Components](#5-editor-components)
6. [Configuration Components](#6-configuration-components)
7. [Generation Components](#7-generation-components)
8. [Shared Patterns](#8-shared-patterns)

---

## 1. Page Layout & Navigation

### 1.1 WizardLayout Component

The main layout wrapper that provides the step-based navigation flow.

**File**: `/components/layout/WizardLayout.tsx`

#### Props Interface

```typescript
interface WizardLayoutProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  children: React.ReactNode;
}
```

#### State Variables

```typescript
const [isNavigating, setIsNavigating] = useState(false);
const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
```

#### Key Features

- **Step validation**: Prevents forward navigation if current step is incomplete
- **Keyboard navigation**: Arrow keys for back/next when focused
- **Progress persistence**: Save current step to sessionStorage
- **Mobile drawer**: Hamburger menu for step overview on small screens

#### shadcn/ui Components

- `Button` for navigation controls
- `Progress` for step indicator
- `Sheet` for mobile step drawer

#### Implementation Example

```typescript
export function WizardLayout({
  currentStep,
  totalSteps,
  onStepChange,
  canNavigateBack,
  canNavigateForward,
  children
}: WizardLayoutProps) {
  const handleNext = () => {
    if (canNavigateForward && currentStep < totalSteps) {
      setDirection('forward');
      setIsNavigating(true);
      onStepChange(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (canNavigateBack && currentStep > 1) {
      setDirection('backward');
      setIsNavigating(true);
      onStepChange(currentStep - 1);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsNavigating(false), 300);
    return () => clearTimeout(timer);
  }, [currentStep]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <StepIndicator current={currentStep} total={totalSteps} />
      </header>

      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: direction === 'forward' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === 'forward' ? -20 : 20 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t p-4">
        <WizardNavigation
          onBack={handleBack}
          onNext={handleNext}
          canGoBack={canNavigateBack}
          canGoForward={canNavigateForward}
          currentStep={currentStep}
          totalSteps={totalSteps}
        />
      </footer>
    </div>
  );
}
```

#### Accessibility

- `role="navigation"` on step indicator
- `aria-label="Step X of Y"` on each step
- `aria-disabled` on navigation buttons when not available
- Keyboard shortcuts: `Alt+Left/Right` for navigation
- Focus management: Auto-focus first interactive element on step change

---

### 1.2 StepIndicator Component

Visual progress indicator showing all steps with current position.

**File**: `/components/layout/StepIndicator.tsx`

#### Props Interface

```typescript
interface StepIndicatorProps {
  current: number;
  total: number;
  steps?: Array<{
    id: number;
    title: string;
    description?: string;
    icon?: React.ReactNode;
  }>;
  variant?: 'compact' | 'detailed';
}
```

#### Mobile Adaptation

```typescript
// Desktop: Full step titles
// Tablet: Icons + abbreviated titles
// Mobile: Dots with current step name only

const isMobile = useMediaQuery('(max-width: 640px)');
const isTablet = useMediaQuery('(max-width: 1024px)');

if (isMobile) {
  return <MobileStepIndicator current={current} total={total} />;
}
```

#### Implementation Example

```typescript
export function StepIndicator({ current, total, steps, variant = 'detailed' }: StepIndicatorProps) {
  const defaultSteps = [
    { id: 1, title: 'Capture', icon: <Camera /> },
    { id: 2, title: 'Select', icon: <MousePointer /> },
    { id: 3, title: 'Calibrate', icon: <Ruler /> },
    { id: 4, title: 'Review', icon: <Eye /> },
    { id: 5, title: 'Configure', icon: <Settings /> },
    { id: 6, title: 'Generate', icon: <Download /> },
  ];

  const displaySteps = steps || defaultSteps;

  return (
    <nav
      className="flex items-center justify-between px-4 py-3"
      aria-label="Progress"
    >
      {displaySteps.map((step, index) => (
        <div
          key={step.id}
          className="flex items-center"
        >
          <StepCircle
            number={step.id}
            title={step.title}
            icon={step.icon}
            status={
              step.id < current ? 'complete' :
              step.id === current ? 'current' :
              'upcoming'
            }
          />
          {index < displaySteps.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-full mx-2",
                step.id < current ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </nav>
  );
}
```

#### Tailwind Styling

```css
/* Completed step */
.step-complete {
  @apply bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2;
}

/* Current step */
.step-current {
  @apply bg-primary text-primary-foreground animate-pulse;
}

/* Upcoming step */
.step-upcoming {
  @apply bg-muted text-muted-foreground;
}
```

---

### 1.3 WizardNavigation Component

Back/Next navigation controls with validation feedback.

**File**: `/components/layout/WizardNavigation.tsx`

#### Props Interface

```typescript
interface WizardNavigationProps {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  currentStep: number;
  totalSteps: number;
  nextLabel?: string;
  backLabel?: string;
  isLoading?: boolean;
  validationMessage?: string;
}
```

#### Implementation Example

```typescript
export function WizardNavigation({
  onBack,
  onNext,
  canGoBack,
  canGoForward,
  currentStep,
  totalSteps,
  nextLabel,
  backLabel,
  isLoading = false,
  validationMessage
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        variant="outline"
        onClick={onBack}
        disabled={!canGoBack || isLoading}
        aria-label="Go to previous step"
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        {backLabel || 'Back'}
      </Button>

      <div className="flex-1 text-center">
        {validationMessage && (
          <p className="text-sm text-destructive" role="alert">
            {validationMessage}
          </p>
        )}
      </div>

      <Button
        onClick={onNext}
        disabled={!canGoForward || isLoading}
        aria-label={isLastStep ? 'Complete wizard' : 'Go to next step'}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {nextLabel || (isLastStep ? 'Finish' : 'Next')}
        {!isLastStep && !isLoading && <ChevronRight className="w-4 h-4 ml-2" />}
      </Button>
    </div>
  );
}
```

---

## 2. Image Capture Components

### 2.1 CameraCapture Component

Real-time camera feed with capture controls.

**File**: `/components/capture/CameraCapture.tsx`

#### Props Interface

```typescript
interface CameraCaptureProps {
  onCapture: (imageData: string, metadata: CaptureMetadata) => void;
  onError: (error: Error) => void;
  aspectRatio?: number;
  maxResolution?: { width: number; height: number };
  enableFlash?: boolean;
}

interface CaptureMetadata {
  timestamp: number;
  dimensions: { width: number; height: number };
  deviceInfo?: MediaDeviceInfo;
}
```

#### State Variables

```typescript
const [stream, setStream] = useState<MediaStream | null>(null);
const [isStreaming, setIsStreaming] = useState(false);
const [error, setError] = useState<string | null>(null);
const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
const [flashEnabled, setFlashEnabled] = useState(false);
const videoRef = useRef<HTMLVideoElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
```

#### Key Event Handlers

```typescript
const startCamera = async () => {
  try {
    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        width: { ideal: maxResolution?.width || 1920 },
        height: { ideal: maxResolution?.height || 1080 },
        facingMode: 'environment', // Prefer rear camera on mobile
      },
      audio: false,
    };

    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    setStream(mediaStream);

    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play();
      setIsStreaming(true);
    }
  } catch (err) {
    setError('Camera access denied or not available');
    onError(err as Error);
  }
};

const captureImage = () => {
  if (!videoRef.current || !canvasRef.current) return;

  const video = videoRef.current;
  const canvas = canvasRef.current;
  const context = canvas.getContext('2d');

  if (!context) return;

  // Set canvas to video dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw current video frame to canvas
  context.drawImage(video, 0, 0);

  // Apply flash effect if enabled
  if (flashEnabled && enableFlash) {
    applyFlashEffect();
  }

  // Convert to base64
  const imageData = canvas.toDataURL('image/jpeg', 0.95);

  const metadata: CaptureMetadata = {
    timestamp: Date.now(),
    dimensions: {
      width: canvas.width,
      height: canvas.height,
    },
    deviceInfo: devices.find(d => d.deviceId === selectedDeviceId),
  };

  onCapture(imageData, metadata);
  stopCamera();
};

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsStreaming(false);
  }
};

const applyFlashEffect = () => {
  // Visual flash feedback
  const flashOverlay = document.createElement('div');
  flashOverlay.className = 'flash-overlay';
  document.body.appendChild(flashOverlay);

  setTimeout(() => flashOverlay.remove(), 200);
};
```

#### Implementation Example

```typescript
export function CameraCapture({
  onCapture,
  onError,
  aspectRatio = 4/3,
  maxResolution,
  enableFlash = true
}: CameraCaptureProps) {
  // ... state and handlers from above ...

  useEffect(() => {
    // Get available cameras
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const cameras = devices.filter(d => d.kind === 'videoinput');
        setDevices(cameras);
        if (cameras.length > 0) {
          setSelectedDeviceId(cameras[0].deviceId);
        }
      });

    return () => stopCamera();
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-0">
          {!isStreaming ? (
            <div className="aspect-[4/3] bg-muted flex items-center justify-center">
              <Button onClick={startCamera} size="lg">
                <Camera className="w-6 h-6 mr-2" />
                Start Camera
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
                style={{ aspectRatio: aspectRatio }}
              />

              <canvas ref={canvasRef} className="hidden" />

              {/* Camera controls overlay */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                {enableFlash && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setFlashEnabled(!flashEnabled)}
                    aria-label="Toggle flash"
                  >
                    {flashEnabled ?
                      <Zap className="w-5 h-5" fill="currentColor" /> :
                      <Zap className="w-5 h-5" />
                    }
                  </Button>
                )}

                <Button
                  size="lg"
                  onClick={captureImage}
                  className="w-16 h-16 rounded-full"
                  aria-label="Capture photo"
                >
                  <Camera className="w-6 h-6" />
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  onClick={stopCamera}
                  aria-label="Close camera"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Camera selector for multiple cameras */}
              {devices.length > 1 && (
                <div className="absolute top-4 right-4">
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map(device => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${devices.indexOf(device) + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

#### Accessibility

- `aria-label` on all interactive buttons
- Visible focus indicators on controls
- Keyboard shortcuts: `Space` to capture, `Esc` to close camera
- Screen reader announcements for camera state changes
- High contrast mode support for controls

#### Mobile Adaptations

- Use `facingMode: 'environment'` for rear camera by default
- Larger touch targets (minimum 44px)
- Prevent page zoom on double-tap
- Handle orientation changes
- Show camera permission prompt with clear messaging

---

### 2.2 ImageUpload Component

Drag-and-drop and file input for image uploads.

**File**: `/components/capture/ImageUpload.tsx`

#### Props Interface

```typescript
interface ImageUploadProps {
  onUpload: (imageData: string, file: File) => void;
  onError: (error: Error) => void;
  accept?: string;
  maxSizeBytes?: number;
  multiple?: boolean;
}
```

#### State Variables

```typescript
const [isDragging, setIsDragging] = useState(false);
const [isProcessing, setIsProcessing] = useState(false);
const [error, setError] = useState<string | null>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
```

#### Validation

```typescript
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a JPEG, PNG, or WebP image'
    };
  }

  // Check file size (default 10MB)
  const maxSize = maxSizeBytes || 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
    };
  }

  return { valid: true };
};
```

#### Event Handlers

```typescript
const handleFileSelect = (files: FileList | null) => {
  if (!files || files.length === 0) return;

  const file = files[0];
  const validation = validateFile(file);

  if (!validation.valid) {
    setError(validation.error || 'Invalid file');
    onError(new Error(validation.error));
    return;
  }

  setIsProcessing(true);
  setError(null);

  const reader = new FileReader();
  reader.onload = (e) => {
    const imageData = e.target?.result as string;
    onUpload(imageData, file);
    setIsProcessing(false);
  };
  reader.onerror = () => {
    setError('Failed to read file');
    onError(new Error('Failed to read file'));
    setIsProcessing(false);
  };
  reader.readAsDataURL(file);
};

const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  handleFileSelect(e.dataTransfer.files);
};
```

#### Implementation Example

```typescript
export function ImageUpload({
  onUpload,
  onError,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeBytes = 10 * 1024 * 1024,
  multiple = false
}: ImageUploadProps) {
  // ... state and handlers from above ...

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-8">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-12 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted",
              isProcessing && "opacity-50 pointer-events-none"
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              {isProcessing ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Processing image...</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">
                      Drag and drop your image here
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, or WebP • Max {Math.round(maxSizeBytes / 1024 / 1024)}MB
                  </p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              aria-label="Upload image file"
            />
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Accessibility

- Hidden file input with proper `aria-label`
- Keyboard activation via button
- Screen reader announcements for drag states
- Error messages with `role="alert"`
- Focus management after upload

---

### 2.3 ImagePreview Component

Pan, zoom, and manipulate uploaded images.

**File**: `/components/capture/ImagePreview.tsx`

#### Props Interface

```typescript
interface ImagePreviewProps {
  src: string;
  alt?: string;
  onReset?: () => void;
  enableZoom?: boolean;
  enablePan?: boolean;
  showInfo?: boolean;
  maxZoom?: number;
  minZoom?: number;
}

interface ImageInfo {
  dimensions: { width: number; height: number };
  fileSize?: number;
  format?: string;
}
```

#### State Variables

```typescript
const [scale, setScale] = useState(1);
const [position, setPosition] = useState({ x: 0, y: 0 });
const [isDragging, setIsDragging] = useState(false);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
const imageRef = useRef<HTMLImageElement>(null);
const containerRef = useRef<HTMLDivElement>(null);
```

#### Event Handlers

```typescript
const handleWheel = (e: React.WheelEvent) => {
  if (!enableZoom) return;

  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  setScale(prev => Math.min(Math.max(prev + delta, minZoom || 0.5), maxZoom || 3));
};

const handleMouseDown = (e: React.MouseEvent) => {
  if (!enablePan) return;

  setIsDragging(true);
  setDragStart({
    x: e.clientX - position.x,
    y: e.clientY - position.y
  });
};

const handleMouseMove = (e: React.MouseEvent) => {
  if (!isDragging || !enablePan) return;

  setPosition({
    x: e.clientX - dragStart.x,
    y: e.clientY - dragStart.y
  });
};

const handleMouseUp = () => {
  setIsDragging(false);
};

const handleReset = () => {
  setScale(1);
  setPosition({ x: 0, y: 0 });
  onReset?.();
};

const handleImageLoad = () => {
  if (imageRef.current) {
    setImageInfo({
      dimensions: {
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      }
    });
  }
};
```

#### Implementation Example

```typescript
export function ImagePreview({
  src,
  alt = 'Preview',
  onReset,
  enableZoom = true,
  enablePan = true,
  showInfo = true,
  maxZoom = 3,
  minZoom = 0.5
}: ImagePreviewProps) {
  // ... state and handlers from above ...

  return (
    <div className="w-full">
      <Card>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-muted"
            style={{ aspectRatio: '4/3' }}
            onWheel={handleWheel}
          >
            <div
              className={cn(
                "w-full h-full flex items-center justify-center",
                isDragging && "cursor-grabbing",
                enablePan && !isDragging && "cursor-grab"
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                ref={imageRef}
                src={src}
                alt={alt}
                onLoad={handleImageLoad}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                draggable={false}
              />
            </div>

            {/* Zoom controls */}
            {enableZoom && (
              <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setScale(prev => Math.min(prev + 0.25, maxZoom))}
                  disabled={scale >= maxZoom}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setScale(prev => Math.max(prev - 0.25, minZoom))}
                  disabled={scale <= minZoom}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleReset}
                  aria-label="Reset view"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Image info overlay */}
            {showInfo && imageInfo && (
              <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
                <p className="font-medium">
                  {imageInfo.dimensions.width} × {imageInfo.dimensions.height}px
                </p>
                <p className="text-muted-foreground">
                  Zoom: {Math.round(scale * 100)}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Touch Support

```typescript
// Add pinch-to-zoom for mobile
const handleTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length === 2) {
    const distance = getDistance(e.touches[0], e.touches[1]);
    setInitialPinchDistance(distance);
  }
};

const handleTouchMove = (e: React.TouchEvent) => {
  if (e.touches.length === 2 && initialPinchDistance) {
    const distance = getDistance(e.touches[0], e.touches[1]);
    const scaleFactor = distance / initialPinchDistance;
    setScale(prev => Math.min(Math.max(prev * scaleFactor, minZoom), maxZoom));
  }
};

function getDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
```

---

## 3. Segmentation Components

### 3.1 ClickToSegment Component

Interactive canvas for object selection via click points.

**File**: `/components/segmentation/ClickToSegment.tsx`

#### Props Interface

```typescript
interface ClickToSegmentProps {
  imageUrl: string;
  onPointsChange: (points: SegmentPoint[]) => void;
  onSegmentRequest: (points: SegmentPoint[]) => Promise<void>;
  isSegmenting?: boolean;
  existingPoints?: SegmentPoint[];
}

interface SegmentPoint {
  x: number;
  y: number;
  label: 0 | 1; // 0 = background (negative), 1 = foreground (positive)
  id: string;
}
```

#### State Variables

```typescript
const [points, setPoints] = useState<SegmentPoint[]>(existingPoints || []);
const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
const [cursorMode, setCursorMode] = useState<'add' | 'remove'>('add');
const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
const canvasRef = useRef<HTMLCanvasElement>(null);
const imageRef = useRef<HTMLImageElement>(null);
```

#### Event Handlers

```typescript
const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (isSegmenting) return;

  const canvas = canvasRef.current;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const newPoint: SegmentPoint = {
    x,
    y,
    label: cursorMode === 'add' ? 1 : 0,
    id: crypto.randomUUID()
  };

  const updatedPoints = [...points, newPoint];
  setPoints(updatedPoints);
  onPointsChange(updatedPoints);

  // Auto-trigger segmentation after adding point
  if (cursorMode === 'add') {
    onSegmentRequest(updatedPoints);
  }
};

const removePoint = (id: string) => {
  const updatedPoints = points.filter(p => p.id !== id);
  setPoints(updatedPoints);
  onPointsChange(updatedPoints);
};

const drawCanvas = useCallback(() => {
  const canvas = canvasRef.current;
  const image = imageRef.current;
  const ctx = canvas?.getContext('2d');

  if (!canvas || !image || !ctx) return;

  // Clear and draw image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Draw points
  points.forEach(point => {
    const isHovered = hoveredPoint === point.id;
    const radius = isHovered ? 8 : 6;

    // Point background
    ctx.fillStyle = point.label === 1 ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Point border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Point label
    if (isHovered) {
      ctx.fillStyle = '#000000';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        point.label === 1 ? 'Include' : 'Exclude',
        point.x + 12,
        point.y - 12
      );
    }
  });
}, [points, hoveredPoint]);

useEffect(() => {
  drawCanvas();
}, [drawCanvas]);
```

#### Implementation Example

```typescript
export function ClickToSegment({
  imageUrl,
  onPointsChange,
  onSegmentRequest,
  isSegmenting = false,
  existingPoints = []
}: ClickToSegmentProps) {
  // ... state and handlers from above ...

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Object</CardTitle>
            <div className="flex gap-2">
              <Toggle
                pressed={cursorMode === 'add'}
                onPressedChange={(pressed) => setCursorMode(pressed ? 'add' : 'remove')}
                aria-label="Toggle add/remove mode"
              >
                {cursorMode === 'add' ? (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Points
                  </>
                ) : (
                  <>
                    <Minus className="w-4 h-4 mr-2" />
                    Remove Points
                  </>
                )}
              </Toggle>
            </div>
          </div>
          <CardDescription>
            Click on the object you want to extract. Add points to include areas,
            or switch to remove mode to exclude areas.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="relative">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={cn(
                "w-full h-auto border rounded-lg",
                isSegmenting && "opacity-50 cursor-wait",
                !isSegmenting && cursorMode === 'add' && "cursor-crosshair",
                !isSegmenting && cursorMode === 'remove' && "cursor-not-allowed"
              )}
              onMouseMove={(e) => {
                // Detect if hovering over a point
                const canvas = canvasRef.current;
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                const hovered = points.find(p => {
                  const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
                  return distance < 10;
                });

                setHoveredPoint(hovered?.id || null);
              }}
            />

            <img
              ref={imageRef}
              src={imageUrl}
              alt="Source"
              className="hidden"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                setDimensions({
                  width: img.naturalWidth,
                  height: img.naturalHeight
                });
                if (canvasRef.current) {
                  canvasRef.current.width = img.naturalWidth;
                  canvasRef.current.height = img.naturalHeight;
                  drawCanvas();
                }
              }}
            />

            {isSegmenting && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm font-medium">Segmenting object...</p>
                </div>
              </div>
            )}
          </div>

          {/* Point list */}
          {points.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Points ({points.length})</p>
              <div className="flex flex-wrap gap-2">
                {points.map(point => (
                  <Badge
                    key={point.id}
                    variant={point.label === 1 ? 'default' : 'destructive'}
                    className="gap-2"
                  >
                    {point.label === 1 ? 'Include' : 'Exclude'}
                    <button
                      onClick={() => removePoint(point.id)}
                      className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                      aria-label="Remove point"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Accessibility

- Keyboard support: Arrow keys to add points, `Delete` to remove
- `aria-label` on mode toggle and point removal buttons
- Screen reader announcement when points added/removed
- High contrast mode for point colors
- Focus visible on canvas when keyboard-focused

---

### 3.2 MaskOverlay Component

Display segmentation mask with transparency and edge highlighting.

**File**: `/components/segmentation/MaskOverlay.tsx`

#### Props Interface

```typescript
interface MaskOverlayProps {
  imageUrl: string;
  maskUrl: string;
  opacity?: number;
  showEdges?: boolean;
  edgeColor?: string;
  edgeThickness?: number;
}
```

#### Implementation Example

```typescript
export function MaskOverlay({
  imageUrl,
  maskUrl,
  opacity = 0.6,
  showEdges = true,
  edgeColor = '#22c55e',
  edgeThickness = 2
}: MaskOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    const mask = new Image();
    let imagesLoaded = 0;

    const checkLoaded = () => {
      imagesLoaded++;
      if (imagesLoaded === 2) {
        drawComposite();
        setIsLoaded(true);
      }
    };

    const drawComposite = () => {
      // Set canvas dimensions
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      // Draw original image
      ctx.drawImage(image, 0, 0);

      // Draw mask with transparency
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(mask, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Draw edges if enabled
      if (showEdges) {
        drawEdges(ctx, mask);
      }
    };

    const drawEdges = (ctx: CanvasRenderingContext2D, maskImg: HTMLImageElement) => {
      // Create temporary canvas for edge detection
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = maskImg.naturalWidth;
      tempCanvas.height = maskImg.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Draw mask to temp canvas
      tempCtx.drawImage(maskImg, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imageData.data;

      // Sobel edge detection
      const edges = detectEdges(data, tempCanvas.width, tempCanvas.height);

      // Draw edges on main canvas
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = edgeThickness;

      for (let y = 0; y < tempCanvas.height; y++) {
        for (let x = 0; x < tempCanvas.width; x++) {
          const idx = (y * tempCanvas.width + x) * 4;
          if (edges[idx] > 128) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    };

    image.onload = checkLoaded;
    mask.onload = checkLoaded;
    image.src = imageUrl;
    mask.src = maskUrl;

  }, [imageUrl, maskUrl, opacity, showEdges, edgeColor, edgeThickness]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-lg border"
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}
    </div>
  );
}

// Edge detection helper
function detectEdges(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const edges = new Uint8ClampedArray(data.length);

  // Sobel kernels
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const intensity = data[idx]; // Use red channel
          gx += intensity * sobelX[ky + 1][kx + 1];
          gy += intensity * sobelY[ky + 1][kx + 1];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const edgeIdx = (y * width + x) * 4;
      edges[edgeIdx] = Math.min(255, magnitude);
    }
  }

  return edges;
}
```

---

### 3.3 SegmentationControls Component

Toolbar for adding, removing, and clearing segmentation points.

**File**: `/components/segmentation/SegmentationControls.tsx`

#### Props Interface

```typescript
interface SegmentationControlsProps {
  onAddPoint: () => void;
  onRemovePoint: () => void;
  onClearAll: () => void;
  onRetry: () => void;
  hasPoints: boolean;
  hasMask: boolean;
  isSegmenting: boolean;
  pointCount: number;
}
```

#### Implementation Example

```typescript
export function SegmentationControls({
  onAddPoint,
  onRemovePoint,
  onClearAll,
  onRetry,
  hasPoints,
  hasMask,
  isSegmenting,
  pointCount
}: SegmentationControlsProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddPoint}
          disabled={isSegmenting}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Point
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRemovePoint}
          disabled={!hasPoints || isSegmenting}
        >
          <Minus className="w-4 h-4 mr-2" />
          Remove Point
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="outline"
          size="sm"
          onClick={onClearAll}
          disabled={!hasPoints || isSegmenting}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>

        {hasMask && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isSegmenting}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Badge variant="secondary">
          {pointCount} {pointCount === 1 ? 'point' : 'points'}
        </Badge>

        {isSegmenting && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Segmenting...
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## 4. Calibration Components

### 4.1 RulerSelector Component

Two-point line drawing tool for ruler measurement.

**File**: `/components/calibration/RulerSelector.tsx`

#### Props Interface

```typescript
interface RulerSelectorProps {
  imageUrl: string;
  onRulerSet: (start: Point, end: Point, pixelDistance: number) => void;
  existingPoints?: [Point, Point];
}

interface Point {
  x: number;
  y: number;
}
```

#### State Variables

```typescript
const [points, setPoints] = useState<[Point?, Point?]>(existingPoints || [undefined, undefined]);
const [isDragging, setIsDragging] = useState<0 | 1 | null>(null);
const [hoveredEndpoint, setHoveredEndpoint] = useState<0 | 1 | null>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
```

#### Implementation Example

```typescript
export function RulerSelector({
  imageUrl,
  onRulerSet,
  existingPoints
}: RulerSelectorProps) {
  // ... state from above ...

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clickPoint = { x, y };

    // Check if clicking near an existing endpoint to drag it
    if (points[0] && points[1]) {
      const dist0 = distance(clickPoint, points[0]);
      const dist1 = distance(clickPoint, points[1]);

      if (dist0 < 15) {
        setIsDragging(0);
        return;
      }
      if (dist1 < 15) {
        setIsDragging(1);
        return;
      }

      // Reset if clicking elsewhere
      setPoints([clickPoint, undefined]);
    } else if (!points[0]) {
      setPoints([clickPoint, undefined]);
    } else {
      const newPoints: [Point, Point] = [points[0], clickPoint];
      setPoints(newPoints);

      const dist = distance(newPoints[0], newPoints[1]);
      onRulerSet(newPoints[0], newPoints[1], dist);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (isDragging !== null) {
      const newPoints = [...points] as [Point?, Point?];
      newPoints[isDragging] = { x, y };
      setPoints(newPoints);

      if (newPoints[0] && newPoints[1]) {
        const dist = distance(newPoints[0], newPoints[1]);
        onRulerSet(newPoints[0], newPoints[1], dist);
      }
    } else {
      // Check hover
      if (points[0] && distance({ x, y }, points[0]) < 15) {
        setHoveredEndpoint(0);
      } else if (points[1] && distance({ x, y }, points[1]) < 15) {
        setHoveredEndpoint(1);
      } else {
        setHoveredEndpoint(null);
      }
    }
  };

  const drawRuler = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Draw line
    if (points[0] && points[1]) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();

      // Draw measurement label
      const midX = (points[0].x + points[1].x) / 2;
      const midY = (points[0].y + points[1].y) / 2;
      const dist = distance(points[0], points[1]);

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist)}px`, midX, midY - 10);
    } else if (points[0]) {
      // Draw dashed line to cursor would go here in interactive version
    }

    // Draw endpoints
    [points[0], points[1]].forEach((point, idx) => {
      if (!point) return;

      const isHovered = hoveredEndpoint === idx;
      const radius = isHovered ? 8 : 6;

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [points, hoveredEndpoint]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Ruler Reference</CardTitle>
        <CardDescription>
          Click two points on a ruler or known measurement to set the scale
        </CardDescription>
      </CardHeader>
      <CardContent>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsDragging(null)}
          onMouseLeave={() => setIsDragging(null)}
          className="w-full h-auto border rounded-lg cursor-crosshair"
        />

        {points[0] && points[1] && (
          <Alert className="mt-4">
            <Ruler className="h-4 w-4" />
            <AlertDescription>
              Pixel distance: {Math.round(distance(points[0], points[1]))}px
              <br />
              Now enter the real-world measurement this represents.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}
```

---

### 4.2 ScaleInput Component

Input for known measurement with unit selector.

**File**: `/components/calibration/ScaleInput.tsx`

#### Props Interface

```typescript
interface ScaleInputProps {
  onScaleSet: (value: number, unit: 'mm' | 'cm' | 'in') => void;
  defaultValue?: number;
  defaultUnit?: 'mm' | 'cm' | 'in';
  pixelDistance?: number;
}
```

#### Implementation Example

```typescript
export function ScaleInput({
  onScaleSet,
  defaultValue = 100,
  defaultUnit = 'mm',
  pixelDistance
}: ScaleInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [unit, setUnit] = useState<'mm' | 'cm' | 'in'>(defaultUnit);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (value <= 0) {
      setError('Please enter a positive number');
      return;
    }

    setError(null);
    onScaleSet(value, unit);
  };

  const convertedValue = useMemo(() => {
    // Convert to mm for display
    switch (unit) {
      case 'cm': return value * 10;
      case 'in': return value * 25.4;
      default: return value;
    }
  }, [value, unit]);

  const pixelsPerMm = pixelDistance && value ?
    pixelDistance / convertedValue : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Known Distance</CardTitle>
        <CardDescription>
          Enter the real-world measurement between the two points you selected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="distance">Distance</Label>
            <Input
              id="distance"
              type="number"
              min="0"
              step="0.1"
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="text-lg"
            />
          </div>

          <div className="w-24">
            <Label htmlFor="unit">Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
              <SelectTrigger id="unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mm">mm</SelectItem>
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="in">inches</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {pixelsPerMm && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Calibration: {pixelsPerMm.toFixed(2)} pixels per mm
              <br />
              {convertedValue.toFixed(1)} mm = {pixelDistance?.toFixed(0)} pixels
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={handleSubmit} className="w-full">
          Set Scale
        </Button>

        {/* Quick presets */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Quick Presets</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setValue(100); setUnit('mm'); }}
            >
              100mm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setValue(10); setUnit('cm'); }}
            >
              10cm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setValue(1); setUnit('in'); }}
            >
              1"
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 4.3 CalibrationPreview Component

Show calculated scale and dimension overlay on image.

**File**: `/components/calibration/CalibrationPreview.tsx`

#### Props Interface

```typescript
interface CalibrationPreviewProps {
  imageUrl: string;
  maskUrl?: string;
  pixelsPerMm: number;
  boundingBox?: BoundingBox;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

#### Implementation Example

```typescript
export function CalibrationPreview({
  imageUrl,
  maskUrl,
  pixelsPerMm,
  boundingBox
}: CalibrationPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dimensions = boundingBox ? {
    widthMm: boundingBox.width / pixelsPerMm,
    heightMm: boundingBox.height / pixelsPerMm
  } : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !boundingBox) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Draw bounding box
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height
      );

      // Draw dimension labels
      const widthMm = (boundingBox.width / pixelsPerMm).toFixed(1);
      const heightMm = (boundingBox.height / pixelsPerMm).toFixed(1);

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';

      // Width label (top)
      ctx.fillText(
        `${widthMm}mm`,
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y - 10
      );

      // Height label (right)
      ctx.save();
      ctx.translate(
        boundingBox.x + boundingBox.width + 20,
        boundingBox.y + boundingBox.height / 2
      );
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${heightMm}mm`, 0, 0);
      ctx.restore();
    };

    img.src = imageUrl;
  }, [imageUrl, boundingBox, pixelsPerMm]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibrated Preview</CardTitle>
        <CardDescription>
          Object dimensions in real-world units
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <canvas
          ref={canvasRef}
          className="w-full h-auto border rounded-lg"
        />

        {dimensions && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Width</p>
              <p className="text-2xl font-bold">
                {dimensions.widthMm.toFixed(1)} mm
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Height</p>
              <p className="text-2xl font-bold">
                {dimensions.heightMm.toFixed(1)} mm
              </p>
            </div>
          </div>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Scale: {pixelsPerMm.toFixed(2)} pixels per millimeter
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
```

---

## 5. Editor Components

### 5.1 SVGPreview Component

Render extracted outline with dimensions.

**File**: `/components/editor/SVGPreview.tsx`

#### Props Interface

```typescript
interface SVGPreviewProps {
  svgContent: string;
  dimensions: { width: number; height: number }; // in mm
  onEdit?: (newSvg: string) => void;
  showGrid?: boolean;
  gridSize?: number;
}
```

#### Implementation Example

```typescript
export function SVGPreview({
  svgContent,
  dimensions,
  onEdit,
  showGrid = true,
  gridSize = 10 // mm
}: SVGPreviewProps) {
  const [scale, setScale] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>SVG Preview</CardTitle>
            <CardDescription>
              {dimensions.width.toFixed(1)}mm × {dimensions.height.toFixed(1)}mm
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="zoom" className="text-sm">Zoom</Label>
            <Slider
              id="zoom"
              min={0.5}
              max={2}
              step={0.1}
              value={[scale]}
              onValueChange={([v]) => setScale(v)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-12">
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="border rounded-lg p-4 bg-muted/30 overflow-auto">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="w-full h-auto"
            style={{ transform: `scale(${scale})` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>

        {showGrid && (
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Grid: {gridSize}mm
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### 5.2 PaddingControls Component

Slider/input for padding around object.

**File**: `/components/editor/PaddingControls.tsx`

#### Props Interface

```typescript
interface PaddingControlsProps {
  value: number; // mm
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}
```

#### Implementation Example

```typescript
export function PaddingControls({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.5
}: PaddingControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Padding</CardTitle>
        <CardDescription>
          Add clearance around the object cutout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Slider
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            min={min}
            max={max}
            step={step}
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              min={min}
              max={max}
              step={step}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">mm</span>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2">
          {[0, 1, 2, 5].map(preset => (
            <Button
              key={preset}
              variant={value === preset ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(preset)}
            >
              {preset}mm
            </Button>
          ))}
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Padding makes it easier to insert and remove objects from the bin
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
```

---

## 6. Configuration Components

### 6.1 BinConfigurator Component

Grid unit selectors and bin parameters.

**File**: `/components/configuration/BinConfigurator.tsx`

#### Props Interface

```typescript
interface BinConfiguratorProps {
  config: BinConfig;
  onChange: (config: BinConfig) => void;
  objectDimensions: { width: number; height: number }; // mm
}

interface BinConfig {
  gridUnitsX: number;
  gridUnitsY: number;
  binHeight: number;
  cutoutDepth: number;
  wallThickness: number;
  magnetHoles: boolean;
  screwHoles: boolean;
  labelArea: boolean;
}
```

#### Implementation Example

```typescript
export function BinConfigurator({
  config,
  onChange,
  objectDimensions
}: BinConfiguratorProps) {
  const GRID_UNIT_SIZE = 42; // mm per Gridfinity unit

  // Calculate minimum grid units needed
  const minUnitsX = Math.ceil(objectDimensions.width / GRID_UNIT_SIZE);
  const minUnitsY = Math.ceil(objectDimensions.height / GRID_UNIT_SIZE);

  const updateConfig = (updates: Partial<BinConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bin Configuration</CardTitle>
        <CardDescription>
          Configure Gridfinity bin parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grid dimensions */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="gridX">Grid Units (Width)</Label>
              <span className="text-sm text-muted-foreground">
                {config.gridUnitsX} units = {config.gridUnitsX * GRID_UNIT_SIZE}mm
              </span>
            </div>
            <Slider
              id="gridX"
              value={[config.gridUnitsX]}
              onValueChange={([v]) => updateConfig({ gridUnitsX: v })}
              min={minUnitsX}
              max={8}
              step={1}
            />
            {config.gridUnitsX < minUnitsX + 1 && (
              <p className="text-xs text-amber-600 mt-1">
                Minimum {minUnitsX} units needed for object ({objectDimensions.width.toFixed(0)}mm)
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="gridY">Grid Units (Depth)</Label>
              <span className="text-sm text-muted-foreground">
                {config.gridUnitsY} units = {config.gridUnitsY * GRID_UNIT_SIZE}mm
              </span>
            </div>
            <Slider
              id="gridY"
              value={[config.gridUnitsY]}
              onValueChange={([v]) => updateConfig({ gridUnitsY: v })}
              min={minUnitsY}
              max={8}
              step={1}
            />
            {config.gridUnitsY < minUnitsY + 1 && (
              <p className="text-xs text-amber-600 mt-1">
                Minimum {minUnitsY} units needed for object ({objectDimensions.height.toFixed(0)}mm)
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Height controls */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="binHeight">Bin Height (mm)</Label>
            <div className="flex gap-2 mt-2">
              <Slider
                id="binHeight"
                value={[config.binHeight]}
                onValueChange={([v]) => updateConfig({ binHeight: v })}
                min={7}
                max={100}
                step={7}
                className="flex-1"
              />
              <Input
                type="number"
                value={config.binHeight}
                onChange={(e) => updateConfig({ binHeight: parseInt(e.target.value) || 7 })}
                className="w-20"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Standard heights: 7mm increments
            </p>
          </div>

          <div>
            <Label htmlFor="cutoutDepth">Cutout Depth (mm)</Label>
            <div className="flex gap-2 mt-2">
              <Slider
                id="cutoutDepth"
                value={[config.cutoutDepth]}
                onValueChange={([v]) => updateConfig({ cutoutDepth: v })}
                min={5}
                max={config.binHeight - 2}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={config.cutoutDepth}
                onChange={(e) => updateConfig({ cutoutDepth: parseInt(e.target.value) || 5 })}
                className="w-20"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="magnetHoles">Magnet Holes</Label>
              <p className="text-xs text-muted-foreground">
                6mm × 2mm holes for base magnets
              </p>
            </div>
            <Switch
              id="magnetHoles"
              checked={config.magnetHoles}
              onCheckedChange={(checked) => updateConfig({ magnetHoles: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="screwHoles">Screw Holes</Label>
              <p className="text-xs text-muted-foreground">
                M3 mounting holes in base
              </p>
            </div>
            <Switch
              id="screwHoles"
              checked={config.screwHoles}
              onCheckedChange={(checked) => updateConfig({ screwHoles: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="labelArea">Label Area</Label>
              <p className="text-xs text-muted-foreground">
                Front label strip
              </p>
            </div>
            <Switch
              id="labelArea"
              checked={config.labelArea}
              onCheckedChange={(checked) => updateConfig({ labelArea: checked })}
            />
          </div>
        </div>

        {/* Advanced toggle */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Advanced Options
              <ChevronDown className="w-4 h-4 ml-auto" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div>
              <Label htmlFor="wallThickness">Wall Thickness (mm)</Label>
              <Input
                id="wallThickness"
                type="number"
                value={config.wallThickness}
                onChange={(e) => updateConfig({ wallThickness: parseFloat(e.target.value) || 1.2 })}
                min={0.8}
                max={3}
                step={0.2}
                className="mt-2"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
```

---

### 6.2 GridfinityPreview Component

Visual representation of configured bin.

**File**: `/components/configuration/GridfinityPreview.tsx`

#### Props Interface

```typescript
interface GridfinityPreviewProps {
  config: BinConfig;
  objectOutline?: string; // SVG path data
}
```

#### Implementation Example

```typescript
export function GridfinityPreview({
  config,
  objectOutline
}: GridfinityPreviewProps) {
  const GRID_SIZE = 42;
  const viewWidth = config.gridUnitsX * GRID_SIZE;
  const viewHeight = config.gridUnitsY * GRID_SIZE;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bin Preview</CardTitle>
        <CardDescription>
          {config.gridUnitsX} × {config.gridUnitsY} units, {config.binHeight}mm tall
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-muted to-background">
          <svg
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            className="w-full h-auto"
          >
            {/* Grid pattern */}
            <defs>
              <pattern
                id="grid"
                width={GRID_SIZE}
                height={GRID_SIZE}
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  opacity="0.2"
                />
              </pattern>
            </defs>

            {/* Base grid */}
            <rect
              width={viewWidth}
              height={viewHeight}
              fill="url(#grid)"
            />

            {/* Bin outline */}
            <rect
              width={viewWidth}
              height={viewHeight}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.6"
            />

            {/* Cutout outline */}
            {objectOutline && (
              <path
                d={objectOutline}
                fill="hsl(var(--primary))"
                fillOpacity="0.2"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
              />
            )}

            {/* Magnet holes */}
            {config.magnetHoles && (
              <>
                <circle cx={8} cy={8} r={3} fill="currentColor" opacity="0.3" />
                <circle cx={viewWidth - 8} cy={8} r={3} fill="currentColor" opacity="0.3" />
                <circle cx={8} cy={viewHeight - 8} r={3} fill="currentColor" opacity="0.3" />
                <circle cx={viewWidth - 8} cy={viewHeight - 8} r={3} fill="currentColor" opacity="0.3" />
              </>
            )}
          </svg>
        </div>

        {/* Specifications */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Footprint:</span>
            <span className="font-medium">
              {viewWidth}×{viewHeight}mm
            </span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Height:</span>
            <span className="font-medium">{config.binHeight}mm</span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Volume:</span>
            <span className="font-medium">
              {((viewWidth * viewHeight * config.binHeight) / 1000).toFixed(1)}cm³
            </span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Features:</span>
            <span className="font-medium">
              {[config.magnetHoles && 'Magnets', config.screwHoles && 'Screws']
                .filter(Boolean)
                .join(', ') || 'None'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 7. Generation Components

### 7.1 GenerateButton Component

Start generation with validation.

**File**: `/components/generation/GenerateButton.tsx`

#### Props Interface

```typescript
interface GenerateButtonProps {
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
  canGenerate: boolean;
  validationErrors?: string[];
}
```

#### Implementation Example

```typescript
export function GenerateButton({
  onGenerate,
  isGenerating,
  canGenerate,
  validationErrors = []
}: GenerateButtonProps) {
  return (
    <div className="space-y-4">
      <Button
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
        size="lg"
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating STL...
          </>
        ) : (
          <>
            <Cube className="w-5 h-5 mr-2" />
            Generate 3D Model
          </>
        )}
      </Button>

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cannot Generate</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {validationErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

---

### 7.2 ProgressIndicator Component

Show generation status and estimated time.

**File**: `/components/generation/ProgressIndicator.tsx`

#### Props Interface

```typescript
interface ProgressIndicatorProps {
  status: 'idle' | 'uploading' | 'processing' | 'rendering' | 'complete' | 'error';
  progress?: number; // 0-100
  estimatedTimeMs?: number;
  errorMessage?: string;
}
```

#### Implementation Example

```typescript
export function ProgressIndicator({
  status,
  progress = 0,
  estimatedTimeMs,
  errorMessage
}: ProgressIndicatorProps) {
  const statusConfig = {
    idle: { label: 'Ready', icon: Circle, color: 'text-muted-foreground' },
    uploading: { label: 'Uploading data...', icon: Upload, color: 'text-blue-500' },
    processing: { label: 'Processing SVG...', icon: Settings, color: 'text-blue-500' },
    rendering: { label: 'Rendering 3D model...', icon: Cube, color: 'text-blue-500' },
    complete: { label: 'Complete!', icon: CheckCircle, color: 'text-green-500' },
    error: { label: 'Error', icon: AlertCircle, color: 'text-destructive' }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={cn('w-5 h-5', config.color)} />
              <span className="font-medium">{config.label}</span>
            </div>

            {estimatedTimeMs && status !== 'complete' && status !== 'error' && (
              <span className="text-sm text-muted-foreground">
                ~{Math.round(estimatedTimeMs / 1000)}s remaining
              </span>
            )}
          </div>

          <Progress value={progress} className="h-2" />

          {status === 'error' && errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {status === 'complete' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your STL file is ready to download!
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 7.3 STLPreview Component

3D model preview using Three.js or static render.

**File**: `/components/generation/STLPreview.tsx`

#### Props Interface

```typescript
interface STLPreviewProps {
  stlUrl: string;
  interactive?: boolean;
  onError?: (error: Error) => void;
}
```

#### Implementation Notes

```typescript
// This component would use @react-three/fiber for 3D rendering
// For simplicity, showing placeholder approach

export function STLPreview({
  stlUrl,
  interactive = true,
  onError
}: STLPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Preview</CardTitle>
        <CardDescription>
          Rotate and zoom to inspect your model
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="aspect-square bg-muted rounded-lg relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}

          {/* Three.js canvas would go here */}
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Cube className="w-16 h-16" />
          </div>
        </div>

        {interactive && (
          <div className="mt-4 flex justify-center gap-2 text-xs text-muted-foreground">
            <span>Click and drag to rotate</span>
            <span>•</span>
            <span>Scroll to zoom</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### 7.4 DownloadButton Component

Download STL file with metadata.

**File**: `/components/generation/DownloadButton.tsx`

#### Props Interface

```typescript
interface DownloadButtonProps {
  stlUrl: string;
  filename?: string;
  fileSize?: number;
  onDownload?: () => void;
}
```

#### Implementation Example

```typescript
export function DownloadButton({
  stlUrl,
  filename = 'gridfinity-bin.stl',
  fileSize,
  onDownload
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const response = await fetch(stlUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onDownload?.();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{filename}</p>
                {fileSize && (
                  <p className="text-sm text-muted-foreground">
                    {(fileSize / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              size="lg"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download STL
                </>
              )}
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Import this STL file into your slicer software for 3D printing
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 8. Shared Patterns

### 8.1 Loading States

Use skeleton components from shadcn/ui for loading states:

```typescript
export function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="aspect-video w-full" />
      </CardContent>
    </Card>
  );
}
```

### 8.2 Error States

Consistent error display pattern:

```typescript
interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ title, message, onRetry }: ErrorDisplayProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="mt-2">
        {message}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

### 8.3 Mobile Responsive Patterns

Use Tailwind responsive classes consistently:

```css
/* Mobile-first approach */
.container {
  @apply px-4 py-6;
  @apply md:px-6 md:py-8;
  @apply lg:px-8 lg:py-10;
}

/* Touch-friendly sizes on mobile */
.button-mobile {
  @apply h-12 px-4 text-base;
  @apply md:h-10 md:px-3 md:text-sm;
}

/* Stack on mobile, row on desktop */
.layout-responsive {
  @apply flex flex-col gap-4;
  @apply lg:flex-row lg:gap-6;
}
```

### 8.4 Animation Patterns

Use Tailwind and Framer Motion for smooth transitions:

```typescript
import { motion, AnimatePresence } from 'framer-motion';

// Fade in/out
<AnimatePresence mode="wait">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
  >
    {content}
  </motion.div>
</AnimatePresence>

// Scale on hover
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click me
</motion.button>
```

### 8.5 Accessibility Checklist

For every interactive component:

- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators visible
- [ ] ARIA labels on icon-only buttons
- [ ] Screen reader announcements for state changes
- [ ] Color contrast meets WCAG AA standards
- [ ] Touch targets minimum 44×44px on mobile
- [ ] Error messages have `role="alert"`
- [ ] Form inputs have associated labels
- [ ] Loading states announced to screen readers

### 8.6 Form Validation Pattern

```typescript
import { z } from 'zod';

const schema = z.object({
  distance: z.number().positive('Must be greater than 0'),
  unit: z.enum(['mm', 'cm', 'in'])
});

function MyForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (data: unknown) => {
    const result = schema.safeParse(data);

    if (!result.success) {
      const formattedErrors = result.error.flatten().fieldErrors;
      setErrors(
        Object.entries(formattedErrors).reduce((acc, [key, value]) => ({
          ...acc,
          [key]: value?.[0] || ''
        }), {})
      );
      return;
    }

    // Process valid data
    setErrors({});
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(formData); }}>
      {/* form fields */}
    </form>
  );
}
```

---

## Component Dependencies

### Required shadcn/ui Components

Install these components:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add select
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add toggle
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add collapsible
```

### Additional Dependencies

```json
{
  "dependencies": {
    "framer-motion": "^10.16.16",
    "lucide-react": "^0.294.0",
    "zod": "^3.22.4",
    "@react-three/fiber": "^8.15.12",
    "@react-three/drei": "^9.92.4",
    "three": "^0.160.0"
  }
}
```

---

## Next Steps

1. Implement components in order: Layout → Capture → Segmentation → Calibration → Editor → Configuration → Generation
2. Create a global state management system (see `06-STATE-MANAGEMENT.md`)
3. Build API routes for backend integration (see `05-API-ARCHITECTURE.md`)
4. Add comprehensive error handling and validation
5. Implement responsive design testing on multiple devices
6. Conduct accessibility audit with automated tools
7. Add unit tests for critical component logic
8. Optimize performance with React.memo and useMemo where appropriate

---

**Document Version**: 1.0
**Last Updated**: 2026-01-06
**Related Docs**: `00-MASTER-ARCHITECTURE.md`, `06-STATE-MANAGEMENT.md`, `05-API-ARCHITECTURE.md`
