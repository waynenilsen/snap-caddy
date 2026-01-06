# Ticket 0004: Automatic Scale Detection

## Status
**Open**

## Priority
**Medium**

## Summary

Users currently must manually set the scale for every image by selecting two points on a ruler and entering the known distance, which slows down the workflow. This ticket implements automatic detection of rulers, coins, or credit cards as reference objects to streamline calibration and reduce friction in the user experience.

## Problem Statement

The current manual calibration workflow requires users to:
1. Take a photo with a ruler or known reference object
2. Manually click two points on the ruler
3. Enter the real-world distance and unit
4. Verify the calculated scale

This manual process is:
- Time-consuming and tedious for repeat usage
- Error-prone (users may misclick or enter wrong values)
- Requires precise alignment and clicking
- Interrupts the flow from capture to generation

Users would benefit from automatic detection that:
- Recognizes common reference objects (rulers, coins, credit cards)
- Calculates scale automatically when possible
- Falls back to manual calibration when auto-detection fails
- Allows manual override for verification

## Current State

### Existing Components
- **CalibrateStep.tsx** (`/home/user/snap-caddy/components/calibration/CalibrateStep.tsx`)
  - Main calibration orchestrator
  - Manages state for line selection, distance input, and scale calculation
  - Currently supports only manual two-point calibration
  - Validates calibration with error bounds (0.1-100 pixels/mm)

- **RulerSelector.tsx** (`/home/user/snap-caddy/components/calibration/RulerSelector.tsx`)
  - Canvas-based interactive line drawing
  - Click/drag interface for selecting two points
  - Visual feedback with measurement overlay
  - Real-time pixel distance calculation

- **ScaleInput.tsx** (`/home/user/snap-caddy/components/calibration/ScaleInput.tsx`)
  - Input form for real-world distance
  - Unit selection (mm, cm, inches)
  - Quick presets (100mm, 10cm, 1 inch)
  - Validation and error handling

- **CalibrationPreview.tsx** (`/home/user/snap-caddy/components/calibration/CalibrationPreview.tsx`)
  - Displays calculated pixels per mm
  - Shows DPI and confidence metrics

### Documented Approach
The image processing documentation (`/home/user/snap-caddy/docs/02-IMAGE-PROCESSING.md`) outlines the following approach in sections 4 and 5:

**Section 4: Ruler/Scale Detection**
- Simplified Hough transform for line detection
- Sobel edge detection as preprocessing
- Parallel line pair detection for ruler edges
- Tick mark detection between parallel edges
- Orientation classification (horizontal/vertical)
- Unit estimation from tick spacing (mm, cm, inch)

**Section 5: Scale Calculation**
- Two-point calibration (current implementation)
- Multi-point averaging for improved accuracy
- Scale validation with confidence scoring
- Reference object detection (coins, cards)
- Known dimensions database

## Acceptance Criteria

### Must Have
1. **Ruler Auto-Detection**
   - [ ] Detect horizontal and vertical rulers in images
   - [ ] Identify ruler edges using parallel line detection
   - [ ] Detect tick marks between ruler edges
   - [ ] Calculate scale from tick spacing
   - [ ] Estimate measurement unit (mm, cm, inch) from spacing
   - [ ] Show confidence score (0-1) for detected rulers
   - [ ] Only auto-apply if confidence > 0.7

2. **Reference Object Detection**
   - [ ] Detect circular objects (coins)
     - US Quarter: 24.26mm diameter
     - US Penny: 19.05mm diameter
   - [ ] Detect rectangular objects (credit cards)
     - Standard credit card: 85.6mm × 53.98mm (aspect ratio ~1.586)
   - [ ] Calculate scale from detected object dimensions
   - [ ] Show detected object type and confidence

3. **Manual Override**
   - [ ] Always allow manual calibration even if auto-detection succeeds
   - [ ] Provide "Use Auto-Detected Scale" button when detection succeeds
   - [ ] Provide "Manual Calibration" button to override auto-detection
   - [ ] Show comparison between auto-detected and manual scales
   - [ ] Preserve user's choice (manual takes precedence)

