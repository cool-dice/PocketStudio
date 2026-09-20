import type { MetadataRoute } from "next";

import { robotsMetadata } from "@/lib/robots";

export default function robots(): MetadataRoute.Robots {
  return robotsMetadata();
}
