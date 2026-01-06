# Type Consistency Fixes - Summary

## Overview
Fixed type inconsistencies between frontend and backend types across the Snap Caddy codebase. The changes ensure type safety, eliminate duplicate definitions, and establish clear conversion patterns between different type formats.

## Files Modified

### 1. Type Definition Files

#### `/types/gridfinity.ts`
**Changes:**
- Added JSDoc comments explaining `GridfinityConfig` is the API request format
- Documented that `baseThickness` is not currently used by backend
- Added documentation for `BinConfigState` extending `GridfinityConfig` with frontend fields

**Key Points:**
- `GridfinityConfig` - API contract type (matches `schemas/generate.ts`)
- `BinConfigState` - Frontend state type (extends with `tolerance` and `error`)

#### `/types/configuration.ts`
**Changes:**
- Added comprehensive JSDoc explaining this is the BACKEND format
- Documented differences between frontend/API and backend formats:
  - Backend uses `baseType` enum vs frontend boolean flags
  - Backend uses single `cutoutPadding` vs frontend individual padding values
  - Backend uses `lipStyle` enum vs frontend `stackingLip` boolean

**Key Points:**
- `GridfinityBinConfig` - Internal OpenSCAD generator format
- Conversion happens in `app/api/generate/route.ts` via `apiConfigToBinConfig()`

#### `/types/segmentation.ts`
**Changes:**
- Replaced duplicate type definitions with schema re-exports
- `ClickPoint` now uses schema-inferred `Point` type
- `MaskOption` now uses schema-inferred type from `schemas/segment.ts`
- Added JSDoc comments explaining the relationship

**Before:**
```typescript
export interface ClickPoint extends Point {
  label: 0 | 1;
}
export interface MaskOption { /* ... */ }
```

**After:**
```typescript
import type { Point, MaskOption as SchemaMaskOption } from '@/schemas/segment';
export type ClickPoint = Point;
export type MaskOption = SchemaMaskOption;
```

#### `/types/image.ts`
**Changes:**
- `BoundingBox` now re-exports from schema to ensure consistency
- Added JSDoc comments

**Before:**
```typescript
export interface BoundingBox { /* ... */ }
```

**After:**
```typescript
import type { BoundingBox as SchemaBoundingBox } from '@/schemas/segment';
export type BoundingBox = SchemaBoundingBox;
```

#### `/types/api.ts`
**Changes:**
- All API request/response types now re-export from schemas:
  - `SegmentRequest`, `SegmentResponse`, `SegmentErrorResponse`
  - `GenerateRequest`, `GenerateResponse`, `GenerateErrorResponse`
  - `GenerationStatus`, `GenerationStatusResponse`
- Added JSDoc comments explaining schema-first approach
- Added import for `GridfinityConfig` from `types/gridfinity`

**Impact:** Ensures frontend types match validated API contract exactly

### 2. Schema Files

#### `/schemas/generate.ts`
**Changes:**
- Added comprehensive JSDoc explaining:
  - This is the API request format (validated by backend)
  - Differs from backend `GridfinityBinConfig`
  - Conversion happens in `app/api/generate/route.ts`
- Documented the boolean vs enum differences

#### `/schemas/segment.ts`
**Changes:**
- Added JSDoc explaining types are re-exported in `types/segmentation.ts`
- Clarified `PointSchema` is called "ClickPoint" in type exports

### 3. API and Client Files

#### `/lib/api/client.ts`
**Changes:**
- Added `binConfigToApiConfig()` conversion function:
  ```typescript
  function binConfigToApiConfig(config: BinConfigState): GridfinityConfig {
    const { tolerance, error, ...apiConfig } = config;
    return apiConfig;
  }
  ```
- Updated method signatures to accept both `GridfinityConfig` and `BinConfigState`:
  - `generate()` - auto-converts `BinConfigState` to `GridfinityConfig`
  - `getPreview()` - auto-converts `BinConfigState` to `GridfinityConfig`
  - `generateAndDownload()` - accepts both types
- Methods now intelligently detect type using `'tolerance' in config` check

**Impact:** Frontend can pass `BinConfigState` directly; conversion is automatic

#### `/app/api/generate/route.ts`
**Changes:**
- Enhanced JSDoc on `apiConfigToBinConfig()` function documenting:
  - Boolean → enum conversions (`magnetHoles`/`screwHoles` → `baseType`)
  - Boolean → enum conversion (`stackingLip` → `lipStyle`)
  - Individual padding → averaged `cutoutPadding`
  - Sets `cutoutOffsetX`/`Y` to 0 (centered)

**Impact:** Clear documentation of frontend → backend transformation

### 4. Context Files

#### `/contexts/WizardContext.tsx`
**Changes:**
- Updated `GenerationStatus` type to extend API type:
  ```typescript
  // Before
  export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

  // After
  import type { GenerationStatus as APIGenerationStatus } from '@/types/api';
  export type GenerationStatus = 'idle' | APIGenerationStatus;
  // Result: 'idle' | 'queued' | 'processing' | 'complete' | 'error'
  ```
- Replaced inline `GridfinityConfig` definition with import:
  ```typescript
  // Before
  export interface GridfinityConfig { /* ... */ }

  // After
  import type { BinConfigState } from '@/types/gridfinity';
  export type GridfinityConfig = BinConfigState;
  ```
- Added missing fields to `initialGridfinityConfig`:
  - `paddingTop: 2`
  - `paddingBottom: 2`
  - `paddingLeft: 2`
  - `paddingRight: 2`
  - `error: null`

**Impact:** Frontend state now matches API types; no more "generating" vs "processing" mismatch

### 5. Application Files

