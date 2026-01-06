# Ticket #0006: Multi-Object Selection for Compartmentalized Bins

**Priority:** Medium
**Status:** Open
**Created:** 2026-01-06
**Component:** Segmentation, OpenSCAD Generation
**Affects:** Frontend, Backend, State Management

---

## Summary

Currently, Snap Caddy only supports single object segmentation per bin, limiting users to creating bins with a single cutout. This prevents the creation of compartmentalized bins where multiple objects can be organized into separate sections of the same Gridfinity bin.

**Current Limitation:**
- Users can only segment one object per bin
- `SelectStep.tsx` sets `returnMultipleMasks: false`
- State stores only one `segmentationMask: ImageData | null`
- OpenSCAD generation expects a single SVG cutout path

**Desired Capability:**
- Select multiple objects from a single image
- Assign each object to different compartments within the bin
- Combine multiple masks into a compartmentalized layout
- Generate STL files with multiple distinct cutout regions

---

## Acceptance Criteria

### User Experience
- [ ] User can segment multiple objects sequentially from the same image
- [ ] User can select between objects and assign them to different compartments
- [ ] User can see a list of all segmented objects with preview thumbnails
- [ ] User can remove individual objects from the selection
- [ ] User can arrange objects in a 2x2, 3x1, or custom grid layout
- [ ] User can assign each object to a specific compartment position

### Technical Requirements
- [ ] State management supports array of masks instead of single mask
- [ ] UI allows iterative segmentation (segment object 1, then object 2, etc.)
- [ ] Mask data is stored with metadata (name, bounds, compartment assignment)
- [ ] Multiple masks can be merged/combined for SVG generation
- [ ] OpenSCAD template supports multiple cutout paths or merged regions
- [ ] Generated bins maintain proper wall thickness between compartments

### Data Flow
- [ ] Segmentation API called multiple times with `returnMultipleMasks: false` for each object
- [ ] Each mask stored separately with identifier and bounding box
- [ ] Compartment layout engine positions masks within bin dimensions
- [ ] SVG generator creates either:
  - Single merged path from all masks, OR
  - Multiple `<path>` elements for separate compartments
- [ ] OpenSCAD handles multi-path SVG input correctly

---

## Technical Approach

### 1. State Management Updates

**File:** `/home/user/snap-caddy/contexts/WizardContext.tsx`

Update wizard state to support multiple segmentation results:

```typescript
// Current (single mask)
segmentationMask: ImageData | null;

// Proposed (multiple masks)
segmentationMasks: SegmentationMaskData[];

interface SegmentationMaskData {
  id: string;                    // Unique identifier
  maskData: string;              // Base64 PNG or data URL
  imageData: ImageData;          // Canvas ImageData
  boundingBox: BoundingBox;      // Object bounds in pixels
  name: string;                  // User-assigned name (e.g., "Screwdriver")
  compartmentId: string | null;  // Assigned compartment (null = unassigned)
  confidence: number;            // SAM confidence score
  thumbnail?: string;            // Preview thumbnail
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Add state actions:
```typescript
- addSegmentationMask(maskData: SegmentationMaskData): void
- removeSegmentationMask(id: string): void
- updateMaskCompartment(id: string, compartmentId: string): void
- clearAllMasks(): void
```

### 2. UI Component Modifications

#### A. SelectStep Component Enhancement

**File:** `/home/user/snap-caddy/components/segmentation/SelectStep.tsx`

**Changes:**
- Add "Multi-Object Mode" toggle switch
- Display list of segmented objects with thumbnails
- Show "Add Another Object" button after successful segmentation
- Allow object naming and deletion
- Display total object count

**New UI Flow:**
1. User segments first object → mask stored
2. "Add Another Object" button appears
3. Clear current points, keep image
4. User segments second object → second mask stored
5. Repeat as needed
6. User proceeds to calibration with all masks

**Proposed Layout:**
```
┌─────────────────────────────────────────┐
│ Multi-Object Mode [Toggle]             │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │  [Canvas with current segmentation] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Segmented Objects (2/5):                │
│ ┌──────┬──────┬──────┐                  │
│ │ [🔧] │ [📏] │ [+]  │                  │
│ │ Tool │Ruler │ Add  │                  │
│ └──────┴──────┴──────┘                  │
└─────────────────────────────────────────┘
```

#### B. New Component: MaskList

**File:** `/home/user/snap-caddy/components/segmentation/MaskList.tsx`

Display all segmented masks with:
- Thumbnail preview
- Object name (editable)
- Delete button
- Compartment assignment dropdown
- Reorder capability (drag-n-drop)

```tsx
interface MaskListProps {
  masks: SegmentationMaskData[];
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (from: number, to: number) => void;
}
```

#### C. New Component: CompartmentLayoutEditor

**File:** `/home/user/snap-caddy/components/segmentation/CompartmentLayoutEditor.tsx`

Visual editor for arranging masks into compartments:

- Grid layout selector (1x2, 2x2, 3x1, etc.)
- Drag-drop masks into compartment cells
- Preview of final bin layout
- Wall thickness visualization between compartments

```tsx
interface CompartmentLayoutEditorProps {
  masks: SegmentationMaskData[];
  gridUnitsX: number;
  gridUnitsY: number;
  onLayoutChange: (layout: CompartmentLayout) => void;
}

