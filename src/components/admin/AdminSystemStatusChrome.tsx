"use client";

import { usePathname } from "next/navigation";
import SystemStatusNavSidebar from "./SystemStatusNavSidebar";

// Same shape as AdminFinanceChrome/AdminLeadsChrome/AdminProjectsChrome -
// adds the System Status hover rail only on the systems-status/landmines
// pages, untouched everywhere else. Doesn't overlap with the other three
// section prefix lists, so this nests safely in admin/layout.tsx.
const SYSTEM_STATUS_SECTION_PREFIXES = [
  '/admin/dashboard-v2/systems-status',
  '/admin/dashboard-v2/landmines',
];

function isSystemStatusSection(pathname: string): boolean {
  return SYSTEM_STATUS_SECTION_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export default function AdminSystemStatusChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isSystemStatusSection(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <SystemStatusNavSidebar />
      <div className="md:pl-14">{children}</div>
    </>
  );
}