#### `/app/page.tsx`
**Changes:**
- Fixed polling status check to use correct API statuses:
  ```typescript
  // Before
  enabled: state.generationStatus === "generating"

  // After
  enabled: state.generationStatus === "queued" || state.generationStatus === "processing"
  ```
- Updated initial status when starting generation:
  ```typescript
  // Before
  setGenerationStatus("generating");

  // After
  setGenerationStatus("queued");
  ```
- Enhanced status update from API response:
  ```typescript
  if (response.status === 'queued' || response.status === 'processing') {
    setGenerationStatus(response.status);
  } else if (response.status === 'complete') {
    setGenerationStatus("complete");
  }
  ```

**Impact:** Eliminates TypeScript errors; status flow matches API contract

### 6. Documentation Files

#### `/types/README.md` (NEW)
**Created comprehensive documentation covering:**
1. Type Sources of Truth (schema-first approach)
2. GridfinityConfig Type Hierarchy (Frontend → API → Backend)
3. Type Conversions (with code examples)
4. Generation Status Types
5. Import Guidelines (DO/DON'T examples)
6. File Organization reference
7. Type Safety Checklist
8. Common Patterns
9. Troubleshooting guide

## Type Consistency Improvements

### Eliminated Duplicate Definitions
**Before:** Types defined in multiple places (types/, schemas/, contexts/)
**After:** Single source of truth (schemas/) with re-exports in types/

**Benefits:**
- No type drift between validation and usage
- TypeScript errors catch mismatches immediately
- Easier to maintain and update

### Clear Conversion Layers
**Frontend State → API → Backend:**
```
BinConfigState (WizardContext)
  ↓ binConfigToApiConfig() in lib/api/client.ts
GridfinityConfig (API Request)
  ↓ apiConfigToBinConfig() in app/api/generate/route.ts
GridfinityBinConfig (OpenSCAD Generator)
```

**Benefits:**
- Each layer has clear responsibility
- Conversions are documented and type-safe
- Frontend doesn't need to know about backend format

### Aligned Generation Status
**Before:**
- Frontend: `'idle' | 'generating' | 'complete' | 'error'`
- API: `'queued' | 'processing' | 'complete' | 'error'`

**After:**
- Frontend: `'idle' | 'queued' | 'processing' | 'complete' | 'error'`
- API: `'queued' | 'processing' | 'complete' | 'error'`

**Benefits:**
- Frontend includes all API statuses
- Adds 'idle' for initial state
- No more string literal mismatches

## Testing Recommendations

1. **Type Checking:**
   ```bash
   npx tsc --noEmit
   ```
   Should now show fewer type errors (remaining errors are dependency-related)

2. **API Integration:**
   - Test generate flow: capture → segment → calibrate → review → configure → generate
   - Verify status transitions: idle → queued → processing → complete
   - Check config conversion: verify padding, magnet/screw holes work correctly

3. **Edge Cases:**
   - Test with BinConfigState directly in API calls
   - Test with GridfinityConfig directly in API calls
   - Verify tolerance field is stripped before API request
   - Verify baseType conversion for all combinations:
     - magnetHoles=true, screwHoles=true → 'magnet_screw'
     - magnetHoles=true, screwHoles=false → 'magnet'
     - magnetHoles=false, screwHoles=true → 'screw'
     - magnetHoles=false, screwHoles=false → 'solid'

## Migration Notes

### For Future Development

1. **Adding New API Types:**
   - Create Zod schema first in `schemas/`
   - Infer type with `z.infer<typeof Schema>`
   - Re-export in `types/api.ts`
   - Document in JSDoc

2. **Modifying GridfinityConfig:**
   - Update schema in `schemas/generate.ts`
   - Update conversion in `app/api/generate/route.ts`
   - Update `apiConfigToBinConfig()` if backend format changes
   - Document changes in `types/README.md`

3. **Type Safety:**
   - Always use imports from `types/` not `schemas/` (except in types/ files)
   - Use `BinConfigState` for frontend state
   - Use `GridfinityConfig` for API calls
   - Let conversion functions handle transformations

## Breaking Changes

### For Existing Code

1. **WizardContext.GridfinityConfig**
   - Now includes padding fields (paddingTop/Bottom/Left/Right)
   - Must initialize all fields in initial state
   - Migration: Add padding fields to existing configs

2. **GenerationStatus**
   - "generating" status removed
   - Use "queued" or "processing" instead
   - Migration: Replace all `"generating"` with `"processing"`

3. **Type Imports**
   - Some types moved to schema re-exports
   - Update imports to use `@/types/*` not `@/schemas/*`
   - Migration: Follow TypeScript errors and update imports

## Summary Statistics

- **Files Modified:** 11
- **Files Created:** 2 (README.md, TYPE_FIXES_SUMMARY.md)
- **Duplicate Types Eliminated:** 5 (ClickPoint, MaskOption, BoundingBox, SegmentRequest, GenerateRequest)
- **Conversion Functions Added:** 1 (binConfigToApiConfig)
- **Conversion Functions Documented:** 1 (apiConfigToBinConfig)
- **Status Values Fixed:** 2 locations in app/page.tsx
- **Lines of Documentation Added:** ~400+

## Verification Checklist

- [x] All type definitions reference schemas where applicable
- [x] Conversion functions documented with JSDoc
- [x] WizardContext uses correct types
- [x] API client handles both BinConfigState and GridfinityConfig
- [x] Generation status aligned with API contract
- [x] No duplicate type definitions
- [x] Documentation created (types/README.md)
- [x] Import paths use @/types/* not @/schemas/*
- [x] All padding fields initialized in WizardContext
