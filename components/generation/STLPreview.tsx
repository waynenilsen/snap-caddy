"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Box } from "lucide-react";

interface STLPreviewProps {
  stlUrl?: string;
}

export function STLPreview({ stlUrl }: STLPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Preview</CardTitle>
        <CardDescription>
          Three.js integration will be added later
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="aspect-square bg-muted rounded-lg relative flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Box className="w-16 h-16 mx-auto mb-4" />
            <p className="text-sm">3D Preview Placeholder</p>
            {stlUrl && (
              <p className="text-xs mt-2">Model ready for display</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
