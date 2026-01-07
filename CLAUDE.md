# CLAUDE.md - AI Assistant Guide for Snap Caddy

## Project Overview

Snap Caddy automates the creation of custom Gridfinity bin cutouts using AI image segmentation and 3D model generation. Users photograph any object with a ruler for scale, and the application generates a 3D-printable STL file. It reduces a complex 7-step manual Inkscape/OpenSCAD workflow into a simple 6-step wizard interface.

**Repository:** https://github.com/waynenilsen/snap-caddy
**Status:** Work in Progress (WIP) - Active development

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui components |
| Forms | React Hook Form + Zod validation |
| Backend | Next.js API Routes (Node.js) |
| AI/ML | Meta SAM via Replicate API |
| 3D Generation | OpenSCAD CLI + Gridfinity Extended library |
| Testing | Bun test runner, Playwright (E2E) |
| Package Manager | Bun (primary), npm/yarn supported |
| Linting | Biome (formatting + linting) |

## Quick Start (Claude Code Web)

For Claude Code web sessions, run the initialization script first:
```bash
./scripts/initialize.sh
```

This script automatically:
- Installs dependencies (via Bun or npm)
- Starts Redis on port 6397
- Installs git hooks
- Runs TypeScript and lint checks
- Creates required temp directories

## Quick Commands

```bash
# Development
bun install          # Install dependencies
bun dev              # Start dev server (http://localhost:3000)
bun build            # Production build
bun start            # Start production server

# Code Quality
bun lint             # Check code with Biome
bun lint:fix         # Auto-fix lint issues
bun format           # Auto-format code

# Testing
bun test             # Run unit tests
bun test --watch     # Watch mode
bun test --coverage  # Coverage report
bun test:e2e         # Run Playwright E2E tests
bun test:e2e:ui      # Playwright UI mode
bun test:e2e:headed  # Headed browser mode

# Docker
docker compose up -d --build   # Build and run
docker compose logs -f         # View logs
docker compose down            # Stop services
```

## Project Structure

```
snap-caddy/
├── app/                      # Next.js App Router
│   ├── api/                  # API endpoints
│   │   ├── segment/          # SAM segmentation
│   │   ├── generate/         # STL generation
│   │   ├── preview/          # Quick preview
│   │   └── download/[id]/    # File download
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Main wizard page
│   └── globals.css           # Global styles
│
├── components/               # React components
│   ├── ui/                   # shadcn/ui primitives (20+ components)
│   ├── wizard/               # Wizard layout, steps, navigation
│   ├── capture/              # Image capture (camera/upload)
│   ├── segmentation/         # SAM object selection
│   ├── calibration/          # Ruler-based scale calibration
│   ├── editor/               # SVG preview and adjustment
│   ├── configuration/        # Gridfinity bin config
│   └── generation/           # Generation progress/download
│
├── lib/                      # Business logic & utilities
│   ├── openscad/             # OpenSCAD integration
│   │   ├── generator.ts      # SCAD template generation
│   │   ├── executor.ts       # CLI execution
│   │   └── fileManager.ts    # Job/file management
│   ├── sam/                  # SAM integration
│   │   ├── inference.ts      # Replicate API calls
│   │   └── types.ts          # SAM types
│   ├── replicate/            # Replicate API utilities
│   │   ├── recorder.ts       # Record/replay functionality
│   │   └── index.ts          # Module exports
│   ├── api/                  # API utilities
│   │   ├── rateLimit.ts      # Rate limiting middleware
│   │   ├── errors.ts         # Error handling
│   │   └── client.ts         # Fetch wrapper
│   ├── validation/           # Input validation
│   ├── env.ts                # Environment config
│   ├── logger.ts             # Logging utility
│   └── utils.ts              # Helper functions
│
├── hooks/                    # Custom React hooks
│   ├── useWizard.ts          # Wizard state management
│   └── useGenerationPolling.ts  # Poll generation status
│
├── contexts/                 # React Context providers
│   └── WizardContext.tsx     # Global wizard state
│
├── types/                    # TypeScript definitions
│   ├── configuration.ts      # GridfinityBinConfig
│   ├── api.ts                # API types
│   ├── wizard.ts             # Wizard state types
│   └── ...                   # Other domain types
│
├── schemas/                  # Zod validation schemas
│   ├── segment.ts            # SAM request schema
│   ├── generate.ts           # STL generation schema
│   └── calibration.ts        # Calibration schema
│
├── e2e/                      # Playwright E2E tests
├── fixtures/                 # Test fixtures
│   └── replicate/            # Recorded API responses
├── docs/                     # Architecture documentation
├── tickets/                  # Feature implementation tickets
└── scripts/                  # Build/test scripts
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main wizard entry point |
| `contexts/WizardContext.tsx` | Global state management |
| `hooks/useWizard.ts` | Wizard navigation and state |
| `lib/openscad/generator.ts` | SCAD template generation |
| `lib/openscad/executor.ts` | OpenSCAD CLI execution |
| `lib/sam/inference.ts` | SAM API integration |
| `lib/env.ts` | Environment variable config |
| `components/ui/` | shadcn/ui component library |

## Environment Variables

Required:
```bash
REPLICATE_API_TOKEN=xxx      # Get from replicate.com/account/api-tokens
```

Optional (with defaults):
```bash
# Stage/Environment
STAGE=dev                                   # dev, staging, or production

