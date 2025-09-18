import type { NextConfig } from "next";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compute monorepo root relative to this app's folder
// apps/calendar -> ../../ (two levels up to reach monorepo root)
const monorepoRoot = path.resolve(__dirname, '..', '..');

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['shiki'],
  // Tell Next.js where the true repo root is for file tracing in monorepos
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
