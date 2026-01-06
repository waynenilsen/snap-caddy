'use client';

import { useContext, useMemo, useCallback } from 'react';
import { WizardContext, type WizardContextValue } from '@/contexts/WizardContext';

export interface UseWizardReturn extends WizardContextValue {
  // Convenience computed values
  canProceedToNext: () => boolean;
  canGoBack: boolean;
  progress: number;
  stepName: string;
  isStepCompleted: (step: number) => boolean;

  // Convenience navigation methods
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: number) => void;
}

const STEP_NAMES = [
  'Capture',      // 0
  'Segment',      // 1
  'Calibrate',    // 2
  'Review',       // 3
  'Configure',    // 4
  'Generate',     // 5
];

/**
 * Hook to access and interact with the wizard context
 * Provides convenience methods for navigation and validation
 */
export function useWizard(): UseWizardReturn {
  const context = useContext(WizardContext);

  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }

  const { state } = context;

  // Check if a specific step is completed
  const isStepCompleted = useCallback(
    (step: number): boolean => {
      return state.completedSteps.has(step);
    },
    [state.completedSteps]
  );

  // Check if we can proceed to the next step
  const canProceedToNext = useCallback((): boolean => {
    const { currentStep, imageData, segmentationMask, calibration, svgOutline, gridfinityConfig } = state;

    switch (currentStep) {
      case 0: // Capture -> Segment
        return imageData !== null;

      case 1: // Segment -> Calibrate
        return segmentationMask !== null;

      case 2: // Calibrate -> Review
        return calibration.pixelsPerMm !== null;

      case 3: // Review -> Configure
        return svgOutline !== null;

      case 4: // Configure -> Generate
        return gridfinityConfig.gridUnitsX > 0 && gridfinityConfig.gridUnitsY > 0;

      case 5: // Generate (final step)
        return false;

      default:
        return false;
    }
  }, [state]);

  // Check if we can go back
  const canGoBack = useMemo(() => {
    return state.currentStep > 0;
  }, [state.currentStep]);

  // Calculate overall progress (0-100)
  const progress = useMemo(() => {
    return Math.round(((state.currentStep + 1) / 6) * 100);
  }, [state.currentStep]);

  // Get current step name
  const stepName = useMemo(() => {
    return STEP_NAMES[state.currentStep] || 'Unknown';
  }, [state.currentStep]);

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    if (canProceedToNext()) {
      const nextStep = state.currentStep + 1;

      // Mark current step as completed
      context.completeStep(state.currentStep);

      // Move to next step
      context.setStep(nextStep);
    }
  }, [canProceedToNext, state.currentStep, context]);

  // Navigate to previous step
  const goToPreviousStep = useCallback(() => {
    if (canGoBack) {
      context.setStep(state.currentStep - 1);
    }
  }, [canGoBack, state.currentStep, context]);

  // Navigate to a specific step
  const goToStep = useCallback(
    (step: number) => {
      // Validate step is in range
      if (step < 0 || step > 5) {
        console.warn(`Invalid step: ${step}. Must be between 0 and 5.`);
        return;
      }

      // Check if all required previous steps are completed
      for (let i = 0; i < step; i++) {
        if (!isStepCompleted(i)) {
          console.warn(`Cannot navigate to step ${step}: step ${i} is not completed.`);
          return;
        }
      }

      context.setStep(step);
    },
    [isStepCompleted, context]
  );

  return {
    ...context,
    canProceedToNext,
    canGoBack,
    progress,
    stepName,
    isStepCompleted,
    goToNextStep,
    goToPreviousStep,
    goToStep,
  };
}