# Replicate API
REPLICATE_BASE_URL=                         # Override Replicate API base URL
REPLICATE_RECORD_MODE=off                   # off, record, or replay

# OpenSCAD
OPENSCAD_PATH=openscad                      # Path to OpenSCAD binary
GRIDFINITY_LIB_PATH=/usr/local/share/gridfinity  # Gridfinity library path
TEMP_DIR=/tmp/snap-caddy                    # Temp file storage
OPENSCAD_TIMEOUT=300000                     # Timeout (5 min)
FILE_RETENTION_MS=3600000                   # File retention (1 hour)
RATE_LIMIT_REQUESTS=10                      # Requests per window
RATE_LIMIT_WINDOW=60000                     # Window duration (1 min)
LOG_LEVEL=info                              # Logging level
```

See `docs/record-replay.md` for detailed documentation on the record/replay system.

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/segment` | SAM segmentation (AI object detection) |
| POST | `/api/generate` | STL file generation |
| GET | `/api/generate?id=...` | Get generation status |
| POST | `/api/preview` | Quick 3D preview |
| GET | `/api/preview/[id]` | Retrieve preview image |
| GET | `/api/download/[id]` | Download STL file |

### Dev-only Endpoints (STAGE=dev)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dev/record-replay/status` | Record/replay configuration |
| GET/DELETE | `/api/dev/record-replay/recordings` | List/clear recordings |
| GET/DELETE | `/api/dev/record-replay/recordings/[hash]` | Get/delete specific recording |

### Hidden Dev Pages

| Path | Purpose |
|------|---------|
| `/dev/record-replay` | UI for managing Replicate API recordings |

## Wizard Flow (6 Steps)

1. **Capture** - Camera or file upload for image input
2. **Segment** - AI object selection using SAM model
3. **Calibrate** - Set scale using ruler reference
4. **Review** - Adjust SVG outline with padding
5. **Configure** - Set Gridfinity bin parameters
6. **Generate** - Create and download STL file

## Pre-commit Workflow

A pre-commit hook is installed automatically when you run `bun install`. The hook runs Biome checks on staged files before each commit.

### Before Staging/Committing

**Always format and lint the entire codebase before staging:**
```bash
bun format           # Auto-format entire codebase
bun lint:fix         # Auto-fix lint issues across codebase
git add .            # Stage changes
git commit -m "..."  # Commit
```

Or use this one-liner:
```bash
bun format && bun lint:fix && git add . && git commit -m "your message"
```

**Important:** Run format and lint on the entire codebase, not just the files you modified. This ensures consistent formatting and catches any issues that may have been introduced elsewhere.

### Manual Hook Installation

If the hook wasn't installed automatically:
```bash
./scripts/install-hooks.sh
```

### Bypassing the Hook (Emergency Only)

In rare cases where you need to bypass the pre-commit check:
```bash
git commit --no-verify -m "your message"
```

**Note:** This should only be used in emergencies. Always fix lint issues before pushing.

## Feature Branch Workflow

Feature branches must maintain a **single commit** throughout development. This keeps git history clean and makes rebasing much easier.

### Always Amend on Feature Branches

When working on a feature branch, always use `git commit --amend` to update your existing commit rather than creating new commits:

```bash
# After making changes
bun format && bun lint:fix
git add .
git commit --amend
```

### Why Single Commits?

- **Cleaner git history** - Main branch shows one commit per feature/fix
- **Easier rebasing** - Single commits rebase cleanly without conflicts between your own commits
- **Better reviews** - Reviewers see the complete change, not incremental WIP states
- **Simpler squashing** - No need to squash multiple commits before merging

### Commit Message Quality

Since your feature branch has only one commit, make it count:
- Follow the [Conventional Commits](docs/conventional-commits.md) specification
- Write a clear, descriptive message that explains the "why"
- Update the message with `--amend` as the feature evolves

```bash
# Update commit message as you refine the feature
git commit --amend -m "$(cat <<'EOF'
feat(wizard): add step validation with error recovery

Implement validation checks between wizard steps to prevent
users from proceeding with invalid data. Includes automatic
error recovery suggestions.
EOF
)"
```

### Important Notes

- **First commit**: Use regular `git commit` for your initial commit
- **Subsequent changes**: Always use `git commit --amend`
- **Force push required**: After amending, you'll need `git push --force` to update the remote branch
- **Never amend shared commits**: Only amend commits on your own feature branches

