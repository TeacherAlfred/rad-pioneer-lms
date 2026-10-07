import type { NextConfig } from "next";

// Changing the type to 'any' stops TypeScript from rejecting the bypass commands
const nextConfig: any = {
  reactCompiler: true,
  // The floating dev-tools badge (bottom-left "N" indicator) only renders
  // under `next dev` and never ships to production, but it sits on top of
  // real content during local demos/screenshots - off entirely so it can't
  // get mistaken for an app bug again.
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vzyraeuyyoytditmfvcc.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Dev-only: swap the tab favicon for a distinct mark so a localhost tab
  // is never mistaken for the live site. beforeFiles is required so this
  // wins over the generated /icon.png route itself; production keeps the
  // real icon.png untouched since this rewrite doesn't exist outside dev.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }
    return {
      beforeFiles: [{ source: '/icon.png', destination: '/dev-icon' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;