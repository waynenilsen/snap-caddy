# Ticket #0008: Configuration Presets and Templates

**Priority:** Low
**Status:** Planning
**Created:** 2026-01-06
**Labels:** enhancement, user-experience, storage

---

## Summary

Users must manually reconfigure Gridfinity bin settings every time they create a new bin, even when using the same or similar configurations repeatedly. There is currently no way to save favorite configurations, load commonly-used presets, or export/import settings for reuse across sessions or devices. This creates friction for power users who frequently generate bins with similar specifications.

### User Pain Points

- Reconfiguring identical settings (e.g., "shallow bins with magnet holes") for every new object
- No way to save successful configurations for future reference
- Cannot share configuration templates with other users or across devices
- No built-in presets for common use cases (e.g., "deep storage", "organizer tray", "tool holder")
- Lost configurations when clearing browser data

---

## Acceptance Criteria

### Must Have

1. **Save Custom Presets**
   - Users can save current bin configuration as a named preset
   - Preset includes all configuration fields from `BinConfig` interface
   - User provides descriptive name and optional description
   - Saved presets persist across browser sessions

2. **Load Saved Presets**
   - Users can view list of saved presets
   - Users can apply a preset to populate configuration fields
   - Preset application should respect object dimension constraints (warn if incompatible)
   - Recently used presets appear at the top

3. **Built-in Default Presets**
   - System includes 4-6 common presets out-of-the-box:
     - "Standard Organizer" (2x2, 28mm height, magnet holes)
     - "Shallow Tray" (3x3, 14mm height, no holes)
     - "Deep Storage" (2x2, 56mm height, magnet + screw holes)
     - "Tool Holder" (1x3, 42mm height, magnet holes, thick walls)
     - "Compact Single" (1x1, 21mm height, magnet holes)
   - Built-in presets cannot be deleted but can be duplicated/modified

4. **Export/Import Presets**
   - Users can export individual presets as JSON files
   - Users can export all presets as a single JSON file
   - Users can import preset JSON files
   - Import validates schema before adding to collection

5. **Preset Management**
   - Users can rename saved presets
   - Users can delete custom presets
   - Users can duplicate presets (create copy with new name)
   - Confirmation dialog before deletion

### Nice to Have

6. **Cloud Sync (Optional)**
   - Optional cloud storage for preset synchronization
   - User account integration (future phase)
   - Sync across devices when authenticated

7. **Preset Categories/Tags**
   - Organize presets by categories (e.g., "tools", "organizer", "electronics")
   - Filter presets by tags

8. **Preset Statistics**
   - Track usage count for each preset
   - Show "last used" timestamp
   - Sort by most frequently used

---

## Technical Approach

### Data Schema

```typescript
// types/presets.ts

export interface BinPreset {
  id: string;                    // UUID v4
  name: string;                  // User-friendly name
  description?: string;          // Optional description
  config: BinConfig;             // Full bin configuration
  isBuiltIn: boolean;            // True for system presets
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  lastUsedAt?: string;           // ISO timestamp
  useCount: number;              // Usage statistics
  category?: string;             // Optional category/tag
}

export interface PresetCollection {
  version: string;               // Schema version (e.g., "1.0.0")
  presets: BinPreset[];
  exportedAt: string;            // ISO timestamp
}

export interface PresetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];           // e.g., "Grid too small for current object"
}
```

### Storage Strategy

**Phase 1: localStorage** (MVP)
- Store presets in `localStorage` under key `snap-caddy:presets`
- Implement size limits and quota handling
- Graceful degradation if quota exceeded
- Automatic cleanup of orphaned data

**Phase 2: Cloud Sync** (Future)
- Optional Firebase/Supabase integration
- Conflict resolution for multi-device sync
- Fallback to localStorage when offline

### Preset Management Service

