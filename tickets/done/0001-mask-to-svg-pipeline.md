# Ticket #0001: Implement Mask-to-SVG Conversion Pipeline

**Priority:** High (Critical Path)
**Status:** Done
**Assignee:** TBD
**Created:** 2026-01-06
**Estimated Effort:** 3-5 days

---

## Summary

The mask-to-SVG conversion pipeline is currently mocked with a static SVG hexagon. This ticket covers implementing the complete pipeline that converts SAM segmentation masks into scaled, optimized SVG paths suitable for OpenSCAD 3D model generation. The implementation plan is fully documented in `/home/user/snap-caddy/docs/02-IMAGE-PROCESSING.md` but has never been integrated into the application.

**Current State:**
- Mock implementation at `/home/user/snap-caddy/app/page.tsx` (lines 352-356)
- Returns hardcoded hexagon SVG regardless of input mask
- Called when mask is generated (line 60): `setSvgOutline(generateMockSvg())`

**Desired State:**
- Binary mask → Contour detection → Path simplification → SVG generation
- Properly scaled using calibration data (pixels per mm)
- Optimized paths with configurable smoothing
- OpenSCAD-compatible SVG output

---

## Problem Statement

Users cannot generate custom Gridfinity bins from their segmented objects because the system currently outputs a placeholder SVG instead of tracing the actual object outline from the SAM segmentation mask. This blocks the entire value proposition of the application.

The documented algorithms (Marching Squares, Douglas-Peucker, Bezier curves) exist in specification form but need to be implemented as working TypeScript modules.

---

## Acceptance Criteria

### Functional Requirements
- [ ] Binary mask (ImageData) is converted to vector contour points
- [ ] Contours are simplified while preserving shape fidelity
- [ ] Outer contour and holes are properly detected and handled
- [ ] SVG paths are scaled from pixels to millimeters using calibration data
- [ ] Generated SVG is compatible with OpenSCAD import
- [ ] SVG output includes proper viewBox, units (mm), and path winding

### Quality Requirements
- [ ] Processing completes in < 1 second for typical masks (512x512)
- [ ] Simplified paths have 50-500 points (reduced from 1000-5000 raw points)
- [ ] SVG file size is < 50KB
- [ ] Works in Chrome, Firefox, Safari, Edge (last 2 versions)
- [ ] Mobile support (iOS Safari, Android Chrome)

### Technical Requirements
- [ ] TypeScript type safety throughout
- [ ] No external dependencies beyond standard Canvas API
- [ ] Memory usage < 20MB during processing
- [ ] Proper error handling with user-friendly messages
- [ ] Unit tests for core algorithms (>80% coverage)

---

## Technical Approach

### Architecture

```
SAM Mask (ImageData)
    ↓
[1] Binary Grid Conversion
    ↓
[2] Marching Squares → Raw Contours
    ↓
[3] Douglas-Peucker → Simplified Contours
    ↓
[4] Bezier Curve Fitting (optional)
    ↓
[5] Scale to Millimeters
    ↓
SVG Document (OpenSCAD-compatible)
```

### Core Algorithms

#### 1. Marching Squares (Contour Tracing)
**File:** `lib/canvas/contourDetection.ts`

- **Purpose:** Trace boundary between foreground (white) and background (black) pixels
- **Input:** Binary mask as `Uint8Array` (0 = background, 1 = foreground)
- **Output:** Array of `Point[]` representing contour boundaries
- **Algorithm:**
  - Scan 2x2 pixel cells
  - Build 4-bit cell value (8,4,2,1 for TL,TR,BR,BL corners)
  - Use lookup table to determine edge direction (16 cases)
  - Follow boundary until returning to start point
- **Complexity:** O(width × height) scan + O(perimeter) trace
- **Reference:** https://en.wikipedia.org/wiki/Marching_squares

#### 2. Douglas-Peucker Simplification
**File:** `lib/canvas/contourDetection.ts`

