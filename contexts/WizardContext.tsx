"use client";

import { createContext, type ReactNode, useCallback, useReducer } from "react";
import type { GenerationStatus as APIGenerationStatus } from "@/types/api";
import type { BinConfigState } from "@/types/gridfinity";
import type { MaskData } from "@/types/segmentation";

// Types
/**
 * GenerationStatus - extended API status with frontend 'idle' state
 * API uses: 'queued' | 'processing' | 'complete' | 'error'
 * Frontend adds: 'idle' for initial state
 */
export type GenerationStatus = "idle" | APIGenerationStatus;

export interface CalibrationData {
  pixelsPerMm: number | null;
  unit: "mm" | "cm" | "in";
}

/**
 * GridfinityConfig extended with tolerance for frontend state management
 * This is the full config used in the wizard, including frontend-only fields like tolerance
 */
export type GridfinityConfig = BinConfigState;

export interface WizardState {
  currentStep: number; // 0-5 (capture, segment, calibrate, review, configure, generate)
  completedSteps: Set<number>;
  imageData: string | null;
  /** Selected masks from SAM 2 segmentation */
  selectedMasks: MaskData[];
  /** Combined mask from selected masks (for downstream processing) */
  segmentationMask: ImageData | null;
  calibration: CalibrationData;
  svgOutline: string | null;
  gridfinityConfig: GridfinityConfig;
  generationStatus: GenerationStatus;
  generationId: string | null;
  error: string | null;
}

type WizardAction =
  | { type: "SET_STEP"; payload: number }
  | { type: "COMPLETE_STEP"; payload: number }
  | { type: "SET_IMAGE_DATA"; payload: string | null }
  | { type: "SET_SELECTED_MASKS"; payload: MaskData[] }
  | { type: "SET_SEGMENTATION_MASK"; payload: ImageData | null }
  | { type: "SET_CALIBRATION"; payload: Partial<CalibrationData> }
  | { type: "SET_SVG_OUTLINE"; payload: string | null }
  | { type: "SET_GRIDFINITY_CONFIG"; payload: Partial<GridfinityConfig> }
  | { type: "SET_GENERATION_STATUS"; payload: GenerationStatus }
  | { type: "SET_GENERATION_ID"; payload: string | null }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

export interface WizardContextValue {
  state: WizardState;
  setStep: (step: number) => void;
  completeStep: (step: number) => void;
  setImageData: (data: string | null) => void;
  setSelectedMasks: (masks: MaskData[]) => void;
  setSegmentationMask: (mask: ImageData | null) => void;
  setCalibration: (calibration: Partial<CalibrationData>) => void;
  setSvgOutline: (svg: string | null) => void;
  setGridfinityConfig: (config: Partial<GridfinityConfig>) => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Initial state
const initialGridfinityConfig: GridfinityConfig = {
  gridUnitsX: 1,
  gridUnitsY: 1,
  binHeight: 42, // Standard Gridfinity height unit
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
  selectedMasks: [],
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

// Reducer
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

    case "SET_SELECTED_MASKS":
      return {
        ...state,
        selectedMasks: action.payload,
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
        completedSteps: new Set(), // Reset the Set
        selectedMasks: [], // Reset the selected masks array
      };

    default:
      return state;
  }
}

// Context
export const WizardContext = createContext<WizardContextValue | null>(null);

// Provider
export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const setStep = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const completeStep = useCallback((step: number) => {
    dispatch({ type: "COMPLETE_STEP", payload: step });
  }, []);

  const setImageData = useCallback((data: string | null) => {
    dispatch({ type: "SET_IMAGE_DATA", payload: data });
  }, []);

  const setSelectedMasks = useCallback((masks: MaskData[]) => {
    dispatch({ type: "SET_SELECTED_MASKS", payload: masks });
  }, []);

  const setSegmentationMask = useCallback((mask: ImageData | null) => {
    dispatch({ type: "SET_SEGMENTATION_MASK", payload: mask });
  }, []);

  const setCalibration = useCallback(
    (calibration: Partial<CalibrationData>) => {
      dispatch({ type: "SET_CALIBRATION", payload: calibration });
    },
    [],
  );

  const setSvgOutline = useCallback((svg: string | null) => {
    dispatch({ type: "SET_SVG_OUTLINE", payload: svg });
  }, []);

  const setGridfinityConfig = useCallback(
    (config: Partial<GridfinityConfig>) => {
      dispatch({ type: "SET_GRIDFINITY_CONFIG", payload: config });
    },
    [],
  );

  const setGenerationStatus = useCallback((status: GenerationStatus) => {
    dispatch({ type: "SET_GENERATION_STATUS", payload: status });
  }, []);

  const setGenerationId = useCallback((id: string | null) => {
    dispatch({ type: "SET_GENERATION_ID", payload: id });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const value: WizardContextValue = {
    state,
    setStep,
    completeStep,
    setImageData,
    setSelectedMasks,
    setSegmentationMask,
    setCalibration,
    setSvgOutline,
    setGridfinityConfig,
    setGenerationStatus,
    setGenerationId,
    setError,
    reset,
  };

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}
