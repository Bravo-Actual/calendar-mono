'use client';

// import Image from 'next/image'; // Removed to fix CORS issue with canvas
import { useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { RotateCw, Upload, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface AvatarCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  onImageChange?: (newImageSrc: string) => void;
  variant?: 'circle' | 'square';
}

export function AvatarCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  onImageChange,
  variant = 'circle',
}: AvatarCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [rotate, setRotate] = useState<number>(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image load to set initial crop
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const size = Math.min(width, height) * 0.8; // 80% of smallest dimension
    const x = (width - size) / 2;
    const y = (height - size) / 2;

    setCrop({
      unit: 'px',
      x,
      y,
      width: size,
      height: size,
    });
  };

  // Handle file selection for changing image
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageChange) {
      const reader = new FileReader();
      reader.onload = () => {
        onImageChange(reader.result as string);
        // Reset crop for new image
        setScale(1);
        setRotate(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCroppedImg = async () => {
    if (!imgRef.current || !completedCrop) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  };

  const handleCropComplete = async () => {
    try {
      const croppedImageBlob = await getCroppedImg();
      if (croppedImageBlob) {
        onCropComplete(croppedImageBlob);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div
        className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center"
        style={{ height: '400px', width: '100%' }}
      >
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={1}
          circularCrop={variant === 'circle'}
          keepSelection
          className="flex items-center justify-center max-w-full"
        >
          {}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop"
            onLoad={onImageLoad}
            crossOrigin="anonymous"
            style={{
              transform: `scale(${scale}) rotate(${rotate}deg)`,
              maxHeight: '400px',
              maxWidth: '100%',
              width: 'auto',
              height: 'auto',
              display: 'block',
            }}
          />
        </ReactCrop>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <ZoomIn className="w-4 h-4" />
            <Slider
              value={[scale]}
              onValueChange={([value]) => setScale(value)}
              min={1}
              max={3}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm w-10">{scale.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <RotateCw className="w-4 h-4" />
            <Slider
              value={[rotate]}
              onValueChange={([value]) => setRotate(value)}
              min={-180}
              max={180}
              step={1}
              className="flex-1"
            />
            <span className="text-sm w-12">{rotate}°</span>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} type="button">
            <Upload className="w-4 h-4 mr-2" />
            Choose Different Image
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleCropComplete}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
