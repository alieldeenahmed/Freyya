import type { NextConfig } from "next";

// Where the API runs. The browser never sees this: it calls /api/* on this site,
// and the requests are forwarded, which keeps the admin cookie same-origin.
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
