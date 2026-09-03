"use client";

import { usePathname } from "next/navigation";
import LeadsNavSidebar from "./LeadsNavSidebar";

// Pages the hover sidebar applies to. Prefix match (not exact) so
// lead-funnel's sub-routes (stages/messages/notifications/guide) are
// covered by one entry. Everything else under /admin/* (dashboard,
// finance, courses, etc.) renders completely untouched - a pathname check
// here rather than moving these ~10 pages into a Next.js route group,
// since this app doesn't use route groups anywhere else and this is a
// five-line alternative for the same visible result.
const LEADS_SECTION_PREFIXES = [
  '/admin/lead-funnel',
  '/admin/bot-flows',
  '/admin/bot-media',
  '/admin/warm-list',
  '/admin/kids',
  '/admin/sessions',
  '/admin/dashboard-v2/lead-journey',
];

function isLeadsSection(pathname: string): boolean {
  return LEADS_SECTION_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export default function AdminLeadsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isLeadsSection(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <LeadsNavSidebar />
      <div className="md:pl-14">{children}</div>
    </>
  );
}
