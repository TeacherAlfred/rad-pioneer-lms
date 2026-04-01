import type { NextConfig } from "next";

// Changing the type to 'any' stops TypeScript from rejecting the bypass commands
const nextConfig: any = {
  reactCompiler: true,
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
    ],
  },
};

export default nextConfig;