"use client";

import { usePathname } from "next/navigation";

import { SiteHeader } from "./site-header";

export function PageHeader() {
  const pathname = usePathname();

  return <SiteHeader showMarketingNavigation={pathname !== "/"} />;
}
