"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Settings, ChevronDown } from "lucide-react";

export interface BinConfig {
  gridUnitsX: number;
  gridUnitsY: number;
  binHeight: number;
  cutoutDepth: number;
  wallThickness: number;
  magnetHoles: boolean;
  screwHoles: boolean;
  stackingLip: boolean;
}

interface BinConfiguratorProps {
  config: BinConfig;
  onChange: (config: BinConfig) => void;
  objectDimensions?: { width: number; height: number }; // mm
}

export function BinConfigurator({
  config,
  onChange,
  objectDimensions
}: BinConfiguratorProps) {
  const GRID_UNIT_SIZE = 42; // mm per Gridfinity unit

  // Calculate minimum grid units needed
  const minUnitsX = objectDimensions
    ? Math.ceil(objectDimensions.width / GRID_UNIT_SIZE)
    : 1;
  const minUnitsY = objectDimensions
    ? Math.ceil(objectDimensions.height / GRID_UNIT_SIZE)
    : 1;

  const updateConfig = (updates: Partial<BinConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bin Configuration</CardTitle>
        <CardDescription>
          Configure Gridfinity bin parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grid dimensions */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="gridX">Grid Units (Width)</Label>
              <span className="text-sm text-muted-foreground">
                {config.gridUnitsX} units = {config.gridUnitsX * GRID_UNIT_SIZE}mm
              </span>
            </div>
            <Slider
              id="gridX"
              value={[config.gridUnitsX]}
              onValueChange={([v]) => updateConfig({ gridUnitsX: v })}
              min={minUnitsX}
              max={10}
              step={1}
            />
            {objectDimensions && config.gridUnitsX < minUnitsX + 1 && (
              <p className="text-xs text-amber-600 mt-1">
                Minimum {minUnitsX} units needed for object ({objectDimensions.width.toFixed(0)}mm)
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="gridY">Grid Units (Depth)</Label>
              <span className="text-sm text-muted-foreground">
                {config.gridUnitsY} units = {config.gridUnitsY * GRID_UNIT_SIZE}mm
              </span>
            </div>
            <Slider
              id="gridY"
              value={[config.gridUnitsY]}
              onValueChange={([v]) => updateConfig({ gridUnitsY: v })}
              min={minUnitsY}
              max={10}
              step={1}
            />
            {objectDimensions && config.gridUnitsY < minUnitsY + 1 && (
              <p className="text-xs text-amber-600 mt-1">
                Minimum {minUnitsY} units needed for object ({objectDimensions.height.toFixed(0)}mm)
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Height controls */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="binHeight">Bin Height (mm)</Label>
            <div className="flex gap-2 mt-2">
              <Slider
                id="binHeight"
                value={[config.binHeight]}
                onValueChange={([v]) => updateConfig({ binHeight: v })}
                min={7}
                max={100}
                step={7}
                className="flex-1"
              />
              <Input
                type="number"
                value={config.binHeight}
                onChange={(e) => updateConfig({ binHeight: parseInt(e.target.value) || 7 })}
                className="w-20"
                min={7}
                max={100}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Standard heights: 7mm increments
            </p>
          </div>

          <div>
            <Label htmlFor="cutoutDepth">Cutout Depth (mm)</Label>
            <div className="flex gap-2 mt-2">
              <Slider
                id="cutoutDepth"
                value={[config.cutoutDepth]}
                onValueChange={([v]) => updateConfig({ cutoutDepth: v })}
                min={1}
                max={Math.min(50, config.binHeight - 2)}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={config.cutoutDepth}
                onChange={(e) => updateConfig({ cutoutDepth: parseInt(e.target.value) || 1 })}
                className="w-20"
                min={1}
                max={50}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              How deep the object cutout goes into the bin
            </p>
          </div>
        </div>

        <Separator />

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="magnetHoles">Magnet Holes</Label>
              <p className="text-xs text-muted-foreground">
                6mm × 2mm holes for base magnets
              </p>
            </div>
            <Switch
              id="magnetHoles"
              checked={config.magnetHoles}
              onCheckedChange={(checked) => updateConfig({ magnetHoles: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="screwHoles">Screw Holes</Label>
              <p className="text-xs text-muted-foreground">
                M3 mounting holes in base
              </p>
            </div>
            <Switch
              id="screwHoles"
              checked={config.screwHoles}
              onCheckedChange={(checked) => updateConfig({ screwHoles: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="stackingLip">Stacking Lip</Label>
              <p className="text-xs text-muted-foreground">
                Front label strip for identification
              </p>
            </div>
            <Switch
              id="stackingLip"
              checked={config.stackingLip}
              onCheckedChange={(checked) => updateConfig({ stackingLip: checked })}
            />
          </div>
        </div>

        {/* Advanced toggle */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Advanced Options
              <ChevronDown className="w-4 h-4 ml-auto" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div>
              <Label htmlFor="wallThickness">Wall Thickness (mm)</Label>
              <Input
                id="wallThickness"
                type="number"
                value={config.wallThickness}
                onChange={(e) => updateConfig({ wallThickness: parseFloat(e.target.value) || 1.2 })}
                min={0.5}
                max={5}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 1.2mm for standard 3D printing
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
