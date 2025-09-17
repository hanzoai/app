/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
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