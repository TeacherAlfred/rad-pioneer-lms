"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, HeartPulse, LayoutDashboard, Gauge, Vote, ClipboardList, Settings, Footprints, NotebookPen, Shirt } from "lucide-react";

// Same slim hover-flyout rail as FinanceNavSidebar/LeadsNavSidebar
// (src/components/admin/FinanceNavSidebar.tsx), mounted once via
// AdminProjectsChrome rather than duplicated per-page. Each project is its
// own group revealing that project's sub-pages - Irene Fitness is the only
// project today, but this scales the same way Finance's groups do when a
// second project dashboard ships (a new group, not a restructure).
type NavItem = { href: string; label: string; icon: any };
type NavGroup = { id: string; label: string; icon: any; items: NavItem[]; colorKey: RadColorKey };

type RadColorKey = 'blue' | 'teal' | 'green' | 'purple';
const RAD_COLORS: Record<RadColorKey, { text: string; bgTint: string }> = {
  blue: { text: 'text-rad-blue', bgTint: 'bg-rad-blue/10' },
  teal: { text: 'text-rad-teal', bgTint: 'bg-rad-teal/10' },
  green: { text: 'text-rad-green', bgTint: 'bg-rad-green/10' },
  purple: { text: 'text-rad-purple', bgTint: 'bg-rad-purple/10' },
};

const HOME_LINK: NavItem = { href: '/admin/dashboard-v2/projects', label: 'Projects', icon: FolderKanban };

const GROUPS: NavGroup[] = [
  {
    id: 'irene-fitness', label: 'Irene Fitness', icon: HeartPulse, colorKey: 'blue',
    items: [
      { href: '/admin/dashboard-v2/projects/irene-fitness', label: 'Overview', icon: Gauge },
      { href: '/admin/dashboard-v2/projects/irene-fitness/votes', label: 'Votes', icon: Vote },
      { href: '/admin/dashboard-v2/projects/irene-fitness/responses', label: 'Responses', icon: ClipboardList },
      { href: '/admin/dashboard-v2/projects/irene-fitness/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    id: 'fitness', label: 'Personal Fitness', icon: Footprints, colorKey: 'green',
    items: [
      { href: '/admin/dashboard-v2/projects/fitness', label: 'Overview', icon: Gauge },
      { href: '/admin/dashboard-v2/projects/fitness/log', label: 'Log', icon: NotebookPen },
      { href: '/admin/dashboard-v2/projects/fitness/gear', label: 'Gear', icon: Shirt },
      { href: '/admin/dashboard-v2/projects/fitness/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export default function ProjectsNavSidebar() {
  const pathname = usePathname();
  const homeActive = pathname === HOME_LINK.href;

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

        {GROUPS.map(group => {
          const groupActive = group.items.some(item => isActive(pathname, item.href));
          const GroupIcon = group.icon;
          const colors = RAD_COLORS[group.colorKey];
          return (
            <div key={group.id} className="relative group">
              <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center cursor-default transition-colors ${groupActive ? `${colors.bgTint} ${colors.text}` : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                <GroupIcon size={18} />
              </div>

              <div className="absolute left-full top-0 ml-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-40">
                <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{group.label}</div>
                {group.items.map(item => {
                  const ItemIcon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-2 py-2 rounded-xl text-xs font-bold transition-colors ${active ? `${colors.bgTint} ${colors.text}` : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ItemIcon size={14} className={active ? colors.text : 'text-slate-400'} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
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
