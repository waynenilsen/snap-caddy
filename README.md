# Snap Caddy

> **Work in Progress** - This project is under active development.

Snap Caddy automates the creation of custom Gridfinity bin cutouts. Take a photo of any object with a ruler for scale, and the app generates a 3D-printable STL file for a custom Gridfinity bin.

## The Problem

Creating custom Gridfinity cutouts currently requires a tedious manual process:

1. Photograph object with ruler, camera overhead
2. Import into Inkscape and calibrate scale
3. Trace the object shape using bitmap tracing
4. Export as SVG with specific DPI settings
5. Import into OpenSCAD with Gridfinity library
6. Configure bin parameters and export STL

Snap Caddy reduces this to a simple wizard-based workflow.

## How It Works

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   CAPTURE    │───▶│   SEGMENT    │───▶│   CALIBRATE  │───▶│   GENERATE   │
│              │    │              │    │              │    │              │
│ Camera/Upload│    │ SAM Model    │    │ Ruler Scale  │    │ OpenSCAD STL │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

1. **Capture** - Take a photo or upload an image of your object with a ruler
2. **Segment** - AI (SAM) automatically extracts the object silhouette
3. **Calibrate** - Mark ruler points to set the real-world scale
4. **Configure** - Choose bin size, depth, and Gridfinity options
5. **Generate** - Download the 3D-printable STL file

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui
- **AI Segmentation**: Meta SAM (Segment Anything Model)
- **3D Generation**: OpenSCAD CLI with Gridfinity Extended library
- **Validation**: Zod schemas

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- OpenSCAD (for STL generation)
- [Gridfinity Extended OpenSCAD library](https://github.com/ostat/gridfinity_extended_openscad)

### Installation

```bash
# Clone the repository
git clone https://github.com/waynenilsen/snap-caddy.git
cd snap-caddy

# Install dependencies
bun install

# Start development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### OpenSCAD Setup

```bash
# Ubuntu/Debian
sudo apt-get install openscad

# Clone Gridfinity library
git clone https://github.com/ostat/gridfinity_extended_openscad.git
```

Set environment variables:
```bash
OPENSCAD_PATH=/usr/bin/openscad
GRIDFINITY_LIB_PATH=/path/to/gridfinity_extended_openscad
```

## Project Status

### Implemented
- Frontend wizard UI with step navigation
- shadcn/ui component library
- Backend API routes (segment, generate, preview, download)
- OpenSCAD integration and file management
- Rate limiting and error handling middleware
- Zod validation schemas

### In Progress
- SAM model integration
- Camera capture component
- Scale calibration UI
- 3D preview rendering

### Planned
- Mobile responsiveness
- Offline support (client-side SAM via ONNX)
- Batch processing
- Custom bin presets

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMP_DIR` | Temporary file storage | `/tmp/snap-caddy` |
| `FILE_RETENTION_MS` | File retention period | `3600000` (1 hour) |
| `OPENSCAD_PATH` | OpenSCAD binary path | `openscad` |
| `OPENSCAD_USE_XVFB` | Use xvfb for headless rendering | `true` |
| `OPENSCAD_TIMEOUT` | Execution timeout (ms) | `300000` (5 min) |
| `GRIDFINITY_LIB_PATH` | Gridfinity library path | - |

## Documentation

Detailed architecture docs are in the `/docs` directory:

- `00-MASTER-ARCHITECTURE.md` - System overview
- `01-FRONTEND-UI.md` - Component specifications
- `02-IMAGE-PROCESSING.md` - Canvas and contour detection
- `03-SAM-INTEGRATION.md` - AI segmentation setup
- `04-OPENSCAD-GENERATION.md` - STL generation
- `05-API-ARCHITECTURE.md` - Backend endpoints
- `06-STATE-MANAGEMENT.md` - React state flow

## License

MIT
