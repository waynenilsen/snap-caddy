# Snap Caddy - Master Architecture Document

## Project Vision

Snap Caddy automates the creation of custom Gridfinity bin cutouts. Users can:
1. Take a photo or upload an image of any object with a ruler for scale
2. Paint a mask over the object to define its silhouette
3. System generates a 3D-printable STL file for a custom Gridfinity bin

This replaces the manual process documented at: https://docs.ostat.com/docs/openscad/gridfinity-extended/custom-cutout/

## Manual Process We're Automating

The original workflow requires:
1. **Photography**: Capture object with ruler/scale reference, camera directly overhead
2. **Inkscape Import**: Load photo into Inkscape
3. **Scale Calibration**: Measure known reference (ruler) to calculate scaling factor
4. **Shape Tracing**: Use bitmap tracing to outline object contours
5. **SVG Export**: Export as Plain SVG with 96 DPI
6. **OpenSCAD Import**: Import SVG into Gridfinity Custom Cutout tool
7. **STL Generation**: Configure bin parameters and export STL

## Automated Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SNAP CADDY WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   CAPTURE    │───▶│   PAINT MASK │───▶│   CALIBRATE  │───▶│   GENERATE   │
│              │    │              │    │              │    │              │
│ Camera/Upload│    │ Paint Tool   │    │ Ruler Scale  │    │ OpenSCAD STL │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
      │                   │                   │                    │
      ▼                   ▼                   ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Raw Image    │    │ Object Mask  │    │ Scaled SVG   │    │ STL File     │
│ (JPEG/PNG)   │    │ (Binary)     │    │ (mm units)   │    │ (3D Model)   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

## Technology Stack

### Frontend (Client-Side)
- **Framework**: Next.js 16 with App Router
- **UI**: shadcn/ui components + Tailwind CSS v4
- **Camera**: MediaDevices API (getUserMedia)
- **Canvas**: HTML5 Canvas for image manipulation
- **State**: React hooks + Zod for validation

### Backend (Server-Side)
- **Runtime**: Node.js via Next.js API routes
- **3D Generation**: OpenSCAD CLI
- **File Handling**: Temporary file storage for processing

### External Dependencies
- **OpenSCAD**: CLI tool for 3D model generation (installed on server)
- **Gridfinity OpenSCAD Library**: For bin generation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  CameraCapture │  │  ImageUpload   │  │  ImagePreview  │                │
│  │  Component     │  │  Component     │  │  Component     │                │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘                │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              ▼                                               │
│                    ┌────────────────────┐                                   │
│                    │  ImageProcessor    │ ◄── Client-side preprocessing    │
│                    │  (Canvas API)      │                                   │
│                    └─────────┬──────────┘                                   │
│                              │                                               │
│          ┌───────────────────┼───────────────────┐                          │
│          ▼                   ▼                   ▼                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  RulerDetector │  │  ObjectMasker  │  │  SVGGenerator  │                │
│  │  Component     │  │  Component     │  │  Component     │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│                              │                                               │
│                              ▼                                               │
│                    ┌────────────────────┐                                   │
│                    │  BinConfigurator   │                                   │
│                    │  Component         │                                   │
│                    └─────────┬──────────┘                                   │
│                              │                                               │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
                               ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 SERVER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                        API ROUTES                                   │     │
│  ├────────────────┬────────────────┬────────────────┬────────────────┤     │
│  │ POST           │ POST           │ GET            │                │     │
│  │ /api/generate  │ /api/preview   │ /api/download  │                │     │
│  │                │                │                │                │     │
│  │ OpenSCAD STL   │ Quick preview  │ Final STL      │                │     │
│  └────────┬───────┴────────┬───────┴────────┬───────┘                      │
│           │                │                │                               │
│           ▼                ▼                ▼                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  OpenSCAD CLI  │  │  OpenSCAD CLI  │  │  File Manager  │                │
│  │  + Gridfinity  │  │  + Preview     │  │  (temp files)  │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Page Structure

