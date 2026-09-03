"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Gauge, Wallet, LayoutList, Users, FolderKanban, ListChecks } from "lucide-react";

// Light theme is deliberate for dashboard-v2 specifically (design doc §4):
// status-colour scanning (red/amber/green) reads faster on light than dark.
// This is a departure from the rest of the admin app's dark theme - scoped
// to these screens only, not applied elsewhere.
//
// Lead Journey and Landmines & Risk used to be their own top-level tabs -
// they're now reached as left-panel buttons from within Leads and System
// Status respectively (see LeadsNavSidebar / SystemStatusNavSidebar), to
// keep this bar from growing a tab per sub-view.
const TABS = [
  { label: "Home", path: "/admin/dashboard-v2", icon: Gauge },
  { label: "Leads", path: "/admin/lead-funnel/overview", icon: Users },
  { label: "System Status", path: "/admin/dashboard-v2/systems-status", icon: LayoutList },
  { label: "Money & Admin", path: "/admin/dashboard-v2/money-admin", icon: Wallet },
  { label: "Projects", path: "/admin/dashboard-v2/projects", icon: FolderKanban },
  { label: "Tasks", path: "/admin/dashboard-v2/tasks", icon: ListChecks },
];

// Always a single row, never wraps to a second line - on a narrow viewport
// (or once more tabs get added later) it scrolls horizontally instead, with
// arrow buttons at each end (like a carousel) rather than a dropdown, since
// that needs no measurement of which tabs "don't fit."
export function DashboardV2Nav() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, []);

  function scrollByAmount(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 180, behavior: "smooth" });
  }

  return (
    <div className="mb-8">
      <style>{`.dashboard-v2-nav-scroll::-webkit-scrollbar { display: none; }
        .dashboard-v2-nav-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <Link href="/admin/dashboard-v2" className="group inline-flex items-center gap-2 bg-white border border-stone-200 hover:border-blue-300 px-4 py-2 rounded-xl transition-all mb-6 shadow-sm">
        <ArrowLeft size={16} className="text-stone-400 group-hover:text-blue-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 group-hover:text-stone-900">Command Center</span>
      </Link>
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-stone-200 shadow-sm max-w-full">
        {canScrollLeft && (
          <button
            onClick={() => scrollByAmount(-1)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-50"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="dashboard-v2-nav-scroll flex items-center gap-2 overflow-x-auto scroll-smooth min-w-0"
        >
          {TABS.map((tab) => {
            const isActive = pathname === tab.path;
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  isActive ? "bg-stone-900 text-white shadow-sm" : "text-stone-500 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </div>
        {canScrollRight && (
          <button
            onClick={() => scrollByAmount(1)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-50"
            aria-label="Scroll tabs right"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
