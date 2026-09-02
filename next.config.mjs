/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist', 'tesseract.js', '@napi-rs/canvas'],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;


