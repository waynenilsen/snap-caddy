"use client";

import { useState, useEffect } from "react";
import { BinConfigurator, BinConfig } from "./BinConfigurator";
import { GridfinityPreview } from "./GridfinityPreview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, CheckCircle, AlertCircle } from "lucide-react";

interface ConfigureStepProps {
  svgDimensions?: { width: number; height: number }; // in mm
  svgOutline?: string; // SVG path data
  onConfigComplete: (config: BinConfig) => void;
  initialConfig?: BinConfig;
}

export function ConfigureStep({
  svgDimensions,
  svgOutline,
  onConfigComplete,
  initialConfig
}: ConfigureStepProps) {
  const GRID_UNIT_SIZE = 42; // mm per Gridfinity unit

  // Auto-suggest grid size based on SVG dimensions
  const suggestedUnitsX = svgDimensions
    ? Math.ceil(svgDimensions.width / GRID_UNIT_SIZE)
    : 2;
  const suggestedUnitsY = svgDimensions
    ? Math.ceil(svgDimensions.height / GRID_UNIT_SIZE)
    : 2;

  const [config, setConfig] = useState<BinConfig>(
    initialConfig || {
      gridUnitsX: suggestedUnitsX,
      gridUnitsY: suggestedUnitsY,
      binHeight: 28, // 4 height units
      cutoutDepth: 20,
      wallThickness: 1.2,
      magnetHoles: true,
      screwHoles: false,
      stackingLip: true
    }
  );

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Validate configuration
  useEffect(() => {
    const errors: string[] = [];

    // Check if grid is large enough for object
    if (svgDimensions) {
      const requiredX = Math.ceil(svgDimensions.width / GRID_UNIT_SIZE);
      const requiredY = Math.ceil(svgDimensions.height / GRID_UNIT_SIZE);

      if (config.gridUnitsX < requiredX) {
        errors.push(
          `Grid width too small: need at least ${requiredX} units for ${svgDimensions.width.toFixed(0)}mm object`
        );
      }

      if (config.gridUnitsY < requiredY) {
        errors.push(
          `Grid depth too small: need at least ${requiredY} units for ${svgDimensions.height.toFixed(0)}mm object`
        );
      }
    }

    // Check cutout depth
    if (config.cutoutDepth >= config.binHeight) {
      errors.push("Cutout depth must be less than bin height");
    }

    if (config.cutoutDepth < 1) {
      errors.push("Cutout depth must be at least 1mm");
    }

    // Check wall thickness
    if (config.wallThickness < 0.5 || config.wallThickness > 5) {
      errors.push("Wall thickness must be between 0.5mm and 5mm");
    }

    // Check bin height
    if (config.binHeight < 7 || config.binHeight > 100) {
      errors.push("Bin height must be between 7mm and 100mm");
    }

    setValidationErrors(errors);
  }, [config, svgDimensions]);

  const handleComplete = () => {
    if (validationErrors.length === 0) {
      onConfigComplete(config);
    }
  };

  const isValid = validationErrors.length === 0;

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Configure Gridfinity Bin</h2>
        <p className="text-muted-foreground mt-2">
          Set the dimensions and features for your custom bin
        </p>
      </div>

      {svgDimensions && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your object measures {svgDimensions.width.toFixed(1)}mm × {svgDimensions.height.toFixed(1)}mm.
            We suggest a {suggestedUnitsX}×{suggestedUnitsY} grid ({suggestedUnitsX * GRID_UNIT_SIZE}mm × {suggestedUnitsY * GRID_UNIT_SIZE}mm).
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <BinConfigurator
            config={config}
            onChange={setConfig}
            objectDimensions={svgDimensions}
          />
        </div>

        <div>
          <GridfinityPreview
            config={config}
            svgOutline={svgOutline}
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Errors</AlertTitle>
            <AlertDescription>
              <p className="mb-2">Please fix the following issues before proceeding:</p>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {isValid && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Configuration is valid and ready to proceed
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-4">
          <Button
            onClick={handleComplete}
            disabled={!isValid}
            size="lg"
          >
            Continue to Generation
          </Button>
        </div>
      </div>
    </div>
  );
}
