/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep pdfjs-dist out of server bundle (it's browser-only)
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
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
