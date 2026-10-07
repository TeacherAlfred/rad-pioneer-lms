"use client";

import { usePathname } from "next/navigation";
import ProgramsNavSidebar from "./ProgramsNavSidebar";

// Same shape as AdminSystemStatusChrome/AdminLeadsChrome - adds the
// Programs hover rail only on the featured-programs/registrations/term-
// program-settings pages. Doesn't overlap with the other sections' prefix
// lists (/admin/pricing stays under AdminFinanceChrome), so this nests
// safely in admin/layout.tsx.
const PROGRAMS_SECTION_PREFIXES = [
  '/admin/featured-programs',
  '/admin/registrations',
  '/admin/term-program-settings',
];

function isProgramsSection(pathname: string): boolean {
  return PROGRAMS_SECTION_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export default function AdminProgramsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isProgramsSection(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <ProgramsNavSidebar />
      <div className="pt-14 md:pt-0 md:pl-14">{children}</div>
    </>
  );
}
