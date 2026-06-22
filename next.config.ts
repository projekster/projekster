import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Geeft de compressie-engine toegang tot jouw Supabase kluis
      },
    ],
  },
};

export default nextConfig;