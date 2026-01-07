"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BinConfig } from "./BinConfigurator";

interface GridfinityPreviewProps {
  config: BinConfig;
  svgOutline?: string; // SVG path data
}

export function GridfinityPreview({
  config,
  svgOutline,
}: GridfinityPreviewProps) {
  const GRID_SIZE = 42;
  const viewWidth = config.gridUnitsX * GRID_SIZE;
  const viewHeight = config.gridUnitsY * GRID_SIZE;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bin Preview</CardTitle>
        <CardDescription>
          {config.gridUnitsX} × {config.gridUnitsY} units, {config.binHeight}mm
          tall
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-muted to-background">
          <svg
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            className="w-full h-auto"
          >
            {/* Grid pattern */}
            <defs>
              <pattern
                id="grid"
                width={GRID_SIZE}
                height={GRID_SIZE}
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  opacity="0.2"
                />
              </pattern>
            </defs>

            {/* Base grid */}
            <rect width={viewWidth} height={viewHeight} fill="url(#grid)" />

            {/* Bin outline */}
            <rect
              width={viewWidth}
              height={viewHeight}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.6"
            />

            {/* Cutout outline */}
            {svgOutline && (
              <g>
                {/* Center the cutout in the bin */}
                <path
                  d={svgOutline}
                  fill="hsl(var(--primary))"
                  fillOpacity="0.2"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Magnet holes */}
            {config.magnetHoles && (
              <>
                <circle cx={8} cy={8} r={3} fill="currentColor" opacity="0.3" />
                <circle
                  cx={viewWidth - 8}
                  cy={8}
                  r={3}
                  fill="currentColor"
                  opacity="0.3"
                />
                <circle
                  cx={8}
                  cy={viewHeight - 8}
                  r={3}
                  fill="currentColor"
                  opacity="0.3"
                />
                <circle
                  cx={viewWidth - 8}
                  cy={viewHeight - 8}
                  r={3}
                  fill="currentColor"
                  opacity="0.3"
                />
              </>
            )}

            {/* Screw holes */}
            {config.screwHoles && (
              <>
                <circle
                  cx={GRID_SIZE / 2}
                  cy={GRID_SIZE / 2}
                  r={1.5}
                  fill="currentColor"
                  opacity="0.4"
                />
                <circle
                  cx={viewWidth - GRID_SIZE / 2}
                  cy={GRID_SIZE / 2}
                  r={1.5}
                  fill="currentColor"
                  opacity="0.4"
                />
                <circle
                  cx={GRID_SIZE / 2}
                  cy={viewHeight - GRID_SIZE / 2}
                  r={1.5}
                  fill="currentColor"
                  opacity="0.4"
                />
                <circle
                  cx={viewWidth - GRID_SIZE / 2}
                  cy={viewHeight - GRID_SIZE / 2}
                  r={1.5}
                  fill="currentColor"
                  opacity="0.4"
                />
              </>
            )}

            {/* Grid unit labels */}
            {Array.from({ length: config.gridUnitsX }).map((_, i) => (
              <text
                key={`x-${i}`}
                x={(i + 0.5) * GRID_SIZE}
                y={viewHeight - 5}
                textAnchor="middle"
                fontSize="8"
                fill="currentColor"
                opacity="0.5"
              >
                {i + 1}
              </text>
            ))}
            {Array.from({ length: config.gridUnitsY }).map((_, i) => (
              <text
                key={`y-${i}`}
                x={5}
                y={(i + 0.5) * GRID_SIZE + 3}
                fontSize="8"
                fill="currentColor"
                opacity="0.5"
              >
                {i + 1}
              </text>
            ))}
          </svg>
        </div>

        {/* Specifications */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Footprint:</span>
            <span className="font-medium">
              {viewWidth}×{viewHeight}mm
            </span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Height:</span>
            <span className="font-medium">{config.binHeight}mm</span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Volume:</span>
            <span className="font-medium">
              {((viewWidth * viewHeight * config.binHeight) / 1000).toFixed(1)}
              cm³
            </span>
          </div>
          <div className="flex justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground">Features:</span>
            <span className="font-medium">
              {[
                config.magnetHoles && "Magnets",
                config.screwHoles && "Screws",
                config.stackingLip && "Label",
              ]
                .filter(Boolean)
                .join(", ") || "None"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
