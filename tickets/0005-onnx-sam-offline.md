# Ticket 0005: Client-Side SAM Inference via ONNX for Offline Capability

## Priority
**Medium**

## Status
Open

## Summary
The application currently requires constant internet connectivity for SAM (Segment Anything Model) inference, as it relies exclusively on the Replicate API. This creates a poor user experience in low-connectivity environments and incurs ongoing API costs for every segmentation request. Implementing client-side ONNX inference will enable offline functionality, reduce server costs, and improve privacy by processing images locally.

## Current State
- SAM integration located at `/home/user/snap-caddy/lib/sam/` uses only Replicate API (Option B from architecture)
- Implementation in `inference.ts` makes synchronous API calls with polling (2-10 second latency)
- No offline capability - application is unusable without internet connection
- Every segmentation incurs Replicate API costs
- All images are uploaded to external service (privacy concern)

## Proposed Solution
Implement client-side ONNX Runtime Web inference (Option A from architecture document) with intelligent fallback to Replicate API when necessary.

## Acceptance Criteria

### Functional Requirements
- [ ] SAM inference runs entirely in the browser using ONNX Runtime Web
- [ ] Model downloads and caches automatically on first use
- [ ] Application works offline after initial model download
- [ ] Automatic fallback to Replicate API when:
  - ONNX model fails to load
  - Browser doesn't support required features (WebAssembly, WebGL)
  - Inference errors occur
  - User explicitly selects API mode in settings
- [ ] User preference persists for inference method (client-side vs. API)
- [ ] Progress indication during model download (with size and percentage)
- [ ] Cache management UI to clear downloaded models

### Non-Functional Requirements
- [ ] Client-side inference completes in <5 seconds on modern hardware
- [ ] Model size is <100MB (using quantized model)
- [ ] Memory usage stays under 512MB during inference
- [ ] No UI blocking during inference (WebWorker implementation)
- [ ] Graceful degradation on low-end devices
- [ ] Clear error messages for unsupported browsers/devices

## Technical Approach

### 1. Model Selection and Quantization
- Use **SAM 2 Tiny** or **SAM vit-b** quantized to INT8/UINT8
- Target model size: 40-80MB (vs. 300MB+ for full SAM)
- ONNX models available from:
  - HuggingFace: `facebook/sam-vit-base`
  - ONNX Model Zoo: `segment-anything`
  - Or convert from PyTorch using `torch.onnx.export()`

### 2. Architecture Components

#### 2.1 ONNX Inference Engine (`lib/sam/onnx/`)
```
lib/sam/onnx/
├── worker.ts              # WebWorker for background inference
├── engine.ts              # ONNX Runtime session management
├── preprocess.ts          # Image preprocessing for SAM
├── postprocess.ts         # Mask postprocessing
├── model-loader.ts        # Download and cache ONNX model
└── types.ts               # ONNX-specific types
```

#### 2.2 Unified SAM Interface (`lib/sam/index.ts`)
```typescript
export async function runSAMSegmentation(
  params: SAMSegmentationParams,
  options?: {
    preferredMethod?: 'onnx' | 'api' | 'auto';
    onProgress?: (progress: number) => void;
  }
): Promise<SAMResult>
```

#### 2.3 Model Management Service
- IndexedDB for ONNX model storage
- Cache versioning (invalidate on model updates)
- Background download with progress tracking
- Integrity verification (checksum validation)

### 3. Implementation Phases

#### Phase 1: ONNX Infrastructure (Week 1)
1. Install dependencies: `onnxruntime-web`
2. Create WebWorker scaffolding
3. Implement model download and caching
4. Add browser capability detection

#### Phase 2: Inference Pipeline (Week 2)
1. Implement image preprocessing (resize, normalize, tensor conversion)
2. Set up ONNX Runtime session with WebAssembly backend
3. Integrate SAM encoder and decoder
4. Implement postprocessing (mask extraction, RLE encoding)

#### Phase 3: Integration (Week 3)
1. Refactor existing SAM interface for dual-mode support
2. Add fallback logic with error handling
3. Implement user preference storage
4. Add progress UI for model download

#### Phase 4: Optimization & Testing (Week 4)
1. Performance profiling and optimization
2. Memory leak detection and fixes
3. Cross-browser testing (Chrome, Firefox, Safari, Edge)
4. Mobile device testing
5. Offline functionality testing

