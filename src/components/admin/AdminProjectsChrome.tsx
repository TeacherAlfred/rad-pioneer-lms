"use client";

import { usePathname } from "next/navigation";
import ProjectsNavSidebar from "./ProjectsNavSidebar";

// Same shape as AdminFinanceChrome/AdminLeadsChrome - adds the projects
// hover rail only on dashboard-v2/projects pages, untouched everywhere
// else. Doesn't overlap with the finance prefix list (which separately
// covers dashboard-v2/money-admin), so this nests safely in admin/layout.tsx.
const PROJECTS_SECTION_PREFIXES = [
  '/admin/dashboard-v2/projects',
];

function isProjectsSection(pathname: string): boolean {
  return PROJECTS_SECTION_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export default function AdminProjectsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isProjectsSection(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <ProjectsNavSidebar />
      <div className="pt-14 md:pt-0 md:pl-14">{children}</div>
    </>
  );
}
