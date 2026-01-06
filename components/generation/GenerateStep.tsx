"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GenerateButton } from "./GenerateButton";
import { ProgressIndicator } from "./ProgressIndicator";
import { STLPreview } from "./STLPreview";
import { DownloadButton } from "./DownloadButton";

interface BinConfig {
  gridUnitsX: number;
  gridUnitsY: number;
  binHeight: number;
  cutoutDepth: number;
  wallThickness: number;
  magnetHoles: boolean;
  screwHoles: boolean;
  labelArea: boolean;
}

interface GenerateStepProps {
  config: BinConfig;
  svgContent: string;
  onGenerate: () => void;
  generationStatus: "idle" | "queued" | "processing" | "complete" | "error";
  generationId?: string;
  generationError?: string;
}

export function GenerateStep({
  config,
  svgContent,
  onGenerate,
  generationStatus,
  generationId,
  generationError,
}: GenerateStepProps) {
  const GRID_UNIT_SIZE = 42; // mm per Gridfinity unit

  const canGenerate = generationStatus === "idle" || generationStatus === "error";
  const canDownload = generationStatus === "complete" && !!generationId;

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Generate 3D Model</h1>
        <p className="text-muted-foreground">
          Review your configuration and generate the STL file for 3D printing
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column - Summary and Controls */}
        <div className="space-y-6">
          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration Summary</CardTitle>
              <CardDescription>
                Review your bin specifications before generating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Grid Size</p>
                  <p className="text-lg font-semibold">
                    {config.gridUnitsX} × {config.gridUnitsY} units
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {config.gridUnitsX * GRID_UNIT_SIZE} × {config.gridUnitsY * GRID_UNIT_SIZE}mm
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Bin Height</p>
                  <p className="text-lg font-semibold">{config.binHeight}mm</p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Cutout Depth</p>
                  <p className="text-lg font-semibold">{config.cutoutDepth}mm</p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Wall Thickness</p>
                  <p className="text-lg font-semibold">{config.wallThickness}mm</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Features</p>
                <div className="flex flex-wrap gap-2">
                  {config.magnetHoles && (
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      Magnet Holes
                    </div>
                  )}
                  {config.screwHoles && (
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      Screw Holes
                    </div>
                  )}
                  {config.labelArea && (
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      Label Area
                    </div>
                  )}
                  {!config.magnetHoles && !config.screwHoles && !config.labelArea && (
                    <span className="text-sm text-muted-foreground">No additional features</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generation Controls */}
          <GenerateButton disabled={!canGenerate} onClick={onGenerate} />

          {/* Progress Indicator */}
          {generationStatus !== "idle" && (
            <ProgressIndicator
              status={generationStatus}
              progress={
                generationStatus === "queued" ? 25 :
                generationStatus === "processing" ? 75 :
                generationStatus === "complete" ? 100 : 0
              }
              error={generationError}
            />
          )}

          {/* Download Button */}
          {canDownload && (
            <DownloadButton
              generationId={generationId}
              disabled={!canDownload}
              filename={`gridfinity-bin-${config.gridUnitsX}x${config.gridUnitsY}.stl`}
            />
          )}
        </div>

        {/* Right column - Preview */}
        <div className="space-y-6">
          <STLPreview stlUrl={canDownload ? `/api/generations/${generationId}/preview` : undefined} />
        </div>
      </div>
    </div>
  );
}
