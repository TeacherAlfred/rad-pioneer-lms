"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, type LucideIcon } from "lucide-react";

// Mobile companion to the four hover-flyout rails (LeadsNavSidebar,
// FinanceNavSidebar, ProjectsNavSidebar, SystemStatusNavSidebar) - those are
// `hidden md:flex`, so below the md breakpoint there was previously no way
// to reach any of this navigation at all (hover has no touch equivalent).
// Each rail renders one of these alongside its desktop nav, passing its own
// topLink/groups/singleLinks - this component only owns the mobile
// presentation (top bar + full-screen drawer), not any section's link data.
type RadColorKey = 'blue' | 'teal' | 'green' | 'purple';
const RAD_COLORS: Record<RadColorKey, { text: string; bgTint: string }> = {
  blue: { text: 'text-rad-blue', bgTint: 'bg-rad-blue/10' },
  teal: { text: 'text-rad-teal', bgTint: 'bg-rad-teal/10' },
  green: { text: 'text-rad-green', bgTint: 'bg-rad-green/10' },
  purple: { text: 'text-rad-purple', bgTint: 'bg-rad-purple/10' },
};

export type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  colorKey?: RadColorKey;
  badge?: number;
};
export type MobileNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  colorKey: RadColorKey;
  items: MobileNavItem[];
  badge?: number;
};

type AdminMobileNavProps = {
  sectionLabel: string;
  topLink: MobileNavItem;
  groups?: MobileNavGroup[];
  singleLinks?: MobileNavItem[];
  commandCenterHref?: string;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-rad-teal text-white text-[10px] font-black flex items-center justify-center leading-none">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function AdminMobileNav({
  sectionLabel,
  topLink,
  groups = [],
  singleLinks = [],
  commandCenterHref = '/admin/dashboard-v2',
}: AdminMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Menu size={20} />
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{sectionLabel}</span>
        <Link
          href={topLink.href}
          aria-label={topLink.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isActive(pathname, topLink.href) ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <topLink.icon size={18} />
        </Link>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-[82vw] max-w-xs h-full bg-white shadow-xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">{sectionLabel}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-4">
              <Link
                href={topLink.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${isActive(pathname, topLink.href) ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <topLink.icon size={18} />
                {topLink.label}
              </Link>

              {groups.map(group => {
                const colors = RAD_COLORS[group.colorKey];
                const GroupIcon = group.icon;
                return (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <GroupIcon size={13} className={colors.text} />
                      {group.label}
                      <Badge count={group.badge || 0} />
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map(item => {
                        const ItemIcon = item.icon;
                        const active = isActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${active ? `${colors.bgTint} ${colors.text}` : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            <ItemIcon size={16} className={active ? colors.text : 'text-slate-400'} />
                            {item.label}
                            <Badge count={item.badge || 0} />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {singleLinks.length > 0 && (
                <div className="space-y-0.5 pt-1 border-t border-slate-100">
                  {singleLinks.map(item => {
                    const ItemIcon = item.icon;
                    const active = isActive(pathname, item.href);
                    const colors = item.colorKey ? RAD_COLORS[item.colorKey] : null;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${active && colors ? `${colors.bgTint} ${colors.text}` : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <ItemIcon size={16} className={active && colors ? colors.text : 'text-slate-400'} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-3 shrink-0">
              <Link
                href={commandCenterHref}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <LayoutDashboard size={18} />
                Command Center
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