## Files to Modify

### New Files
```
lib/sam/onnx/
├── worker.ts                    # WebWorker entry point
├── engine.ts                    # ONNX session manager
├── model-loader.ts              # Model download/cache
├── preprocess.ts                # Image → tensor
├── postprocess.ts               # Tensor → mask
└── types.ts                     # Type definitions

components/segmentation/
└── ModelDownloadProgress.tsx    # Download UI

lib/storage/
└── indexed-db.ts                # IndexedDB wrapper

hooks/
└── useONNXInference.ts          # React hook for ONNX
```

### Modified Files
```
lib/sam/
├── index.ts                     # Add ONNX path, fallback logic
├── inference.ts                 # Refactor as API-only variant
└── types.ts                     # Add ONNX-specific types

app/api/segment/route.ts         # Add ONNX health check endpoint

contexts/
└── SegmentationContext.tsx      # Add inference method state

components/segmentation/
├── ClickToSegment.tsx           # Add method selection UI
└── SegmentationControls.tsx     # Add settings for ONNX/API
```

## Dependencies

### NPM Packages
```json
{
  "dependencies": {
    "onnxruntime-web": "^1.19.0",        // Core ONNX runtime
    "idb": "^8.0.0"                      // IndexedDB wrapper (optional)
  }
}
```

### External Resources
- **ONNX Model**: SAM vit-b quantized (~50MB)
  - Hosted on CDN or self-hosted in `/public/models/`
  - URL: TBD based on model source
- **WebAssembly Backend**: Included in onnxruntime-web
- **WebGL Backend**: Fallback for better performance (if available)

## Configuration

### Environment Variables
```bash
# Existing
REPLICATE_API_TOKEN=r8_xxx           # Fallback API
SAM_MODEL_VERSION=meta/sam-2-hiera-large

# New
NEXT_PUBLIC_SAM_ONNX_MODEL_URL=https://cdn.example.com/sam-vit-b-uint8.onnx
NEXT_PUBLIC_SAM_ONNX_ENABLED=true    # Feature flag
NEXT_PUBLIC_SAM_DEFAULT_METHOD=auto  # auto|onnx|api
```

### Browser Requirements
- **Minimum**: Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- **WebAssembly**: Required for ONNX Runtime
- **WebGL**: Optional but recommended for GPU acceleration
- **IndexedDB**: Required for model caching
- **Web Workers**: Required for non-blocking inference

## Testing Requirements

### Unit Tests
- [ ] Model download and caching logic
- [ ] Image preprocessing (resizing, normalization)
- [ ] Mask postprocessing (binary threshold, RLE encoding)
- [ ] Fallback behavior when ONNX unavailable
- [ ] IndexedDB operations (store, retrieve, delete)

### Integration Tests
- [ ] End-to-end segmentation with ONNX
- [ ] Fallback from ONNX to API on error
- [ ] Model caching across page reloads
- [ ] WebWorker communication
- [ ] Memory cleanup after inference

### Manual Testing Scenarios
1. **First-time user**: Model downloads automatically, shows progress
2. **Offline mode**: Segmentation works without internet (after initial download)
3. **Browser support**: Graceful degradation on unsupported browsers
4. **Model corruption**: Re-downloads if integrity check fails
5. **Low memory**: Falls back to API if ONNX OOMs
6. **Model cache clear**: User can delete cached model to free space
7. **Preference persistence**: Selected method (ONNX/API) persists across sessions

### Performance Benchmarks
- [ ] **Model load time**: <3 seconds on 10 Mbps connection
- [ ] **Inference time**: <5 seconds for 1024x1024 image on mid-range device
- [ ] **Memory usage**: <512MB peak during inference
- [ ] **Cache size**: <100MB for model storage
- [ ] **API comparison**: ONNX should be comparable or faster than API (excluding network time)

## Performance Considerations

### Model Size
- **Full SAM**: ~300MB (too large for web)
- **Quantized SAM vit-b**: ~50MB ✅
- **SAM 2 Tiny**: ~30-40MB ✅ (best option)
- **Target**: <80MB total download

### Inference Time
| Device Type | Target Time | Expected Time |
|-------------|-------------|---------------|
| Desktop (GPU) | <2s | 1-2s |
| Desktop (CPU) | <5s | 3-5s |
| Mobile (High-end) | <8s | 5-10s |
| Mobile (Low-end) | <15s or fallback | 10-20s |

