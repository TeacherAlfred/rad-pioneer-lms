import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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