## Code Patterns & Conventions

### Component Structure
- Use shadcn/ui components from `components/ui/`
- Custom components follow pattern: `components/{feature}/{ComponentName}.tsx`
- Export component + props type from each file

### State Management
- Global wizard state via `WizardContext`
- Use `useWizard()` hook for state access
- Each step manages its local state, commits to global on completion

### API Routes
- Located in `app/api/{endpoint}/route.ts`
- Use Zod schemas from `schemas/` for validation
- Apply rate limiting via `lib/api/rateLimit.ts`
- Return consistent error responses via `lib/api/errors.ts`

### Validation
- All schemas in `schemas/` directory
- Use Zod for runtime validation
- Schemas used in both API and client-side

### Testing
- **All new code must have test coverage** - No exceptions
- Unit tests: `*.test.ts` files alongside source
- E2E tests: `e2e/*.e2e.ts` files
- Use `describe`/`it` pattern with Bun test runner
- Mock external services (Replicate API, OpenSCAD)
- Run `bun test --coverage` to verify coverage before committing

### Styling
- Tailwind CSS with shadcn/ui design tokens
- Use `cn()` utility from `lib/utils.ts` for class merging
- CSS variables defined in `globals.css`

## Common Development Tasks

### Adding a new shadcn/ui component
```bash
bunx shadcn@latest add <component-name>
```

### Creating a new API endpoint
1. Create `app/api/{name}/route.ts`
2. Add Zod schema in `schemas/{name}.ts`
3. Apply rate limiting middleware
4. Add types to `types/api.ts`

### Adding a wizard step component
1. Create component in `components/{feature}/`
2. Update step configuration in `components/wizard/`
3. Add step state to `types/wizard.ts` if needed
4. Update `WizardContext` for new state fields

### Running specific tests
```bash
bun test lib/openscad          # Tests in specific directory
bun test inference.test.ts     # Specific test file
bun test --grep "pattern"      # Tests matching pattern
```

## Architecture Notes

### OpenSCAD Integration
- Uses Gridfinity Extended library for bin generation
- Templates generated dynamically based on user config
- Executes OpenSCAD CLI with xvfb for headless rendering
- Files cleaned up after retention period (1 hour default)

### SAM Integration
- Uses Replicate API for inference (cloud-based)
- Supports point prompts (positive/negative clicks)
- Returns segmentation mask as base64 image
- Future: ONNX-based client-side inference

### File Management
- Jobs tracked by UUID in memory (production: use Redis)
- Files stored in `TEMP_DIR` organized by job ID
- Automatic cleanup via `FileManager.cleanupOldFiles()`

## Documentation References

Detailed architecture docs in `/docs`:
- `00-MASTER-ARCHITECTURE.md` - System overview
- `01-FRONTEND-UI.md` - UI component specs
- `02-IMAGE-PROCESSING.md` - Canvas & contour detection
- `03-SAM-INTEGRATION.md` - SAM setup & inference
- `04-OPENSCAD-GENERATION.md` - STL generation
- `05-API-ARCHITECTURE.md` - Backend design
- `06-STATE-MANAGEMENT.md` - React state flow
- `conventional-commits.md` - Commit message conventions

Feature tickets in `/tickets`:
- Implementation specs for planned features
- Technical requirements and acceptance criteria

### Ticket Workflow

Tickets follow a simple lifecycle:

1. **Open tickets** live in `/tickets/` root directory
2. **When completing a ticket:**
   - Update the ticket's `**Status:**` field to `Done`
   - Move the ticket file to `/tickets/done/`
   - Reference the ticket number in your commit message (e.g., "Implement feature X (ticket #0001)")
3. **Completed tickets** are archived in `/tickets/done/` for reference

```
tickets/
├── 0004-auto-scale-detection.md      # Open - pending work
├── 0005-onnx-sam-offline.md          # Open - pending work
├── ...
└── done/
    ├── 0001-mask-to-svg-pipeline.md  # Completed
    ├── 0002-async-job-queue.md       # Completed
    └── 0003-threejs-stl-preview.md   # Completed
```

## Debugging Tips

### OpenSCAD Issues
- Check `OPENSCAD_PATH` points to valid binary
- Ensure Gridfinity library is installed at `GRIDFINITY_LIB_PATH`
- Review logs for template generation errors
- Check xvfb is available for headless rendering

### SAM API Issues
- Verify `REPLICATE_API_TOKEN` is set and valid
- Check rate limits (10 req/min default)
- Review inference.ts for API response handling

### Build/Type Errors
- Run `bun lint` to check for issues
- Check `tsconfig.json` for strict mode settings
- Review `TYPE_FIXES_SUMMARY.md` for common fixes

## Security Considerations

- UUID validation on all job IDs
- SVG sanitization before processing
- Rate limiting on all API endpoints
- No secrets in client-side code
- Input validation via Zod schemas