```typescript
// lib/presets/presetManager.ts

export class PresetManager {
  // CRUD operations
  savePreset(config: BinConfig, name: string, description?: string): BinPreset
  loadPreset(id: string): BinPreset | null
  updatePreset(id: string, updates: Partial<BinPreset>): BinPreset
  deletePreset(id: string): boolean
  getAllPresets(): BinPreset[]

  // Validation
  validatePreset(preset: BinPreset): PresetValidationResult
  validatePresetForObject(preset: BinPreset, dimensions?: {width: number, height: number}): PresetValidationResult

  // Import/Export
  exportPreset(id: string): string  // JSON string
  exportAllPresets(): string        // JSON string
  importPreset(jsonString: string): BinPreset | BinPreset[]

  // Built-in presets
  getBuiltInPresets(): BinPreset[]
  resetBuiltInPresets(): void

  // Statistics
  recordPresetUsage(id: string): void
  getMostUsedPresets(limit: number): BinPreset[]
}
```

### Built-in Preset Definitions

```typescript
// lib/presets/builtInPresets.ts

export const BUILT_IN_PRESETS: Omit<BinPreset, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Standard Organizer",
    description: "General-purpose organizer for small items",
    isBuiltIn: true,
    useCount: 0,
    category: "organizer",
    config: {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 28,
      cutoutDepth: 20,
      wallThickness: 1.2,
      magnetHoles: true,
      screwHoles: false,
      stackingLip: true
    }
  },
  {
    name: "Shallow Tray",
    description: "Low-profile tray for flat items",
    isBuiltIn: true,
    useCount: 0,
    category: "organizer",
    config: {
      gridUnitsX: 3,
      gridUnitsY: 3,
      binHeight: 14,
      cutoutDepth: 10,
      wallThickness: 1.2,
      magnetHoles: false,
      screwHoles: false,
      stackingLip: true
    }
  },
  {
    name: "Deep Storage",
    description: "Maximum height bin for tall items",
    isBuiltIn: true,
    useCount: 0,
    category: "storage",
    config: {
      gridUnitsX: 2,
      gridUnitsY: 2,
      binHeight: 56,
      cutoutDepth: 45,
      wallThickness: 1.5,
      magnetHoles: true,
      screwHoles: true,
      stackingLip: true
    }
  },
  {
    name: "Tool Holder",
    description: "Long bin with reinforced walls for tools",
    isBuiltIn: true,
    useCount: 0,
    category: "tools",
    config: {
      gridUnitsX: 1,
      gridUnitsY: 3,
      binHeight: 42,
      cutoutDepth: 35,
      wallThickness: 2.0,
      magnetHoles: true,
      screwHoles: false,
      stackingLip: true
    }
  },
  {
    name: "Compact Single",
    description: "Minimal single-unit bin",
    isBuiltIn: true,
    useCount: 0,
    category: "organizer",
    config: {
      gridUnitsX: 1,
      gridUnitsY: 1,
      binHeight: 21,
      cutoutDepth: 15,
      wallThickness: 1.2,
      magnetHoles: true,
      screwHoles: false,
      stackingLip: true
    }
  }
];
```

---

## Files to Modify/Create

### New Files

1. **`/types/presets.ts`**
   - TypeScript interfaces for presets
   - Validation result types
   - Export/import schemas

2. **`/lib/presets/presetManager.ts`**
   - Core preset management class
   - localStorage integration
   - CRUD operations and validation

3. **`/lib/presets/builtInPresets.ts`**
   - Default preset definitions
   - Initialization logic

4. **`/lib/presets/storage.ts`**
   - localStorage abstraction layer
   - Quota management
   - Error handling and fallbacks

5. **`/lib/presets/validation.ts`**
   - Preset validation logic
   - Compatibility checking with object dimensions
   - Schema versioning support

6. **`/components/configuration/PresetPicker.tsx`**
   - Preset selection dropdown/dialog
   - Built-in and custom preset display
   - Recent presets section
   - Search/filter functionality

