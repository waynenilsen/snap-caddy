"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";

interface CameraMetadata {
  timestamp: number;
  dimensions: { width: number; height: number };
  deviceInfo?: MediaDeviceInfo;
}

interface CameraCaptureProps {
  onCapture: (imageData: string, metadata?: CameraMetadata) => void;
  onError?: (error: Error) => void;
  aspectRatio?: number;
  maxResolution?: { width: number; height: number };
  enableFlash?: boolean;
}

export function CameraCapture({
  onCapture,
  onError,
  aspectRatio = 4 / 3,
  maxResolution,
  enableFlash = true,
}: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [flashEnabled, setFlashEnabled] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get available cameras on mount
  useEffect(() => {
    // Check if mediaDevices API is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      const errorMsg =
        "Camera API not available. Please use HTTPS or localhost.";
      setError(errorMsg);
      onError?.(new Error(errorMsg));
      return;
    }

    navigator.mediaDevices
      .enumerateDevices()
      .then((deviceList) => {
        const cameras = deviceList.filter((d) => d.kind === "videoinput");
        setDevices(cameras);
        if (cameras.length > 0) {
          setSelectedDeviceId(cameras[0].deviceId);
        }
      })
      .catch((err) => {
        console.error("Error enumerating devices:", err);
        setError("Failed to access camera devices. Please check permissions.");
        onError?.(err as Error);
      });
  }, [onError]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    // Check if mediaDevices API is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMessage =
        "Camera API not available. Please use HTTPS or access via localhost. For local network access, use the Upload tab instead.";
      setError(errorMessage);
      onError?.(new Error(errorMessage));
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: maxResolution?.width || 1920 },
          height: { ideal: maxResolution?.height || 1080 },
          facingMode: "environment", // Prefer rear camera on mobile
        },
        audio: false,
      };

      const mediaStream =
        await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      const errorMessage =
        "Camera access denied or not available. Please ensure you have granted camera permissions.";
      setError(errorMessage);
      onError?.(err as Error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  };

  const applyFlashEffect = () => {
    const flashOverlay = document.createElement("div");
    flashOverlay.className =
      "fixed inset-0 bg-white pointer-events-none z-50 animate-flash";
    flashOverlay.style.animation = "flash 200ms ease-out";
    document.body.appendChild(flashOverlay);

    setTimeout(() => flashOverlay.remove(), 200);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0);

    // Apply flash effect if enabled
    if (flashEnabled && enableFlash) {
      applyFlashEffect();
    }

    // Convert to base64
    const imageData = canvas.toDataURL("image/jpeg", 0.95);

    const metadata: CameraMetadata = {
      timestamp: Date.now(),
      dimensions: {
        width: canvas.width,
        height: canvas.height,
      },
      deviceInfo: devices.find((d) => d.deviceId === selectedDeviceId),
    };

    onCapture(imageData, metadata);
    stopCamera();
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-0">
          {!isStreaming ? (
            <div
              className="aspect-[4/3] bg-muted flex items-center justify-center"
              style={{ aspectRatio: aspectRatio }}
            >
              <Button onClick={startCamera} size="lg">
                <Camera className="w-6 h-6 mr-2" />
                Start Camera
              </Button>
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto bg-black"
                style={{ aspectRatio: aspectRatio }}
              />

              <canvas ref={canvasRef} className="hidden" />

              {/* Camera controls overlay */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                {enableFlash && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setFlashEnabled(!flashEnabled)}
                    aria-label="Toggle flash"
                    className="rounded-full"
                  >
                    <Zap
                      className="w-5 h-5"
                      fill={flashEnabled ? "currentColor" : "none"}
                    />
                  </Button>
                )}

                <Button
                  size="lg"
                  onClick={captureImage}
                  className="w-16 h-16 rounded-full"
                  aria-label="Capture photo"
                >
                  <Camera className="w-6 h-6" />
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  onClick={stopCamera}
                  aria-label="Close camera"
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Camera selector for multiple cameras */}
              {devices.length > 1 && (
                <div className="absolute top-4 right-4">
                  <Select
                    value={selectedDeviceId}
                    onValueChange={(value) => {
                      setSelectedDeviceId(value);
                      if (isStreaming) {
                        stopCamera();
                        // Restart with new device
                        setTimeout(startCamera, 100);
                      }
                    }}
                  >
                    <SelectTrigger className="w-40 bg-background/90 backdrop-blur-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device, index) => (
                        <SelectItem
                          key={device.deviceId}
                          value={device.deviceId}
                        >
                          {device.label || `Camera ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <style jsx>{`
        @keyframes flash {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