4. **UI/UX Improvements**
   - [ ] Show auto-detection status (detecting, found, failed)
   - [ ] Display detected reference object with visual overlay
   - [ ] Highlight detected ruler or object boundaries
   - [ ] Show why auto-detection failed (no ruler found, low confidence, etc.)
   - [ ] Provide helpful suggestions (add ruler, try different angle, etc.)

5. **Validation and Error Handling**
   - [ ] Validate auto-detected scale is reasonable (0.1-100 px/mm)
   - [ ] Check DPI range (50-300 typical)
   - [ ] Warn if object size seems incorrect
   - [ ] Handle multiple detected objects (choose highest confidence)
   - [ ] Gracefully fall back to manual calibration on failure

### Nice to Have
1. **Advanced Detection**
   - [ ] Support multiple ruler types (clear/transparent, wooden, metal)
   - [ ] Detect QR codes with embedded scale information
   - [ ] Support other common coins (Euro, British Pound, etc.)
   - [ ] Template matching for specific ruler brands

2. **User Experience**
   - [ ] Remember preferred reference object type per user
   - [ ] Show detection results history
   - [ ] Provide "recalibrate" option after auto-detection
   - [ ] Export calibration data for reuse

3. **Performance**
   - [ ] Run detection in Web Worker to avoid UI blocking
   - [ ] Show progress indicator during detection
   - [ ] Cache detection results per image
   - [ ] Optimize for mobile devices (lower resolution processing)

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────┐
│           CalibrateStep (Orchestrator)              │
│  - Manages calibration mode (auto/manual)           │
│  - Coordinates detection and user input             │
└───────────────┬─────────────────────────────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ AutoDetector │  │ RulerSelector    │
│  (New)       │  │ (Existing)       │
└──────────────┘  └──────────────────┘
       │
       ├─► RulerDetection (lib)
       ├─► ObjectDetection (lib)
       └─► ScaleCalculation (lib)
```

### New Files to Create

1. **`lib/calibration/rulerDetection.ts`**
   - `detectLines(imageData, options): DetectedLine[]`
   - `sobelEdgeDetection(grayData): Uint8Array`
   - `detectRuler(imageData, options): DetectedRuler | null`
   - `detectTickMarks(imageData, edge1, edge2): Point[]`
   - `estimateUnit(spacing): 'mm' | 'cm' | 'inch' | 'unknown'`

2. **`lib/calibration/objectDetection.ts`**
   - `detectReferenceObjects(imageData, options): ReferenceObject[]`
   - `detectCircles(imageData): Circle[]` (Hough circle transform)
   - `detectRectangles(imageData): BoundingBox[]`
   - `classifyObject(shape, dimensions): 'coin' | 'card' | 'unknown'`

3. **`lib/calibration/scaleCalculation.ts`**
   - `scaleFromRuler(ruler): ScaleResult`
   - `scaleFromReferenceObject(object): ScaleResult`
   - `validateScale(scale, imageSize): ScaleValidation`
   - `calculateConfidence(scale, method): number`

4. **`components/calibration/AutoDetector.tsx`**
   - UI component showing auto-detection status
   - Visual overlay of detected ruler/object
   - Accept/reject buttons for auto-detected scale
   - Fallback to manual calibration

5. **`components/calibration/DetectionOverlay.tsx`**
   - Canvas overlay showing detected lines, objects
   - Visual feedback for ruler edges, tick marks
   - Bounding boxes for coins/cards
   - Confidence indicators

### Files to Modify

1. **`components/calibration/CalibrateStep.tsx`**
   - Add auto-detection mode state
   - Integrate AutoDetector component
   - Handle detection results and user confirmation
   - Coordinate between auto and manual modes
   - Update validation logic for auto-detected scales

2. **`components/calibration/RulerSelector.tsx`**
   - Add optional overlay for detected ruler
   - Show auto-detected points (read-only mode)
   - Allow switching from auto to manual mode

3. **`components/calibration/CalibrationPreview.tsx`**
   - Show detection method (auto vs manual)
   - Display confidence score
   - Show detected object type (if auto)

### Type Definitions

```typescript
// lib/calibration/types.ts