7. **`/components/configuration/PresetSaveDialog.tsx`**
   - Modal for saving new presets
   - Name, description, category inputs
   - Validation and duplicate detection

8. **`/components/configuration/PresetManagementDialog.tsx`**
   - Full preset management interface
   - List view with edit/delete actions
   - Export/import controls
   - Statistics display

9. **`/components/configuration/PresetCard.tsx`**
   - Individual preset display component
   - Shows config summary
   - Quick actions (apply, edit, delete, duplicate)

10. **`/hooks/usePresets.ts`**
    - React hook for preset operations
    - State management for preset list
    - Loading/saving/deleting helpers

### Files to Modify

1. **`/components/configuration/ConfigureStep.tsx`**
   - Add preset picker UI above BinConfigurator
   - Add "Save as Preset" button near "Continue" button
   - Integrate preset loading logic
   - Show warning if loaded preset incompatible with object size

2. **`/components/configuration/BinConfigurator.tsx`**
   - Add optional "presetIndicator" display (show which preset is active)
   - Add "Reset to Defaults" button option

3. **`/types/configuration.ts`**
   - Export BinConfig interface for reuse (if not already exported)

4. **`/contexts/WizardContext.tsx`** (if applicable)
   - Add preset-related state if needed
   - Track currently applied preset

---

## UI/UX Considerations

### Preset Picker Component

