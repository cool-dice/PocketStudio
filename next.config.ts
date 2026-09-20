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
  // Keep both `/socket.io` and `/socket.io/` as distinct URLs. Bare
  // `/socket.io` is handled in `src/proxy.ts`; do not rewrite it here —
  // Turbopack's `/socket.io` → `/socket.io/` rewrite hangs with 0 bytes.
  skipTrailingSlashRedirect: true,
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
