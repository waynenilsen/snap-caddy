"use client";

import { AlertCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CalibrationPreview } from "./CalibrationPreview";
import { RulerSelector } from "./RulerSelector";
import { ScaleInput } from "./ScaleInput";

interface Point {
  x: number;
  y: number;
}

type Unit = "mm" | "cm" | "in";

interface CalibrateStepProps {
  imageUrl: string;
  onCalibrationComplete: (pixelsPerMm: number, unit: Unit) => void;
}

export function CalibrateStep({
  imageUrl,
  onCalibrationComplete,
}: CalibrateStepProps) {
  const [line, setLine] = useState<[Point, Point] | null>(null);
  const [pixelDistance, setPixelDistance] = useState<number | null>(null);
  const [realDistance, setRealDistance] = useState<number>(100);
  const [unit, setUnit] = useState<Unit>("mm");
  const [error, setError] = useState<string | null>(null);

  const handleLineChange = (point1: Point, point2: Point) => {
    setLine([point1, point2]);

    // Clear any previous errors
    setError(null);

    // Calculate pixel distance
    const dist = Math.sqrt(
      (point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2,
    );

    // Validate the line isn't too short
    if (dist < 10) {
      setError(
        "The calibration line is too short. Please select two points that are further apart for accurate calibration.",
      );
      setPixelDistance(null);
      return;
    }

    setPixelDistance(dist);
  };

  const handleDismissError = () => {
    setError(null);
  };

  // Calculate pixels per mm
  const pixelsPerMm = useMemo(() => {
    if (!pixelDistance || !realDistance || realDistance <= 0) {
      return null;
    }

    // Validate real distance
    if (realDistance > 10000) {
      setError(
        "The entered distance seems unusually large. Please verify your measurement.",
      );
      return null;
    }

    if (realDistance < 0.1) {
      setError(
        "The entered distance is too small. Please enter a larger measurement for better accuracy.",
      );
      return null;
    }

    // Convert real distance to mm
    let distanceInMm: number;
    switch (unit) {
      case "cm":
        distanceInMm = realDistance * 10;
        break;
      case "in":
        distanceInMm = realDistance * 25.4;
        break;
      default:
        distanceInMm = realDistance;
    }

    const result = pixelDistance / distanceInMm;

    // Validate the result is reasonable
    if (result < 0.1 || result > 100) {
      setError(
        "The calculated scale seems incorrect. Please verify your calibration line and distance measurement.",
      );
      return null;
    }

    return result;
  }, [pixelDistance, realDistance, unit]);

  // Check if calibration is complete
  const isComplete = pixelsPerMm !== null && pixelsPerMm > 0;

  // Notify parent when calibration is complete
  useEffect(() => {
    if (isComplete && pixelsPerMm) {
      onCalibrationComplete(pixelsPerMm, unit);
    }
  }, [isComplete, pixelsPerMm, unit, onCalibrationComplete]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Calibrate Scale</h1>
          <p className="text-muted-foreground">
            Set the scale by drawing a line on a ruler or known measurement in
            your image.
          </p>
        </div>

        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>How to calibrate:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>
                Click two points on a ruler or object with known dimensions
              </li>
              <li>Enter the real-world distance between those points</li>
              <li>Select the unit of measurement</li>
              <li>Review the calculated scale factor</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissError}
                className="h-6 w-6 p-0 ml-2 hover:bg-destructive/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Ruler selector */}
          <div className="space-y-6">
            <RulerSelector
              imageUrl={imageUrl}
              line={line}
              onLineChange={handleLineChange}
            />
          </div>

          {/* Right column - Inputs and preview */}
          <div className="space-y-6">
            <ScaleInput
              pixelDistance={pixelDistance}
              realDistance={realDistance}
              unit={unit}
              onDistanceChange={setRealDistance}
              onUnitChange={setUnit}
            />

            {pixelsPerMm && (
              <CalibrationPreview pixelsPerMm={pixelsPerMm} unit={unit} />
            )}
          </div>
        </div>

        {/* Validation message */}
        {!line && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please select two points on the image to create a calibration
              line.
            </AlertDescription>
          </Alert>
        )}

        {line && (!realDistance || realDistance <= 0) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please enter a valid real-world distance greater than 0.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
