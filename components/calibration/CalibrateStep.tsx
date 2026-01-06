"use client";

import { useEffect, useMemo, useState } from "react";
import { RulerSelector } from "./RulerSelector";
import { ScaleInput } from "./ScaleInput";
import { CalibrationPreview } from "./CalibrationPreview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

type Unit = "mm" | "cm" | "in";

interface CalibrateStepProps {
  imageUrl: string;
  onCalibrationComplete: (pixelsPerMm: number, unit: Unit) => void;
}

export function CalibrateStep({ imageUrl, onCalibrationComplete }: CalibrateStepProps) {
  const [line, setLine] = useState<[Point, Point] | null>(null);
  const [pixelDistance, setPixelDistance] = useState<number | null>(null);
  const [realDistance, setRealDistance] = useState<number>(100);
  const [unit, setUnit] = useState<Unit>("mm");

  const handleLineChange = (point1: Point, point2: Point) => {
    setLine([point1, point2]);

    // Calculate pixel distance
    const dist = Math.sqrt(
      (point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2
    );
    setPixelDistance(dist);
  };

  // Calculate pixels per mm
  const pixelsPerMm = useMemo(() => {
    if (!pixelDistance || !realDistance || realDistance <= 0) {
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

    return pixelDistance / distanceInMm;
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
            Set the scale by drawing a line on a ruler or known measurement in your image.
          </p>
        </div>

        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>How to calibrate:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Click two points on a ruler or object with known dimensions</li>
              <li>Enter the real-world distance between those points</li>
              <li>Select the unit of measurement</li>
              <li>Review the calculated scale factor</li>
            </ol>
          </AlertDescription>
        </Alert>

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
              Please select two points on the image to create a calibration line.
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
