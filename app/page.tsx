"use client";

import { useCallback, useState } from "react";
import { useWizard } from "@/hooks/useWizard";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";
import { WizardLayout, StepIndicator, WizardNavigation } from "@/components/wizard";
import { CaptureStep } from "@/components/capture";
import { SelectStep } from "@/components/segmentation";
import { CalibrateStep } from "@/components/calibration";
import { ReviewStep } from "@/components/editor";
import { ConfigureStep } from "@/components/configuration";
import { GenerateStep } from "@/components/generation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RotateCcw, AlertCircle, X } from "lucide-react";
import { api, APIClientError } from "@/lib/api/client";

export default function Home() {
  const wizard = useWizard();
  const { state, setImageData, setCalibration, setSvgOutline, setGridfinityConfig, setGenerationStatus, setGenerationId } = wizard;
  const [isLoading, setIsLoading] = useState(false);

  // Use polling hook to track generation status
  const polling = useGenerationPolling(state.generationId, {
    enabled: !!state.generationId && (state.generationStatus === "queued" || state.generationStatus === "processing"),
    pollingInterval: 2500, // Poll every 2.5 seconds
    onComplete: (data) => {
      console.log("Generation complete:", data);
      setGenerationStatus("complete");
    },
    onError: (error) => {
      console.error("Generation error:", error);
      setGenerationStatus("error");
      wizard.setError(error);
    },
  });

  // Use polling status if available, otherwise use wizard state
  const generationStatus = polling.status || state.generationStatus;

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
    // Validate required data
    if (!state.svgOutline) {
      wizard.setError("SVG outline is missing. Please complete the previous steps.");
      return;
    }

    setIsLoading(true);
    setGenerationStatus("queued"); // Set wizard status to 'queued' while initiating
    wizard.setError(null); // Clear any previous errors

    try {
      // Call the generate API with the SVG and configuration
      // Map state config to API config format (API expects GridfinityConfig from types/gridfinity)
      const response = await api.generate({
        svg: state.svgOutline,
        config: {
          gridUnitsX: state.gridfinityConfig.gridUnitsX,
          gridUnitsY: state.gridfinityConfig.gridUnitsY,
          binHeight: state.gridfinityConfig.binHeight,
          cutoutDepth: state.gridfinityConfig.cutoutDepth,
          wallThickness: state.gridfinityConfig.wallThickness,
          paddingTop: 2, // Default padding - backend will apply defaults but we set them explicitly
          paddingBottom: 2,
          paddingLeft: 2,
          paddingRight: 2,
          magnetHoles: state.gridfinityConfig.magnetHoles,
          screwHoles: state.gridfinityConfig.screwHoles,
          stackingLip: state.gridfinityConfig.stackingLip,
          cornerRadius: state.gridfinityConfig.cornerRadius,
          baseThickness: state.gridfinityConfig.baseThickness,
        },
        async: true, // Request async generation for polling
      });

      // Set the generation ID to start polling
      setGenerationId(response.generationId);
      // Update status from response - polling hook will monitor progress and update to "complete"
      if (response.status === 'queued' || response.status === 'processing') {
        setGenerationStatus(response.status);
      } else if (response.status === 'complete') {
        setGenerationStatus("complete");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      setGenerationStatus("error");

      // User-friendly error message
      let errorMessage = "Unable to generate the 3D model. Please try again.";

      if (error instanceof APIClientError) {
        // Handle specific API errors
        switch (error.code) {
          case 'INVALID_INPUT':
            errorMessage = "Invalid configuration. Please check your settings and try again.";
            break;
          case 'INVALID_SVG':
            errorMessage = "Invalid SVG outline. Please go back and review your outline.";
            break;
          case 'OPENSCAD_ERROR':
            errorMessage = "Error generating the 3D model. Please try different configuration settings.";
            break;
          case 'RATE_LIMIT':
            errorMessage = "Too many requests. Please wait a moment before trying again.";
            break;
          case 'SERVER_ERROR':
            errorMessage = "Server error. Please try again later.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "The request took too long. Please try again.";
        }
      }

      wizard.setError(errorMessage);
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

  const handleDismissError = useCallback(() => {
    wizard.setError(null);
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
            config={state.gridfinityConfig}
            svgContent={state.svgOutline || ""}
            onGenerate={handleGenerate}
            generationStatus={generationStatus as "idle" | "queued" | "processing" | "complete" | "error"}
            generationId={state.generationId || undefined}
            generationError={polling.error || state.error || undefined}
            progress={polling.progress}
            downloadUrl={polling.downloadUrl}
            previewUrl={polling.previewUrl}
            onDismissError={handleDismissError}
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

      {/* Global Error Display */}
      {state.error && (
        <div className="border-b bg-destructive/5">
          <div className="container mx-auto px-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>Error</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissError}
                  className="h-6 w-6 p-0 hover:bg-destructive/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </div>
        </div>
      )}

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