interface CompartmentLayout {
  gridPattern: [number, number]; // e.g., [2, 2] for 2x2
  compartments: Compartment[];
}

interface Compartment {
  id: string;
  position: [number, number]; // Grid position
  size: [number, number];     // Cells occupied
  maskIds: string[];          // Assigned masks
}
```

### 3. Mask Processing & Merging

**New File:** `/home/user/snap-caddy/lib/image/maskMerger.ts`

Utility to combine multiple masks based on compartment layout:

```typescript
export class MaskMerger {
  /**
   * Merge multiple masks into a single mask with compartment separation
   */
  mergeMasks(
    masks: SegmentationMaskData[],
    layout: CompartmentLayout,
    binDimensions: { width: number; height: number },
    wallThickness: number
  ): ImageData;

  /**
   * Position individual mask within compartment bounds
   */
  positionMaskInCompartment(
    mask: ImageData,
    compartment: Compartment,
    binDimensions: { width: number; height: number }
  ): ImageData;

  /**
   * Generate wall separations between compartments
   */
  generateCompartmentWalls(
    layout: CompartmentLayout,
    wallThickness: number
  ): ImageData;
}
```

### 4. SVG Generation Updates

**File:** `/home/user/snap-caddy/lib/svg/contourDetection.ts`

Update to handle multiple masks:

```typescript
// Current: generates single SVG path from one mask
export function generateSVGFromMask(mask: ImageData): string;

// Proposed: generates SVG with multiple paths
export function generateSVGFromMasks(
  masks: SegmentationMaskData[],
  layout: CompartmentLayout
): string;

// Output format option 1: Merged single path
<svg>
  <path d="M ... Z" id="merged-cutout" />
</svg>

// Output format option 2: Multiple paths with IDs
<svg>
  <g id="compartments">
    <path d="M ... Z" id="compartment-1" />
    <path d="M ... Z" id="compartment-2" />
  </g>
</svg>
```

### 5. OpenSCAD Template Updates

**File:** `/home/user/snap-caddy/lib/openscad/templates/custom-cutout.scad`

Enhance template to support multiple cutout paths:

```openscad
// Current: Single cutout import
linear_extrude(height=CUTOUT_DEPTH)
  import("cutout.svg");

// Proposed: Multi-cutout support
module multi_cutout() {
  // Option 1: Merged SVG (backward compatible)
  linear_extrude(height=CUTOUT_DEPTH)
    import("cutout.svg");

  // Option 2: Multiple SVG files
  for (i = [0:NUM_COMPARTMENTS-1]) {
    translate(compartment_positions[i])
      linear_extrude(height=compartment_depths[i])
        import(str("compartment-", i, ".svg"));
  }
}
```

**Alternative:** Use SVG groups/layers if OpenSCAD supports selective import.

### 6. Backend API Considerations

**File:** `/home/user/snap-caddy/app/api/generate/route.ts`

Update generation endpoint to:
- Accept multiple SVG paths or multi-path SVG
- Validate compartment wall thickness
- Ensure bin strength with multiple cutouts

**Validation:**
```typescript
// Check that walls between compartments are thick enough
if (compartmentWallThickness < MIN_WALL_THICKNESS) {
  throw new Error('Compartment walls too thin');
}

