"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Info } from "lucide-react";

interface CalibrationPreviewProps {
  pixelsPerMm: number;
  unit: "mm" | "cm" | "in";
}

export function CalibrationPreview({
  pixelsPerMm,
  unit,
}: CalibrationPreviewProps) {
  // Calculate what 1mm equals in pixels
  const mmToPixels = pixelsPerMm;

  // Calculate what 1 unit equals in pixels
  const unitToPixels = {
    mm: pixelsPerMm,
    cm: pixelsPerMm * 10,
    in: pixelsPerMm * 25.4,
  }[unit];

  // Calculate accuracy indicator
  // Generally, good calibration has 10-50 pixels per mm
  const getAccuracyLevel = (
    pxPerMm: number,
  ): { level: string; color: string; message: string } => {
    if (pxPerMm < 5) {
      return {
        level: "Low Resolution",
        color: "destructive",
        message:
          "Image resolution is quite low. Consider using a higher quality image for better accuracy.",
      };
    } else if (pxPerMm < 10) {
      return {
        level: "Acceptable",
        color: "secondary",
        message:
          "Calibration is acceptable. Results should be reasonably accurate.",
      };
    } else if (pxPerMm < 50) {
      return {
        level: "Good",
        color: "default",
        message: "Calibration quality is good. Results should be accurate.",
      };
    } else {
      return {
        level: "Excellent",
        color: "default",
        message:
          "Calibration quality is excellent. Results should be very accurate.",
      };
    }
  };

  const accuracy = getAccuracyLevel(pixelsPerMm);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Calibration Result</CardTitle>
            <CardDescription>Scale factor for measurements</CardDescription>
          </div>
          <Badge variant={accuracy.color as any}>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {accuracy.level}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main scale display */}
        <div className="p-6 bg-muted rounded-lg text-center space-y-2">
          <p className="text-sm text-muted-foreground">Calculated Scale</p>
          <p className="text-3xl font-bold">
            1mm = {pixelsPerMm.toFixed(2)} px
          </p>
          <p className="text-sm text-muted-foreground">
            1{unit} = {unitToPixels.toFixed(2)} px
          </p>
        </div>

        {/* Conversion examples */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 border rounded-lg">
            <p className="text-muted-foreground">10mm equals</p>
            <p className="font-semibold">
              {(pixelsPerMm * 10).toFixed(0)} pixels
            </p>
          </div>
          <div className="p-3 border rounded-lg">
            <p className="text-muted-foreground">100 pixels equals</p>
            <p className="font-semibold">{(100 / pixelsPerMm).toFixed(1)} mm</p>
          </div>
        </div>

        {/* Accuracy info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{accuracy.message}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
