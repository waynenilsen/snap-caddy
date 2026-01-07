"use client";

import { useCallback, useState } from "react";
import { useWizard } from "@/hooks/useWizard";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";
import {
  WizardLayout,
  StepIndicator,
  WizardNavigation,
} from "@/components/wizard";
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
import { findContours, generateSVG } from "@/lib/canvas";

export default function Home() {
  const wizard = useWizard();
  const {
    state,
    setImageData,
    setCalibration,
    setSvgOutline,
    setGridfinityConfig,
    setGenerationStatus,
    setGenerationId,
  } = wizard;
  const [isLoading, setIsLoading] = useState(false);

  // Use polling hook to track generation status
  const polling = useGenerationPolling(state.generationId, {
    enabled:
      !!state.generationId &&
      (state.generationStatus === "queued" ||
        state.generationStatus === "processing"),
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
  const handleImageCaptured = useCallback(
    (imageDataUrl: string) => {
      setImageData(imageDataUrl);
    },
    [setImageData],
  );

  const handleMaskGenerated = useCallback(
    (maskDataUrl: string) => {
      // Load the mask image from data URL and convert to ImageData
      const img = new Image();
      img.onload = () => {
        // Create canvas to extract ImageData from the mask
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          console.error("Failed to get canvas context for mask processing");
          return;
        }

        // Draw mask image to canvas
        ctx.drawImage(img, 0, 0);

        // Get ImageData from the mask
        const maskImageData = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );

        // Store the mask in wizard state
        wizard.setSegmentationMask(maskImageData);

        try {
          // Detect contours from the binary mask
          const contourResult = findContours(maskImageData, {
            minArea: 200, // Ignore small noise
            simplifyTolerance: 1.5, // Reduce points while preserving shape
            smoothingIterations: 2, // Smooth edges
            findHoles: true, // Detect inner holes
          });

          // Check if we found a valid contour
          if (contourResult.outerContour.points.length === 0) {
            console.warn("No contour detected in mask");
            // Use a fallback simple SVG if no contour detected
            setSvgOutline(createFallbackSvg(canvas.width, canvas.height));
            return;
          }

          // Use calibration data if available, otherwise use a sensible default
          // Default: 10 pixels per mm (typical for a phone camera at ~30cm distance)
          const pixelsPerMm = state.calibration.pixelsPerMm || 10;

          // Generate SVG from contours
          const svgDoc = generateSVG(
            contourResult.outerContour,
            contourResult.holes,
            {
              pixelsPerMm,
              padding: 3, // 3mm padding
              useBezier: true, // Smooth curves for organic shapes
              bezierTension: 0.4, // Moderate smoothing
              decimals: 2, // 0.01mm precision
              flipY: true, // SVG Y-axis convention
            },
          );

          // Store the generated SVG
          setSvgOutline(svgDoc.fullSvg);

          console.log(
            `SVG generated: ${svgDoc.width.toFixed(1)}mm x ${svgDoc.height.toFixed(1)}mm, ${contourResult.outerContour.points.length} points`,
          );
        } catch (error) {
          console.error("Error generating SVG from mask:", error);
          // Use fallback on error
          setSvgOutline(createFallbackSvg(canvas.width, canvas.height));
        }
      };

      img.onerror = () => {
        console.error("Failed to load mask image");
      };

      img.src = maskDataUrl;
    },
    [wizard, setSvgOutline, state.calibration.pixelsPerMm],
  );

  const handleCalibrationComplete = useCallback(
    (pixelsPerMm: number, unit: "mm" | "cm" | "in") => {
      setCalibration({ pixelsPerMm, unit });
    },
    [setCalibration],
  );

  const handleReviewConfirm = useCallback(
    (paddedSvg: string, padding: number) => {
      setSvgOutline(paddedSvg);
    },
    [setSvgOutline],
  );

  const handleConfigComplete = useCallback(
    (config: {
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
    },
    [setGridfinityConfig],
  );

  const handleGenerate = useCallback(async () => {
    // Validate required data
    if (!state.svgOutline) {
      wizard.setError(
        "SVG outline is missing. Please complete the previous steps.",
      );
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
      if (response.status === "queued" || response.status === "processing") {
        setGenerationStatus(response.status);
      } else if (response.status === "complete") {
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
          case "INVALID_INPUT":
            errorMessage =
              "Invalid configuration. Please check your settings and try again.";
            break;
          case "INVALID_SVG":
            errorMessage =
              "Invalid SVG outline. Please go back and review your outline.";
            break;
          case "OPENSCAD_ERROR":
            errorMessage =
              "Error generating the 3D model. Please try different configuration settings.";
            break;
          case "RATE_LIMIT":
            errorMessage =
              "Too many requests. Please wait a moment before trying again.";
            break;
          case "SERVER_ERROR":
            errorMessage = "Server error. Please try again later.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error instanceof Error) {
        // Check for specific error types
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "The request took too long. Please try again.";
        }
      }

      wizard.setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    state.svgOutline,
    state.gridfinityConfig,
    setGenerationStatus,
    setGenerationId,
    wizard,
  ]);

  const handleStepClick = useCallback(
    (step: number) => {
      wizard.goToStep(step);
    },
    [wizard],
  );

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
        return <CaptureStep onImageCaptured={handleImageCaptured} />;

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
            svgDimensions={getSvgDimensions(
              state.svgOutline,
              state.calibration.pixelsPerMm,
            )}
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
            generationStatus={
              generationStatus as
                | "idle"
                | "queued"
                | "processing"
                | "complete"
                | "error"
            }
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
              <span className="text-primary-foreground font-bold text-sm">
                SC
              </span>
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
            completedSteps={Array.from(state.completedSteps).map((s) => s + 1)}
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

// Helper function to create a fallback SVG when contour detection fails
function createFallbackSvg(width: number, height: number): string {
  // Create a simple rectangle placeholder
  const padding = 10;
  const w = Math.max(10, width - padding * 2);
  const h = Math.max(10, height - padding * 2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     version="1.1"
     width="${w}mm"
     height="${h}mm"
     viewBox="0 0 ${w} ${h}">
  <path d="M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z"
        fill="black"
        stroke="none"/>
</svg>`;
}

// Helper function to get SVG dimensions in mm
function getSvgDimensions(
  svgContent: string | null,
  pixelsPerMm: number | null,
): { width: number; height: number } | undefined {
  if (!svgContent) return undefined;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");

    if (!svg) return undefined;

    // First, check for explicit width/height attributes with units
    const widthAttr = svg.getAttribute("width") || "";
    const heightAttr = svg.getAttribute("height") || "";

    // If dimensions are in mm (from our generator), parse directly
    if (widthAttr.endsWith("mm") && heightAttr.endsWith("mm")) {
      const width = parseFloat(widthAttr);
      const height = parseFloat(heightAttr);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    // Check viewBox (which is now in mm from our generator)
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).filter(Boolean);
      if (parts.length >= 4) {
        const width = parseFloat(parts[2]);
        const height = parseFloat(parts[3]);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    // Fallback: parse width/height as pixels and convert using pixelsPerMm
    if (pixelsPerMm) {
      const width = parseFloat(widthAttr) || 0;
      const height = parseFloat(heightAttr) || 0;
      if (width > 0 && height > 0) {
        return {
          width: width / pixelsPerMm,
          height: height / pixelsPerMm,
        };
      }
    }
  } catch {
    // Ignore parse errors
  }

  return undefined;
}
