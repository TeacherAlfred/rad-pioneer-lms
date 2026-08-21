"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, Users, UserPlus, MessageCircleWarning, Users2, MessageSquare,
  Send, XCircle, Baby, GraduationCap, CalendarClock, BellOff, AlertTriangle,
  ArrowRight, X,
} from "lucide-react";
import { isWithinDnd, type DndDay } from "@/lib/dndSchedule";

type Lead = {
  id: string; name: string | null; phone: string; lifecycle_stage: string | null;
  created_at: string | null; needs_human: boolean | null;
  household_id: string | null; household_name: string | null; tags: string[] | null;
};
type MessageRow = { id: string; lead_id: string; lead_name: string | null; lead_phone: string | null; direction: 'inbound' | 'outbound'; body: string; created_at: string | null };
type Kid = { id: string; name: string; age: number | null; grade: string | null; kid_guardians: { leads: { name: string | null; phone: string } | null }[]; enrolments: { status: string }[] };
type SessionRow = { id: string; starts_at: string | null; programs: { name: string } | null; venues: { name: string } | null; enrolments: { id: string }[] };

const INHOUSE_TAG = 'inhouse';

function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' });
}

function stageLabel(s: string | null) {
  if (!s) return 'Unknown';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Each stat tile carries the underlying list it summarizes (already loaded
// client-side for the page's own totals - no extra fetch on click) plus how
// to render one row of it. Tiles without a natural "list" (Do Not Disturb)
// get a directHref instead and skip the modal entirely.
type Tile = {
  icon: any; label: string; value: number | string; accent?: string;
  items?: any[]; renderRow?: (item: any) => React.ReactNode;
  directHref?: string;
};
type ActiveTile = { label: string; items: any[]; renderRow: (item: any) => React.ReactNode; href: string; linkLabel: string };

// The default landing page for the leads section - a curated, high-level
// summary of the three groups behind the sidebar (Leads / Messages &
// Notifications / Kids & Parents). Every stat tile is clickable and opens a
// paginated modal listing what it's counting, with a way to jump to the
// full page from there. Reuses the same endpoints each group's main page
// already calls rather than a dedicated aggregation route - at this app's
// actual data volume (a few hundred rows per table) that's the same
// tradeoff every other page here already makes.
export default function LeadsOverviewPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [dndSchedule, setDndSchedule] = useState<DndDay[]>([]);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTile, setActiveTile] = useState<ActiveTile | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [leadsRes, messagesRes, kidsRes, settingsRes, sessionsRes] = await Promise.all([
          fetch('/admin/api/lead-funnel'),
          fetch('/admin/api/lead-funnel/messages'),
          fetch('/admin/api/kids'),
          fetch('/admin/api/lead-funnel/notification-settings'),
          fetch('/admin/api/sessions'),
        ]);
        const [leadsData, messagesData, kidsData, settingsData, sessionsData] = await Promise.all([
          leadsRes.json(), messagesRes.json(), kidsRes.json(), settingsRes.json(), sessionsRes.json(),
        ]);
        if (!leadsRes.ok) throw new Error(leadsData.error || 'Failed to load leads');
        setLeads(leadsData.rows || []);
        setMessages(messagesRes.ok ? (messagesData.rows || []) : []);
        setKids(kidsRes.ok ? (kidsData.rows || []) : []);
        setDndSchedule(settingsRes.ok ? (settingsData.dndSchedule || []) : []);
        setSessions(sessionsRes.ok ? (sessionsData.rows || []) : []);
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, []);

  const nonInhouseLeads = useMemo(() => (leads || []).filter(l => !(l.tags || []).some(t => t.toLowerCase() === INHOUSE_TAG)), [leads]);
  const newTodayLeads = useMemo(() => nonInhouseLeads.filter(l => isToday(l.created_at)), [nonInhouseLeads]);
  const needsHumanLeads = useMemo(() => nonInhouseLeads.filter(l => l.needs_human), [nonInhouseLeads]);

  const householdGroups = useMemo(() => {
    const byHousehold = new Map<string, { label: string; members: Lead[] }>();
    const standalone: { label: string; members: Lead[] }[] = [];
    for (const l of nonInhouseLeads) {
      if (l.household_id) {
        if (!byHousehold.has(l.household_id)) byHousehold.set(l.household_id, { label: l.household_name || 'Household', members: [] });
        byHousehold.get(l.household_id)!.members.push(l);
      } else {
        standalone.push({ label: l.name || '(no name)', members: [l] });
      }
    }
    return [...Array.from(byHousehold.values()), ...standalone];
  }, [nonInhouseLeads]);

  const outboundMessages = useMemo(() => (messages || []).filter(m => m.direction === 'outbound'), [messages]);
  const failedMessages = useMemo(() => outboundMessages.filter(m => m.body.startsWith('[FAILED')), [outboundMessages]);

  const enrolledKids = useMemo(() => (kids || []).filter(k => (k.enrolments || []).some(e => e.status === 'active' || e.status === 'registered')), [kids]);

  const upcomingSessionsList = useMemo(() => {
    const now = Date.now();
    return (sessions || []).filter(s => s.starts_at && new Date(s.starts_at).getTime() >= now);
  }, [sessions]);

  const dndActive = isWithinDnd(dndSchedule);
  const loading = leads === null;
  const needsAttention = needsHumanLeads.length > 0 || failedMessages.length > 0 || dndActive;

  function openTile(label: string, items: any[], renderRow: (item: any) => React.ReactNode, href: string, linkLabel: string) {
    setActiveTile({ label, items, renderRow, href, linkLabel });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Leads Overview</h1>
          <p className="text-sm text-slate-500 mt-1">A high-level look at everything under Leads, Messages & Notifications, and Kids & Parents. Click any number for a quick look, or use the icons on the left to go to the full page.</p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <div className="space-y-4">
            {needsAttention && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap text-sm text-amber-700">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="font-bold">Needs attention:</span>
                {needsHumanLeads.length > 0 && <span>{needsHumanLeads.length} lead{needsHumanLeads.length === 1 ? '' : 's'} awaiting a reply</span>}
                {failedMessages.length > 0 && <span>{failedMessages.length} failed delivery{failedMessages.length === 1 ? '' : 'ies'}</span>}
                {dndActive && <span className="flex items-center gap-1"><BellOff size={13} /> Do Not Disturb is active - alerts are queued, not sent</span>}
              </div>
            )}

            <GroupCard
              title="Leads" icon={Users} href="/admin/lead-funnel/list" linkLabel="View Lead Funnel"
              tiles={[
                { icon: Users, label: 'Total Leads', value: nonInhouseLeads.length, items: nonInhouseLeads, renderRow: leadRow },
                { icon: UserPlus, label: 'New Today', value: newTodayLeads.length, items: newTodayLeads, renderRow: leadRow },
                { icon: MessageCircleWarning, label: 'Needs Human', value: needsHumanLeads.length, accent: needsHumanLeads.length > 0 ? 'text-amber-600' : undefined, items: needsHumanLeads, renderRow: leadRow },
                { icon: Users2, label: 'Households', value: householdGroups.length, accent: 'text-purple-600', items: householdGroups, renderRow: householdRow },
              ]}
              onTileClick={openTile}
            />

            <GroupCard
              title="Messages & Notifications" icon={MessageSquare} href="/admin/lead-funnel/messages" linkLabel="View Message Activity"
              tiles={[
                { icon: Send, label: 'Total Sent', value: outboundMessages.length, items: outboundMessages, renderRow: messageRow },
                { icon: XCircle, label: 'Failed', value: failedMessages.length, accent: failedMessages.length > 0 ? 'text-rose-600' : undefined, items: failedMessages, renderRow: messageRow },
                { icon: BellOff, label: 'Do Not Disturb', value: dndActive ? 'Active' : 'Off', accent: dndActive ? 'text-amber-600' : undefined, directHref: '/admin/lead-funnel/notifications' },
              ]}
              onTileClick={openTile}
            />

            <GroupCard
              title="Kids & Parents" icon={Baby} href="/admin/kids" linkLabel="View Kids"
              tiles={[
                { icon: Baby, label: 'Total Kids', value: (kids || []).length, items: kids || [], renderRow: kidRow },
                { icon: GraduationCap, label: 'Enrolled', value: enrolledKids.length, accent: 'text-emerald-600', items: enrolledKids, renderRow: kidRow },
                { icon: CalendarClock, label: 'Upcoming Sessions', value: upcomingSessionsList.length, accent: 'text-indigo-600', items: upcomingSessionsList, renderRow: sessionRow },
              ]}
              onTileClick={openTile}
            />
          </div>
        )}
      </div>

      {activeTile && <TileModal tile={activeTile} onClose={() => setActiveTile(null)} />}
    </div>
  );
}

