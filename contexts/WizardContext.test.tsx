import { describe, it, expect, beforeEach } from "bun:test";
import type {
  WizardState,
  CalibrationData,
  GridfinityConfig,
  GenerationStatus,
} from "./WizardContext";

// Mock ImageData for testing environment
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

// Use mock in place of ImageData
const ImageData = MockImageData as any;

// Re-create the action types for testing
type WizardAction =
  | { type: "SET_STEP"; payload: number }
  | { type: "COMPLETE_STEP"; payload: number }
  | { type: "SET_IMAGE_DATA"; payload: string | null }
  | { type: "SET_SEGMENTATION_MASK"; payload: ImageData | null }
  | { type: "SET_CALIBRATION"; payload: Partial<CalibrationData> }
  | { type: "SET_SVG_OUTLINE"; payload: string | null }
  | { type: "SET_GRIDFINITY_CONFIG"; payload: Partial<GridfinityConfig> }
  | { type: "SET_GENERATION_STATUS"; payload: GenerationStatus }
  | { type: "SET_GENERATION_ID"; payload: string | null }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

// Re-create the initial state for testing
const initialGridfinityConfig: GridfinityConfig = {
  gridUnitsX: 1,
  gridUnitsY: 1,
  binHeight: 42,
  cutoutDepth: 35,
  wallThickness: 1.2,
  baseThickness: 2.6,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 2,
  paddingRight: 2,
  magnetHoles: true,
  screwHoles: false,
  stackingLip: true,
  cornerRadius: 0.5,
  tolerance: 0.2,
  error: null,
};

const initialState: WizardState = {
  currentStep: 0,
  completedSteps: new Set(),
  imageData: null,
  segmentationMask: null,
  calibration: {
    pixelsPerMm: null,
    unit: "mm",
  },
  svgOutline: null,
  gridfinityConfig: initialGridfinityConfig,
  generationStatus: "idle",
  generationId: null,
  error: null,
};

// Re-create the reducer for testing
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return {
        ...state,
        currentStep: Math.max(0, Math.min(5, action.payload)),
        error: null,
      };

    case "COMPLETE_STEP":
      return {
        ...state,
        completedSteps: new Set([...state.completedSteps, action.payload]),
      };

    case "SET_IMAGE_DATA":
      return {
        ...state,
        imageData: action.payload,
        error: null,
      };

    case "SET_SEGMENTATION_MASK":
      return {
        ...state,
        segmentationMask: action.payload,
        error: null,
      };

    case "SET_CALIBRATION":
      return {
        ...state,
        calibration: {
          ...state.calibration,
          ...action.payload,
        },
        error: null,
      };

    case "SET_SVG_OUTLINE":
      return {
        ...state,
        svgOutline: action.payload,
        error: null,
      };

    case "SET_GRIDFINITY_CONFIG":
      return {
        ...state,
        gridfinityConfig: {
          ...state.gridfinityConfig,
          ...action.payload,
        },
        error: null,
      };

    case "SET_GENERATION_STATUS":
      return {
        ...state,
        generationStatus: action.payload,
        error: action.payload === "error" ? state.error : null,
      };

    case "SET_GENERATION_ID":
      return {
        ...state,
        generationId: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    case "RESET":
      return {
        ...initialState,
        completedSteps: new Set(),
      };

    default:
      return state;
  }
}