**Location:** Top of ConfigureStep, above BinConfigurator card

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Presets                                         [Manage]│
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Select a preset...                          ▼   │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Recently Used:                                          │
│ [Standard Organizer] [Deep Storage] [Custom Tool Bin]   │
└─────────────────────────────────────────────────────────┘
```

**Dropdown Structure:**
- Built-in Presets (grouped, non-deletable)
  - Standard Organizer
  - Shallow Tray
  - Deep Storage
  - Tool Holder
  - Compact Single
- ───────────────
- Custom Presets (alphabetical)
  - My Tool Organizer ⭐ (recently used)
  - Electronics Tray
  - Pliers Holder
- ───────────────
- [+ Create New Preset]
- [📥 Import Presets]

### Save Preset Dialog

```
┌──────────────────────────────────────────┐
│ Save Configuration as Preset        [X]  │
├──────────────────────────────────────────┤
│                                          │
│ Preset Name *                            │
│ ┌────────────────────────────────────┐  │
│ │ My Custom Bin                       │  │
│ └────────────────────────────────────┘  │
│                                          │
│ Description (optional)                   │
│ ┌────────────────────────────────────┐  │
│ │ 2x2 organizer for small tools      │  │
│ │                                    │  │
│ └────────────────────────────────────┘  │
│                                          │
│ Category (optional)                      │
│ ┌────────────────────────────────────┐  │
│ │ tools                          ▼   │  │
│ └────────────────────────────────────┘  │
│                                          │
│ Configuration Summary:                   │
│ • 2x2 grid (84mm × 84mm)                │
│ • Height: 28mm                           │
│ • Cutout: 20mm deep                      │
│ • Magnet holes enabled                   │
│                                          │
│              [Cancel]  [Save Preset]     │
└──────────────────────────────────────────┘
```

### Preset Management Dialog

**Accessible via:** "Manage" button in preset picker section

**Features:**
- Tabbed interface: [My Presets] [Built-in] [Import/Export]
- List view with search/filter
- Bulk export option
- Import with drag-and-drop support
- Usage statistics display

**Preset List Item:**
```
┌─────────────────────────────────────────────────────────┐
│ Standard Organizer                              BUILT-IN│
│ General-purpose organizer for small items               │
│ 2×2 grid • 28mm height • Magnet holes                   │
│ Used 15 times • Last used: 2 hours ago                  │
│                                                          │
│ [Apply] [Duplicate]                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ My Tool Organizer                            ⭐ [✏️] [🗑️]│
│ Custom bin for screwdriver handles                      │
│ 1×3 grid • 42mm height • 2mm walls                      │
│ Used 8 times • Last used: yesterday                     │
│                                                          │
│ [Apply] [Edit] [Duplicate] [Export]                     │
└─────────────────────────────────────────────────────────┘
```

### Integration with ConfigureStep

**Workflow:**

1. **User arrives at Configure step**
   - Preset picker shows at top
   - Default configuration loaded (auto-suggested based on object)
   - Indicator: "Using suggested configuration"

2. **User selects preset**
   - Configuration fields populate immediately
   - Validation runs automatically
   - If incompatible with object dimensions:
     - Warning alert: "This preset's grid size (2×2) is too small for your object (105mm × 78mm). Consider selecting 'Deep Storage' or adjust manually."
     - Allow override or suggest alternatives

3. **User modifies configuration**
   - Indicator changes to: "Modified from: Standard Organizer"
   - "Save as Preset" button becomes available

4. **User saves new preset**
   - Save dialog opens
   - Preset name pre-filled with "Modified Standard Organizer"
   - User customizes and saves
   - New preset immediately available in picker

### Responsive Behavior

- **Desktop:** Preset picker inline above configurator
- **Mobile:** Compact dropdown, management dialog as full-screen modal
- **Touch-friendly:** Large tap targets for preset selection

### Accessibility

- Keyboard navigation through preset list
- Screen reader announcements for preset application
- ARIA labels for all controls
- Focus management in dialogs

---

## Testing Requirements

### Unit Tests

**`lib/presets/presetManager.test.ts`**
- ✓ Save preset creates valid BinPreset object
- ✓ Load preset retrieves correct configuration
- ✓ Delete preset removes from storage
- ✓ Update preset modifies existing entry
- ✓ Duplicate preset creates new copy with unique ID
- ✓ Built-in presets cannot be deleted
- ✓ Import validates JSON schema
- ✓ Export generates valid JSON
- ✓ Invalid preset import returns errors
- ✓ Preset validation catches invalid configurations
- ✓ Object dimension compatibility check works correctly
- ✓ Usage statistics increment correctly
- ✓ localStorage quota exceeded handled gracefully

**`lib/presets/validation.test.ts`**
- ✓ Valid preset passes validation
- ✓ Missing required fields fail validation
- ✓ Invalid data types rejected
- ✓ Out-of-range values caught
- ✓ Object size compatibility warnings generated

### Integration Tests

**`components/configuration/ConfigureStep.test.tsx`**
- ✓ Preset picker renders with built-in presets
- ✓ Selecting preset populates configuration fields
- ✓ Save dialog opens with current config
- ✓ Saved preset appears in picker
- ✓ Warning shown for incompatible preset
- ✓ Modified configuration shows indicator
- ✓ Reset to defaults works correctly

**`hooks/usePresets.test.ts`**
- ✓ Hook returns preset list on mount
- ✓ Save operation updates state
- ✓ Delete operation removes from list
- ✓ Import adds presets to collection
- ✓ Export generates downloadable file

### E2E Tests (Cypress/Playwright)

**User Flows:**
1. ✓ Complete wizard → Configure step → Save preset → Verify in localStorage
2. ✓ Start new wizard → Load saved preset → Configuration applied
3. ✓ Open management dialog → Delete custom preset → Confirm removal
4. ✓ Export preset → Download JSON → Import in new session → Verify loaded
5. ✓ Select incompatible preset → See warning → Override or adjust
6. ✓ Apply built-in preset → Modify → Save as new → Verify custom copy created

### Manual Testing Checklist

- [ ] Built-in presets have sensible default values
- [ ] Preset picker dropdown renders correctly on all viewport sizes
- [ ] Save dialog validation prevents empty names
- [ ] Duplicate preset names get auto-incremented suffix
- [ ] Export generates valid, importable JSON
- [ ] Import handles malformed JSON gracefully
- [ ] localStorage persistence works across page reloads
- [ ] Browser with disabled localStorage shows appropriate message
- [ ] Management dialog shows accurate usage statistics
- [ ] Recently used presets appear in correct order
- [ ] Warning alerts for incompatible presets are clear and actionable

---

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)
**Estimated: 8-12 hours**

1. Create type definitions (`types/presets.ts`)
2. Implement PresetManager with localStorage (`lib/presets/`)
3. Define built-in presets
4. Basic validation logic
5. Unit tests for core functionality

### Phase 2: UI Components
**Estimated: 12-16 hours**

1. Build PresetPicker component
2. Create PresetSaveDialog
3. Implement usePresets hook
4. Integrate into ConfigureStep
5. Add save/load buttons
6. Component tests

### Phase 3: Management & Import/Export
**Estimated: 8-10 hours**

1. Build PresetManagementDialog
2. Implement export/import functionality
3. Add bulk operations
4. File download/upload handling
5. Integration tests

### Phase 4: Polish & Statistics
**Estimated: 4-6 hours**

1. Usage tracking
2. Recently used section
3. Preset search/filter
4. Responsive design refinement
5. Accessibility improvements
6. E2E tests

### Phase 5: Cloud Sync (Future/Optional)
**Estimated: 16-24 hours**

1. Authentication integration
2. Cloud storage setup (Firebase/Supabase)
3. Sync conflict resolution
4. Offline fallback handling
5. Migration from localStorage

---

## Security & Privacy Considerations

- **No Sensitive Data:** Presets contain only configuration numbers and user-provided names
- **localStorage Limits:** Implement size checks to prevent quota exhaustion
- **Input Sanitization:** Validate preset names and descriptions to prevent XSS
- **Import Validation:** Strictly validate imported JSON to prevent code injection
- **Cloud Sync:** If implemented, ensure encrypted transmission and storage
- **User Control:** Easy deletion of all presets for privacy

---

## Documentation Updates

### User Documentation
- Add section to README: "Using Configuration Presets"
- Create tutorial: "Saving and Loading Bin Configurations"
- Update FAQ with preset-related questions

### Developer Documentation
- Document preset schema in `/docs/06-STATE-MANAGEMENT.md`
- Add preset architecture diagram
- Include code examples for preset management

---

## Success Metrics

- **Adoption:** 40%+ of users save at least one custom preset
- **Reuse:** Average 2.5+ preset applications per user session
- **Built-in Usage:** Each built-in preset used by 15%+ of users
- **Export/Import:** 5%+ of users export presets (indicates power users)
- **Support:** No preset-related bug reports within 30 days of launch

---

## Future Enhancements

1. **Preset Sharing**
   - Public preset repository
   - Community-contributed templates
   - QR code sharing for quick preset exchange

2. **Smart Presets**
   - AI-suggested presets based on object detection
   - Auto-categorization of objects → preset recommendations

3. **Preset Collections**
   - Group related presets (e.g., "Tool Organization Set")
   - Batch export/import of collections

4. **Preset Versioning**
   - Track configuration changes over time
   - Rollback to previous versions

5. **Advanced Filtering**
   - Filter by configuration criteria (e.g., "all bins > 40mm height")
   - Saved filters for quick access

---

## References

- Current implementation: `/components/configuration/ConfigureStep.tsx`
- Configuration types: `/types/configuration.ts` and `/types/gridfinity.ts`
- Wizard context: `/contexts/WizardContext.tsx`
- Similar pattern: Browser bookmark systems, VS Code snippet management
- Related ticket: README.md mentions "Custom bin presets" in Planned features

---

## Notes

- This feature is user-facing only; no backend changes required
- localStorage is sufficient for MVP; cloud sync is optional future enhancement
- Focus on discoverability: Users should easily find and understand presets
- Ensure preset application doesn't break existing validation logic
- Consider A/B testing preset picker placement (top vs. sidebar)
