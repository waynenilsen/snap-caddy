import React from "react";
import { cn } from "@/lib/utils";
import {
  Camera,
  MousePointer,
  Ruler,
  Eye,
  Settings,
  Download,
  Check,
} from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  completedSteps?: number[];
  onStepClick?: (step: number) => void;
}

const STEPS = [
  {
    id: 1,
    title: "Capture",
    shortTitle: "Capture",
    description: "Upload or capture image",
    icon: Camera,
  },
  {
    id: 2,
    title: "Select",
    shortTitle: "Select",
    description: "Select your object",
    icon: MousePointer,
  },
  {
    id: 3,
    title: "Calibrate",
    shortTitle: "Calibrate",
    description: "Set scale with ruler",
    icon: Ruler,
  },
  {
    id: 4,
    title: "Review",
    shortTitle: "Review",
    description: "Review outline",
    icon: Eye,
  },
  {
    id: 5,
    title: "Configure",
    shortTitle: "Configure",
    description: "Configure bin",
    icon: Settings,
  },
  {
    id: 6,
    title: "Generate",
    shortTitle: "Generate",
    description: "Generate STL",
    icon: Download,
  },
] as const;

export function StepIndicator({
  currentStep,
  completedSteps = [],
  onStepClick,
}: StepIndicatorProps) {
  const handleStepClick = (stepId: number) => {
    // Only allow clicking on completed steps or current step (to go back)
    if (completedSteps.includes(stepId) || stepId === currentStep) {
      onStepClick?.(stepId);
    }
  };

  const isStepClickable = (stepId: number) => {
    return completedSteps.includes(stepId) && stepId < currentStep;
  };

  const getStepStatus = (
    stepId: number,
  ): "complete" | "current" | "upcoming" => {
    if (completedSteps.includes(stepId) && stepId < currentStep)
      return "complete";
    if (stepId === currentStep) return "current";
    return "upcoming";
  };

  return (
    <nav
      className="w-full border-b bg-background"
      aria-label="Progress"
      role="navigation"
    >
      {/* Mobile view - compact dots */}
      <div className="md:hidden px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {currentStep} of {STEPS.length}
          </span>
          <span className="text-xs text-muted-foreground">
            {STEPS[currentStep - 1]?.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => handleStepClick(step.id)}
                disabled={!isStepClickable(step.id)}
                aria-label={`Step ${step.id}: ${step.title}`}
                aria-current={step.id === currentStep ? "step" : undefined}
                className={cn(
                  "flex-1 h-2 rounded-full transition-all",
                  getStepStatus(step.id) === "complete" && "bg-primary",
                  getStepStatus(step.id) === "current" && "bg-primary",
                  getStepStatus(step.id) === "upcoming" && "bg-muted",
                  isStepClickable(step.id) && "cursor-pointer hover:opacity-80",
                )}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Desktop view - full step indicators */}
      <div className="hidden md:flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const status = getStepStatus(step.id);
          const isClickable = isStepClickable(step.id);

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => handleStepClick(step.id)}
                disabled={!isClickable}
                aria-label={`Step ${step.id}: ${step.title} - ${step.description}`}
                aria-current={step.id === currentStep ? "step" : undefined}
                className={cn(
                  "flex flex-col items-center gap-2 group",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default",
                )}
              >
                {/* Circle with icon/checkmark */}
                <div
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                    status === "complete" &&
                      "bg-primary border-primary text-primary-foreground",
                    status === "current" &&
                      "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                    status === "upcoming" &&
                      "bg-background border-muted text-muted-foreground",
                    isClickable &&
                      "group-hover:ring-4 group-hover:ring-primary/10",
                  )}
                >
                  {status === "complete" ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Step label */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors",
                      status === "current" && "text-foreground",
                      status === "complete" && "text-foreground",
                      status === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {step.shortTitle}
                  </span>
                  <span className="text-xs text-muted-foreground hidden lg:block text-center max-w-[100px]">
                    {step.description}
                  </span>
                </div>
              </button>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors",
                    step.id < currentStep ? "bg-primary" : "bg-muted",
                  )}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
