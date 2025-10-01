'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AvatarCropper } from './avatar-cropper';

interface AvatarCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  existingImageSrc?: string | null;
  onCropComplete: (croppedImageBlob: Blob) => void;
  variant?: 'circle' | 'square';
}

export function AvatarCropModal({
  open,
  onOpenChange,
  imageSrc: initialImageSrc,
  existingImageSrc,
  onCropComplete,
  variant = 'circle',
}: AvatarCropModalProps) {
  const [currentImageSrc, setCurrentImageSrc] = useState(initialImageSrc);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [needsFileUpload, setNeedsFileUpload] = useState(false);

  // Update image when modal opens with new image
  useEffect(() => {
    if (open) {
      if (initialImageSrc) {
        setCurrentImageSrc(initialImageSrc);
        setNeedsFileUpload(false);
      } else if (existingImageSrc) {
        // Show existing image
        setCurrentImageSrc(existingImageSrc);
        setNeedsFileUpload(false);
      } else {
        // No image available, need to upload
        setNeedsFileUpload(true);
        // Auto-trigger file selection
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 100);
      }
    }
  }, [open, initialImageSrc, existingImageSrc]);

  const handleCropComplete = (croppedImageBlob: Blob) => {
    onCropComplete(croppedImageBlob);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleImageChange = (newImageSrc: string) => {
    setCurrentImageSrc(newImageSrc);
    setNeedsFileUpload(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        handleImageChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Crop Avatar</DialogTitle>
          <DialogDescription>
            {needsFileUpload
              ? 'Select an image to get started.'
              : `Adjust the crop area, zoom, and rotation for your ${variant === 'circle' ? 'avatar' : 'image'}.`}
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input for auto-upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileSelect}
        />

        {needsFileUpload ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              {fileInputRef.current ? 'File dialog should have opened...' : 'Loading...'}
            </p>
          </div>
        ) : (
          <AvatarCropper
            imageSrc={currentImageSrc}
            onCropComplete={handleCropComplete}
            onCancel={handleCancel}
            onImageChange={handleImageChange}
            variant={variant}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
