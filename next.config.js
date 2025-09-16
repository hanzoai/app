/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.GITHUB_PAGES === 'true' ? 'export' : process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
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
  // For GitHub Pages deployment
  ...(process.env.GITHUB_PAGES === 'true' && {
    basePath: '/build',
    assetPrefix: '/build',
  }),
}

module.exports = nextConfig