import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/", destination: "/app/overview", permanent: false },
      { source: "/app", destination: "/app/overview", permanent: false },
    ];
  },
};

export default nextConfig;
