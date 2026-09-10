"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, MessageSquare, Baby, LayoutDashboard, GitBranch, ClipboardList,
  BookOpen, Bell, FileText, CalendarClock, Gauge, Kanban, Phone, ListChecks, Send, Inbox,
} from "lucide-react";
import AdminMobileNav from "./AdminMobileNav";

const PENDING_POLL_MS = 30000;
// Pages whose icon should carry the pending-buffer badge - the group icon
// itself plus the one flyout item that's actually the notifications
// settings/pipeline page. Deliberately not every icon - "relevant" means
// where the buffer queue actually lives, not a generic unread dot.
const BADGE_HREFS = new Set(['/admin/lead-funnel/notifications']);

type NavItem = { href: string; label: string; icon: any };
type NavGroup = { id: string; label: string; icon: any; items: NavItem[]; colorKey: RadColorKey };

// RAD's official brand palette (see src/app/globals.css --rad-* tokens) -
// each group/single icon gets the one that fits it, used only for its
// active state. Literal class strings (not template-interpolated) so
// Tailwind's scanner picks them up - same pattern as STATUS_STYLES etc.
// elsewhere in this app.
type RadColorKey = 'blue' | 'teal' | 'green' | 'purple';
const RAD_COLORS: Record<RadColorKey, { text: string; bgTint: string }> = {
  blue: { text: 'text-rad-blue', bgTint: 'bg-rad-blue/10' },
  teal: { text: 'text-rad-teal', bgTint: 'bg-rad-teal/10' },
  green: { text: 'text-rad-green', bgTint: 'bg-rad-green/10' },
  purple: { text: 'text-rad-purple', bgTint: 'bg-rad-purple/10' },
};

// The overview dashboard sits above the three groups (uppermost icon, kept
// solid black regardless of active state - it's the "home" of this whole
// section, not one of the color-coded groups), and the Guide sits below
// them (bottom of the "content" icons, above the divider).
const OVERVIEW_LINK: NavItem = { href: '/admin/lead-funnel/overview', label: 'Leads Overview', icon: Gauge };
// One click, no hover-flyout needed - this is a work-session tool used at
// the start of every calling slot, not a reference page tucked into the
// Leads group's list. Sits right under Overview for the same reason.
const CALL_QUEUE_LINK: { item: NavItem; colorKey: RadColorKey } = {
  item: { href: '/admin/lead-funnel/call-queue', label: 'Call Queue', icon: Phone },
  colorKey: 'blue',
};
// Same "one click, no flyout" treatment as Call Queue - a record you check
// when something didn't arrive, not a reference page worth burying a click
// deeper behind the Messages group's hover flyout.
const SENT_LINK: { item: NavItem; colorKey: RadColorKey } = {
  item: { href: '/admin/lead-funnel/sent', label: 'Sent Messages', icon: Send },
  colorKey: 'teal',
};
// The pending-approval queue for business-number leads (leads.is_business_number -
// see src/lib/leadSend.ts) - a bot reply that would normally go straight out
// lands here instead, waiting for an admin to approve or reject it by hand.
// Distinct from Sent above: that's a log of what already went out.
const OUTBOX_LINK: { item: NavItem; colorKey: RadColorKey } = {
  item: { href: '/admin/lead-funnel/outbox', label: 'Outbox', icon: Inbox },
  colorKey: 'teal',
};
const GUIDE_LINK: { item: NavItem; colorKey: RadColorKey } = {
  item: { href: '/admin/lead-funnel/guide', label: 'Guide', icon: BookOpen },
  colorKey: 'purple',
};

