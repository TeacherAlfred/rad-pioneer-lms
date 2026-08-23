"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Send, CheckCircle2, XCircle, MousePointerClick,
  Users2, Search, MessageSquare, Reply, X, VolumeX, Plus, Sparkles,
  ChevronDown, ChevronRight, Pencil,
} from "lucide-react";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";

type MessageRow = {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at?: string | null;
  lead_phone?: string | null;
  lead_name?: string | null;
  lead_email?: string | null;
  lead_school?: string | null;
  lead_tags?: string[] | null;
  lead_bot_paused?: boolean;
  lead_respondent_is_parent?: boolean | null;
  status?: string | null;
  status_updated_at?: string | null;
  conversation_category?: string | null;
  conversation_expires_at?: string | null;
};

type ButtonRef = { id: string; title: string };

type LeadGroup = {
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  leadEmail: string | null;
  leadSchool: string | null;
  leadBotPaused: boolean;
  respondentIsParent: boolean | null;
  messages: MessageRow[];
  inboundCount: number;
  outboundCount: number;
  total: number;
  lastActivityAt: string | null;
  lastLabel: string;
  lastDirection: 'inbound' | 'outbound' | null;
};

type BotFlow = {
  id: string;
  trigger_button_id: string;
  label: string;
  action_type: 'message' | 'template' | 'bot_media';
  message_body: string | null;
  message_buttons: ButtonRef[] | null;
  active: boolean;
};

// WhatsApp's own check-mark convention - only meaningful for outbound rows
// that actually got a status webhook (see whatsapp-webhook/route.ts's
// applyMessageStatus). Rows sent before this feature existed have no
// status at all and render with none of this, not a placeholder.
const STATUS_DISPLAY: Record<string, { icon: string; label: string; className: string }> = {
  sent: { icon: '✓', label: 'Sent', className: 'text-slate-400' },
  delivered: { icon: '✓✓', label: 'Delivered', className: 'text-slate-400' },
  played: { icon: '✓✓', label: 'Played', className: 'text-slate-400' },
  read: { icon: '✓✓', label: 'Read', className: 'text-sky-500' },
  failed: { icon: '⚠', label: 'Failed', className: 'text-rose-500' },
};

function formatStatusTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' });
}

const INHOUSE_TAG = 'Inhouse';
function isInhouseRow(m: MessageRow) {
  return (m.lead_tags || []).some(t => t.toLowerCase() === INHOUSE_TAG.toLowerCase());
}

// Everything sent to a lead is logged into `messages` as bracketed text
// rather than structured columns (see whatsapp-webhook/route.ts) - this
// parses that back out into something a dashboard can group and count.
type Parsed =
  | { kind: 'template'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'bot_flow'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'bot_media'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'human_handoff'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'button_tap'; label: string; detail?: string }
  | { kind: 'text'; label: string };

function parseMessage(m: MessageRow): Parsed {
  const body = m.body || '';

  if (m.direction === 'outbound') {
    let match = body.match(/^\[Delivered template: (.+)\]$/);
    if (match) return { kind: 'template', status: 'delivered', label: match[1] };

    match = body.match(/^\[FAILED to deliver template (.+?): (.+)\]$/);
    if (match) return { kind: 'template', status: 'failed', label: match[1], detail: match[2] };

    if (body === '[Delivered human-handoff acknowledgment]') {
      return { kind: 'human_handoff', status: 'delivered', label: 'Human handoff acknowledgment' };
    }
    match = body.match(/^\[FAILED to deliver acknowledgment: (.+)\]$/);
    if (match) return { kind: 'human_handoff', status: 'failed', label: 'Human handoff acknowledgment', detail: match[1] };

    // Checked before the generic "[Delivered X]" bot_media catch-all below,
    // which would otherwise also match this and mislabel every Bot Flows
    // message-type send as Bot Media.
    match = body.match(/^\[Delivered flow: (.+)\]$/);
    if (match) return { kind: 'bot_flow', status: 'delivered', label: match[1] };
    match = body.match(/^\[FAILED to deliver flow (.+?): (.+)\]$/);
    if (match) return { kind: 'bot_flow', status: 'failed', label: match[1], detail: match[2] };

    match = body.match(/^\[FAILED to deliver "(.+?)": (.+)\]$/);
    if (match) return { kind: 'bot_media', status: 'failed', label: match[1], detail: match[2] };

    match = body.match(/^\[Delivered (.+)\]$/);
    if (match) return { kind: 'bot_media', status: 'delivered', label: match[1] };

    return { kind: 'text', label: body };
  }

  const match = body.match(/^\[Button Reply: (.+) \((.+)\)\]$/);
  if (match) return { kind: 'button_tap', label: match[1], detail: match[2] };
  return { kind: 'text', label: body };
}

