/**
 * Wizard navigation and step types
 */

/**
 * Available wizard steps
 */
export type Step =
  | "capture" // Image capture (camera/upload)
  | "paint" // Paint shape (paintbrush tool)
  | "calibrate" // Scale calibration (ruler measurement)
  | "review" // Outline review (SVG preview)
  | "configure" // Bin configuration (Gridfinity params)
  | "generate"; // Generate & download (STL creation)

/**
 * Step metadata for UI display
 */
export interface StepMetadata {
  id: Step;
  title: string;
  description: string;
  icon: string;
  requiresCompletion: Step[]; // Steps that must be completed first
}

/**
 * Navigation state
 */
export interface NavigationState {
  currentStep: Step;
  completedSteps: Set<Step>;
  canProceed: boolean;
  canGoBack: boolean;
  stepHistory: Step[]; // For back navigation
}

/**
 * Wizard state (combines all step states)
 */
export interface WizardState {
  navigation: NavigationState;
  currentStepIndex: number;
  totalSteps: number;
  progress: number; // 0-100
}

/**
 * Step order for validation
 */
export const STEP_ORDER: Step[] = [
  "capture",
  "paint",
  "calibrate",
  "review",
  "configure",
  "generate",
];

/**
 * Step metadata for UI
 */
export const STEP_METADATA: Record<Step, StepMetadata> = {
  capture: {
    id: "capture",
    title: "Capture Image",
    description: "Take a photo or upload an image",
    icon: "camera",
    requiresCompletion: [],
  },
  paint: {
    id: "paint",
    title: "Paint Shape",
    description: "Paint the shape you want",
    icon: "paintbrush",
    requiresCompletion: ["capture"],
  },
  calibrate: {
    id: "calibrate",
    title: "Set Scale",
    description: "Calibrate using a ruler",
    icon: "ruler",
    requiresCompletion: ["capture", "paint"],
  },
  review: {
    id: "review",
    title: "Review Outline",
    description: "Preview and adjust the SVG",
    icon: "eye",
    requiresCompletion: ["capture", "paint", "calibrate"],
  },
  configure: {
    id: "configure",
    title: "Configure Bin",
    description: "Set Gridfinity parameters",
    icon: "settings",
    requiresCompletion: ["capture", "paint", "calibrate", "review"],
  },
  generate: {
    id: "generate",
    title: "Generate STL",
    description: "Create and download 3D model",
    icon: "download",
    requiresCompletion: [
      "capture",
      "paint",
      "calibrate",
      "review",
      "configure",
    ],
  },
};

/**
 * Get step index by ID
 */
export function getStepIndex(step: Step): number {
  return STEP_ORDER.indexOf(step);
}

/**
 * Get next step
 */
export function getNextStep(currentStep: Step): Step | null {
  const currentIndex = getStepIndex(currentStep);
  if (currentIndex < 0 || currentIndex >= STEP_ORDER.length - 1) {
    return null;
  }
  return STEP_ORDER[currentIndex + 1];
}

/**
 * Get previous step
 */
export function getPreviousStep(currentStep: Step): Step | null {
  const currentIndex = getStepIndex(currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  return STEP_ORDER[currentIndex - 1];
}
