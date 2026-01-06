"use client";

import { useState } from 'react';
import { Camera, Upload, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CameraCapture } from './CameraCapture';
import { ImageUpload } from './ImageUpload';
import { ImagePreview } from './ImagePreview';

interface CaptureStepProps {
  onImageCaptured: (imageDataUrl: string) => void;
}

export function CaptureStep({ onImageCaptured }: CaptureStepProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [error, setError] = useState<string | null>(null);

  const handleCapture = (imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    onImageCaptured(imageDataUrl);
    setError(null); // Clear any errors on success
  };

  const handleUpload = (imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    onImageCaptured(imageDataUrl);
    setError(null); // Clear any errors on success
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setError(null);
  };

  const handleError = (error: Error) => {
    console.error('Capture error:', error);

    // Transform technical errors into user-friendly messages
    let errorMessage = "Unable to capture image. Please try again.";

    if (error.message.includes("permission") || error.message.includes("denied")) {
      errorMessage = "Camera permission denied. Please allow camera access in your browser settings and try again.";
    } else if (error.message.includes("not found") || error.message.includes("no device")) {
      errorMessage = "No camera found. Please connect a camera or try uploading an image instead.";
    } else if (error.message.includes("size") || error.message.includes("large")) {
      errorMessage = "Image file is too large. Please choose a smaller image (maximum 10MB).";
    } else if (error.message.includes("format") || error.message.includes("type")) {
      errorMessage = "Unsupported file format. Please upload a JPG, PNG, or WebP image.";
    } else if (error.message.includes("network")) {
      errorMessage = "Network error. Please check your connection and try again.";
    }

    setError(errorMessage);
  };

  const handleDismissError = () => {
    setError(null);
  };

  if (capturedImage) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
            <CardDescription>
              Review your captured image. You can zoom and pan to inspect details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImagePreview
              src={capturedImage}
              alt="Captured object"
              onRetake={handleRetake}
              enableZoom={true}
              enablePan={true}
              showInfo={true}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Capture Image</CardTitle>
          <CardDescription>
            Take a photo of your object or upload an existing image. Make sure the object is
            clearly visible and well-lit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissError}
                  className="h-6 w-6 p-0 ml-2 hover:bg-destructive/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'camera' | 'upload')}
            className="w-full"
          >
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
              <TabsTrigger value="camera" className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Camera
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="mt-0">
              <CameraCapture
                onCapture={handleCapture}
                onError={handleError}
                enableFlash={true}
                aspectRatio={4 / 3}
              />
            </TabsContent>

            <TabsContent value="upload" className="mt-0">
              <ImageUpload
                onUpload={handleUpload}
                onError={handleError}
                maxSizeBytes={10 * 1024 * 1024}
              />
            </TabsContent>
          </Tabs>

          {/* Tips section */}
          <div className="mt-8 max-w-2xl mx-auto">
            <h3 className="text-sm font-medium mb-3">Tips for best results:</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>Place the object on a contrasting background</li>
              <li>Ensure good, even lighting without harsh shadows</li>
              <li>Include a ruler or known-size object for scale reference</li>
              <li>Take the photo from directly above for accurate measurements</li>
              <li>Avoid blurry images - keep the camera steady</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
