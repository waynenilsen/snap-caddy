"use client";

import { useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraCapture } from './CameraCapture';
import { ImageUpload } from './ImageUpload';
import { ImagePreview } from './ImagePreview';

interface CaptureStepProps {
  onImageCaptured: (imageDataUrl: string) => void;
}

export function CaptureStep({ onImageCaptured }: CaptureStepProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');

  const handleCapture = (imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    onImageCaptured(imageDataUrl);
  };

  const handleUpload = (imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    onImageCaptured(imageDataUrl);
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleError = (error: Error) => {
    console.error('Capture error:', error);
    // You can add toast notifications here
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
