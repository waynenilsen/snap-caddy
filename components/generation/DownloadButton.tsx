"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, Loader2, Info } from "lucide-react";

interface DownloadButtonProps {
  generationId: string;
  disabled: boolean;
  filename?: string;
}

export function DownloadButton({
  generationId,
  disabled,
  filename = "gridfinity-bin.stl",
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      // TODO: Replace with actual API endpoint
      const stlUrl = `/api/generations/${generationId}/download`;

      const response = await fetch(stlUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{filename}</p>
                <p className="text-sm text-muted-foreground">STL File</p>
              </div>
            </div>

            <Button
              onClick={handleDownload}
              disabled={disabled || isDownloading}
              size="lg"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download STL
                </>
              )}
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Import this STL file into your slicer software for 3D printing
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
