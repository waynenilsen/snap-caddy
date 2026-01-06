# Type Architecture

This document explains the type system organization and relationships in Snap Caddy.

## Type Sources of Truth

### Schema-First Types (Recommended)
Types that are validated by Zod schemas should use the schema as the source of truth:

- **Segmentation Types** (`schemas/segment.ts` → `types/segmentation.ts`)
  - `Point` (ClickPoint) - validated by `PointSchema`
  - `MaskOption` - validated by `MaskOptionSchema`
  - `BoundingBox` - validated by `BoundingBoxSchema`

- **API Types** (`schemas/generate.ts`, `schemas/segment.ts` → `types/api.ts`)
  - `SegmentRequest`, `SegmentResponse`, `SegmentErrorResponse`
  - `GenerateRequest`, `GenerateResponse`, `GenerateErrorResponse`
  - `GenerationStatus`, `GenerationStatusResponse`

### Type Re-exports
The `types/` folder re-exports schema-inferred types for consistency:
```typescript
// types/segmentation.ts
import type { Point, MaskOption } from '@/schemas/segment';
export type ClickPoint = Point;
export type { MaskOption };
```

This approach ensures:
- Single source of truth (the schema)
- Type safety matches runtime validation
- No drift between frontend types and API validation

## GridfinityConfig Type Hierarchy

### Frontend → API → Backend Flow

```
Frontend State          API Request           Backend Processing
(WizardContext)    →    (API Route)      →    (OpenSCAD Generator)
───────────────         ───────────           ──────────────────
BinConfigState          GridfinityConfig      GridfinityBinConfig
```

### 1. BinConfigState (Frontend)
**File:** `types/gridfinity.ts`

Used for wizard state management. Extends `GridfinityConfig` with frontend-only fields:
```typescript
interface BinConfigState extends GridfinityConfig {
  tolerance: number;  // Frontend-only field
  error: string | null;  // Frontend-only field
}
```

### 2. GridfinityConfig (API)
**File:** `types/gridfinity.ts`, validated by `schemas/generate.ts`

The API contract format sent from frontend to backend:
```typescript
interface GridfinityConfig {
  gridUnitsX: number;
  gridUnitsY: number;
  binHeight: number;
  cutoutDepth: number;
  wallThickness: number;

  // Individual padding values (frontend-friendly)
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;

  // Boolean flags (frontend-friendly)
  magnetHoles: boolean;
  screwHoles: boolean;
  stackingLip: boolean;

  cornerRadius: number;
  baseThickness: number;  // Note: not currently used by backend
}
```

### 3. GridfinityBinConfig (Backend)
**File:** `types/configuration.ts`

Internal format used by OpenSCAD generator:
```typescript
interface GridfinityBinConfig {
  gridUnitsX: number;
  gridUnitsY: number;
  binHeight: number;
  cutoutDepth: number;
  wallThickness: number;

  // Single padding value (averaged from individual values)
  cutoutPadding: number;
  cutoutOffsetX: number;
  cutoutOffsetY: number;

  // Enum instead of booleans (backend-friendly)
  baseType: 'solid' | 'magnet' | 'screw' | 'magnet_screw';
  lipStyle: 'normal' | 'reduced' | 'none';

  cornerRadius?: number;
  taperAngle?: number;
}
```

### Type Conversions

#### Frontend → API (lib/api/client.ts)
```typescript
function binConfigToApiConfig(config: BinConfigState): GridfinityConfig {
  const { tolerance, error, ...apiConfig } = config;
  return apiConfig;
}
```

Used in API client methods:
```typescript
api.generate({ svg, config: binConfigState })  // Accepts both types
api.getPreview({ svg, config: binConfigState }) // Auto-converts
```

#### API → Backend (app/api/generate/route.ts)
```typescript
function apiConfigToBinConfig(config: GridfinityConfig): GridfinityBinConfig {
  return {
    // ... same fields
    cutoutPadding: (paddingTop + paddingBottom + paddingLeft + paddingRight) / 4,
    cutoutOffsetX: 0,
    cutoutOffsetY: 0,
    baseType: magnetHoles && screwHoles ? 'magnet_screw'
            : magnetHoles ? 'magnet'
            : screwHoles ? 'screw'
            : 'solid',
    lipStyle: stackingLip ? 'normal' : 'none',
    cornerRadius: cornerRadius ?? 0.5,
  };
}
```

