# State Management Usage Guide

This document provides examples of how to use the Snap Caddy state management system.

## Overview

The state management system consists of:
- **WizardContext**: React Context with useReducer for state management
- **useWizard Hook**: Convenience hook with navigation and validation methods
- **WizardProvider**: Context provider that wraps the application

## Quick Start

### 1. Provider Setup (Already Done)

The `WizardProvider` is already wrapped around your app in `/app/layout.tsx`:

```tsx
import { WizardProvider } from "@/contexts";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WizardProvider>
          {children}
        </WizardProvider>
      </body>
    </html>
  );
}
```

### 2. Using the Hook in Components

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function MyComponent() {
  const wizard = useWizard();

  // Access state
  const { currentStep, imageData, generationStatus } = wizard.state;

  // Use convenience methods
  const handleNext = () => {
    if (wizard.canProceedToNext()) {
      wizard.goToNextStep();
    }
  };

  return (
    <div>
      <h1>{wizard.stepName}</h1>
      <p>Progress: {wizard.progress}%</p>
      <button onClick={handleNext} disabled={!wizard.canProceedToNext()}>
        Next Step
      </button>
    </div>
  );
}
```

## Step-by-Step Usage Examples

### Step 0: Capture Image

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function CaptureStep() {
  const { state, setImageData, goToNextStep, canProceedToNext } = useWizard();

  const handleImageCapture = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageData(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageCapture(file);
        }}
      />
      {state.imageData && (
        <>
          <img src={state.imageData} alt="Captured" />
          <button onClick={goToNextStep} disabled={!canProceedToNext()}>
            Next: Segment
          </button>
        </>
      )}
    </div>
  );
}
```

### Step 1: Segmentation

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function SegmentStep() {
  const { state, setSegmentationMask, goToNextStep, goToPreviousStep } = useWizard();

  const handleSegment = async (clickX: number, clickY: number) => {
    // Call segmentation API
    const response = await fetch('/api/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: state.imageData,
        clickPoint: { x: clickX, y: clickY },
      }),
    });

    const { mask } = await response.json();

    // Convert mask to ImageData (simplified)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // ... process mask data
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);

    if (imageData) {
      setSegmentationMask(imageData);
    }
  };

  return (
    <div>
      <h2>Click on the object to segment</h2>
      <canvas onClick={(e) => handleSegment(e.clientX, e.clientY)} />
      <div>
        <button onClick={goToPreviousStep}>Back</button>
        <button onClick={goToNextStep} disabled={!state.segmentationMask}>
          Next: Calibrate
        </button>
      </div>
    </div>
  );
}
```

### Step 2: Calibration

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function CalibrateStep() {
  const { state, setCalibration, goToNextStep, goToPreviousStep } = useWizard();

  const handleCalibrate = (pixelsPerMm: number) => {
    setCalibration({ pixelsPerMm, unit: 'mm' });
  };

  return (
    <div>
      <h2>Set Scale</h2>
      <p>Current: {state.calibration.pixelsPerMm?.toFixed(2)} px/mm</p>
      <button onClick={() => handleCalibrate(10)}>Set Scale</button>
      <div>
        <button onClick={goToPreviousStep}>Back</button>
        <button onClick={goToNextStep} disabled={!state.calibration.pixelsPerMm}>
          Next: Review
        </button>
      </div>
    </div>
  );
}
```

### Step 3: Review SVG

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function ReviewStep() {
  const { state, setSvgOutline, goToNextStep, goToPreviousStep } = useWizard();

  const generateSVG = async () => {
    // Generate SVG from mask and calibration
    const svg = '<svg>...</svg>'; // Your SVG generation logic
    setSvgOutline(svg);
  };

  return (
    <div>
      <h2>Review Outline</h2>
      {state.svgOutline && (
        <div dangerouslySetInnerHTML={{ __html: state.svgOutline }} />
      )}
      <button onClick={generateSVG}>Generate SVG</button>
      <div>
        <button onClick={goToPreviousStep}>Back</button>
        <button onClick={goToNextStep} disabled={!state.svgOutline}>
          Next: Configure
        </button>
      </div>
    </div>
  );
}
```

### Step 4: Configure Gridfinity

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function ConfigureStep() {
  const { state, setGridfinityConfig, goToNextStep, goToPreviousStep } = useWizard();
  const config = state.gridfinityConfig;

  return (
    <div>
      <h2>Configure Bin</h2>
      <label>
        Grid Units X:
        <input
          type="number"
          value={config.gridUnitsX}
          onChange={(e) => setGridfinityConfig({ gridUnitsX: parseInt(e.target.value) })}
          min={1}
          max={10}
        />
      </label>
      <label>
        Grid Units Y:
        <input
          type="number"
          value={config.gridUnitsY}
          onChange={(e) => setGridfinityConfig({ gridUnitsY: parseInt(e.target.value) })}
          min={1}
          max={10}
        />
      </label>
      <label>
        Bin Height (mm):
        <input
          type="number"
          value={config.binHeight}
          onChange={(e) => setGridfinityConfig({ binHeight: parseInt(e.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.magnetHoles}
          onChange={(e) => setGridfinityConfig({ magnetHoles: e.target.checked })}
        />
        Magnet Holes
      </label>
      <div>
        <button onClick={goToPreviousStep}>Back</button>
        <button onClick={goToNextStep}>Next: Generate</button>
      </div>
    </div>
  );
}
```