- **Purpose:** Reduce point count while preserving shape
- **Input:** Array of contour points, epsilon tolerance (1-2 pixels typical)
- **Output:** Simplified point array (typically 10-20% of original)
- **Algorithm:**
  - Find point with maximum perpendicular distance from line segment
  - If distance > epsilon, recursively split at that point
  - Otherwise, use only endpoints
- **Complexity:** O(n log n) average, O(n²) worst case
- **Reference:** https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm

#### 3. Bezier Curve Fitting
**File:** `lib/canvas/svgGeneration.ts`

- **Purpose:** Generate smooth SVG curves instead of polylines
- **Input:** Simplified contour points
- **Output:** SVG path with cubic Bezier commands (C)
- **Algorithm:**
  - Use Catmull-Rom spline interpolation
  - Calculate control points from neighboring points
  - Generate cubic Bezier segments (p1, cp1, cp2, p2)
- **Complexity:** O(n) where n is simplified point count
- **Reference:** https://en.wikipedia.org/wiki/Centripetal_Catmull–Rom_spline

#### 4. Scale Conversion
**File:** `lib/canvas/svgGeneration.ts`

- **Purpose:** Convert pixel coordinates to millimeters
- **Input:** Contour points (pixels), calibration (pixels/mm)
- **Output:** Scaled coordinates with proper padding
- **Formula:** `mm = pixels / pixelsPerMm`
- **Notes:**
  - Apply Y-axis flip (SVG convention: origin top-left)
  - Add configurable padding (default 2-3mm)
  - Round to 2-3 decimal places

---

## Files to Create/Modify

### New Files to Create

1. **`/home/user/snap-caddy/lib/canvas/contourDetection.ts`** (~500 lines)
   - `findContours(maskData, options): ContourResult`
   - `marchingSquares(grid, width, height): Point[][]`
   - `douglasPeucker(points, epsilon): Point[]`
   - `smoothContour(points, iterations): Point[]`
   - Utility functions: area calculation, bounding box, etc.

2. **`/home/user/snap-caddy/lib/canvas/svgGeneration.ts`** (~400 lines)
   - `generateSVG(contour, holes, options): SVGDocument`
   - `contourToLinePath(points, ...): string`
   - `contourToBezierPath(points, ...): string`
   - `createSVGDocument(pathData, width, height): string`
   - Utility functions: coordinate transforms, path optimization

3. **`/home/user/snap-caddy/lib/canvas/types.ts`** (~100 lines)
   - Type definitions: `Point`, `Contour`, `ContourResult`, `SVGDocument`
   - Options interfaces: `ContourDetectionOptions`, `SVGGenerationOptions`
   - Ensure compatibility with existing types

4. **`/home/user/snap-caddy/lib/canvas/index.ts`**
   - Barrel export for all canvas utilities
   - Clean public API

### Files to Modify

1. **`/home/user/snap-caddy/app/page.tsx`**
   - **Line 46-61:** Replace `handleMaskGenerated` implementation
   - **Remove:** `generateMockSvg()` function (lines 352-356)
   - **Add:** Import and call real mask-to-SVG pipeline
   ```typescript
   import { findContours, generateSVG } from '@/lib/canvas';

   const handleMaskGenerated = useCallback((maskData: ImageData) => {
     // Detect contours
     const contours = findContours(maskData, {
       minArea: 200,
       simplifyTolerance: 1.5,
       smoothingIterations: 2,
       findHoles: true
     });

     // Generate SVG with calibration
     const svg = generateSVG(
       contours.outerContour,
       contours.holes,
       {
         pixelsPerMm: state.calibration.pixelsPerMm || 10,
         padding: 3,
         useBezier: true,
         bezierTension: 0.4,
         decimals: 2,
         flipY: true
       }
     );

     // Store in state
     wizard.setSegmentationMask(maskData);
     setSvgOutline(svg.fullSvg);
   }, [wizard, setSvgOutline, state.calibration.pixelsPerMm]);
   ```

