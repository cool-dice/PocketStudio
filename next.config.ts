import type { NextConfig } from "next";

import {
  apiNoindexHeaderList,
  apiNoStoreHeaderList,
  securityHeaderList,
} from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Internal only — never proxy to :3003 here (Turbopack hangs).
    // Engine.IO without a trailing slash would miss the App Router route.
    return {
      beforeFiles: [
        { source: "/socket.io", destination: "/socket.io/" },
      ],
    };
  },
  async headers() {
    return [
      { source: "/", headers: securityHeaderList },
      { source: "/:path*", headers: securityHeaderList },
      {
        source: "/api/:path*",
        headers: [...apiNoindexHeaderList, ...apiNoStoreHeaderList],
      },
    ];
  },
};

export default nextConfig;
