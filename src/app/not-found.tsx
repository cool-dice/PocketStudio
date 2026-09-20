import type { Metadata } from "next";

import { RouteErrorView } from "@/components/app/route-error-view";
import {
  NOT_FOUND_META_TITLE,
  routeErrorViewModel,
} from "@/lib/route-error-copy";

export const metadata: Metadata = {
  title: NOT_FOUND_META_TITLE,
};

export default function NotFound() {
  return <RouteErrorView model={routeErrorViewModel("not-found")} />;
}