2. **`/home/user/snap-caddy/components/segmentation/SelectStep.tsx`** (likely needs update)
   - Ensure `onMaskGenerated` callback receives actual `ImageData` from SAM
   - Not a mock or placeholder

3. **`/home/user/snap-caddy/components/calibration/CalibrateStep.tsx`** (likely needs update)
   - Ensure calibration runs BEFORE mask processing if possible
   - Or provide fallback pixels/mm value (e.g., 10) until calibrated

### Test Files to Create

1. **`/home/user/snap-caddy/__tests__/lib/canvas/contourDetection.test.ts`**
   - Test marching squares with known binary grids
   - Test Douglas-Peucker with various epsilon values
   - Test hole detection
   - Edge cases: empty mask, single pixel, full mask

2. **`/home/user/snap-caddy/__tests__/lib/canvas/svgGeneration.test.ts`**
   - Test SVG path generation
   - Test scaling and coordinate transforms
   - Test Bezier curve generation
   - Validate SVG XML syntax

3. **`/home/user/snap-caddy/__tests__/lib/canvas/integration.test.ts`**
   - End-to-end: binary mask → SVG
   - Test with real SAM output samples
   - Performance benchmarks

---

## Dependencies

### Internal Dependencies
- SAM segmentation must output valid `ImageData` (likely already implemented)
- Calibration step must calculate `pixelsPerMm` (already implemented)
- Wizard state management (already implemented)

### External Dependencies
- **None** - Uses only browser Canvas API (universally supported)
- TypeScript compiler
- Testing framework (Jest/Vitest - already in project)

### Browser APIs Required
- `ImageData` (to read mask pixels)
- `DOMParser` (to validate SVG output)
- Standard Math functions
- Typed arrays (`Uint8Array`)

---

## Testing Requirements

### Unit Tests

**Coverage Target:** > 80%

1. **Marching Squares Algorithm**
   ```typescript
   describe('marchingSquares', () => {
     it('traces a simple rectangle', () => {
       const grid = createBinaryGrid(10, 10, [
         [2, 2], [2, 7], [7, 7], [7, 2] // Rectangle corners
       ]);
       const contours = marchingSquares(grid, 10, 10);
       expect(contours).toHaveLength(1);
       expect(contours[0]).toBeClosedPath();
     });

     it('handles holes correctly', () => {
       const gridWithHole = createGridWithHole();
       const contours = marchingSquares(gridWithHole, 20, 20);
       expect(contours.length).toBeGreaterThan(1); // Outer + hole
     });

     it('handles edge pixels', () => {
       // Foreground pixels touching image borders
     });
   });
   ```

2. **Douglas-Peucker Simplification**
   ```typescript
   describe('douglasPeucker', () => {
     it('simplifies straight line to endpoints', () => {
       const line = [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0}];
       const simplified = douglasPeucker(line, 0.1);
       expect(simplified).toHaveLength(2);
       expect(simplified).toEqual([{x:0,y:0}, {x:3,y:0}]);
     });

     it('preserves significant points', () => {
       const zigzag = createZigzagPath();
       const simplified = douglasPeucker(zigzag, 1.0);
       expect(simplified.length).toBeLessThan(zigzag.length);
       expect(simplified.length).toBeGreaterThan(2);
     });

     it('respects epsilon tolerance', () => {
       const points = createComplexPath();
       const tight = douglasPeucker(points, 0.5);
       const loose = douglasPeucker(points, 2.0);
       expect(tight.length).toBeGreaterThan(loose.length);
     });
   });
   ```

