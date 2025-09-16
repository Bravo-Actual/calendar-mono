import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['shiki'],
  turbopack: {
    root: 'C:\\Users\\micha\\coincrew-ai-dev\\calendar-mono',
  },
};

export default nextConfig;
