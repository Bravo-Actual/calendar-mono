"use client"

import { GalleryVerticalEnd } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      // Add a small delay to ensure the video is fully loaded
      const timer = setTimeout(() => {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
            })
            .catch(error => {
            })
        }
      }, 100)

      return () => clearTimeout(timer)
    } else {
    }
  }, [])

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Calendar
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block overflow-hidden min-h-svh bg-gray-900">
        {/* Video background */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          controls={false}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => console.error('LoginPage Video failed to load:', e)}
        >
          <source src="/splash.mp4" type="video/mp4" />
          {/* Fallback message */}
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}
