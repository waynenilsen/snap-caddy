"use client";

import { AlertCircle, Download, FileText, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APIClientError, api } from "@/lib/api/client";

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
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!generationId) {
      setError("No generation ID provided");
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      // Use API client to download STL
      const blob = await api.downloadSTL(generationId);

      // Trigger browser download
      api.triggerDownload(blob, filename);
    } catch (err) {
      console.error("Download failed:", err);

      // Handle specific API errors
      if (err instanceof APIClientError) {
        if (err.statusCode === 404) {
          setError("File not found. The generation may have been deleted.");
        } else if (err.statusCode === 410) {
          setError("File has expired. Please regenerate the model.");
        } else if (err.statusCode === 400) {
          setError("Invalid generation ID format.");
        } else {
          setError(err.message || "Failed to download file. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
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
              disabled={disabled || isDownloading || !generationId}
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