3. **SVG Generation**
   ```typescript
   describe('generateSVG', () => {
     it('creates valid SVG document', () => {
       const svg = generateSVG(mockContour, [], options);
       const parser = new DOMParser();
       const doc = parser.parseFromString(svg.fullSvg, 'image/svg+xml');
       expect(doc.querySelector('parsererror')).toBeNull();
     });

     it('applies correct scale transformation', () => {
       const contour = createSquareContour(100); // 100x100 pixels
       const svg = generateSVG(contour, [], {
         pixelsPerMm: 10,
         padding: 0
       });
       expect(svg.width).toBeCloseTo(10, 1); // 100px / 10 = 10mm
       expect(svg.height).toBeCloseTo(10, 1);
     });

     it('handles holes with opposite winding', () => {
       const outerCCW = createCounterClockwiseContour();
       const holeCW = createClockwiseContour();
       const svg = generateSVG(outerCCW, [holeCW], options);
       expect(svg.pathData).toContain('M'); // Move for outer
       expect(countMoveCommands(svg.pathData)).toBe(2); // Outer + hole
     });
   });
   ```

### Integration Tests

1. **End-to-End Pipeline**
   ```typescript
   describe('Mask to SVG Pipeline', () => {
     it('converts simple circular mask to SVG', async () => {
       const maskData = createCircularMask(512, 512, 100);

       const contours = findContours(maskData, {
         minArea: 100,
         simplifyTolerance: 2.0
       });

       const svg = generateSVG(contours.outerContour, [], {
         pixelsPerMm: 10,
         useBezier: true
       });

       expect(svg.pathData).toBeTruthy();
       expect(svg.width).toBeGreaterThan(0);
       expect(validateSVG(svg.fullSvg)).toBe(true);
     });
   });
   ```

2. **Performance Benchmarks**
   ```typescript
   describe('Performance', () => {
     it('processes 512x512 mask in < 1 second', () => {
       const start = performance.now();
       const result = processMaskToSVG(testMask512);
       const duration = performance.now() - start;
       expect(duration).toBeLessThan(1000);
     });

     it('uses < 20MB memory', () => {
       // Memory profiling test
     });
   });
   ```

### Manual Testing Checklist

- [ ] Test with real SAM segmentation output (organic shapes)
- [ ] Test with objects containing holes (e.g., wrench, carabiner)
- [ ] Test calibration accuracy (measure generated SVG vs. real object)
- [ ] Visual inspection: SVG matches mask outline
- [ ] Import SVG into OpenSCAD - verify no errors
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Test with various image resolutions (256x256 to 2048x2048)
- [ ] Test edge cases: very small objects, very large masks
- [ ] Error handling: invalid mask data, calibration = 0, etc.

---

## Implementation Plan

### Phase 1: Core Contour Detection (Day 1-2)

**Tasks:**
1. Create `lib/canvas/types.ts` with all interface definitions
2. Implement `maskToBinaryGrid()` - convert ImageData to Uint8Array
3. Implement `marchingSquares()` algorithm with lookup table
4. Implement `calculateSignedArea()` and `calculateBoundingBox()`
5. Implement `findContours()` wrapper function
6. Write unit tests for Phase 1
7. Test with synthetic binary grids (rectangles, circles)

**Deliverable:** Working contour detection from binary mask

### Phase 2: Path Simplification (Day 2-3)

**Tasks:**
1. Implement `douglasPeucker()` algorithm
2. Implement `perpendicularDistance()` helper
3. Implement `smoothContour()` (moving average filter)
4. Add options handling (epsilon, smoothing iterations)
5. Write unit tests for Phase 2
6. Test simplification quality vs. speed tradeoffs

**Deliverable:** Optimized contour with reduced point count

### Phase 3: SVG Generation (Day 3-4)

**Tasks:**
1. Implement `contourToLinePath()` - basic polyline SVG
2. Implement `transformPoint()` - coordinate system transforms
3. Implement `scaleContourToMm()` - apply calibration
4. Implement `createSVGDocument()` - XML generation
5. Implement `reverseWinding()` for holes
6. Write unit tests for Phase 3
7. Validate SVG output in OpenSCAD

**Deliverable:** Working SVG generation with scaling

### Phase 4: Bezier Curves (Day 4)

