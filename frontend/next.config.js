/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${apiTarget}/static/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