interface Point {
  x: number;
  y: number;
}

interface DetectedLine {
  start: Point;
  end: Point;
  length: number;
  angle: number; // radians
  confidence: number; // 0-1
}

interface DetectedRuler {
  edges: [DetectedLine, DetectedLine];
  ticks: Point[];
  orientation: 'horizontal' | 'vertical';
  estimatedUnit: 'mm' | 'cm' | 'inch' | 'unknown';
  confidence: number;
}

interface ReferenceObject {
  type: 'coin' | 'card' | 'ruler';
  boundingBox: BoundingBox;
  knownSize: number; // in mm
  confidence: number;
  specificType?: string; // "US Quarter", "Credit Card", etc.
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Circle {
  center: Point;
  radius: number;
  confidence: number;
}

interface ScaleResult {
  pixelsPerMm: number;
  confidence: number;
  errorBound: number;
  dpi: number;
  method: 'auto-ruler' | 'auto-object' | 'manual';
  detectedObject?: ReferenceObject | DetectedRuler;
}

interface RulerDetectionOptions {
  minLineLength?: number;
  maxLineGap?: number;
  angleThreshold?: number;
  enableCoinDetection?: boolean;
  enableCardDetection?: boolean;
}
```

### Algorithm Implementation Details

#### Edge Detection (Sobel Operator)
```typescript
// Simplified from documentation Section 4.2
// Time Complexity: O(width × height)
// Uses 3×3 Sobel kernels for X and Y gradients

function sobelEdgeDetection(grayData: Uint8Array, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(width * height);
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  // Apply kernels and calculate magnitude
  // See docs Section 4.2 for full implementation

  return edges;
}
```

#### Line Detection (Simplified Hough Transform)
```typescript
// Simplified from documentation Section 4.1
// Time Complexity: O(width × height)
// Edge-based approach instead of full Hough transform

function detectLines(imageData: ImageData, options: RulerDetectionOptions): DetectedLine[] {
  // 1. Convert to grayscale
  // 2. Apply Sobel edge detection
  // 3. Find connected edge components
  // 4. Fit lines using least squares
  // 5. Filter by length and confidence

  // See docs Section 4.1 for full implementation
}
```

#### Ruler Detection
```typescript
// From documentation Section 4.3
// Time Complexity: O(n²) where n is number of detected lines

function detectRuler(imageData: ImageData, options: RulerDetectionOptions): DetectedRuler | null {
  const lines = detectLines(imageData, options);

  // 1. Find parallel line pairs
  // 2. Check for tick marks between pairs
  // 3. Calculate tick spacing
  // 4. Estimate unit (mm/cm/inch)
  // 5. Calculate confidence score

  // See docs Section 4.3 for full implementation
}
```

#### Circle Detection (for Coins)
```typescript
// From documentation Section 4.4
// Simplified Hough Circle Transform

function detectCircles(imageData: ImageData): Circle[] {
  // 1. Apply edge detection
  // 2. Use Hough Circle Transform (simplified for browser)
  // 3. Filter by radius range (10-30mm typical)
  // 4. Calculate confidence from edge strength

  // Note: Full Hough Circle is expensive, use simplified approach
}
```

#### Scale Calculation from Ruler
```typescript
// From documentation Section 5.4

function scaleFromRuler(ruler: DetectedRuler): ScaleResult {
  // 1. Calculate average tick spacing
  // 2. Determine real-world spacing from unit
  // 3. Calculate pixels per mm
  // 4. Estimate confidence from spacing variance

  const avgSpacing = calculateAverageTickSpacing(ruler.ticks);
  const realSpacing = unitToMm(ruler.estimatedUnit);
  const pixelsPerMm = avgSpacing / realSpacing;

  return {
    pixelsPerMm,
    confidence: ruler.confidence,
    method: 'auto-ruler',
    detectedObject: ruler
  };
}
```

### Performance Considerations

1. **Image Preprocessing**
   - Downsample to max 1024×1024 for detection (faster)
   - Run in Web Worker to avoid blocking UI
   - Use typed arrays (Uint8Array) for efficiency
   - Cache edge detection results

2. **Optimization Strategies**
   - Only detect in user-specified region if possible
   - Skip expensive operations if quick heuristics fail
   - Use progressive detection (fast checks first)
   - Timeout after 3 seconds, fall back to manual

3. **Memory Management**
   - Dispose of temporary canvases
   - Clear ImageData after processing
   - Limit image size for detection
   - Reuse buffers where possible

4. **Expected Performance**
   - Edge detection: 100-300ms (2048×2048 image)
   - Line detection: 50-150ms
   - Ruler detection: 50-100ms
   - Circle detection: 200-500ms (most expensive)
   - **Total: 400-1000ms** (acceptable with progress indicator)

### Mobile Considerations

- Reduce max image size to 512×512 on mobile
- Skip circle detection on low-end devices
- Show simpler UI (no fancy overlays)
- Provide option to skip auto-detection
- Test on actual iOS and Android devices

## Dependencies

### Internal Dependencies
- Existing calibration components (CalibrateStep, RulerSelector, ScaleInput)
- Image processing utilities from `lib/canvas/imageProcessing.ts`
- Canvas utilities (createCanvas, disposeCanvas)
- Existing validation logic

### External Dependencies
- No new npm packages required
- Uses native Canvas API and Web Workers
- TypeScript type definitions

### Documentation References
- `/home/user/snap-caddy/docs/02-IMAGE-PROCESSING.md` Section 4: Ruler/Scale Detection
- `/home/user/snap-caddy/docs/02-IMAGE-PROCESSING.md` Section 5: Scale Calculation

## Testing Requirements

### Unit Tests

1. **Edge Detection**
   - [ ] Sobel operator produces correct gradients
   - [ ] Edge magnitude calculation is accurate
   - [ ] Handles edge cases (1×1, very large images)

2. **Line Detection**
   - [ ] Detects horizontal and vertical lines
   - [ ] Filters out short lines correctly
   - [ ] Calculates line angles accurately
   - [ ] Confidence scoring works as expected

3. **Ruler Detection**
   - [ ] Finds parallel line pairs
   - [ ] Detects tick marks between edges
   - [ ] Estimates correct unit from spacing
   - [ ] Handles rotated rulers (±45°)

4. **Object Detection**
   - [ ] Detects circles of various sizes
   - [ ] Detects rectangles with correct aspect ratio
   - [ ] Classifies objects correctly (coin vs card)
   - [ ] Handles partially visible objects

5. **Scale Calculation**
   - [ ] Calculates correct pixels per mm
   - [ ] Validates scale bounds (0.1-100)
   - [ ] Confidence scoring is reasonable
   - [ ] Error bounds are calculated correctly

### Integration Tests

1. **Auto-Detection Flow**
   - [ ] Detects ruler and calculates scale automatically
   - [ ] Falls back to manual on detection failure
   - [ ] Allows manual override of auto-detected scale
   - [ ] Preserves user's manual choice

2. **UI Integration**
   - [ ] Shows detection progress indicator
   - [ ] Displays detected object overlay correctly
   - [ ] Accept/reject buttons work as expected
   - [ ] Mode switching (auto ↔ manual) works smoothly

3. **Error Handling**
   - [ ] Handles images with no ruler gracefully
   - [ ] Handles low-quality images (blurry, dark)
   - [ ] Shows helpful error messages
   - [ ] Never crashes on invalid input

### Test Images Required

Create test suite with:
1. **Rulers**
   - Metric ruler (mm marks) - horizontal
   - Metric ruler (cm marks) - horizontal
   - Imperial ruler (inch marks) - horizontal
   - Vertical rulers
   - Rotated rulers (30°, 45°, 60°)

2. **Reference Objects**
   - US Quarter (multiple angles)
   - US Penny
   - Credit card (standard size)
   - Other coins (Euro, GBP)

3. **Edge Cases**
   - No ruler in image
   - Multiple rulers
   - Partially visible ruler
   - Blurry image
   - Low contrast
   - Very small ruler
   - Dark/shadowed ruler

4. **Real-World Scenarios**
   - Phone photos at various distances
   - Different lighting conditions
   - Various backgrounds
   - With and without objects to measure

### Manual Testing Checklist

- [ ] Test on Chrome desktop
- [ ] Test on Firefox desktop
- [ ] Test on Safari desktop
- [ ] Test on Chrome mobile (Android)
- [ ] Test on Safari mobile (iOS)
- [ ] Test with slow network (detection progress)
- [ ] Test with various image sizes (100KB - 10MB)
- [ ] Test with different camera angles
- [ ] Verify accessibility (keyboard navigation, screen readers)

## Implementation Plan

### Phase 1: Core Detection Algorithms (Week 1)
1. Implement Sobel edge detection
2. Implement simplified line detection
3. Implement parallel line pair finding
4. Test with sample ruler images

### Phase 2: Ruler Detection (Week 1-2)
1. Implement tick mark detection
2. Implement unit estimation
3. Implement confidence scoring
4. Integration testing with real images

### Phase 3: Reference Object Detection (Week 2)
1. Implement simplified circle detection
2. Implement rectangle detection
3. Implement object classification
4. Test with coin and card images

### Phase 4: UI Integration (Week 2-3)
1. Create AutoDetector component
2. Create DetectionOverlay component
3. Modify CalibrateStep for auto mode
4. Add mode switching and user controls

### Phase 5: Validation and Polish (Week 3)
1. Implement scale validation
2. Add error handling and fallbacks
3. Performance optimization
4. Mobile testing and adjustments

### Phase 6: Testing and Documentation (Week 4)
1. Unit tests for all algorithms
2. Integration tests for UI
3. Manual testing on devices
4. Update user documentation

**Total Estimated Timeline: 3-4 weeks**

## Success Metrics

1. **Detection Accuracy**
   - Auto-detection succeeds on 70%+ of images with rulers
   - False positive rate < 10%
   - Scale accuracy within ±2% of manual calibration

2. **User Experience**
   - Time to calibration reduced by 50% when auto-detection works
   - User satisfaction score increase
   - Reduced calibration errors

3. **Performance**
   - Auto-detection completes in < 2 seconds on desktop
   - Auto-detection completes in < 3 seconds on mobile
   - No UI blocking during detection

4. **Adoption**
   - 60%+ of users use auto-detected scale when available
   - Manual override used < 20% of the time
   - Calibration step completion rate increases

## Notes

- Auto-detection is a convenience feature, not a replacement for manual calibration
- Always provide manual override for users who need precise control
- Focus on common use cases first (standard rulers, US coins/cards)
- Can expand to support more object types in future iterations
- Consider adding a "Tips for better detection" help section

## Related Tickets

- #0001: Complete Image Processing Pipeline (parent)
- #0002: Improve Segmentation Accuracy (related)
- #0003: Add Multi-Object Support (related)
- #0005: Calibration Presets and Templates (future)

## References

- Image Processing Documentation: `/home/user/snap-caddy/docs/02-IMAGE-PROCESSING.md`
- Marching Squares Algorithm: https://en.wikipedia.org/wiki/Marching_squares
- Sobel Operator: https://en.wikipedia.org/wiki/Sobel_operator
- Hough Transform: https://en.wikipedia.org/wiki/Hough_transform
- Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
