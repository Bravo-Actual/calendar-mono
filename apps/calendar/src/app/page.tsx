"use client";

import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/login-form"
import { GalleryVerticalEnd } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Link from "next/link";

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!loading && user) {
      router.push('/calendar');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      console.log('RootPage: Video element found, attempting to play')
      // Add a small delay to ensure the video is fully loaded
      const timer = setTimeout(() => {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('RootPage: Video play succeeded')
            })
            .catch(error => {
              console.log('RootPage: Auto-play was prevented:', error)
            })
        }
      }, 100)

      return () => clearTimeout(timer)
    } else {
      console.log('RootPage: Video element not found')
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return null; // Will redirect to /calendar
  }

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
          onError={(e) => console.error('RootPage Video failed to load:', e)}
          onLoadStart={() => console.log('RootPage Video started loading')}
          onCanPlay={() => console.log('RootPage Video can play')}
          onLoadedData={() => console.log('RootPage Video loaded data')}
          onPlay={() => console.log('RootPage Video started playing')}
          onPause={() => console.log('RootPage Video paused')}
        >
          <source src="/splash.mp4" type="video/mp4" />
          {/* Fallback message */}
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}