function leadRow(l: Lead) {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
      <div className="min-w-0">
        <div className="font-bold text-slate-800 text-sm truncate">{l.name || '(no name)'}</div>
        <div className="text-xs text-slate-400">+{l.phone}</div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-slate-100 text-slate-500 shrink-0">{stageLabel(l.lifecycle_stage)}</span>
    </div>
  );
}

function householdRow(h: { label: string; members: Lead[] }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
      <div className="font-bold text-slate-800 text-sm">{h.label}</div>
      <div className="text-xs text-slate-400">{h.members.length} member{h.members.length === 1 ? '' : 's'} - {h.members.map(m => m.name || `+${m.phone}`).join(', ')}</div>
    </div>
  );
}

function messageRow(m: MessageRow) {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
      <div className="min-w-0">
        <div className="font-bold text-slate-800 text-sm truncate">{m.lead_name || '(no name)'}</div>
        <div className="text-xs text-slate-400 truncate">{m.body}</div>
      </div>
      <span className="text-[11px] text-slate-400 shrink-0">{fmtDate(m.created_at)}</span>
    </div>
  );
}

function kidRow(k: Kid) {
  const guardians = (k.kid_guardians || []).map(g => g.leads?.name || (g.leads?.phone ? `+${g.leads.phone}` : null)).filter(Boolean);
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
      <div className="font-bold text-slate-800 text-sm">{k.name}{k.age ? `, age ${k.age}` : ''}{k.grade ? ` · ${k.grade}` : ''}</div>
      <div className="text-xs text-slate-400">{guardians.length > 0 ? guardians.join(', ') : 'No guardian linked'}</div>
    </div>
  );
}

