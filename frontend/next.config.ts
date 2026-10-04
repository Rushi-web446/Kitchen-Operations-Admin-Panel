import type { NextConfig } from "next";

const rawApiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3001";
const API_BASE_URL = (rawApiBaseUrl || "http://localhost:3001").replace(/\/$/, "");
const hasValidApiBaseUrl =
  API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://");

if (!hasValidApiBaseUrl && typeof console !== "undefined") {
  console.warn(
    `[next.config] NEXT_PUBLIC_API_URL is not set to a valid http(s) URL (got: ${JSON.stringify(rawApiBaseUrl)}). Skipping /api rewrites. Set NEXT_PUBLIC_API_URL in the Vercel dashboard before deploying.`,
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    if (!hasValidApiBaseUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
