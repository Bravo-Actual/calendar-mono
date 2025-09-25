'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AvatarCropModal } from './avatar-crop-modal'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getAvatarUrl } from '@/lib/avatar-utils'

interface AvatarManagerProps {
  /** Current image URL */
  src?: string | null
  /** Fallback content for the avatar/image */
  fallback?: React.ReactNode
  /** Size of the image container */
  size?: number
  /** Shape of the image */
  variant?: 'circle' | 'square'
  /** Additional CSS classes */
  className?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Message to show when disabled and clicked */
  disabledMessage?: string
  /** Whether upload is in progress */
  isUploading?: boolean
  /** Callback when image is changed */
  onImageChange?: (imageBlob: Blob) => void | Promise<void>
  /** Callback when image is deleted */
  onImageDelete?: () => void | Promise<void>
  /** File size limit in MB */
  maxSizeMB?: number
  /** Accepted file types */
  acceptedTypes?: string[]
  /** Alt text for accessibility */
  alt?: string
}

export function AvatarManager({
  src,
  fallback,
  size = 96,
  variant = 'circle',
  className,
  disabled = false,
  disabledMessage = 'This action is currently disabled',
  isUploading = false,
  onImageChange,
  onImageDelete,
  maxSizeMB = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  alt = 'Avatar',
}: AvatarManagerProps) {
  const [showCropper, setShowCropper] = useState(false)
  const [imageForCropping, setImageForCropping] = useState<string | null>(null)

  // Process the avatar URL through the avatar utility
  const processedSrc = getAvatarUrl(src)

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset the input
    event.target.value = ''

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size exceeds ${maxSizeMB}MB limit.`)
      return
    }

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please select an image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageForCropping(reader.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    try {
      await onImageChange?.(croppedImageBlob)
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image')
    }
  }

  const handleDelete = async () => {
    try {
      await onImageDelete?.()
    } catch (error) {
      console.error('Error deleting image:', error)
      toast.error('Failed to delete image')
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    if (disabled) {
      // Show disabled message
      toast.error(disabledMessage)
      return
    }

    // Component is enabled, proceed with normal flow
    // If there's an existing image, show cropper with that image
    if (processedSrc) {
      setImageForCropping(null) // Use existing image
      setShowCropper(true)
    } else {
      // No image exists, trigger file upload
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = acceptedTypes.join(',')
      fileInput.onchange = (event) => {
        const target = event.target as HTMLInputElement
        const file = target.files?.[0]
        if (file) {
          handleImageSelect({ target } as React.ChangeEvent<HTMLInputElement>)
        }
      }
      fileInput.click()
    }
  }

  const containerClasses = cn(
    'relative group cursor-pointer',
    disabled && 'cursor-not-allowed opacity-50',
    className
  )

  const imageClasses = cn(
    variant === 'circle' ? 'rounded-full' : 'rounded-lg',
    'transition-opacity group-hover:opacity-80'
  )

  const overlayClasses = cn(
    'absolute inset-0 flex items-center justify-center',
    'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
    variant === 'circle' ? 'rounded-full' : 'rounded-lg'
  )

  return (
    <>
      <AvatarCropModal
        open={showCropper}
        onOpenChange={setShowCropper}
        imageSrc={imageForCropping || ''}
        existingImageSrc={processedSrc}
        onCropComplete={handleCropComplete}
        variant={variant}
      />

      <div
        className={containerClasses}
        style={{ width: size, height: size }}
        onClick={handleClick}
      >
        {variant === 'circle' ? (
          <Avatar className={imageClasses} style={{ width: size, height: size }}>
            <AvatarImage src={processedSrc || undefined} alt={alt} />
            <AvatarFallback>{fallback}</AvatarFallback>
          </Avatar>
        ) : (
          <div
            className={cn(
              'flex items-center justify-center overflow-hidden',
              processedSrc ? 'bg-background' : 'border-2 border-dashed border-muted-foreground/25 bg-muted/50',
              imageClasses
            )}
            style={{ width: size, height: size }}
          >
            {processedSrc ? (
               
              <img
                src={processedSrc}
                alt={alt}
                className="w-full h-full object-cover"
              />
            ) : (
              fallback
            )}
          </div>
        )}

        {/* Hover overlay with action buttons */}
        {!disabled && (
          <div className={overlayClasses}>
            <div className="flex items-center gap-1">
              {/* Upload/Change button */}
              <label htmlFor={`image-upload-${Math.random().toString(36).substr(2, 9)}`}>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn(
                    'p-0',
                    size >= 80 ? 'h-8 w-8' : 'h-6 w-6'
                  )}
                  disabled={isUploading}
                  asChild
                >
                  <span>
                    {isUploading ? (
                      <Loader2 className={cn(
                        'animate-spin',
                        size >= 80 ? 'h-4 w-4' : 'h-3 w-3'
                      )} />
                    ) : (
                      <Camera className={cn(
                        size >= 80 ? 'h-4 w-4' : 'h-3 w-3'
                      )} />
                    )}
                  </span>
                </Button>
                <Input
                  id={`image-upload-${Math.random().toString(36).substr(2, 9)}`}
                  type="file"
                  accept={acceptedTypes.join(',')}
                  className="sr-only"
                  onChange={handleImageSelect}
                  disabled={disabled || isUploading}
                />
              </label>

              {/* Delete button (only show if image exists) */}
              {processedSrc && onImageDelete && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className={cn(
                    'p-0',
                    size >= 80 ? 'h-8 w-8' : 'h-6 w-6'
                  )}
                  onClick={handleDelete}
                  disabled={isUploading}
                >
                  <Trash2 className={cn(
                    size >= 80 ? 'h-4 w-4' : 'h-3 w-3'
                  )} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}