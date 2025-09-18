/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable dev indicators in production
  devIndicators: {
    appIsrStatus: process.env.NODE_ENV !== 'production',
    buildActivity: process.env.NODE_ENV !== 'production',
    buildActivityPosition: 'bottom-right',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'huggingface.co',
      },
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig