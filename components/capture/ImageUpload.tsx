"use client";

import { useState, useRef } from 'react';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onUpload: (imageData: string, file: File) => void;
  onError?: (error: Error) => void;
  accept?: string;
  maxSizeBytes?: number;
  multiple?: boolean;
}

export function ImageUpload({
  onUpload,
  onError,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  multiple = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a JPEG, PNG, or WebP image',
      };
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size must be less than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
      };
    }

    return { valid: true };
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file);

    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      onError?.(new Error(validation.error));
      return;
    }

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      onUpload(imageData, file);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      const errorMessage = 'Failed to read file';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-8">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-12 transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-muted',
              isProcessing && 'opacity-50 pointer-events-none'
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              {isProcessing ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Processing image...</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">
                      Drag and drop your image here
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, or WebP • Max {Math.round(maxSizeBytes / 1024 / 1024)}MB
                  </p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              aria-label="Upload image file"
            />
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