## Generation Status Types

### API GenerationStatus
**File:** `schemas/generate.ts` → `types/api.ts`

```typescript
type GenerationStatus = 'queued' | 'processing' | 'complete' | 'error';
```

### Frontend GenerationStatus
**File:** `contexts/WizardContext.tsx`

Extends API status with frontend 'idle' state:
```typescript
type GenerationStatus = 'idle' | 'queued' | 'processing' | 'complete' | 'error';
```

Usage:
- `idle` - Initial state before generation starts
- `queued` - Job submitted to backend queue
- `processing` - Backend actively generating STL
- `complete` - Generation finished successfully
- `error` - Generation failed

## Import Guidelines

### ✅ DO: Use Centralized Exports
```typescript
// Good - use central exports
import type { GridfinityConfig, BinConfigState } from '@/types/gridfinity';
import type { SegmentRequest, SegmentResponse } from '@/types/api';
import type { ClickPoint, MaskOption } from '@/types/segmentation';
```

### ❌ DON'T: Import from Schemas Directly (except in types/)
```typescript
// Avoid - unless you're in types/ folder re-exporting
import type { GridfinityConfig } from '@/schemas/generate';
```

### ✅ DO: Use Schema Types in API Routes
```typescript
// Good - API routes should validate with schemas
import { SegmentRequestSchema } from '@/schemas/segment';
const parseResult = SegmentRequestSchema.safeParse(body);
```

## File Organization

```
types/
├── api.ts              # API request/response types (re-exports from schemas)
├── gridfinity.ts       # GridfinityConfig & BinConfigState
├── configuration.ts    # GridfinityBinConfig (backend format)
├── segmentation.ts     # Segmentation types (re-exports from schemas)
├── calibration.ts      # Calibration types
├── wizard.ts           # Wizard navigation types
├── image.ts            # Basic geometric types
└── index.ts            # Central export for all types

schemas/
├── segment.ts          # Zod schemas for /api/segment
└── generate.ts         # Zod schemas for /api/generate

contexts/
└── WizardContext.tsx   # Uses BinConfigState for frontend state
```

## Type Safety Checklist

When adding new types:

1. ✅ Is this type validated by an API? → Add Zod schema first
2. ✅ Do frontend and backend need different formats? → Create conversion function
3. ✅ Document the conversion in both type files and conversion function
4. ✅ Re-export from schemas in `types/` for consistency
5. ✅ Add JSDoc comments explaining the type's purpose and relationships

## Common Patterns

### API Request/Response Pattern
```typescript
// 1. Define Zod schema
export const MyRequestSchema = z.object({ ... });
export type MyRequest = z.infer<typeof MyRequestSchema>;

// 2. Re-export in types/api.ts
export type { MyRequest } from '@/schemas/my-api';

// 3. Use in API route
const parseResult = MyRequestSchema.safeParse(body);
if (!parseResult.success) { /* error */ }

// 4. Use in client
import type { MyRequest } from '@/types/api';
```

### Frontend State → API Pattern
```typescript
// 1. Define base API type
interface ApiConfig { required: string; }

// 2. Extend for frontend state
interface FrontendConfig extends ApiConfig {
  frontendOnly: string;
}

// 3. Add conversion utility
function toApiConfig(config: FrontendConfig): ApiConfig {
  const { frontendOnly, ...apiConfig } = config;
  return apiConfig;
}

// 4. Use in API client
api.method({ config: toApiConfig(frontendConfig) });
```

## Troubleshooting

### Type mismatch between frontend and API
- Check if schema exists in `schemas/`
- Verify `types/` re-exports schema types
- Look for conversion function in `lib/api/client.ts`

### "Cannot find module" errors
- Ensure import path uses `@/` alias
- Check `types/index.ts` for central exports
- Verify file exists and export is correct

### Validation fails but types match
- Schema validation is stricter (e.g., min/max values)
- Check schema defaults in `schemas/`
- Review Zod schema definition