const KIND_LABEL: Record<string, string> = {
  template: 'Template Send',
  bot_flow: 'Bot Flow',
  bot_media: 'Bot Media',
  human_handoff: 'Human Handoff',
  button_tap: 'Button Tap',
  text: 'Text',
};

export default function MessageActivityPage() {
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showInhouse, setShowInhouse] = useState(false);

  async function loadMessages() {
    try {
      const res = await fetch('/admin/api/lead-funnel/messages');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load messages');
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const [botFlows, setBotFlows] = useState<BotFlow[]>([]);
  useEffect(() => {
    loadMessages();
    fetch('/admin/api/bot-flows').then(res => res.json()).then(data => setBotFlows((data.rows || []).filter((f: BotFlow) => f.active)));
  }, []);

  // Free-form reply, sent from here since replying to a lead who just
  // messaged in (24h customer-service window open) doesn't need an
  // approved template - see /admin/api/lead-funnel/reply. Can optionally
  // carry up to 3 buttons whose ids are existing bot_flows trigger words,
  // and/or start from an existing bot-flow message as an editable draft.
  const [replyingTo, setReplyingTo] = useState<{ leadId: string; leadName: string | null; leadPhone: string | null; botPaused: boolean } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyButtons, setReplyButtons] = useState<ButtonRef[]>([]);
  const [addButtonFlowId, setAddButtonFlowId] = useState('');
  const [loadFlowId, setLoadFlowId] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pauseSaving, setPauseSaving] = useState(false);

  function openReply(info: { leadId: string; leadName: string | null; leadPhone: string | null; botPaused: boolean }) {
    setReplyingTo(info);
    setReplyText('');
    setReplyButtons([]);
    setAddButtonFlowId('');
    setLoadFlowId('');
    setReplyError(null);
  }

  function loadFlowIntoComposer(flowId: string) {
    setLoadFlowId(flowId);
    const flow = botFlows.find(f => f.id === flowId);
    if (!flow) return;
    if (flow.action_type === 'message' && flow.message_body) setReplyText(flow.message_body);
    setReplyButtons((flow.message_buttons || []).slice(0, 3));
  }

  function addButtonFromFlow(flowId: string) {
    setAddButtonFlowId('');
    const flow = botFlows.find(f => f.id === flowId);
    if (!flow || replyButtons.length >= 3) return;
    if (replyButtons.some(b => b.id === flow.trigger_button_id)) return;
    setReplyButtons(prev => [...prev, { id: flow.trigger_button_id, title: flow.label.slice(0, 20) }]);
  }

  function removeButton(id: string) {
    setReplyButtons(prev => prev.filter(b => b.id !== id));
  }

  async function togglePause() {
    if (!replyingTo) return;
    setPauseSaving(true);
    try {
      const nextValue = !replyingTo.botPaused;
      const res = await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replyingTo.leadId, bot_paused: nextValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update.');
      setReplyingTo(prev => prev ? { ...prev, botPaused: nextValue } : prev);
      setRows(prev => prev.map(r => r.lead_id === replyingTo.leadId ? { ...r, lead_bot_paused: nextValue } : r));
    } catch (err: any) {
      setReplyError(err.message);
    } finally {
      setPauseSaving(false);
    }
  }

  async function sendReply() {
    if (!replyingTo || !replyText.trim()) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch('/admin/api/lead-funnel/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: replyingTo.leadId, body: replyText.trim(), buttons: replyButtons }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send.');
      setReplyingTo(null);
      setReplyText('');
      setReplyButtons([]);
      setLoading(true);
      await loadMessages();
    } catch (err: any) {
      setReplyError(err.message);
    } finally {
      setReplySending(false);
    }
  }

  // Lead-detail editing, opened from this page since a message thread is
  // often exactly where a name/email/parent-or-child detail first surfaces -
  // no need to jump to the full lead-funnel list just to record it.
  const [editingLead, setEditingLead] = useState<{
    leadId: string; name: string; email: string; phone: string; school: string; respondentIsParent: boolean | null;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [respondentSaving, setRespondentSaving] = useState(false);

  function openEditLead(group: LeadGroup) {
    setEditingLead({
      leadId: group.leadId,
      name: group.leadName || '',
      email: group.leadEmail || '',
      phone: group.leadPhone || '',
      school: group.leadSchool || '',
      respondentIsParent: group.respondentIsParent,
    });
    setEditError(null);
  }

  async function saveLeadInfo() {
    if (!editingLead) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLead.leadId,
          name: editingLead.name.trim(),
          email: editingLead.email.trim(),
          phone: editingLead.phone.trim(),
          school: editingLead.school.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save.');
      const updated = data.row;
      setRows(prev => prev.map(r => r.lead_id === editingLead.leadId
        ? { ...r, lead_name: updated.name, lead_email: updated.email, lead_phone: updated.phone, lead_school: updated.school }
        : r));
      setEditingLead(null);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  // Same qualify endpoint Lead Journey uses for the respondent_is_parent
  // check - marking "Child" can auto-move the lead to lost (disqualified),
  // exactly as it would from that screen, since this is the same check.
  async function setRespondent(passed: boolean) {
    if (!editingLead) return;
    setRespondentSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/leads/${editingLead.leadId}/qualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_key: 'respondent_is_parent', passed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save.');
      setEditingLead(prev => prev ? { ...prev, respondentIsParent: passed } : prev);
      setRows(prev => prev.map(r => r.lead_id === editingLead.leadId ? { ...r, lead_respondent_is_parent: passed } : r));
      if (data.movedToLost) {
        setEditError('Marked as Child - this lead was automatically moved to Lost (not the parent).');
      }
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setRespondentSaving(false);
    }
  }

  const statsRows = useMemo(() => rows.filter(r => !isInhouseRow(r)), [rows]);
  const inhouseCount = rows.length - statsRows.length;

  const parsedStatsRows = useMemo(() => statsRows.map(r => ({ row: r, parsed: parseMessage(r) })), [statsRows]);

  const stats = useMemo(() => {
    const outbound = parsedStatsRows.filter(p => p.row.direction === 'outbound');
    const inbound = parsedStatsRows.filter(p => p.row.direction === 'inbound');
    const delivered = outbound.filter(p => 'status' in p.parsed && p.parsed.status === 'delivered').length;
    const failed = outbound.filter(p => 'status' in p.parsed && p.parsed.status === 'failed').length;
    const buttonTaps = parsedStatsRows.filter(p => p.parsed.kind === 'button_tap');
    const engagedLeads = new Set(buttonTaps.map(p => p.row.lead_id)).size;

    const messagedLeads = new Set(outbound.map(p => p.row.lead_id));
    const repliedLeads = new Set(
      parsedStatsRows.filter(p => p.row.direction === 'inbound' && messagedLeads.has(p.row.lead_id)).map(p => p.row.lead_id)
    );

    const byKind: Record<string, number> = {};
    const byTemplate: Record<string, number> = {};
    const byButton: Record<string, number> = {};

    for (const { row, parsed } of parsedStatsRows) {
      if (row.direction !== 'outbound') continue;
      byKind[KIND_LABEL[parsed.kind] || parsed.kind] = (byKind[KIND_LABEL[parsed.kind] || parsed.kind] || 0) + 1;
      if (parsed.kind === 'template') {
        byTemplate[parsed.label] = (byTemplate[parsed.label] || 0) + 1;
      }
    }
    for (const { row, parsed } of parsedStatsRows) {
      if (row.direction !== 'inbound' || parsed.kind !== 'button_tap') continue;
      byButton[parsed.label] = (byButton[parsed.label] || 0) + 1;
    }

    return {
      totalOutbound: outbound.length,
      totalInbound: inbound.length,
      delivered,
      failed,
      buttonTaps: buttonTaps.length,
      engagedLeads,
      replyRate: messagedLeads.size > 0 ? Math.round((repliedLeads.size / messagedLeads.size) * 100) : 0,
      byKind, byTemplate, byButton,
    };
  }, [parsedStatsRows]);

  // One row per contact rather than one per message - a lead who's texted
  // 40 times shouldn't push everyone else off the first page. Grouped here
  // rather than changing what /admin/api/lead-funnel/messages returns, so
  // the flat `rows` still backs the stats/breakdown cards above untouched.
  const groups = useMemo<LeadGroup[]>(() => {
    const source = showInhouse ? rows : statsRows;
    const byLead = new Map<string, MessageRow[]>();
    for (const r of source) {
      if (!byLead.has(r.lead_id)) byLead.set(r.lead_id, []);
      byLead.get(r.lead_id)!.push(r);
    }
    return Array.from(byLead.entries()).map(([leadId, msgs]) => {
      const sorted = [...msgs].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      const last = sorted[sorted.length - 1] || null;
      return {
        leadId,
        leadName: sorted[0]?.lead_name || null,
        leadPhone: sorted[0]?.lead_phone || null,
        leadEmail: sorted[0]?.lead_email || null,
        leadSchool: sorted[0]?.lead_school || null,
        leadBotPaused: !!sorted[0]?.lead_bot_paused,
        respondentIsParent: sorted[0]?.lead_respondent_is_parent ?? null,
        messages: sorted,
        inboundCount: sorted.filter(m => m.direction === 'inbound').length,
        outboundCount: sorted.filter(m => m.direction === 'outbound').length,
        total: sorted.length,
        lastActivityAt: last?.created_at || null,
        lastLabel: last ? parseMessage(last).label : '',
        lastDirection: last?.direction || null,
      };
    });
  }, [rows, statsRows, showInhouse]);

  // Filters decide which conversations show up at all (any message in the
  // thread matching is enough) - the expanded thread itself always shows
  // every message for that lead, unfiltered, since a conversation with
  // gaps cut out of it isn't a conversation anymore.
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      if (directionFilter !== 'all' && !g.messages.some(m => m.direction === directionFilter)) return false;
      if (kindFilter !== 'all' && !g.messages.some(m => parseMessage(m).kind === kindFilter)) return false;
      if (q) {
        const haystack = `${g.leadPhone || ''} ${g.leadName || ''} ${g.messages.map(m => m.body).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [groups, directionFilter, kindFilter, search]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  function toggleExpanded(leadId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      return next;
    });
  }

  const [sortColumn, setSortColumn] = useState<string | null>('lastActivityAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }
  const sortedGroups = useMemo(() => sortRows(filteredGroups, sortColumn, sortDirection), [filteredGroups, sortColumn, sortDirection]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => { setPage(0); }, [directionFilter, kindFilter, search, showInhouse]);
  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedGroups = useMemo(
    () => sortedGroups.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [sortedGroups, currentPage, pageSize]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Lead Funnel
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Message Activity</h1>
          <p className="text-sm text-slate-500 mt-1">Every outbound send and every button tap logged in `messages` - templates, bot media, human handoff, and engagement.</p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <StatCard icon={MessageSquare} label="Total Inbound" value={stats.totalInbound} accent="text-blue-600" />
              <StatCard icon={Send} label="Total Sent" value={stats.totalOutbound} />
              <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} accent="text-emerald-600" />
              <StatCard icon={XCircle} label="Failed" value={stats.failed} accent="text-rose-600" />
              <StatCard icon={MousePointerClick} label="Button Taps" value={stats.buttonTaps} accent="text-indigo-600" />
              <StatCard icon={Users2} label="Leads Engaged" value={stats.engagedLeads} accent="text-indigo-600" />
              <StatCard icon={MessageSquare} label="Reply Rate" value={stats.replyRate} suffix="%" accent="text-amber-600" />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <BreakdownCard title="Sends By Type" data={stats.byKind} />
              <BreakdownCard title="Button Taps (Engagement)" data={stats.byButton} />
            </div>

            {Object.keys(stats.byTemplate).length > 0 && (
              <div className="mb-6">
                <BreakdownCard title="Template Sends By Name" data={stats.byTemplate} />
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  placeholder="Search phone, name, message text..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All directions</option>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
              <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All types</option>
                {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showInhouse} onChange={e => setShowInhouse(e.target.checked)} /> Show inhouse ({inhouseCount})
              </label>
              <span className="text-xs text-slate-400 ml-auto">{filteredGroups.length} contact{filteredGroups.length === 1 ? '' : 's'} (of {(showInhouse ? rows.length : statsRows.length)} messages)</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3 w-6"></th>
                      <SortableHeader label="Lead" column="leadName" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="In" column="inboundCount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Out" column="outboundCount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Total" column="total" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <th className="px-4 py-3">Last Message</th>
                      <SortableHeader label="Last Activity" column="lastActivityAt" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedGroups.map(g => {
                      const isOpen = expandedIds.has(g.leadId);
                      return (
                        <Fragment key={g.leadId}>
                          <tr
                            onClick={() => toggleExpanded(g.leadId)}
                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer"
                          >
                            <td className="px-4 py-3 text-slate-300">
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                {g.leadName || '(no name)'}
                                {g.respondentIsParent !== null && (
                                  <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${g.respondentIsParent ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {g.respondentIsParent ? 'Parent' : 'Child'}
                                  </span>
                                )}
                                {g.leadBotPaused && (
                                  <span title="Bot paused - manual replies only" className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                    <VolumeX size={9} /> Paused
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">+{g.leadPhone}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-bold">{g.inboundCount}</td>
                            <td className="px-4 py-3 text-slate-600 font-bold">{g.outboundCount}</td>
                            <td className="px-4 py-3 text-slate-400">{g.total}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs">
                              <span className="line-clamp-1">
                                {g.lastDirection === 'outbound' && <span className="text-slate-400">↳ </span>}
                                {g.lastLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                              {g.lastActivityAt ? new Date(g.lastActivityAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => openEditLead(g)}
                                  title="Edit lead details"
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"
                                >
                                  <Pencil size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => openReply({ leadId: g.leadId, leadName: g.leadName, leadPhone: g.leadPhone, botPaused: g.leadBotPaused })}
                                  title="Send a free-form reply"
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"
                                >
                                  <Reply size={12} /> Reply
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b border-slate-50 last:border-0">
                              <td colSpan={8} className="bg-slate-50/60 px-6 py-4">
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                  {g.messages.map(m => {
                                    const parsed = parseMessage(m);
                                    const isOut = m.direction === 'outbound';
                                    const ok = 'status' in parsed ? parsed.status === 'delivered' : true;
                                    return (
                                      <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] ${isOut ? (ok ? 'bg-slate-900 text-white' : 'bg-rose-100 text-rose-700') : 'bg-white border border-slate-200 text-slate-800'}`}>
                                          {parsed.kind !== 'text' && (
                                            <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isOut ? 'text-slate-300' : 'text-slate-400'}`}>{KIND_LABEL[parsed.kind] || parsed.kind}</div>
                                          )}
                                          <p className="whitespace-pre-wrap">{parsed.label}</p>
                                          {'detail' in parsed && parsed.detail && (
                                            <p className={`text-[11px] mt-0.5 ${isOut ? 'text-slate-300' : 'text-slate-400'}`}>{parsed.detail}</p>
                                          )}
                                          <div className={`flex items-center gap-1.5 text-[10px] mt-1 ${isOut ? 'text-slate-400' : 'text-slate-400'}`}>
                                            <span>{m.created_at ? new Date(m.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : ''}</span>
                                            {m.status && STATUS_DISPLAY[m.status] && (
                                              <span className={STATUS_DISPLAY[m.status].className}>{STATUS_DISPLAY[m.status].icon}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {filteredGroups.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm">No conversations match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredGroups.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>
                      Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredGroups.length)} of {filteredGroups.length} contacts
                    </span>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none"
                    >
                      {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-slate-400">Page {currentPage + 1} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {replyingTo && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between px-6 pt-6 pb-1 shrink-0">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">Reply to {replyingTo.leadName || 'this lead'}</h3>
                <p className="text-[13px] text-slate-400 mt-0.5">+{replyingTo.leadPhone} · sent as a free-form WhatsApp message</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={13} /></button>
            </div>

            <div className="px-6 pt-4 shrink-0">
              <button
                onClick={togglePause}
                disabled={pauseSaving}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors duration-150 disabled:opacity-50 ${
                  replyingTo.botPaused ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
                  <VolumeX size={15} className={replyingTo.botPaused ? 'text-amber-600' : 'text-slate-400'} />
                  {replyingTo.botPaused ? 'Bot paused - only manual replies are sent to this lead' : 'Pause automated bot replies for this lead'}
                </span>
                {pauseSaving ? <Loader2 size={14} className="animate-spin text-slate-400" /> : (
                  <span className={`shrink-0 relative h-5 w-9 rounded-full transition-colors duration-200 ${replyingTo.botPaused ? 'bg-amber-500' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${replyingTo.botPaused ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                )}
              </button>
            </div>

            <div className="px-6 pt-4 pb-5 space-y-3 overflow-y-auto">
              {botFlows.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><Sparkles size={11} /> Start from a bot-flow message (optional)</label>
                  <select
                    value={loadFlowId}
                    onChange={e => loadFlowIntoComposer(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-700 outline-none focus:border-blue-400"
                  >
                    <option value="">Write from scratch...</option>
                    {botFlows.filter(f => f.action_type === 'message').map(f => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Loads that flow's text and buttons here as a starting draft - edit or remove anything before sending, nothing about the original flow is changed.</p>
                </div>
              )}

              <textarea
                autoFocus
                rows={4}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 resize-none"
              />

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Buttons ({replyButtons.length}/3)</label>
                {replyButtons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {replyButtons.map(b => (
                      <span key={b.id} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-[12px] font-medium px-2.5 py-1.5 rounded-lg">
                        {b.title}
                        <button onClick={() => removeButton(b.id)} className="text-blue-400 hover:text-blue-700"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
                {replyButtons.length < 3 && botFlows.length > 0 && (
                  <div className="relative">
                    <select
                      value={addButtonFlowId}
                      onChange={e => addButtonFromFlow(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-[10px] pl-8 pr-3.5 py-2 text-[13px] text-slate-500 outline-none focus:border-blue-400 appearance-none cursor-pointer"
                    >
                      <option value="">Add a button (links to a trigger word)...</option>
                      {botFlows.filter(f => !replyButtons.some(b => b.id === f.trigger_button_id)).map(f => (
                        <option key={f.id} value={f.id}>{f.label} ({f.trigger_button_id})</option>
                      ))}
                    </select>
                    <Plus size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-1">Tapping a button re-enters that bot flow automatically, same as if the bot had sent it.</p>
              </div>

              <p className="text-[12px] text-slate-400">Only deliverable while the 24h reply window is open (i.e. this lead has messaged recently) - Meta will reject it otherwise.</p>
              {replyError && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{replyError}</div>}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <div className="flex gap-2">
                <button onClick={() => setReplyingTo(null)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">Cancel</button>
                <button
                  onClick={sendReply}
                  disabled={replySending || !replyText.trim()}
                  className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                >
                  {replySending ? <Loader2 size={14} className="animate-spin" /> : <><Send size={13} /> Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingLead && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md overflow-hidden">
            <div className="flex items-start justify-between px-6 pt-6 pb-1">
              <h3 className="text-[16px] font-semibold text-slate-900">Edit Lead Details</h3>
              <button onClick={() => setEditingLead(null)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={13} /></button>
            </div>

            <div className="px-6 pt-4 pb-5 space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Who is the respondent?</label>
                <div className="flex gap-1.5">
                  <button
                    disabled={respondentSaving}
                    onClick={() => setRespondent(true)}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                      editingLead.respondentIsParent === true ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Parent
                  </button>
                  <button
                    disabled={respondentSaving}
                    onClick={() => setRespondent(false)}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                      editingLead.respondentIsParent === false ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Child
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Same qualification check used on Lead Journey - marking Child may auto-move this lead to Lost.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Name</label>
                <input
                  value={editingLead.name}
                  onChange={e => setEditingLead(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Email</label>
                <input
                  value={editingLead.email}
                  onChange={e => setEditingLead(prev => prev ? { ...prev, email: e.target.value } : prev)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Phone</label>
                <input
                  value={editingLead.phone}
                  onChange={e => setEditingLead(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">School</label>
                <input
                  value={editingLead.school}
                  onChange={e => setEditingLead(prev => prev ? { ...prev, school: e.target.value } : prev)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400"
                />
              </div>

              {editError && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{editError}</div>}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <div className="flex gap-2">
                <button onClick={() => setEditingLead(null)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">Cancel</button>
                <button
                  onClick={saveLeadInfo}
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                >
                  {editSaving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, suffix }: { icon: any; label: string; value: number; accent?: string; suffix?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <Icon size={16} className={accent || 'text-slate-400'} />
      <div className={`text-2xl font-black mt-2 ${accent || 'text-slate-900'}`}>{value}{suffix || ''}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-40 shrink-0 truncate" title={key}>{key}</span>
            <div className="flex-1 bg-slate-50 rounded-full h-2 overflow-hidden">
              <div className="bg-slate-800 h-full rounded-full" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-xs font-black text-slate-500 w-8 text-right">{count}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-slate-400">No data yet.</p>}
      </div>
    </div>
  );
}
