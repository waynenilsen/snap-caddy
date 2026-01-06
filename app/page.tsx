"use client";

import { useCallback, useState } from "react";
import { useWizard } from "@/hooks/useWizard";
import { WizardLayout, StepIndicator, WizardNavigation } from "@/components/wizard";
import { CaptureStep } from "@/components/capture";
import { SelectStep } from "@/components/segmentation";
import { CalibrateStep } from "@/components/calibration";
import { ReviewStep } from "@/components/editor";
import { ConfigureStep } from "@/components/configuration";
import { GenerateStep } from "@/components/generation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export default function Home() {
  const wizard = useWizard();
  const { state, setImageData, setCalibration, setSvgOutline, setGridfinityConfig, setGenerationStatus, setGenerationId } = wizard;
  const [isLoading, setIsLoading] = useState(false);

  // Convert generation status for GenerateStep component
  const generationStatus = state.generationStatus === "generating" ? "processing" : state.generationStatus;

  // Step handlers
  const handleImageCaptured = useCallback((imageDataUrl: string) => {
    setImageData(imageDataUrl);
  }, [setImageData]);

  const handleMaskGenerated = useCallback((maskData: string) => {
    // For now, store the mask data as a string
    // In production, this would be converted to ImageData
    // The segmentation step already calls onMaskGenerated when complete
    // We'll create a temporary ImageData for state tracking
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const imageData = ctx.createImageData(512, 512);
      wizard.setSegmentationMask(imageData);
    }
    // Also store the SVG outline (mock for now - will be generated from mask)
    setSvgOutline(generateMockSvg());
  }, [wizard, setSvgOutline]);

  const handleCalibrationComplete = useCallback((pixelsPerMm: number, unit: "mm" | "cm" | "in") => {
    setCalibration({ pixelsPerMm, unit });
  }, [setCalibration]);

  const handleReviewConfirm = useCallback((paddedSvg: string, padding: number) => {
    setSvgOutline(paddedSvg);
  }, [setSvgOutline]);

  const handleConfigComplete = useCallback((config: {
    gridUnitsX: number;
    gridUnitsY: number;
    binHeight: number;
    cutoutDepth: number;
    wallThickness: number;
    magnetHoles: boolean;
    screwHoles: boolean;
    stackingLip: boolean;
  }) => {
    setGridfinityConfig(config);
  }, [setGridfinityConfig]);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setGenerationStatus("generating");

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/generate', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     svg: state.svgOutline,
      //     config: state.gridfinityConfig,
      //   }),
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful response
      setGenerationId("mock-generation-id-" + Date.now());
      setGenerationStatus("complete");
    } catch (error) {
      console.error("Generation failed:", error);
      setGenerationStatus("error");
      wizard.setError("Failed to generate STL. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [state.svgOutline, state.gridfinityConfig, setGenerationStatus, setGenerationId, wizard]);

  const handleStepClick = useCallback((step: number) => {
    wizard.goToStep(step);
  }, [wizard]);

  const handleBack = useCallback(() => {
    wizard.goToPreviousStep();
  }, [wizard]);

  const handleNext = useCallback(() => {
    wizard.goToNextStep();
  }, [wizard]);

  // Render current step content
  const renderStepContent = () => {
    switch (state.currentStep) {
      case 0: // Capture
        return (
          <CaptureStep onImageCaptured={handleImageCaptured} />
        );

      case 1: // Segment
        return state.imageData ? (
          <SelectStep
            imageUrl={state.imageData}
            onMaskGenerated={handleMaskGenerated}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Please capture an image first
          </div>
        );

      case 2: // Calibrate
        return state.imageData ? (
          <CalibrateStep
            imageUrl={state.imageData}
            onCalibrationComplete={handleCalibrationComplete}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Please capture an image first
          </div>
        );

      case 3: // Review
        return state.svgOutline && state.calibration.pixelsPerMm ? (
          <ReviewStep
            svgContent={state.svgOutline}
            pixelsPerMm={state.calibration.pixelsPerMm}
            onConfirm={handleReviewConfirm}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Please complete calibration first
          </div>
        );

      case 4: // Configure
        return (
          <ConfigureStep
            svgDimensions={getSvgDimensions(state.svgOutline, state.calibration.pixelsPerMm)}
            svgOutline={state.svgOutline || undefined}
            onConfigComplete={handleConfigComplete}
            initialConfig={{
              gridUnitsX: state.gridfinityConfig.gridUnitsX,
              gridUnitsY: state.gridfinityConfig.gridUnitsY,
              binHeight: state.gridfinityConfig.binHeight,
              cutoutDepth: state.gridfinityConfig.cutoutDepth,
              wallThickness: state.gridfinityConfig.wallThickness,
              magnetHoles: state.gridfinityConfig.magnetHoles,
              screwHoles: state.gridfinityConfig.screwHoles,
              stackingLip: state.gridfinityConfig.stackingLip,
            }}
          />
        );

      case 5: // Generate
        return (
          <GenerateStep
            config={{
              gridUnitsX: state.gridfinityConfig.gridUnitsX,
              gridUnitsY: state.gridfinityConfig.gridUnitsY,
              binHeight: state.gridfinityConfig.binHeight,
              cutoutDepth: state.gridfinityConfig.cutoutDepth,
              wallThickness: state.gridfinityConfig.wallThickness,
              magnetHoles: state.gridfinityConfig.magnetHoles,
              screwHoles: state.gridfinityConfig.screwHoles,
              labelArea: state.gridfinityConfig.stackingLip,
            }}
            svgContent={state.svgOutline || ""}
            onGenerate={handleGenerate}
            generationStatus={generationStatus as "idle" | "queued" | "processing" | "complete" | "error"}
            generationId={state.generationId || undefined}
            generationError={state.error || undefined}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SC</span>
            </div>
            <h1 className="text-xl font-semibold">Snap Caddy</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => wizard.reset()}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Start Over
          </Button>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <StepIndicator
            currentStep={state.currentStep + 1}
            completedSteps={Array.from(state.completedSteps).map(s => s + 1)}
            onStepClick={(step) => handleStepClick(step - 1)}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <WizardLayout currentStep={state.currentStep + 1}>
          {renderStepContent()}
        </WizardLayout>
      </main>

      {/* Navigation */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky bottom-0">
        <div className="container mx-auto px-4 py-4">
          <WizardNavigation
            currentStep={state.currentStep + 1}
            canProceed={wizard.canProceedToNext()}
            onBack={handleBack}
            onNext={handleNext}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

// Helper function to generate mock SVG for testing
function generateMockSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="200" height="150">
    <path d="M50,25 L150,25 L175,75 L150,125 L50,125 L25,75 Z" fill="none" stroke="currentColor" stroke-width="2"/>
  </svg>`;
}

// Helper function to get SVG dimensions in mm
function getSvgDimensions(
  svgContent: string | null,
  pixelsPerMm: number | null
): { width: number; height: number } | undefined {
  if (!svgContent || !pixelsPerMm) return undefined;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");

    if (!svg) return undefined;

    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const [, , width, height] = viewBox.split(" ").map(Number);
      return {
        width: width / pixelsPerMm,
        height: height / pixelsPerMm,
      };
    }

    const width = parseFloat(svg.getAttribute("width") || "0");
    const height = parseFloat(svg.getAttribute("height") || "0");

    if (width && height) {
      return {
        width: width / pixelsPerMm,
        height: height / pixelsPerMm,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return undefined;
}