### Step 5: Generate STL

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function GenerateStep() {
  const {
    state,
    setGenerationStatus,
    setGenerationId,
    setError,
    goToPreviousStep,
    reset,
  } = useWizard();

  const handleGenerate = async () => {
    try {
      setGenerationStatus('generating');

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          svg: state.svgOutline,
          config: state.gridfinityConfig,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const { id } = await response.json();
      setGenerationId(id);
      setGenerationStatus('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setGenerationStatus('error');
    }
  };

  const handleDownload = () => {
    if (state.generationId) {
      window.location.href = `/api/download/${state.generationId}`;
    }
  };

  return (
    <div>
      <h2>Generate STL</h2>

      {state.generationStatus === 'idle' && (
        <button onClick={handleGenerate}>Generate 3D Model</button>
      )}

      {state.generationStatus === 'generating' && (
        <p>Generating your custom bin...</p>
      )}

      {state.generationStatus === 'complete' && (
        <>
          <p>Generation complete!</p>
          <button onClick={handleDownload}>Download STL</button>
          <button onClick={reset}>Start Over</button>
        </>
      )}

      {state.generationStatus === 'error' && (
        <>
          <p>Error: {state.error}</p>
          <button onClick={handleGenerate}>Retry</button>
        </>
      )}

      <div>
        <button onClick={goToPreviousStep}>Back</button>
      </div>
    </div>
  );
}
```

## Progress Indicator Example

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function ProgressIndicator() {
  const wizard = useWizard();

  const steps = [
    'Capture',
    'Segment',
    'Calibrate',
    'Review',
    'Configure',
    'Generate',
  ];

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`
            flex-1 text-center p-2
            ${wizard.state.currentStep === index ? 'font-bold' : ''}
            ${wizard.isStepCompleted(index) ? 'text-green-600' : 'text-gray-400'}
          `}
        >
          <div className="mb-1">
            {wizard.isStepCompleted(index) ? '✓' : index + 1}
          </div>
          <div className="text-xs">{step}</div>
        </div>
      ))}
    </div>
  );
}
```

## Reset Functionality

```tsx
'use client';

import { useWizard } from '@/hooks/useWizard';

export function ResetButton() {
  const { reset } = useWizard();

  const handleReset = () => {
    if (confirm('Are you sure you want to start over?')) {
      reset();
    }
  };

  return (
    <button onClick={handleReset} className="text-red-600">
      Start Over
    </button>
  );
}
```

## State Shape Reference

```typescript
interface WizardState {
  currentStep: number;           // 0-5
  completedSteps: Set<number>;   // Set of completed step indices
  imageData: string | null;      // Data URL of captured/uploaded image
  segmentationMask: ImageData | null;  // Mask from SAM
  calibration: {
    pixelsPerMm: number | null;
    unit: 'mm' | 'cm' | 'in';
  };
  svgOutline: string | null;     // Generated SVG string
  gridfinityConfig: {
    gridUnitsX: number;
    gridUnitsY: number;
    binHeight: number;
    cutoutDepth: number;
    wallThickness: number;
    baseThickness: number;
    magnetHoles: boolean;
    screwHoles: boolean;
    stackingLip: boolean;
    cornerRadius: number;
    tolerance: number;
  };
  generationStatus: 'idle' | 'generating' | 'complete' | 'error';
  generationId: string | null;   // ID for downloading generated file
  error: string | null;          // Error message if any
}
```

## Available Methods

### State Setters
- `setStep(step: number)` - Navigate to a specific step
- `completeStep(step: number)` - Mark a step as completed
- `setImageData(data: string | null)` - Set captured image
- `setSegmentationMask(mask: ImageData | null)` - Set segmentation mask
- `setCalibration(calibration: Partial<CalibrationData>)` - Update calibration
- `setSvgOutline(svg: string | null)` - Set SVG outline
- `setGridfinityConfig(config: Partial<GridfinityConfig>)` - Update config
- `setGenerationStatus(status: GenerationStatus)` - Set generation status
- `setGenerationId(id: string | null)` - Set generation ID
- `setError(error: string | null)` - Set error message
- `reset()` - Reset entire wizard to initial state

### Convenience Methods
- `canProceedToNext()` - Check if can proceed to next step
- `goToNextStep()` - Navigate to next step (with validation)
- `goToPreviousStep()` - Navigate to previous step
- `goToStep(step: number)` - Navigate to specific step (with validation)
- `isStepCompleted(step: number)` - Check if a step is completed

### Computed Properties
- `canGoBack` - Boolean indicating if can go back
- `progress` - Overall progress percentage (0-100)
- `stepName` - Current step name as string