### Single-Page Application Flow

```
/                           # Main application page
├── Step 1: Image Capture   # Camera or upload
├── Step 2: Paint Mask      # Paint over the object to create mask
├── Step 3: Scale Calibration # Identify ruler, set known measurement
├── Step 4: Review & Adjust  # Preview silhouette, adjust padding
├── Step 5: Bin Configuration # Set Gridfinity dimensions
└── Step 6: Generate & Download # Create STL, download
```

## Data Flow

### Step 1: Image Capture
```typescript
interface CaptureState {
  imageData: string;        // Base64 or Blob URL
  imageDimensions: {
    width: number;
    height: number;
  };
  captureMethod: 'camera' | 'upload';
}
```

### Step 2: Paint Mask
```typescript
interface SegmentationState {
  paintMask: ImageData | null;    // Binary mask painted by user
  objectBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### Step 3: Scale Calibration
```typescript
interface CalibrationState {
  rulerPoints: [Point, Point];    // Two points on ruler
  knownDistance: number;          // Real-world measurement in mm
  pixelsPerMm: number;            // Calculated scale factor
}
```

### Step 4: SVG Generation
```typescript
interface SVGState {
  svgPath: string;          // SVG path data
  dimensions: {
    width: number;          // in mm
    height: number;         // in mm
  };
  padding: number;          // mm to add around object
}
```

### Step 5: Bin Configuration
```typescript
interface BinConfig {
  gridUnitsX: number;       // Gridfinity units wide
  gridUnitsY: number;       // Gridfinity units deep
  binHeight: number;        // Height in mm
  cutoutDepth: number;      // How deep the cutout goes
  wallThickness: number;    // Wall around cutout
  magnetHoles: boolean;     // Bottom magnet holes
  screwHoles: boolean;      // Bottom screw holes
}
```

### Step 6: Generation
```typescript
interface GenerationState {
  status: 'idle' | 'generating' | 'complete' | 'error';
  stlUrl: string | null;
  previewUrl: string | null;
  errorMessage: string | null;
}
```

## API Endpoints

### POST /api/generate
Generates STL file from SVG and configuration.

**Request:**
```typescript
{
  svg: string;              // SVG content
  config: BinConfig;
}
```

**Response:**
```typescript
{
  stlId: string;            // ID to download the STL
  previewUrl: string;       // URL to 3D preview image
}
```

### GET /api/download/:id
Downloads the generated STL file.

## File Directory Structure

```
snap-caddy/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Main single-page app
│   ├── globals.css
│   └── api/
│       ├── generate/
│       │   └── route.ts            # OpenSCAD generation
│       ├── preview/
│       │   └── route.ts            # Quick 3D preview
│       └── download/
│           └── [id]/
│               └── route.ts        # STL download
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── capture/
│   │   ├── CameraCapture.tsx
│   │   ├── ImageUpload.tsx
│   │   └── ImagePreview.tsx
│   ├── segmentation/
│   │   ├── PaintTool.tsx
│   │   ├── MaskOverlay.tsx
│   │   └── PaintControls.tsx
│   ├── calibration/
│   │   ├── RulerSelector.tsx
│   │   ├── ScaleInput.tsx
│   │   └── CalibrationPreview.tsx
│   ├── editor/
│   │   ├── SVGPreview.tsx
│   │   ├── PaddingControls.tsx
│   │   └── ContourEditor.tsx
│   ├── configuration/
│   │   ├── BinConfigurator.tsx
│   │   ├── GridfinityPreview.tsx
│   │   └── AdvancedOptions.tsx
│   └── generation/
│       ├── GenerateButton.tsx
│       ├── ProgressIndicator.tsx
│       ├── STLPreview.tsx
│       └── DownloadButton.tsx
├── lib/
│   ├── canvas/
│   │   ├── imageProcessing.ts      # Client-side image manipulation
│   │   ├── contourDetection.ts     # Edge detection algorithms
│   │   └── svgGeneration.ts        # Convert mask to SVG path
│   ├── calibration/
│   │   ├── rulerDetection.ts       # Auto-detect ruler markings
│   │   └── scaleCalculation.ts     # Calculate pixels-to-mm ratio
│   └── openscad/
│       ├── templates/              # OpenSCAD template files
│       │   ├── gridfinity-base.scad
│       │   └── custom-cutout.scad
│       ├── generator.ts            # OpenSCAD file generator
│       └── executor.ts             # Run OpenSCAD CLI
├── hooks/
│   ├── useCamera.ts                # Camera access hook
│   ├── useImageUpload.ts           # File upload hook
│   ├── useSegmentation.ts          # Paint mask interaction hook
│   ├── useCalibration.ts           # Scale calibration hook
│   └── useGeneration.ts            # STL generation hook
├── types/
│   ├── capture.ts
│   ├── segmentation.ts
│   ├── calibration.ts
│   ├── configuration.ts
│   └── generation.ts
├── schemas/
│   └── index.ts                    # Zod schemas for validation
└── docs/
    ├── 00-MASTER-ARCHITECTURE.md   # This file
    ├── 01-FRONTEND-UI.md
    ├── 02-IMAGE-PROCESSING.md
    ├── 03-SAM-INTEGRATION.md
    ├── 04-OPENSCAD-GENERATION.md
    ├── 05-API-ARCHITECTURE.md
    └── 06-STATE-MANAGEMENT.md
