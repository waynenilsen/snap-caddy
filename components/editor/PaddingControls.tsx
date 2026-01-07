"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface PaddingControlsProps {
  padding: number; // mm
  onPaddingChange: (padding: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function PaddingControls({
  padding,
  onPaddingChange,
  min = 0,
  max = 10,
  step = 0.5,
}: PaddingControlsProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= min && value <= max) {
      onPaddingChange(value);
    }
  };

  const presets = [0, 1, 2, 5];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Padding</CardTitle>
        <CardDescription>
          Add clearance around the object cutout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Slider
            value={[padding]}
            onValueChange={([v]) => onPaddingChange(v)}
            min={min}
            max={max}
            step={step}
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={padding}
              onChange={handleInputChange}
              min={min}
              max={max}
              step={step}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">mm</span>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2">
          {presets.map((preset) => (
            <Button
              key={preset}
              variant={padding === preset ? "default" : "outline"}
              size="sm"
              onClick={() => onPaddingChange(preset)}
            >
              {preset}mm
            </Button>
          ))}
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Padding makes it easier to insert and remove objects from the bin
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
