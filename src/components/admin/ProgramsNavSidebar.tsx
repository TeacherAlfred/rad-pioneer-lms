"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Sparkles, Users, Settings, Package, Globe, CalendarDays, GraduationCap, Home,
  type LucideIcon,
} from "lucide-react";
import AdminMobileNav from "./AdminMobileNav";

// Same slim hover-flyout rail shell as LeadsNavSidebar/SystemStatusNavSidebar,
// mounted once via AdminProgramsChrome. Featured Programs is the section's
// home (it's what the dashboard-v2 "Programs" tab opens); Registrations and
// the Term Program page settings are one-click siblings, and the public
// pages these programs feed sit behind a hover flyout since they open in a
// new tab rather than being admin screens.
type RadColorKey = 'blue' | 'teal' | 'green' | 'purple';
const RAD_COLORS: Record<RadColorKey, { text: string; bgTint: string }> = {
  blue: { text: 'text-rad-blue', bgTint: 'bg-rad-blue/10' },
  teal: { text: 'text-rad-teal', bgTint: 'bg-rad-teal/10' },
  green: { text: 'text-rad-green', bgTint: 'bg-rad-green/10' },
  purple: { text: 'text-rad-purple', bgTint: 'bg-rad-purple/10' },
};

type NavItem = { href: string; label: string; icon: LucideIcon };

const HOME_LINK: NavItem = { href: '/admin/featured-programs', label: 'Featured Programs', icon: Sparkles };
const SINGLE_LINKS: { item: NavItem; colorKey: RadColorKey }[] = [
  { item: { href: '/admin/registrations', label: 'Registrations', icon: Users }, colorKey: 'blue' },
  { item: { href: '/admin/term-program-settings', label: 'Term Program Page', icon: Settings }, colorKey: 'teal' },
  // Lives under the Finance rail (AdminFinanceChrome) - linked here because
  // a program can't go live without a published package (the publish gate).
  { item: { href: '/admin/pricing', label: 'Pricing Library', icon: Package }, colorKey: 'green' },
];
const LIVE_PAGES = {
  id: 'live', label: 'Live Pages', icon: Globe, colorKey: 'purple' as RadColorKey,
  items: [
    { href: '/events', label: '/events', icon: CalendarDays },
    { href: '/term-program', label: '/term-program', icon: GraduationCap },
    { href: '/', label: 'Homepage', icon: Home },
  ] as NavItem[],
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export default function ProgramsNavSidebar() {
  const pathname = usePathname();
  const homeActive = isActive(pathname, HOME_LINK.href);
  const liveColors = RAD_COLORS[LIVE_PAGES.colorKey];

  return (
    <>
    <AdminMobileNav
      sectionLabel="Programs"
      topLink={HOME_LINK}
      groups={[LIVE_PAGES]}
      singleLinks={SINGLE_LINKS.map(l => ({ ...l.item, colorKey: l.colorKey }))}
    />
    <nav className="hidden md:flex fixed left-0 top-0 h-full w-14 bg-white border-r border-slate-200 z-40 flex-col items-center py-4">
      <div className="flex-1 flex flex-col items-center gap-2">
        <Link
          href={HOME_LINK.href}
          title={HOME_LINK.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-900 transition-colors ${homeActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
        >
          <HOME_LINK.icon size={18} />
        </Link>

        {SINGLE_LINKS.map(({ item, colorKey }) => {
          const active = isActive(pathname, item.href);
          const colors = RAD_COLORS[colorKey];
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${active ? `${colors.bgTint} ${colors.text}` : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              <item.icon size={18} />
            </Link>
          );
        })}

        <div className="w-8 border-t border-slate-100 my-1" />

        <div className="relative group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center cursor-default text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <LIVE_PAGES.icon size={18} />
          </div>
          <div className="absolute left-full top-0 ml-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-40">
            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{LIVE_PAGES.label}</div>
            {LIVE_PAGES.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                target="_blank"
                className="flex items-center gap-2 px-2 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <item.icon size={14} className={liveColors.text} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
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
    </>
  );
}