// Verify total cutout area doesn't compromise bin structure
const totalCutoutArea = calculateTotalCutoutArea(masks);
const binArea = gridUnitsX * gridUnitsY * GRID_UNIT_SIZE * GRID_UNIT_SIZE;
if (totalCutoutArea > binArea * MAX_CUTOUT_RATIO) {
  throw new Error('Too much material removed');
}
```

---

## Files to Modify

### Frontend Components
- `/home/user/snap-caddy/components/segmentation/SelectStep.tsx` - Add multi-object mode
- `/home/user/snap-caddy/components/segmentation/SegmentationControls.tsx` - Add "Add Another" button
- `/home/user/snap-caddy/components/segmentation/MaskOverlay.tsx` - Support multiple mask overlays

### New Components to Create
- `/home/user/snap-caddy/components/segmentation/MaskList.tsx` - Display segmented objects
- `/home/user/snap-caddy/components/segmentation/MaskListItem.tsx` - Individual mask card
- `/home/user/snap-caddy/components/segmentation/CompartmentLayoutEditor.tsx` - Layout designer
- `/home/user/snap-caddy/components/segmentation/CompartmentGrid.tsx` - Grid visualization

### State Management
- `/home/user/snap-caddy/contexts/WizardContext.tsx` - Update state structure
- `/home/user/snap-caddy/hooks/useWizard.ts` - Update validation logic

### Image Processing
- `/home/user/snap-caddy/lib/image/maskMerger.ts` - **NEW** - Mask combination logic
- `/home/user/snap-caddy/lib/svg/contourDetection.ts` - Multi-mask SVG generation

### Types
- `/home/user/snap-caddy/types/segmentation.ts` - Add `SegmentationMaskData` interface
- `/home/user/snap-caddy/types/configuration.ts` - Add compartment layout types

### OpenSCAD
- `/home/user/snap-caddy/lib/openscad/templates/custom-cutout.scad` - Multi-cutout support
- `/home/user/snap-caddy/lib/openscad/generator.ts` - Handle multiple SVGs

### Backend API
- `/home/user/snap-caddy/app/api/generate/route.ts` - Validate compartment layouts

---

## UI/UX Considerations

### Progressive Enhancement
- **Phase 1:** Multi-object selection without compartments (merge all masks)
- **Phase 2:** Simple grid-based compartment layouts (2x2, 3x1)
- **Phase 3:** Advanced custom layouts with drag-drop

### User Guidance
- Show tutorial/tooltip on first multi-object use
- Limit maximum objects (suggest 4-6 for usability)
- Provide preset layouts: "2 Large Items", "4 Small Tools", etc.
- Visual feedback when compartment walls are too thin

### Performance
- Generate thumbnails asynchronously
- Debounce compartment layout updates
- Show loading states during mask processing
- Cache intermediate SVG results

### Mobile Considerations
- Simplified list view for masks on mobile
- Tap-based compartment assignment instead of drag-drop
- Responsive grid layout selector

### Error Handling
- Warn if objects overlap too much
- Alert if bin dimensions insufficient for all objects
- Suggest increasing bin size if objects don't fit
- Validate minimum wall thickness between compartments

### Accessibility
- Keyboard navigation for mask list
- Screen reader labels for compartments
- Focus management between segmentation sessions
- Alt text for mask thumbnails

---

## Testing Requirements

### Unit Tests

**State Management:**
```typescript
// contexts/__tests__/WizardContext.test.tsx
describe('Multi-mask state management', () => {
  test('addSegmentationMask adds mask to array');
  test('removeSegmentationMask removes correct mask');
  test('updateMaskCompartment assigns compartment');
  test('clearAllMasks resets to empty array');
  test('validates maximum mask count');
});
```

**Mask Processing:**
```typescript
// lib/image/__tests__/maskMerger.test.ts
describe('MaskMerger', () => {
  test('merges two non-overlapping masks correctly');
  test('positions mask within compartment bounds');
  test('generates walls between compartments');
  test('handles edge cases (empty masks, single mask)');
  test('preserves mask quality during merge');
});
```

**SVG Generation:**
```typescript
// lib/svg/__tests__/contourDetection.test.ts
describe('Multi-mask SVG generation', () => {
  test('generates valid SVG from multiple masks');
  test('creates separate paths for each compartment');
  test('applies correct scaling to all paths');
  test('handles masks with different bounding boxes');
});
```

### Integration Tests

**Segmentation Flow:**
```typescript
// components/segmentation/__tests__/SelectStep.integration.test.tsx
describe('Multi-object segmentation flow', () => {
  test('user can segment multiple objects sequentially');
  test('user can add and remove masks from list');
  test('user can rename objects');
  test('mask list updates after each segmentation');
  test('navigation enabled after all masks assigned to compartments');
});
```

**OpenSCAD Generation:**
```typescript
// lib/openscad/__tests__/generator.integration.test.ts
describe('Multi-compartment bin generation', () => {
  test('generates valid SCAD file with multiple cutouts');
  test('maintains minimum wall thickness between compartments');
  test('validates bin dimensions accommodate all objects');
  test('successfully compiles to STL with OpenSCAD');
});
```

### Visual Regression Tests
- Mask overlay with multiple objects
- Compartment layout grid variations
- Mask list with 1, 2, 4, 6 objects
- Mobile responsive layouts

### E2E Tests

**Complete Multi-Object Flow:**
1. Upload image with multiple objects
2. Segment first object (screwdriver)
3. Click "Add Another Object"
4. Segment second object (ruler)
5. Assign to 2x1 compartment layout
6. Complete calibration
7. Configure bin parameters
8. Generate STL successfully
9. Verify STL has distinct compartments

### Performance Tests
- Benchmark mask merging with 2, 4, 6 objects
- Measure SVG generation time for multi-mask scenarios
- Profile memory usage with multiple high-res masks
- Test OpenSCAD compilation time for complex layouts

### Manual Testing Checklist
- [ ] Segment 2 objects and create 1x2 bin
- [ ] Segment 4 objects and create 2x2 bin
- [ ] Remove middle object from list and verify layout updates
- [ ] Rename all objects and verify names persist through wizard
- [ ] Test with very small and very large objects
- [ ] Test with overlapping bounding boxes
- [ ] Verify minimum wall thickness validation
- [ ] Test undo/redo during multi-object selection
- [ ] Verify STL quality matches preview

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Update state management for multiple masks
- Modify `SelectStep` to support iterative segmentation
- Create `MaskList` component
- Basic mask storage and deletion

### Phase 2: Layout System (Week 2)
- Implement `CompartmentLayoutEditor`
- Add preset grid layouts (1x2, 2x2, 2x3)
- Create mask merger utility
- Update SVG generation for multiple paths

### Phase 3: OpenSCAD Integration (Week 3)
- Update OpenSCAD template for multi-cutout
- Implement compartment wall generation
- Add validation for structural integrity
- End-to-end testing

### Phase 4: Polish & UX (Week 4)
- Add tutorials and tooltips
- Implement drag-drop for advanced layouts
- Performance optimization
- Mobile responsiveness
- Documentation updates

---

## Dependencies

**Requires:**
- Current single-object segmentation working (✓)
- Mask-to-SVG conversion pipeline (✓)
- OpenSCAD integration (✓)

**Blocks:**
- Advanced bin customization features
- Batch processing multiple images

**Related Tickets:**
- #0003 - SVG outline refinement (affects multi-path generation)
- #0004 - Calibration accuracy (affects compartment sizing)
- #0005 - OpenSCAD parameter tuning (affects wall thickness)

---

## Success Metrics

- Users can create bins with 2-6 compartments
- Multi-object bins generate successfully >95% of the time
- Compartment wall thickness validated before generation
- User flow adds <30 seconds per additional object
- Generated STLs are structurally sound and printable

---

## Notes & Considerations

### Design Decisions

**Why not use `returnMultipleMasks: true` from SAM?**
- SAM's multiple masks are alternative segmentations of the *same* object (different confidence levels)
- For multi-object bins, we need segments of *different* objects
- Solution: Call SAM multiple times, once per object

**Merged vs. Separate SVG Paths?**
- **Merged approach:** Combine all masks into single outline (simpler OpenSCAD)
- **Separate paths:** Individual compartment cutouts (more flexible, better for non-grid layouts)
- **Recommendation:** Start with merged, add separate paths later for advanced layouts

**Compartment Wall Thickness:**
- Must maintain structural integrity
- Minimum 2mm walls between compartments (configurable)
- Validate during layout design, not just at generation

### Alternative Approaches Considered

1. **Single image with multiple SAM calls:**
   - ✅ Simpler UI (one upload)
   - ❌ Objects might be different sizes, harder to align

2. **Multiple images, one object each:**
   - ✅ Easier to photograph individual objects
   - ❌ More complex calibration (different scales)
   - ❌ Breaks current wizard flow

3. **Automatic object detection:**
   - ✅ No manual segmentation needed
   - ❌ Unreliable for complex backgrounds
   - ❌ Requires additional ML model

**Chosen:** Single image with multiple manual segmentations (best balance)

### Future Enhancements

- Auto-pack algorithm to optimize compartment layouts
- 3D preview showing compartment depths
- Export/import compartment layouts as presets
- Support for non-rectangular compartments
- Honeycomb or custom divider patterns
- Variable depth compartments (different `cutoutDepth` per section)

---

## References

- [SAM Model Documentation](https://segment-anything.com/)
- [Gridfinity Specification](https://github.com/kennetek/gridfinity-rebuilt-openscad)
- OpenSCAD Multi-Object Import: [Forum Discussion](https://forum.openscad.org/)
- Current Implementation:
  - `/home/user/snap-caddy/components/segmentation/SelectStep.tsx`
  - `/home/user/snap-caddy/lib/openscad/generator.ts`
  - `/home/user/snap-caddy/contexts/WizardContext.tsx`

---

**Estimated Effort:** 3-4 weeks
**Risk Level:** Medium (OpenSCAD template changes require careful testing)
**Impact:** High (enables key use case - compartmentalized storage)