```

## OpenSCAD Integration

### Required Installation
```bash
# On Ubuntu/Debian
apt-get install openscad

# Gridfinity library
git clone https://github.com/ostat/gridfinity_extended_openscad.git
```

### Custom Cutout Template
The OpenSCAD script takes:
- SVG file path for the cutout shape
- Bin dimensions (grid units)
- Cutout depth
- Padding values
- Magnet/screw hole options

### Generation Flow
1. Client sends SVG + config to `/api/generate`
2. Server writes SVG to temp file
3. Server generates OpenSCAD file with parameters
4. OpenSCAD CLI renders to STL
5. STL stored with unique ID
6. Client receives ID for download

## Implementation Phases

### Phase 1: Core Infrastructure
- Set up directory structure
- Create API route stubs
- Install OpenSCAD on server
- Basic UI shell with step navigation

### Phase 2: Image Capture
- Camera capture component
- File upload component
- Image preview with zoom/pan
- Client-side image preprocessing

### Phase 3: Paint Mask
- Canvas-based paint tool
- Brush size and opacity controls
- Mask visualization and overlay
- Undo/redo functionality

### Phase 4: Calibration
- Ruler detection/selection UI
- Scale input
- Automatic ruler marking detection (stretch goal)
- Validation of scale factor

### Phase 5: SVG Generation
- Mask to contour conversion
- Contour to SVG path
- SVG optimization (simplify paths)
- Preview with real-world dimensions

### Phase 6: Bin Configuration
- Gridfinity parameter UI
- Visual preview of bin
- Validation of dimensions
- Presets for common sizes

### Phase 7: STL Generation
- OpenSCAD template integration
- Server-side rendering
- Progress indication
- Download handling

### Phase 8: Polish
- Error handling throughout
- Loading states
- Mobile responsiveness
- Performance optimization

## Documentation Index

Each sub-document provides detailed implementation guidance:

1. **01-FRONTEND-UI.md**: Component specifications, UI/UX design, accessibility
2. **02-IMAGE-PROCESSING.md**: Canvas API usage, contour detection, SVG generation
3. **03-SAM-INTEGRATION.md**: SAM model setup, inference, mask post-processing
4. **04-OPENSCAD-GENERATION.md**: Template design, CLI integration, file handling
5. **05-API-ARCHITECTURE.md**: Endpoint design, validation, error handling
6. **06-STATE-MANAGEMENT.md**: React state, data flow, persistence