### Memory Footprint
- **Model in memory**: 50-80MB
- **Input tensor**: ~12MB (1024x1024 RGB)
- **Output masks**: ~1-4MB
- **Peak usage**: ~200-300MB ✅ (acceptable)
- **Cleanup**: Immediate tensor disposal after inference

### Optimization Strategies
1. **WebGL backend**: Use GPU when available (3-5x faster)
2. **Model quantization**: INT8/UINT8 reduces size and improves speed
3. **Image downscaling**: Resize large images to 1024x1024 max
4. **Worker threads**: Prevent UI blocking
5. **Lazy loading**: Only load ONNX runtime when needed
6. **Progressive caching**: Stream model download, start inference ASAP
7. **Tensor reuse**: Reuse buffers to reduce GC pressure

## User Experience Improvements

### Download Experience
- Non-blocking download with cancel option
- "Download model for offline use?" prompt on first use
- Background download while user continues workflow
- Progress bar with MB downloaded / total MB
- Option to defer download and use API mode

### Settings Panel
```
Segmentation Method:
○ Automatic (ONNX when available, fallback to API)
○ Client-side (ONNX only, faster & private)
○ Server API (Replicate, slower but works everywhere)

Model Cache:
- SAM vit-b Quantized (52.3 MB) - [Delete]
- Last updated: 2025-01-06

[Clear All Models]
```

### Error Handling
- "Downloading model... 45% (23 MB / 51 MB)"
- "Model download failed. Using server API instead."
- "Your browser doesn't support client-side inference. Using server API."
- "Inference failed. Retrying with server API..."

## Security & Privacy

### Privacy Benefits
- **No external uploads**: Images processed entirely locally
- **No API logs**: User data never leaves device
- **Offline capability**: Works without network access

### Security Considerations
- **Model integrity**: Verify checksum before loading
- **CORS headers**: Ensure model URL allows cross-origin fetch
- **CSP policy**: Update Content Security Policy for WASM
- **Size limits**: Prevent malicious large file downloads

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Browser compatibility issues | High | Medium | Feature detection + API fallback |
| Model too slow on mobile | Medium | High | Device detection + auto-fallback |
| Model download failure | Medium | Low | Retry logic + API fallback |
| Memory overflow on low-end devices | High | Medium | Memory check before ONNX load |
| ONNX runtime bugs | Medium | Low | Comprehensive error handling + API fallback |
| Model accuracy lower than API | Medium | Medium | A/B testing, allow API override |

## Success Metrics

### Primary Metrics
- **Offline usage rate**: >30% of sessions use offline mode
- **API cost reduction**: >50% reduction in Replicate API calls
- **User retention**: Improved retention in low-connectivity regions
- **Performance**: 80% of users see <5s inference time

### Secondary Metrics
- **Model adoption**: >70% of users download ONNX model
- **Cache hit rate**: >95% of returning users use cached model
- **Fallback rate**: <10% of inference attempts fall back to API
- **Error rate**: <2% of ONNX inferences fail

## Related Tickets
- #0001: Replicate API integration (completed)
- #0006: Hybrid inference (Option C) - future enhancement
- #0007: PWA offline support - synergy opportunity

## References

### Documentation
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- SAM ONNX Export: https://github.com/facebookresearch/segment-anything
- WebWorker API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

### Similar Implementations
- TensorFlow.js SAM: https://github.com/tensorflow/tfjs-models
- ONNX.js Examples: https://github.com/microsoft/onnxjs-demo
- Web-based Image Segmentation: https://github.com/xenova/transformers.js

### Model Sources
- HuggingFace ONNX Models: https://huggingface.co/models?library=onnx
- ONNX Model Zoo: https://github.com/onnx/models
- SAM Quantization Guide: https://pytorch.org/docs/stable/quantization.html

## Notes
- This ticket implements **Option A** from `/home/user/snap-caddy/docs/00-MASTER-ARCHITECTURE.md`
- Consider **Option C (Hybrid)** in future: client-side encoder, server-side decoder for best balance
- Monitor ONNX Runtime Web releases for performance improvements
- Quantized models may have slightly lower accuracy - validate with user testing
- Consider progressive web app (PWA) integration for better offline experience
