"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Circle,
  Upload,
  Settings,
  Box,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface ProgressIndicatorProps {
  status: "idle" | "queued" | "processing" | "complete" | "error";
  progress?: number; // 0-100
  error?: string;
}

export function ProgressIndicator({
  status,
  progress = 0,
  error,
}: ProgressIndicatorProps) {
  const statusConfig = {
    idle: {
      label: "Ready to generate",
      icon: Circle,
      color: "text-muted-foreground",
    },
    queued: {
      label: "Queued for processing...",
      icon: Upload,
      color: "text-blue-500",
    },
    processing: {
      label: "Generating 3D model...",
      icon: Box,
      color: "text-blue-500",
    },
    complete: {
      label: "Complete!",
      icon: CheckCircle,
      color: "text-green-500",
    },
    error: {
      label: "Generation failed",
      icon: AlertCircle,
      color: "text-destructive",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon
                className={cn(
                  "w-5 h-5",
                  config.color,
                  (status === "queued" || status === "processing") &&
                    "animate-pulse"
                )}
              />
              <span className="font-medium">{config.label}</span>
            </div>

            {progress > 0 && status !== "complete" && status !== "error" && (
              <span className="text-sm text-muted-foreground">
                {Math.round(progress)}%
              </span>
            )}
          </div>

          {(status === "queued" || status === "processing") && (
            <Progress value={progress} className="h-2" />
          )}

          {status === "error" && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status === "complete" && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Your STL file is ready to download!
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