**Tasks:**
1. Implement `catmullRomControlPoint()` calculation
2. Implement `contourToBezierPath()` - smooth curves
3. Add `useBezier` option flag
4. Test smoothing quality
5. Compare file size: linear vs. Bezier paths

**Deliverable:** Optional smooth Bezier curve paths

### Phase 5: Integration (Day 5)

**Tasks:**
1. Replace `generateMockSvg()` in `app/page.tsx`
2. Update `handleMaskGenerated()` to call real pipeline
3. Handle calibration timing (provide fallback if not yet calibrated)
4. Add error handling and user feedback
5. Update `SelectStep` if needed to pass correct ImageData
6. Integration testing with full wizard flow
7. Cross-browser testing
8. Mobile testing

**Deliverable:** Fully integrated mask-to-SVG pipeline

### Phase 6: Polish & Documentation (Day 5)

**Tasks:**
1. Performance optimization (if needed)
2. Add JSDoc comments to all public functions
3. Update README with pipeline documentation
4. Create example usage guide
5. Add logging/telemetry points
6. Final QA pass

**Deliverable:** Production-ready implementation

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Marching squares performance on large masks | Medium | Medium | Downsample mask to 512x512 before processing |
| Douglas-Peucker introduces artifacts | Medium | High | Provide adjustable epsilon, visual preview |
| OpenSCAD rejects generated SVG | Low | High | Strict SVG validation, test with OpenSCAD |
| Calibration unavailable when mask generated | High | Medium | Use sensible default (10 px/mm), re-process when calibrated |
| Memory issues on mobile devices | Low | Medium | Limit max mask size, cleanup after processing |

### Schedule Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Algorithms more complex than estimated | Medium | Medium | Start with simple versions, iterate |
| Integration breaks existing flow | Low | High | Feature flag, thorough testing |
| Cross-browser issues | Low | Low | Standard APIs, limited polyfills needed |

---

## Success Metrics

### Quantitative
- ✅ Processing time < 1s for 512x512 mask
- ✅ Simplified paths: 50-500 points (vs. 1000-5000 raw)
- ✅ SVG file size < 50KB
- ✅ Test coverage > 80%
- ✅ Zero OpenSCAD import errors

### Qualitative
- ✅ SVG visually matches segmentation mask
- ✅ Smooth curves (when Bezier enabled)
- ✅ No user complaints about accuracy
- ✅ Successfully generates Gridfinity bins that fit real objects

---

## References

### Algorithm Documentation
- **Marching Squares:** https://en.wikipedia.org/wiki/Marching_squares
- **Douglas-Peucker:** https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
- **Catmull-Rom Splines:** https://en.wikipedia.org/wiki/Centripetal_Catmull–Rom_spline
- **Shoelace Formula (Area):** https://en.wikipedia.org/wiki/Shoelace_formula

### Web Standards
- **Canvas API:** https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **ImageData:** https://developer.mozilla.org/en-US/docs/Web/API/ImageData
- **SVG Paths:** https://www.w3.org/TR/SVG/paths.html
- **OpenSCAD SVG Import:** https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/SVG_Import

### Internal Documentation
- **Image Processing Spec:** `/home/user/snap-caddy/docs/02-IMAGE-PROCESSING.md`
- **Current Mock:** `/home/user/snap-caddy/app/page.tsx:352-356`

---

## Notes

- This pipeline is the critical path for the entire application value proposition
- All algorithms are specified in detail in `02-IMAGE-PROCESSING.md`
- No external dependencies required beyond standard browser APIs
- Consider Web Worker implementation for large masks (future optimization)
- Bezier curves are optional - linear paths work fine for angular objects
- OpenSCAD compatibility is non-negotiable - must test imports

---

## Related Tickets

- None (this is the first implementation ticket)

## Blocked By

- None (can be implemented immediately)

## Blocks

- User acceptance testing of end-to-end flow
- Performance optimization tickets
- Advanced features (multi-object, auto-calibration)