function sessionRow(s: SessionRow) {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
      <div className="min-w-0">
        <div className="font-bold text-slate-800 text-sm truncate">{s.programs?.name || 'Session'}</div>
        <div className="text-xs text-slate-400 truncate">{s.venues?.name || ''} · {(s.enrolments || []).length} enrolled</div>
      </div>
      <span className="text-[11px] text-slate-400 shrink-0">{fmtDate(s.starts_at)}</span>
    </div>
  );
}

function GroupCard({ title, icon: Icon, href, linkLabel, tiles, onTileClick }: {
  title: string; icon: any; href: string; linkLabel: string; tiles: Tile[];
  onTileClick: (label: string, items: any[], renderRow: (item: any) => React.ReactNode, href: string, linkLabel: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-slate-400" />
          <h3 className="font-black text-slate-800">{title}</h3>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(t => (
          <StatCard
            key={t.label} {...t}
            onClick={t.items ? () => onTileClick(t.label, t.items!, t.renderRow!, href, linkLabel) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, directHref, onClick }: Tile & { onClick?: () => void }) {
  const content = (
    <>
      <Icon size={14} className={accent || 'text-slate-400'} />
      <div className={`text-xl font-black mt-1.5 ${accent || 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{label}</div>
    </>
  );
  const className = "bg-slate-50 rounded-xl p-3 text-left w-full cursor-pointer hover:bg-slate-100 hover:-translate-y-0.5 transition-all";

  if (directHref) {
    return <Link href={directHref} className={className}>{content}</Link>;
  }
  return <button onClick={onClick} className={className}>{content}</button>;
}

// Premium-feeling modal: backdrop blur, rounded-3xl, fade+scale entrance
// (CSS-only, no animation library - consistent with every other modal in
// this admin area). Pagination is client-side since the tile's full item
// list is already in memory (see the page component's fetch above).
function TileModal({ tile, onClose }: { tile: ActiveTile; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(tile.items.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = tile.items.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <div
      className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col transition-all duration-200 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-slate-900">{tile.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{tile.items.length} total</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {paged.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-8">Nothing here yet.</p>
          ) : (
            paged.map((item, i) => <div key={item.id || item.label || i}>{tile.renderRow(item)}</div>)
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap shrink-0">
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40">Prev</button>
              <span className="text-xs text-slate-400">Page {currentPage + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40">Next</button>
            </div>
          ) : <div />}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Close</button>
            <Link href={tile.href} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800">
              {tile.linkLabel} <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
