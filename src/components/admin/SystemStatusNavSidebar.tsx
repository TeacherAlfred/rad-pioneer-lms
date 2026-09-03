"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutList, AlertTriangle } from "lucide-react";

// Same slim hover-flyout rail shell as LeadsNavSidebar/FinanceNavSidebar/
// ProjectsNavSidebar, mounted once via AdminSystemStatusChrome. Only two
// destinations here (Landmines & Risk used to be its own top-level tab,
// now lives as a button under System Status instead) so no flyout groups
// are needed - just two direct icon links, same treatment as the
// Overview/Guide direct links in LeadsNavSidebar.
type RadColorKey = 'blue' | 'teal' | 'green' | 'purple';
const RAD_COLORS: Record<RadColorKey, { text: string; bgTint: string }> = {
  blue: { text: 'text-rad-blue', bgTint: 'bg-rad-blue/10' },
  teal: { text: 'text-rad-teal', bgTint: 'bg-rad-teal/10' },
  green: { text: 'text-rad-green', bgTint: 'bg-rad-green/10' },
  purple: { text: 'text-rad-purple', bgTint: 'bg-rad-purple/10' },
};

const HOME_LINK = { href: '/admin/dashboard-v2/systems-status', label: 'System Status', icon: LayoutList };
const LANDMINES_LINK = { href: '/admin/dashboard-v2/landmines', label: 'Landmines & Risk', icon: AlertTriangle, colorKey: 'purple' as RadColorKey };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export default function SystemStatusNavSidebar() {
  const pathname = usePathname();
  const homeActive = isActive(pathname, HOME_LINK.href);
  const landminesActive = isActive(pathname, LANDMINES_LINK.href);
  const landminesColors = RAD_COLORS[LANDMINES_LINK.colorKey];

  return (
    <nav className="hidden md:flex fixed left-0 top-0 h-full w-14 bg-white border-r border-slate-200 z-40 flex-col items-center py-4">
      <div className="flex-1 flex flex-col items-center gap-2">
        <Link
          href={HOME_LINK.href}
          title={HOME_LINK.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-900 transition-colors ${homeActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
        >
          <HOME_LINK.icon size={18} />
        </Link>

        <div className="w-8 border-t border-slate-100 my-1" />

        <Link
          href={LANDMINES_LINK.href}
          title={LANDMINES_LINK.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${landminesActive ? `${landminesColors.bgTint} ${landminesColors.text}` : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
        >
          <LANDMINES_LINK.icon size={18} />
        </Link>
      </div>

      <div className="border-t border-slate-100 pt-3 w-full flex justify-center">
        <Link
          href="/admin/dashboard-v2"
          title="Command Center"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <LayoutDashboard size={18} />
        </Link>
      </div>
    </nav>
  );
}
