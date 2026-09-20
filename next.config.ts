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
