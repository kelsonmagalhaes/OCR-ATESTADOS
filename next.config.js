/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy libs out of the server bundle (Next.js 14 syntax)
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js", "pdfjs-dist"],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pdfjs-dist requires canvas to be false in browser builds
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
