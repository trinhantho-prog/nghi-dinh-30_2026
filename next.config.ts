import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: { proxyClientMaxBodySize: '21mb' },
};

export default nextConfig;