// The grouping behind the hover rail - see RAD Lead Funnel guide for what
// each page actually does. Order here is the order groups appear top-down.
const GROUPS: NavGroup[] = [
  {
    id: 'leads', label: 'Leads', icon: Users, colorKey: 'blue',
    items: [
      { href: '/admin/lead-funnel/list', label: 'Lead Funnel', icon: Users },
      { href: '/admin/lead-funnel/stages', label: 'Funnel Stages', icon: GitBranch },
      { href: '/admin/warm-list', label: 'Warm List', icon: ClipboardList },
      { href: '/admin/dashboard-v2/lead-journey', label: 'Lead Journey', icon: Kanban },
    ],
  },
  {
    id: 'messages', label: 'Messages & Notifications', icon: MessageSquare, colorKey: 'teal',
    items: [
      { href: '/admin/lead-funnel/messages', label: 'Message Activity', icon: MessageSquare },
      { href: '/admin/lead-funnel/notifications', label: 'Notifications', icon: Bell },
      { href: '/admin/template-rollouts', label: 'Template Rollouts', icon: ListChecks },
      { href: '/admin/bot-flows', label: 'Bot Flows', icon: GitBranch },
      { href: '/admin/bot-media', label: 'Bot Media', icon: FileText },
    ],
  },
  {
    id: 'kids', label: 'Kids & Parents', icon: Baby, colorKey: 'green',
    items: [
      { href: '/admin/kids', label: 'Kids', icon: Baby },
      { href: '/admin/sessions', label: 'Upcoming Sessions', icon: CalendarClock },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

// Small pill in the corner of an icon showing how many leads currently
// have something queued in admin_notification_buffer. Not a generic
// "unread" red dot on purpose - it's the buffer's own count, in the
// group's own color, so it reads as "this many pending" not "something's
// wrong".
function PendingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rad-teal text-white text-[9px] font-black flex items-center justify-center leading-none ring-2 ring-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

// Polls the same admin-facing pending-preview endpoint the Notification
// Settings page uses, so the badge and that page's own "Pending for next
// cycle" list are always in agreement. Lives in the sidebar (mounted once
// via the shared admin layout) rather than per-page, so it keeps polling
// and updating as the admin navigates between pages without needing to be
// on the notifications page itself - "any admin on the platform" sees it.
function usePendingBufferCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/admin/api/lead-funnel/notify-flush');
        const data = await res.json();
        if (!cancelled && res.ok) setCount((data.pending || []).length);
      } catch {
        // Non-fatal - badge just won't update this cycle.
      }
    }
    poll();
    const interval = setInterval(poll, PENDING_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  return count;
}

// Slim, always-visible icon rail - hovering a group reveals a CSS-only
// flyout (no JS state) listing that group's pages. Deliberately doesn't
// resize or push page content around - see AdminLeadsChrome, which only
// adds left padding to clear the rail's fixed width.
export default function LeadsNavSidebar() {
  const pathname = usePathname();
  const overviewActive = isActive(pathname, OVERVIEW_LINK.href);
  const callQueueActive = isActive(pathname, CALL_QUEUE_LINK.item.href);
  const callQueueColors = RAD_COLORS[CALL_QUEUE_LINK.colorKey];
  const sentActive = isActive(pathname, SENT_LINK.item.href);
  const sentColors = RAD_COLORS[SENT_LINK.colorKey];
  const outboxActive = isActive(pathname, OUTBOX_LINK.item.href);
  const outboxColors = RAD_COLORS[OUTBOX_LINK.colorKey];
  const guideActive = isActive(pathname, GUIDE_LINK.item.href);
  const guideColors = RAD_COLORS[GUIDE_LINK.colorKey];
  const pendingCount = usePendingBufferCount();
  const mobileGroups = GROUPS.map(group => ({
    ...group,
    badge: group.id === 'messages' ? pendingCount : 0,
    items: group.items.map(item => ({
      ...item,
      badge: BADGE_HREFS.has(item.href) ? pendingCount : 0,
    })),
  }));

  return (
    <>
    <AdminMobileNav
      sectionLabel="Leads"
      topLink={OVERVIEW_LINK}
      groups={mobileGroups}
      singleLinks={[
        { ...CALL_QUEUE_LINK.item, colorKey: CALL_QUEUE_LINK.colorKey },
        { ...OUTBOX_LINK.item, colorKey: OUTBOX_LINK.colorKey },
        { ...SENT_LINK.item, colorKey: SENT_LINK.colorKey },
        { ...GUIDE_LINK.item, colorKey: GUIDE_LINK.colorKey },
      ]}
    />
    <nav className="hidden md:flex fixed left-0 top-0 h-full w-14 bg-white border-r border-slate-200 z-40 flex-col items-center py-4">
      <div className="flex-1 flex flex-col items-center gap-2">
        {/* Overview - always black, never "clear" like the groups below,
            since it's the section's home rather than a color-coded group. */}
        <Link
          href={OVERVIEW_LINK.href}
          title={OVERVIEW_LINK.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-900 transition-colors ${overviewActive ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
        >
          <OVERVIEW_LINK.icon size={18} />
        </Link>

        <Link
          href={CALL_QUEUE_LINK.item.href}
          title={CALL_QUEUE_LINK.item.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${callQueueActive ? `${callQueueColors.bgTint} ${callQueueColors.text}` : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
        >
          <CALL_QUEUE_LINK.item.icon size={18} />
        </Link>

        <Link
          href={OUTBOX_LINK.item.href}
          title={OUTBOX_LINK.item.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${outboxActive ? `${outboxColors.bgTint} ${outboxColors.text}` : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
        >
          <OUTBOX_LINK.item.icon size={18} />
        </Link>

        <Link
          href={SENT_LINK.item.href}
          title={SENT_LINK.item.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${sentActive ? `${sentColors.bgTint} ${sentColors.text}` : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
        >
          <SENT_LINK.item.icon size={18} />
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
                {group.id === 'messages' && <PendingBadge count={pendingCount} />}
              </div>

              <div className="absolute left-full top-0 ml-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-40">
                <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{group.label}</div>
                {group.items.map(item => {
                  const ItemIcon = item.icon;
                  const active = isActive(pathname, item.href);
                  const showBadge = BADGE_HREFS.has(item.href) && pendingCount > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-2 py-2 rounded-xl text-xs font-bold transition-colors ${active ? `${colors.bgTint} ${colors.text}` : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ItemIcon size={14} className={active ? colors.text : 'text-slate-400'} />
                      {item.label}
                      {showBadge && (
                        <span className="ml-auto min-w-[16px] h-4 px-1 rounded-full bg-rad-teal text-white text-[9px] font-black flex items-center justify-center leading-none">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="w-8 border-t border-slate-100 my-1" />

        <Link
          href={GUIDE_LINK.item.href}
          title={GUIDE_LINK.item.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${guideActive ? `${guideColors.bgTint} ${guideColors.text}` : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
        >
          <GUIDE_LINK.item.icon size={18} />
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
    </>
  );
}
