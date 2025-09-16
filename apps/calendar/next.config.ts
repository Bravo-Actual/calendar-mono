import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['shiki'],
  experimental: {
    serverComponentsExternalPackages: ['shiki'],
  },
};
