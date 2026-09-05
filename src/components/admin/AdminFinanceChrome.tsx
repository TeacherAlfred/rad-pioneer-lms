"use client";

import { usePathname } from "next/navigation";
import FinanceNavSidebar from "./FinanceNavSidebar";

// Same shape as AdminLeadsChrome (src/components/admin/AdminLeadsChrome.tsx)
// - adds the finance hover rail only on finance-v2/pricing/money-admin
// pages, untouched everywhere else. The two section prefix lists never
// overlap, so this nests safely alongside AdminLeadsChrome in admin/layout.tsx.
const FINANCE_SECTION_PREFIXES = [
  '/admin/finance-v2',
  '/admin/pricing',
  '/admin/dashboard-v2/money-admin',
];

function isFinanceSection(pathname: string): boolean {
  return FINANCE_SECTION_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export default function AdminFinanceChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isFinanceSection(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <FinanceNavSidebar />
      <div className="pt-14 md:pt-0 md:pl-14">{children}</div>
    </>
  );
}
