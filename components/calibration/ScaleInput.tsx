"use client";

import { AlertCircle, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Unit = "mm" | "cm" | "in";

interface ScaleInputProps {
  pixelDistance: number | null;
  realDistance: number;
  unit: Unit;
  onDistanceChange: (value: number) => void;
  onUnitChange: (unit: Unit) => void;
}

export function ScaleInput({
  pixelDistance,
  realDistance,
  unit,
  onDistanceChange,
  onUnitChange,
}: ScaleInputProps) {
  const [error, setError] = useState<string | null>(null);

  const handleValueChange = (value: string) => {
    const numValue = parseFloat(value);

    if (Number.isNaN(numValue)) {
      onDistanceChange(0);
      return;
    }

    if (numValue <= 0) {
      setError("Please enter a positive number");
    } else {
      setError(null);
    }

    onDistanceChange(numValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && realDistance > 0) {
      e.preventDefault();
    }
  };

  // Convert to mm for calculation
  const convertedValueInMm = useMemo(() => {
    switch (unit) {
      case "cm":
        return realDistance * 10;
      case "in":
        return realDistance * 25.4;
      default:
        return realDistance;
    }
  }, [realDistance, unit]);

  const pixelsPerMm =
    pixelDistance && realDistance && convertedValueInMm > 0
      ? pixelDistance / convertedValueInMm
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Known Distance</CardTitle>
        <CardDescription>
          Enter the real-world measurement between the two points you selected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="distance">Distance</Label>
            <Input
              id="distance"
              type="number"
              min="0"
              step="0.1"
              value={realDistance || ""}
              onChange={(e) => handleValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-lg mt-2"
              placeholder="Enter distance"
            />
          </div>

          <div className="w-28">
            <Label htmlFor="unit">Unit</Label>
            <Select value={unit} onValueChange={(v) => onUnitChange(v as Unit)}>
              <SelectTrigger id="unit" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mm">mm</SelectItem>
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="in">inches</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {pixelsPerMm && !error && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Calibration: {pixelsPerMm.toFixed(2)} pixels per mm
              <br />
              {convertedValueInMm.toFixed(1)} mm = {pixelDistance?.toFixed(0)}{" "}
              pixels
            </AlertDescription>
          </Alert>
        )}

        {/* Quick presets */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Quick Presets</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDistanceChange(100);
                onUnitChange("mm");
                setError(null);
              }}
            >
              100mm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDistanceChange(10);
                onUnitChange("cm");
                setError(null);
              }}
            >
              10cm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDistanceChange(1);
                onUnitChange("in");
                setError(null);
              }}
            >
              1&quot;
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
