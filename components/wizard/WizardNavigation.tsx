import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WizardNavigationProps {
  currentStep: number;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
  nextLabel?: string;
  backLabel?: string;
  totalSteps?: number;
  className?: string;
}

export function WizardNavigation({
  currentStep,
  canProceed,
  onBack,
  onNext,
  isLoading = false,
  nextLabel,
  backLabel,
  totalSteps = 6,
  className,
}: WizardNavigationProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const defaultNextLabel = isLastStep ? "Finish" : "Next";
  const defaultBackLabel = "Back";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t bg-background px-4 py-4 md:px-6",
        className,
      )}
    >
      {/* Back button */}
      <Button
        variant="outline"
        onClick={onBack}
        disabled={isFirstStep || isLoading}
        aria-label="Go to previous step"
        className="min-w-[100px]"
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        {backLabel || defaultBackLabel}
      </Button>

      {/* Step counter for mobile */}
      <div className="flex-1 text-center md:hidden">
        <span className="text-sm text-muted-foreground">
          {currentStep} of {totalSteps}
        </span>
      </div>

      {/* Next button */}
      <Button
        onClick={onNext}
        disabled={!canProceed || isLoading}
        aria-label={isLastStep ? "Complete wizard" : "Go to next step"}
        className="min-w-[100px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {isLastStep ? "Finishing..." : "Processing..."}
          </>
        ) : (
          <>
            {nextLabel || defaultNextLabel}
            {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
          </>
        )}
      </Button>
    </div>
  );
}