describe("WizardContext", () => {
  describe("Initial State", () => {
    it("should have currentStep as 0", () => {
      expect(initialState.currentStep).toBe(0);
    });

    it("should have empty completedSteps Set", () => {
      expect(initialState.completedSteps).toBeInstanceOf(Set);
      expect(initialState.completedSteps.size).toBe(0);
    });

    it("should have null imageData", () => {
      expect(initialState.imageData).toBeNull();
    });

    it("should have null segmentationMask", () => {
      expect(initialState.segmentationMask).toBeNull();
    });

    it("should have correct calibration defaults", () => {
      expect(initialState.calibration).toEqual({
        pixelsPerMm: null,
        unit: "mm",
      });
    });

    it("should have null svgOutline", () => {
      expect(initialState.svgOutline).toBeNull();
    });

    it("should have correct gridfinityConfig defaults", () => {
      expect(initialState.gridfinityConfig).toEqual({
        gridUnitsX: 1,
        gridUnitsY: 1,
        binHeight: 42,
        cutoutDepth: 35,
        wallThickness: 1.2,
        baseThickness: 2.6,
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: 2,
        paddingRight: 2,
        magnetHoles: true,
        screwHoles: false,
        stackingLip: true,
        cornerRadius: 0.5,
        tolerance: 0.2,
        error: null,
      });
    });

    it("should have idle generationStatus", () => {
      expect(initialState.generationStatus).toBe("idle");
    });

    it("should have null generationId", () => {
      expect(initialState.generationId).toBeNull();
    });

    it("should have null error", () => {
      expect(initialState.error).toBeNull();
    });
  });

  describe("wizardReducer", () => {
    let state: WizardState;

    beforeEach(() => {
      state = { ...initialState, completedSteps: new Set() };
    });

    describe("SET_STEP", () => {
      it("should update currentStep with valid value", () => {
        const newState = wizardReducer(state, { type: "SET_STEP", payload: 3 });
        expect(newState.currentStep).toBe(3);
      });

      it("should clamp currentStep to 0 minimum", () => {
        const newState = wizardReducer(state, {
          type: "SET_STEP",
          payload: -5,
        });
        expect(newState.currentStep).toBe(0);
      });

      it("should clamp currentStep to 5 maximum", () => {
        const newState = wizardReducer(state, {
          type: "SET_STEP",
          payload: 10,
        });
        expect(newState.currentStep).toBe(5);
      });

      it("should clear error when setting step", () => {
        const stateWithError = { ...state, error: "Some error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_STEP",
          payload: 2,
        });
        expect(newState.error).toBeNull();
      });

      it("should accept boundary value 0", () => {
        const newState = wizardReducer(state, { type: "SET_STEP", payload: 0 });
        expect(newState.currentStep).toBe(0);
      });

      it("should accept boundary value 5", () => {
        const newState = wizardReducer(state, { type: "SET_STEP", payload: 5 });
        expect(newState.currentStep).toBe(5);
      });
    });

    describe("COMPLETE_STEP", () => {
      it("should add step to completedSteps Set", () => {
        const newState = wizardReducer(state, {
          type: "COMPLETE_STEP",
          payload: 1,
        });
        expect(newState.completedSteps.has(1)).toBe(true);
        expect(newState.completedSteps.size).toBe(1);
      });

      it("should add multiple steps to completedSteps Set", () => {
        let newState = wizardReducer(state, {
          type: "COMPLETE_STEP",
          payload: 1,
        });
        newState = wizardReducer(newState, {
          type: "COMPLETE_STEP",
          payload: 2,
        });
        newState = wizardReducer(newState, {
          type: "COMPLETE_STEP",
          payload: 3,
        });

        expect(newState.completedSteps.has(1)).toBe(true);
        expect(newState.completedSteps.has(2)).toBe(true);
        expect(newState.completedSteps.has(3)).toBe(true);
        expect(newState.completedSteps.size).toBe(3);
      });

      it("should not duplicate steps in completedSteps Set", () => {
        let newState = wizardReducer(state, {
          type: "COMPLETE_STEP",
          payload: 1,
        });
        newState = wizardReducer(newState, {
          type: "COMPLETE_STEP",
          payload: 1,
        });

        expect(newState.completedSteps.size).toBe(1);
        expect(newState.completedSteps.has(1)).toBe(true);
      });

      it("should preserve existing completed steps", () => {
        const stateWithCompleted = {
          ...state,
          completedSteps: new Set([0, 1]),
        };
        const newState = wizardReducer(stateWithCompleted, {
          type: "COMPLETE_STEP",
          payload: 2,
        });

        expect(newState.completedSteps.has(0)).toBe(true);
        expect(newState.completedSteps.has(1)).toBe(true);
        expect(newState.completedSteps.has(2)).toBe(true);
        expect(newState.completedSteps.size).toBe(3);
      });
    });

    describe("SET_IMAGE_DATA", () => {
      it("should update imageData with string value", () => {
        const imageData = "data:image/png;base64,abc123";
        const newState = wizardReducer(state, {
          type: "SET_IMAGE_DATA",
          payload: imageData,
        });
        expect(newState.imageData).toBe(imageData);
      });

      it("should update imageData with null value", () => {
        const stateWithImage = {
          ...state,
          imageData: "data:image/png;base64,abc123",
        };
        const newState = wizardReducer(stateWithImage, {
          type: "SET_IMAGE_DATA",
          payload: null,
        });
        expect(newState.imageData).toBeNull();
      });

      it("should clear error when setting image data", () => {
        const stateWithError = { ...state, error: "Upload error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_IMAGE_DATA",
          payload: "data:image/png;base64,xyz",
        });
        expect(newState.error).toBeNull();
      });
    });

    describe("SET_SEGMENTATION_MASK", () => {
      it("should update segmentationMask with ImageData value", () => {
        const mockImageData = new ImageData(100, 100);
        const newState = wizardReducer(state, {
          type: "SET_SEGMENTATION_MASK",
          payload: mockImageData,
        });
        expect(newState.segmentationMask).toBe(mockImageData);
      });

      it("should update segmentationMask with null value", () => {
        const mockImageData = new ImageData(100, 100);
        const stateWithMask = { ...state, segmentationMask: mockImageData };
        const newState = wizardReducer(stateWithMask, {
          type: "SET_SEGMENTATION_MASK",
          payload: null,
        });
        expect(newState.segmentationMask).toBeNull();
      });

      it("should clear error when setting segmentation mask", () => {
        const stateWithError = { ...state, error: "Segmentation error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_SEGMENTATION_MASK",
          payload: new ImageData(50, 50),
        });
        expect(newState.error).toBeNull();
      });
    });

    describe("SET_CALIBRATION", () => {
      it("should merge partial calibration data (pixelsPerMm)", () => {
        const newState = wizardReducer(state, {
          type: "SET_CALIBRATION",
          payload: { pixelsPerMm: 10.5 },
        });
        expect(newState.calibration.pixelsPerMm).toBe(10.5);
        expect(newState.calibration.unit).toBe("mm"); // preserved
      });

      it("should merge partial calibration data (unit)", () => {
        const newState = wizardReducer(state, {
          type: "SET_CALIBRATION",
          payload: { unit: "in" },
        });
        expect(newState.calibration.unit).toBe("in");
        expect(newState.calibration.pixelsPerMm).toBeNull(); // preserved
      });

      it("should merge both calibration fields", () => {
        const newState = wizardReducer(state, {
          type: "SET_CALIBRATION",
          payload: { pixelsPerMm: 8.2, unit: "cm" },
        });
        expect(newState.calibration).toEqual({
          pixelsPerMm: 8.2,
          unit: "cm",
        });
      });

      it("should preserve existing calibration values when updating one field", () => {
        const stateWithCalibration = {
          ...state,
          calibration: { pixelsPerMm: 5.5, unit: "mm" as const },
        };
        const newState = wizardReducer(stateWithCalibration, {
          type: "SET_CALIBRATION",
          payload: { unit: "in" },
        });
        expect(newState.calibration.pixelsPerMm).toBe(5.5);
        expect(newState.calibration.unit).toBe("in");
      });

      it("should clear error when setting calibration", () => {
        const stateWithError = { ...state, error: "Calibration error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_CALIBRATION",
          payload: { pixelsPerMm: 10 },
        });
        expect(newState.error).toBeNull();
      });
    });

    describe("SET_SVG_OUTLINE", () => {
      it("should update svgOutline with string value", () => {
        const svgData = '<svg><path d="M0,0 L100,100"/></svg>';
        const newState = wizardReducer(state, {
          type: "SET_SVG_OUTLINE",
          payload: svgData,
        });
        expect(newState.svgOutline).toBe(svgData);
      });

      it("should update svgOutline with null value", () => {
        const stateWithSvg = { ...state, svgOutline: "<svg></svg>" };
        const newState = wizardReducer(stateWithSvg, {
          type: "SET_SVG_OUTLINE",
          payload: null,
        });
        expect(newState.svgOutline).toBeNull();
      });

      it("should clear error when setting SVG outline", () => {
        const stateWithError = { ...state, error: "SVG error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_SVG_OUTLINE",
          payload: "<svg></svg>",
        });
        expect(newState.error).toBeNull();
      });
    });

    describe("SET_GRIDFINITY_CONFIG", () => {
      it("should merge single config field", () => {
        const newState = wizardReducer(state, {
          type: "SET_GRIDFINITY_CONFIG",
          payload: { gridUnitsX: 3 },
        });
        expect(newState.gridfinityConfig.gridUnitsX).toBe(3);
        expect(newState.gridfinityConfig.gridUnitsY).toBe(1); // preserved
      });

      it("should merge multiple config fields", () => {
        const newState = wizardReducer(state, {
          type: "SET_GRIDFINITY_CONFIG",
          payload: {
            gridUnitsX: 2,
            gridUnitsY: 3,
            binHeight: 21,
          },
        });
        expect(newState.gridfinityConfig.gridUnitsX).toBe(2);
        expect(newState.gridfinityConfig.gridUnitsY).toBe(3);
        expect(newState.gridfinityConfig.binHeight).toBe(21);
        expect(newState.gridfinityConfig.wallThickness).toBe(1.2); // preserved
      });

      it("should update boolean config fields", () => {
        const newState = wizardReducer(state, {
          type: "SET_GRIDFINITY_CONFIG",
          payload: {
            magnetHoles: false,
            screwHoles: true,
          },
        });
        expect(newState.gridfinityConfig.magnetHoles).toBe(false);
        expect(newState.gridfinityConfig.screwHoles).toBe(true);
      });

      it("should preserve all unmodified config fields", () => {
        const newState = wizardReducer(state, {
          type: "SET_GRIDFINITY_CONFIG",
          payload: { tolerance: 0.5 },
        });
        expect(newState.gridfinityConfig).toEqual({
          ...initialGridfinityConfig,
          tolerance: 0.5,
        });
      });

      it("should clear error when setting gridfinity config", () => {
        const stateWithError = { ...state, error: "Config error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_GRIDFINITY_CONFIG",
          payload: { gridUnitsX: 2 },
        });
        expect(newState.error).toBeNull();
      });
    });

    describe("SET_GENERATION_STATUS", () => {
      it("should update generationStatus to processing", () => {
        const newState = wizardReducer(state, {
          type: "SET_GENERATION_STATUS",
          payload: "processing",
        });
        expect(newState.generationStatus).toBe("processing");
      });

      it("should update generationStatus to complete", () => {
        const newState = wizardReducer(state, {
          type: "SET_GENERATION_STATUS",
          payload: "complete",
        });
        expect(newState.generationStatus).toBe("complete");
      });

      it("should update generationStatus to error and preserve error message", () => {
        const stateWithError = { ...state, error: "Generation failed" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_GENERATION_STATUS",
          payload: "error",
        });
        expect(newState.generationStatus).toBe("error");
        expect(newState.error).toBe("Generation failed");
      });

      it("should clear error when setting non-error status", () => {
        const stateWithError = { ...state, error: "Some error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_GENERATION_STATUS",
          payload: "processing",
        });
        expect(newState.error).toBeNull();
      });

      it("should update generationStatus to idle", () => {
        const stateGenerating = {
          ...state,
          generationStatus: "processing" as const,
        };
        const newState = wizardReducer(stateGenerating, {
          type: "SET_GENERATION_STATUS",
          payload: "idle",
        });
        expect(newState.generationStatus).toBe("idle");
      });
    });

    describe("SET_GENERATION_ID", () => {
      it("should update generationId with string value", () => {
        const id = "gen-12345";
        const newState = wizardReducer(state, {
          type: "SET_GENERATION_ID",
          payload: id,
        });
        expect(newState.generationId).toBe(id);
      });

      it("should update generationId with null value", () => {
        const stateWithId = { ...state, generationId: "gen-12345" };
        const newState = wizardReducer(stateWithId, {
          type: "SET_GENERATION_ID",
          payload: null,
        });
        expect(newState.generationId).toBeNull();
      });

      it("should not affect error state", () => {
        const stateWithError = { ...state, error: "Some error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_GENERATION_ID",
          payload: "gen-67890",
        });
        expect(newState.error).toBe("Some error");
      });
    });

    describe("SET_ERROR", () => {
      it("should update error with string value", () => {
        const errorMsg = "Something went wrong";
        const newState = wizardReducer(state, {
          type: "SET_ERROR",
          payload: errorMsg,
        });
        expect(newState.error).toBe(errorMsg);
      });

      it("should clear error with null value", () => {
        const stateWithError = { ...state, error: "Previous error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_ERROR",
          payload: null,
        });
        expect(newState.error).toBeNull();
      });

      it("should update error message", () => {
        const stateWithError = { ...state, error: "First error" };
        const newState = wizardReducer(stateWithError, {
          type: "SET_ERROR",
          payload: "Second error",
        });
        expect(newState.error).toBe("Second error");
      });
    });

    describe("RESET", () => {
      it("should reset to initial state", () => {
        const modifiedState: WizardState = {
          currentStep: 3,
          completedSteps: new Set([0, 1, 2]),
          imageData: "data:image/png;base64,xyz",
          segmentationMask: new ImageData(100, 100),
          calibration: { pixelsPerMm: 10, unit: "cm" },
          svgOutline: "<svg></svg>",
          gridfinityConfig: {
            ...initialGridfinityConfig,
            gridUnitsX: 5,
            magnetHoles: false,
          },
          generationStatus: "complete",
          generationId: "gen-123",
          error: "Some error",
        };

        const newState = wizardReducer(modifiedState, { type: "RESET" });

        expect(newState.currentStep).toBe(0);
        expect(newState.completedSteps.size).toBe(0);
        expect(newState.imageData).toBeNull();
        expect(newState.segmentationMask).toBeNull();
        expect(newState.calibration).toEqual({ pixelsPerMm: null, unit: "mm" });
        expect(newState.svgOutline).toBeNull();
        expect(newState.gridfinityConfig).toEqual(initialGridfinityConfig);
        expect(newState.generationStatus).toBe("idle");
        expect(newState.generationId).toBeNull();
        expect(newState.error).toBeNull();
      });

      it("should create a new Set for completedSteps", () => {
        const modifiedState = {
          ...state,
          completedSteps: new Set([1, 2, 3]),
        };
        const newState = wizardReducer(modifiedState, { type: "RESET" });

        expect(newState.completedSteps).not.toBe(modifiedState.completedSteps);
        expect(newState.completedSteps).toBeInstanceOf(Set);
        expect(newState.completedSteps.size).toBe(0);
      });
    });

    describe("Edge Cases", () => {
      it("should handle unknown action type by returning current state", () => {
        const unknownAction = { type: "UNKNOWN_ACTION" } as any;
        const newState = wizardReducer(state, unknownAction);
        expect(newState).toBe(state);
      });

      it("should maintain immutability - not mutate original state", () => {
        const originalState = { ...state };
        wizardReducer(state, { type: "SET_STEP", payload: 2 });
        expect(state).toEqual(originalState);
      });

      it("should create new Set instance when completing step", () => {
        const newState = wizardReducer(state, {
          type: "COMPLETE_STEP",
          payload: 1,
        });
        expect(newState.completedSteps).not.toBe(state.completedSteps);
      });

      it("should handle decimal step values without flooring", () => {
        const newState = wizardReducer(state, {
          type: "SET_STEP",
          payload: 2.7,
        });
        expect(newState.currentStep).toBe(2.7);
      });

      it("should handle very large step values", () => {
        const newState = wizardReducer(state, {
          type: "SET_STEP",
          payload: 9999,
        });
        expect(newState.currentStep).toBe(5);
      });

      it("should handle very negative step values", () => {
        const newState = wizardReducer(state, {
          type: "SET_STEP",
          payload: -9999,
        });
        expect(newState.currentStep).toBe(0);
      });
    });

    describe("State Transitions", () => {
      it("should handle typical wizard flow", () => {
        let currentState = state;

        // Step 1: Set image
        currentState = wizardReducer(currentState, {
          type: "SET_IMAGE_DATA",
          payload: "data:image/png;base64,abc",
        });
        currentState = wizardReducer(currentState, {
          type: "COMPLETE_STEP",
          payload: 0,
        });
        currentState = wizardReducer(currentState, {
          type: "SET_STEP",
          payload: 1,
        });

        // Step 2: Set segmentation
        currentState = wizardReducer(currentState, {
          type: "SET_SEGMENTATION_MASK",
          payload: new ImageData(100, 100),
        });
        currentState = wizardReducer(currentState, {
          type: "COMPLETE_STEP",
          payload: 1,
        });
        currentState = wizardReducer(currentState, {
          type: "SET_STEP",
          payload: 2,
        });

        // Step 3: Set calibration
        currentState = wizardReducer(currentState, {
          type: "SET_CALIBRATION",
          payload: { pixelsPerMm: 10, unit: "mm" },
        });
        currentState = wizardReducer(currentState, {
          type: "COMPLETE_STEP",
          payload: 2,
        });

        expect(currentState.currentStep).toBe(2);
        expect(currentState.completedSteps.has(0)).toBe(true);
        expect(currentState.completedSteps.has(1)).toBe(true);
        expect(currentState.completedSteps.has(2)).toBe(true);
        expect(currentState.imageData).toBe("data:image/png;base64,abc");
        expect(currentState.segmentationMask).toBeInstanceOf(ImageData);
        expect(currentState.calibration.pixelsPerMm).toBe(10);
      });

      it("should handle error and recovery flow", () => {
        let currentState = state;

        // Set an error
        currentState = wizardReducer(currentState, {
          type: "SET_ERROR",
          payload: "Upload failed",
        });
        expect(currentState.error).toBe("Upload failed");

        // Setting new data should clear error
        currentState = wizardReducer(currentState, {
          type: "SET_IMAGE_DATA",
          payload: "data:image/png;base64,retry",
        });
        expect(currentState.error).toBeNull();
        expect(currentState.imageData).toBe("data:image/png;base64,retry");
      });
    });
  });
});
