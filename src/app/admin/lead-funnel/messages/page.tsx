"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Send, CheckCircle2, XCircle, MousePointerClick,
  Users2, Search, MessageSquare, Reply, X, VolumeX, Plus, Sparkles,
  ChevronDown, ChevronRight, Pencil, Ban, ShieldCheck,
} from "lucide-react";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { QueueQuickAdd } from "@/components/admin/QueueQuickAdd";
import { parseMessage, KIND_LABEL, STATUS_DISPLAY } from "@/lib/messageParse";
import { DesktopSendButton } from "@/components/admin/DesktopSendButton";
import { LEAD_AUTOFIELDS } from "@/lib/metaTemplate";
import { computeWindowState } from "@/lib/whatsappWindow";

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
  lead_is_blocked?: boolean;
  lead_blocked_reason?: string | null;
  lead_reply_dismissed_at?: string | null;
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
  leadIsBlocked: boolean;
  leadBlockedReason: string | null;
  replyDismissedAt: string | null;
  respondentIsParent: boolean | null;
  messages: MessageRow[];
  inboundCount: number;
  outboundCount: number;
  total: number;
  lastActivityAt: string | null;
  lastLabel: string;
  lastDirection: 'inbound' | 'outbound' | null;
  windowExpiresAt: Date | null;
  isWindowOpen: boolean;
  msRemaining: number;
  windowTotalHours: number | null;
};

type BotFlow = {
  id: string;
  trigger_button_id: string;
  label: string;
  action_type: 'message' | 'template' | 'bot_media' | 'tag_only';
  message_body: string | null;
  message_buttons: ButtonRef[] | null;
  active: boolean;
  template_name: string | null;
  template_language: string | null;
  template_variables: string[];
  template_variable_names: string[];
  template_button_payloads: string[];
};

type MetaTemplate = {
  name: string;
  language: string;
  category: string;
  variableNames: string[];
  variableLabels?: string[];
  bodyPreview: string;
  quickReplyButtons: { text: string; index: number }[];
};

// One tagged entry per sendable approved template, whichever source it came
// from - a template-linked bot-flow (pre-configured variables, no manual
// fill needed, same resolution the automated trigger already uses) or a
// plain approved template with no bot-flow wired to it yet (needs the same
// manual variable-fill UX as the List page's Send Template modal). Merged
// and de-duped by name+language so a bot-flow-linked template never also
// shows up as a second, un-tagged "plain" entry.
type TemplateOption = {
  key: string;
  label: string;
  badge: 'Bot-flow Template' | 'Approved Template';
  templateName: string;
  languageCode: string;
  bodyPreview?: string;
  variableNames: string[];
  variableLabels?: string[];
  presetVariables?: string[];
  presetButtonPayloads?: string[];
  quickReplyButtons?: { text: string; index: number }[];
};

function formatStatusTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' });
}

const INHOUSE_TAG = 'Inhouse';
function isInhouseRow(m: MessageRow) {
  return (m.lead_tags || []).some(t => t.toLowerCase() === INHOUSE_TAG.toLowerCase());
}
function isBlockedRow(m: MessageRow) {
  return !!m.lead_is_blocked;
}

// Glow intensity communicates urgency, not just "open vs closed" - a lead
// with 60 hours left (a 72h ad-referral window) doesn't need the same visual
// weight as one closing in 20 minutes. A soft, blurred full-row shadow plus a
// faint background wash reads as a glow around the whole card; a hard ring
// alone just looks like a border. Four tiers, most urgent (closing soon) to
// calmest (just opened, plenty of time left) - independent of whether the
// underlying window is 24h or the 72h ad-referral one.
function windowGlowClass(msRemaining: number): string {
  const hoursLeft = msRemaining / (60 * 60 * 1000);
  if (hoursLeft <= 2) return 'bg-rose-50/70 shadow-[0_0_20px_4px_rgba(244,63,94,0.28)] animate-pulse';
  if (hoursLeft <= 12) return 'bg-orange-50/60 shadow-[0_0_18px_3px_rgba(251,146,60,0.22)]';
  if (hoursLeft <= 24) return 'bg-amber-50/50 shadow-[0_0_16px_3px_rgba(252,211,77,0.16)]';
  return 'bg-emerald-50/40 shadow-[0_0_14px_2px_rgba(110,231,183,0.12)]';
}

function formatCountdown(msRemaining: number): string {
  const totalMinutes = Math.max(0, Math.round(msRemaining / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m left`;
  return `${hours}h ${minutes}m left`;
}

// A conversation "needs reply" purely because its own last message is
// inbound - no reply has followed it yet, regardless of needs_human (which
// can be stale/cleared for other reasons). Blocked leads are excluded -
// their inbound messages are deliberately never replied to, so surfacing
// them here would just be noise for something already decided.
//
// replyDismissedAt is a temporary "I handled this elsewhere" mark, not a
// permanent silence - it only suppresses the flag for the inbound message
// that already exists. A NEWER inbound message necessarily has a later
// timestamp than the dismissal, so the flag reappears on its own the
// moment the lead writes in again, with no explicit re-arm step anywhere.
function needsReply(g: { lastDirection: 'inbound' | 'outbound' | null; leadIsBlocked: boolean; lastActivityAt: string | null; replyDismissedAt: string | null }): boolean {
  if (g.lastDirection !== 'inbound' || g.leadIsBlocked) return false;
  if (!g.replyDismissedAt || !g.lastActivityAt) return true;
  return new Date(g.lastActivityAt).getTime() > new Date(g.replyDismissedAt).getTime();
}

export default function MessageActivityPage() {
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  // Set by clicking a row in the Button Taps / Template Sends breakdown
  // cards below - narrows the contacts table to leads with that specific
  // tap/template, same idea as kindFilter but one level more specific than
  // that dropdown goes. Clicking the same row again clears it.
  const [buttonFilter, setButtonFilter] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState<string | null>(null);
  const [countMode, setCountMode] = useState<'messages' | 'leads'>('messages');
  const [search, setSearch] = useState('');
  // Mutually exclusive, momentary lenses - not additive filters. Flipping
  // one on narrows the whole list to ONLY that category (inhouse or
  // blocked contacts don't normally belong in the working view at all,
  // there's just occasionally a reason to look at them specifically) and
  // flips the other off, rather than adding them back alongside everyone
  // else. Off (the default) excludes both.
  const [showInhouse, setShowInhouseRaw] = useState(false);
  const [showBlocked, setShowBlockedRaw] = useState(false);
  function setShowInhouse(next: boolean) {
    setShowInhouseRaw(next);
    if (next) setShowBlockedRaw(false);
  }
  function setShowBlocked(next: boolean) {
    setShowBlockedRaw(next);
    if (next) setShowInhouseRaw(false);
  }

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
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  useEffect(() => {
    loadMessages();
    fetch('/admin/api/bot-flows').then(res => res.json()).then(data => setBotFlows((data.rows || []).filter((f: BotFlow) => f.active)));
    fetch('/admin/api/lead-funnel/templates').then(res => res.json()).then(data => {
      if (data.error) { setTemplatesError(data.error); return; }
      setMetaTemplates(data.templates || []);
    }).catch(err => setTemplatesError(err.message));
  }, []);

  // Merged, tagged picker: template-linked bot-flows first (pre-configured,
  // no manual variable entry - resolved server-side against the lead row
  // exactly like the automated trigger path), then any other approved
  // template Meta returns that isn't already wired to a bot-flow.
  const templateOptions = useMemo<TemplateOption[]>(() => {
    const flowTemplates = botFlows.filter(f => f.action_type === 'template' && f.template_name && f.template_language);
    const flowKeys = new Set(flowTemplates.map(f => `${f.template_name}|${f.template_language}`));
    const fromFlows: TemplateOption[] = flowTemplates.map(f => ({
      key: `flow:${f.id}`,
      label: f.label,
      badge: 'Bot-flow Template',
      templateName: f.template_name!,
      languageCode: f.template_language!,
      variableNames: f.template_variable_names || [],
      presetVariables: f.template_variables || [],
      presetButtonPayloads: f.template_button_payloads || [],
    }));
    const fromMeta: TemplateOption[] = metaTemplates
      .filter(t => !flowKeys.has(`${t.name}|${t.language}`))
      .map(t => ({
        key: `meta:${t.name}|${t.language}`,
        label: t.name,
        badge: 'Approved Template',
        templateName: t.name,
        languageCode: t.language,
        bodyPreview: t.bodyPreview,
        variableNames: t.variableNames,
        variableLabels: t.variableLabels,
        quickReplyButtons: t.quickReplyButtons,
      }));
    return [...fromFlows, ...fromMeta];
  }, [botFlows, metaTemplates]);

  // Countdown labels/glow need to visibly tick down without a full refetch -
  // this just forces a re-render every 60s so `computeWindowState`'s
  // Date.now()-derived msRemaining recomputes on the next render.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Free-form reply, sent from here since replying to a lead who just
  // messaged in (messaging window open - 24h normally, 72h for a
  // Click-to-WhatsApp ad-referral lead) doesn't need an approved template -
  // see /admin/api/lead-funnel/reply. Can optionally
  // carry up to 3 buttons whose ids are existing bot_flows trigger words,
  // and/or start from an existing bot-flow message as an editable draft.
  const [replyingTo, setReplyingTo] = useState<{ leadId: string; leadName: string | null; leadPhone: string | null; botPaused: boolean; isWindowOpen: boolean; windowExpiresAt: Date | null; windowTotalHours: number | null } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyButtons, setReplyButtons] = useState<ButtonRef[]>([]);
  const [addButtonFlowId, setAddButtonFlowId] = useState('');
  const [loadFlowId, setLoadFlowId] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pauseSaving, setPauseSaving] = useState(false);

  // Template send state, scoped to the open reply modal.
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [templateButtonPayloads, setTemplateButtonPayloads] = useState<Record<number, string>>({});
  const [templateSending, setTemplateSending] = useState(false);
  const [templateSendError, setTemplateSendError] = useState<string | null>(null);

  // Shared across every send path on this page (free-form reply, template) -
  // a successful send closes the compose modal and hands off to this one,
  // rather than swapping in an inline "sent" banner while the form stays up.
  const [sendSuccessInfo, setSendSuccessInfo] = useState<{ leadName: string | null; kind: 'Message' | 'Template' } | null>(null);

  const selectedTemplateOption = templateOptions.find(t => t.key === selectedTemplateKey) || null;

  function openReply(info: { leadId: string; leadName: string | null; leadPhone: string | null; botPaused: boolean; isWindowOpen: boolean; windowExpiresAt: Date | null; windowTotalHours: number | null }) {
    setReplyingTo(info);
    setReplyText('');
    setReplyButtons([]);
    setAddButtonFlowId('');
    setLoadFlowId('');
    setReplyError(null);
    setSelectedTemplateKey('');
    setTemplateVariables([]);
    setTemplateButtonPayloads({});
    setTemplateSendError(null);
  }

  function selectTemplateOption(key: string) {
    setSelectedTemplateKey(key);
    setTemplateSendError(null);
    const t = templateOptions.find(o => o.key === key);
    if (!t) return;
    if (t.presetVariables) {
      // Bot-flow-linked: already configured, no manual fill needed.
      setTemplateVariables(t.presetVariables);
    } else {
      setTemplateVariables(t.variableNames.map((vn, i) => {
        const label = (t.variableLabels?.[i] || vn).toLowerCase();
        return LEAD_AUTOFIELDS.includes(label) ? `{{${label}}}` : '';
      }));
    }
    setTemplateButtonPayloads({});
  }

  async function sendTemplateFromReply() {
    if (!replyingTo || !selectedTemplateOption) return;
    const leadName = replyingTo.leadName;
    setTemplateSending(true);
    setTemplateSendError(null);
    try {
      const maxIndex = Math.max(-1, ...Object.keys(templateButtonPayloads).map(Number));
      const buttonPayloads = selectedTemplateOption.presetButtonPayloads
        || Array.from({ length: maxIndex + 1 }, (_, i) => templateButtonPayloads[i] || '');
      const res = await fetch('/admin/api/lead-funnel/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: [replyingTo.leadId],
          templateName: selectedTemplateOption.templateName,
          languageCode: selectedTemplateOption.languageCode,
          variables: templateVariables,
          variableNames: selectedTemplateOption.variableNames,
          buttonPayloads,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send.');
      const result = (data.results || [])[0];
      if (result && !result.ok) throw new Error(result.error || 'Meta rejected this template send.');
      setReplyingTo(null);
      setSendSuccessInfo({ leadName, kind: 'Template' });
      setLoading(true);
      await loadMessages();
    } catch (err: any) {
      setTemplateSendError(err.message);
    } finally {
      setTemplateSending(false);
    }
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
    const leadName = replyingTo.leadName;
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
      setSendSuccessInfo({ leadName, kind: 'Message' });
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

  // Block an abusive/gibberish contact - webhook checks leads.is_blocked
  // before any bot logic runs from here on (see whatsapp-webhook/route.ts),
  // so this is the one place that actually stops them, not just hides them.
  const [blockingId, setBlockingId] = useState<string | null>(null);
  async function toggleBlocked(group: LeadGroup) {
    const next = !group.leadIsBlocked;
    let reason: string | null = null;
    if (next) {
      reason = window.prompt(`Why block ${group.leadName || 'this contact'}? (shown if you look back later)`) || null;
      if (reason === null) return; // cancelled
    }
    setBlockingId(group.leadId);
    try {
      const res = await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.leadId, is_blocked: next, blocked_reason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update.');
      setRows(prev => prev.map(r => r.lead_id === group.leadId
        ? { ...r, lead_is_blocked: data.row.is_blocked, lead_blocked_reason: data.row.blocked_reason }
        : r));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBlockingId(null);
    }
  }

  // "I handled this another way" - temporary, not a permanent silence. See
  // needsReply()'s comment above for why no explicit re-arm is needed.
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  async function dismissReply(group: LeadGroup) {
    setDismissingId(group.leadId);
    try {
      const res = await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.leadId, dismiss_reply: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update.');
      setRows(prev => prev.map(r => r.lead_id === group.leadId
        ? { ...r, lead_reply_dismissed_at: data.row.reply_dismissed_at }
        : r));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDismissingId(null);
    }
  }

  const statsRows = useMemo(() => rows.filter(r => !isInhouseRow(r) && !isBlockedRow(r)), [rows]);
  // Lead counts, not message counts - these label a "how many contacts"
  // toggle, and one chatty inhouse/blocked contact shouldn't inflate it.
  const inhouseCount = new Set(rows.filter(r => isInhouseRow(r) && !isBlockedRow(r)).map(r => r.lead_id)).size;
  const blockedCount = new Set(rows.filter(isBlockedRow).map(r => r.lead_id)).size;
  const visibleMessageCount = showInhouse ? rows.filter(isInhouseRow).length
    : showBlocked ? rows.filter(isBlockedRow).length
    : statsRows.length;

  const parsedStatsRows = useMemo(() => statsRows.map(r => ({ row: r, parsed: parseMessage(r) })), [statsRows]);

  // Every count below carries both a raw message count and a distinct-lead
  // count, so the Messages/Leads view toggle (below) can pick either without
  // recomputing - one chatty lead tapping the same button 20 times should
  // read as "1" in leads view, not "20".
  const stats = useMemo(() => {
    const outbound = parsedStatsRows.filter(p => p.row.direction === 'outbound');
    const inbound = parsedStatsRows.filter(p => p.row.direction === 'inbound');
    const deliveredRows = outbound.filter(p => 'status' in p.parsed && p.parsed.status === 'delivered');
    const failedRows = outbound.filter(p => 'status' in p.parsed && p.parsed.status === 'failed');
    const buttonTapRows = parsedStatsRows.filter(p => p.parsed.kind === 'button_tap');
    const engagedLeads = new Set(buttonTapRows.map(p => p.row.lead_id)).size;

    const messagedLeads = new Set(outbound.map(p => p.row.lead_id));
    const repliedLeads = new Set(
      parsedStatsRows.filter(p => p.row.direction === 'inbound' && messagedLeads.has(p.row.lead_id)).map(p => p.row.lead_id)
    );

    const countOf = (list: { row: MessageRow }[]) => ({ messages: list.length, leads: new Set(list.map(p => p.row.lead_id)).size });

    // Keyed by the raw parsed.kind (not its display label) so a click can
    // feed straight into kindFilter, which already operates on that key.
    const byKind: Record<string, { messages: number; leads: Set<string> }> = {};
    const byTemplate: Record<string, { messages: number; leads: Set<string> }> = {};
    const byButton: Record<string, { messages: number; leads: Set<string> }> = {};

    for (const { row, parsed } of parsedStatsRows) {
      if (row.direction !== 'outbound') continue;
      (byKind[parsed.kind] ||= { messages: 0, leads: new Set() });
      byKind[parsed.kind].messages++;
      byKind[parsed.kind].leads.add(row.lead_id);
      if (parsed.kind === 'template') {
        (byTemplate[parsed.label] ||= { messages: 0, leads: new Set() });
        byTemplate[parsed.label].messages++;
        byTemplate[parsed.label].leads.add(row.lead_id);
      }
    }
    for (const { row, parsed } of parsedStatsRows) {
      if (row.direction !== 'inbound' || parsed.kind !== 'button_tap') continue;
      (byButton[parsed.label] ||= { messages: 0, leads: new Set() });
      byButton[parsed.label].messages++;
      byButton[parsed.label].leads.add(row.lead_id);
    }

    return {
      totalOutbound: countOf(outbound),
      totalInbound: countOf(inbound),
      delivered: countOf(deliveredRows),
      failed: countOf(failedRows),
      buttonTaps: countOf(buttonTapRows),
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
    const source = showInhouse ? rows.filter(isInhouseRow)
      : showBlocked ? rows.filter(isBlockedRow)
      : rows.filter(r => !isInhouseRow(r) && !isBlockedRow(r));
    const byLead = new Map<string, MessageRow[]>();
    for (const r of source) {
      if (!byLead.has(r.lead_id)) byLead.set(r.lead_id, []);
      byLead.get(r.lead_id)!.push(r);
    }
    return Array.from(byLead.entries()).map(([leadId, msgs]) => {
      const sorted = [...msgs].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      const last = sorted[sorted.length - 1] || null;
      const windowState = computeWindowState(sorted);
      return {
        leadId,
        leadName: sorted[0]?.lead_name || null,
        leadPhone: sorted[0]?.lead_phone || null,
        leadEmail: sorted[0]?.lead_email || null,
        leadSchool: sorted[0]?.lead_school || null,
        leadBotPaused: !!sorted[0]?.lead_bot_paused,
        leadIsBlocked: !!sorted[0]?.lead_is_blocked,
        leadBlockedReason: sorted[0]?.lead_blocked_reason || null,
        replyDismissedAt: sorted[0]?.lead_reply_dismissed_at || null,
        respondentIsParent: sorted[0]?.lead_respondent_is_parent ?? null,
        messages: sorted,
        inboundCount: sorted.filter(m => m.direction === 'inbound').length,
        outboundCount: sorted.filter(m => m.direction === 'outbound').length,
        total: sorted.length,
        lastActivityAt: last?.created_at || null,
        lastLabel: last ? parseMessage(last).label : '',
        lastDirection: last?.direction || null,
        windowExpiresAt: windowState.expiresAt,
        isWindowOpen: windowState.isOpen,
        msRemaining: windowState.msRemaining,
        windowTotalHours: windowState.totalHours,
      };
    });
  }, [rows, showInhouse, showBlocked]);

  // Filters decide which conversations show up at all (any message in the
  // thread matching is enough) - the expanded thread itself always shows
  // every message for that lead, unfiltered, since a conversation with
  // gaps cut out of it isn't a conversation anymore.
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      if (directionFilter !== 'all' && !g.messages.some(m => m.direction === directionFilter)) return false;
      if (kindFilter !== 'all' && !g.messages.some(m => parseMessage(m).kind === kindFilter)) return false;
      if (buttonFilter && !g.messages.some(m => { const p = parseMessage(m); return p.kind === 'button_tap' && p.label === buttonFilter; })) return false;
      if (templateFilter && !g.messages.some(m => { const p = parseMessage(m); return p.kind === 'template' && p.label === templateFilter; })) return false;
      if (q) {
        const haystack = `${g.leadPhone || ''} ${g.leadName || ''} ${g.messages.map(m => m.body).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [groups, directionFilter, kindFilter, buttonFilter, templateFilter, search]);

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
  // Leads still inside their messaging window are pinned to the top
  // regardless of the chosen column sort - Array.sort is stable in Node/V8, so this only
  // reorders across the open/closed boundary and leaves the user's chosen
  // order intact within each bucket. Unanswered-inbound conversations are a
  // second, higher-priority pin on top of that - an unreplied lead matters
  // more than window freshness, whether or not their window happens to
  // still be open.
  const sortedGroups = useMemo(() => {
    const base = sortRows(filteredGroups, sortColumn, sortDirection);
    const byWindow = [...base].sort((a, b) => (b.isWindowOpen ? 1 : 0) - (a.isWindowOpen ? 1 : 0));
    return byWindow.sort((a, b) => (needsReply(b) ? 1 : 0) - (needsReply(a) ? 1 : 0));
  }, [filteredGroups, sortColumn, sortDirection]);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => { setPage(0); }, [directionFilter, kindFilter, buttonFilter, templateFilter, search, showInhouse, showBlocked]);
  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedGroups = useMemo(
    () => sortedGroups.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [sortedGroups, currentPage, pageSize]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
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
            <div className="flex items-center justify-end mb-3">
              <div className="inline-flex bg-slate-100 rounded-xl p-1 text-xs font-black uppercase tracking-widest">
                <button onClick={() => setCountMode('messages')} className={`px-3 py-1.5 rounded-lg transition-colors ${countMode === 'messages' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Messages</button>
                <button onClick={() => setCountMode('leads')} className={`px-3 py-1.5 rounded-lg transition-colors ${countMode === 'leads' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Leads</button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <StatCard icon={MessageSquare} label="Total Inbound" value={stats.totalInbound[countMode]} accent="text-blue-600" />
              <StatCard icon={Send} label="Total Sent" value={stats.totalOutbound[countMode]} />
              <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered[countMode]} accent="text-emerald-600" />
              <StatCard icon={XCircle} label="Failed" value={stats.failed[countMode]} accent="text-rose-600" />
              <StatCard icon={MousePointerClick} label="Button Taps" value={stats.buttonTaps[countMode]} accent="text-indigo-600" />
              <StatCard icon={Users2} label="Leads Engaged" value={stats.engagedLeads} accent="text-indigo-600" />
              <StatCard icon={MessageSquare} label="Reply Rate" value={stats.replyRate} suffix="%" accent="text-amber-600" />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <BreakdownCard
                title="Sends By Type"
                data={stats.byKind}
                mode={countMode}
                keyLabel={k => KIND_LABEL[k] || k}
                activeKey={kindFilter !== 'all' ? kindFilter : null}
                onSelect={k => setKindFilter(prev => prev === k ? 'all' : k)}
              />
              <BreakdownCard
                title="Button Taps (Engagement)"
                data={stats.byButton}
                mode={countMode}
                activeKey={buttonFilter}
                onSelect={k => setButtonFilter(prev => prev === k ? null : k)}
              />
            </div>

            {Object.keys(stats.byTemplate).length > 0 && (
              <div className="mb-6">
                <BreakdownCard
                  title="Template Sends By Name"
                  data={stats.byTemplate}
                  mode={countMode}
                  activeKey={templateFilter}
                  onSelect={k => setTemplateFilter(prev => prev === k ? null : k)}
                />
              </div>
            )}

            {(buttonFilter || templateFilter) && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {buttonFilter && (
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold px-3 py-1.5 rounded-full">
                    Button: {buttonFilter}
                    <button onClick={() => setButtonFilter(null)} className="hover:text-indigo-900"><X size={11} /></button>
                  </span>
                )}
                {templateFilter && (
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold px-3 py-1.5 rounded-full">
                    Template: {templateFilter}
                    <button onClick={() => setTemplateFilter(null)} className="hover:text-indigo-900"><X size={11} /></button>
                  </span>
                )}
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
              <ViewToggle label={`Show inhouse (${inhouseCount})`} checked={showInhouse} onChange={setShowInhouse} activeColor="bg-slate-900" />
              <ViewToggle label={`Show blocked (${blockedCount})`} checked={showBlocked} onChange={setShowBlocked} activeColor="bg-rose-500" />
              <span className="text-xs text-slate-400 ml-auto">{filteredGroups.length} contact{filteredGroups.length === 1 ? '' : 's'} (of {visibleMessageCount} messages)</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-8" />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '19%' }} />
                  </colgroup>
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
                            className={`border-b border-slate-50 last:border-0 cursor-pointer transition-shadow duration-300 ${
                              needsReply(g) ? 'border-l-4 border-l-rose-400' : ''
                            } ${
                              g.isWindowOpen ? `relative z-0 ${windowGlowClass(g.msRemaining)} hover:brightness-95` : 'hover:bg-slate-50/50'
                            }`}
                          >
                            <td className="px-4 py-3 text-slate-300">
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800 flex items-center flex-wrap gap-1.5">
                                <span className="truncate max-w-full min-w-0">{g.leadName || '(no name)'}</span>
                                {needsReply(g) && (
                                  <span title="Their last message hasn't had a reply yet" className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest pl-1.5 pr-1 py-0.5 rounded-full bg-rose-100 text-rose-600">
                                    ● Needs Reply
                                    <button
                                      onClick={e => { e.stopPropagation(); dismissReply(g); }}
                                      disabled={dismissingId === g.leadId}
                                      title="Dismiss - I contacted them another way. Reappears if they message in again."
                                      className="hover:text-rose-900 disabled:opacity-50"
                                    >
                                      {dismissingId === g.leadId ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                                    </button>
                                  </span>
                                )}
                                {g.isWindowOpen && (
                                  <span title={g.windowExpiresAt ? `${g.windowTotalHours ?? 24}h messaging window closes ${g.windowExpiresAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}` : undefined} className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                    {formatCountdown(g.msRemaining)}
                                  </span>
                                )}
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
                                {g.leadIsBlocked && (
                                  <span title={g.leadBlockedReason || 'Blocked - no bot replies, no admin alerts'} className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600">
                                    <Ban size={9} /> Blocked
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
                            <td className="px-4 py-3 text-slate-400 text-xs truncate">
                              {g.lastActivityAt ? new Date(g.lastActivityAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center flex-wrap justify-end gap-1.5">
                                {!g.leadIsBlocked && <QueueQuickAdd leadId={g.leadId} leadName={g.leadName} />}
                                <button
                                  onClick={() => openEditLead(g)}
                                  title="Edit lead details"
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"
                                >
                                  <Pencil size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => openReply({ leadId: g.leadId, leadName: g.leadName, leadPhone: g.leadPhone, botPaused: g.leadBotPaused, isWindowOpen: g.isWindowOpen, windowExpiresAt: g.windowExpiresAt, windowTotalHours: g.windowTotalHours })}
                                  title={g.isWindowOpen ? 'Reply - free-form or an approved template' : 'Reply - messaging window closed, only approved templates can be sent'}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"
                                >
                                  <Reply size={12} /> Reply
                                </button>
                                {!g.leadIsBlocked && <DesktopSendButton leadId={g.leadId} phone={g.leadPhone || ''} />}
                                <button
                                  onClick={() => toggleBlocked(g)}
                                  disabled={blockingId === g.leadId}
                                  title={g.leadIsBlocked ? 'Unblock - resume normal bot/admin handling' : 'Block - abusive/gibberish sender, stops all bot replies and admin alerts'}
                                  className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg disabled:opacity-50 ${
                                    g.leadIsBlocked ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-rose-500 bg-slate-50 hover:bg-rose-50'
                                  }`}
                                >
                                  {blockingId === g.leadId ? <Loader2 size={12} className="animate-spin" /> : g.leadIsBlocked ? <ShieldCheck size={12} /> : <Ban size={12} />}
                                  {g.leadIsBlocked ? 'Unblock' : 'Block'}
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
                <p className="text-[13px] text-slate-400 mt-0.5">
                  +{replyingTo.leadPhone} · {replyingTo.isWindowOpen
                    ? `${replyingTo.windowTotalHours ?? 24}h messaging window open - free-form or template`
                    : 'Messaging window closed - approved templates only'}
                </p>
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
              {replyingTo.isWindowOpen ? (
                <>
                  {botFlows.filter(f => f.action_type === 'message').length > 0 && (
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

                  <p className="text-[12px] text-slate-400">Only deliverable while the messaging window is open (i.e. this lead has messaged recently - {replyingTo.windowTotalHours ?? 24}h for this lead) - Meta will reject it otherwise.</p>
                  {replyError && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{replyError}</div>}
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[13px] rounded-xl px-4 py-3">
                  Messaging window closed - free-form text and bot-flow message drafts can't be delivered. Send an approved template below instead; sending one also re-opens the window.
                </div>
              )}

              <div className={replyingTo.isWindowOpen ? 'pt-2 mt-1 border-t border-slate-100' : ''}>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><ShieldCheck size={11} /> Send an approved template</label>
                <select
                  value={selectedTemplateKey}
                  onChange={e => selectTemplateOption(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-700 outline-none focus:border-blue-400"
                >
                  <option value="">Choose a template...</option>
                  {templateOptions.map(t => (
                    <option key={t.key} value={t.key}>{t.label} · {t.badge} ({t.languageCode})</option>
                  ))}
                </select>
                {templateOptions.length === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">{templatesError || 'No approved templates found.'}</p>
                )}

                {selectedTemplateOption && (
                  <div className="mt-2.5 space-y-2 bg-slate-50 rounded-[10px] p-3">
                    <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${selectedTemplateOption.badge === 'Bot-flow Template' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {selectedTemplateOption.badge}
                    </span>
                    {selectedTemplateOption.bodyPreview && (
                      <p className="text-[12px] text-slate-500 italic">"{selectedTemplateOption.bodyPreview}"</p>
                    )}
                    {!selectedTemplateOption.presetVariables && selectedTemplateOption.variableNames.map((vn, i) => (
                      <input
                        key={i}
                        value={templateVariables[i] || ''}
                        onChange={e => setTemplateVariables(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                        placeholder={`{{${selectedTemplateOption.variableLabels?.[i] || vn}}} or literal text`}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-blue-400"
                      />
                    ))}
                    {selectedTemplateOption.presetVariables && selectedTemplateOption.variableNames.length > 0 && (
                      <p className="text-[11px] text-slate-400">Variables are pre-configured on this bot-flow and resolve automatically against the lead's own details.</p>
                    )}
                    <button
                      onClick={sendTemplateFromReply}
                      disabled={templateSending}
                      className="w-full py-2 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {templateSending ? <Loader2 size={13} className="animate-spin" /> : <><Send size={12} /> Send Template</>}
                    </button>
                    {templateSendError && <div className="bg-rose-50 text-rose-600 text-[12px] rounded-lg px-3 py-2">{templateSendError}</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <div className="flex gap-2">
                <button onClick={() => setReplyingTo(null)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">
                  {replyingTo.isWindowOpen ? 'Cancel' : 'Close'}
                </button>
                {replyingTo.isWindowOpen && (
                  <button
                    onClick={sendReply}
                    disabled={replySending || !replyText.trim()}
                    className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                  >
                    {replySending ? <Loader2 size={14} className="animate-spin" /> : <><Send size={13} /> Send</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {sendSuccessInfo && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-sm p-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-slate-900">{sendSuccessInfo.kind} sent</h3>
            <p className="text-[13px] text-slate-400 mt-1">Delivered to {sendSuccessInfo.leadName || 'the lead'}.</p>
            <button
              onClick={() => setSendSuccessInfo(null)}
              className="mt-5 w-full py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors duration-150"
            >
              Done
            </button>
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

// A momentary lens switch, not a persistent filter - same track/thumb
// styling as the bot-pause toggle in the reply modal above, just compact
// enough to sit inline in the filter bar.
function ViewToggle({ label, checked, onChange, activeColor }: { label: string; checked: boolean; onChange: (next: boolean) => void; activeColor: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"
    >
      {label}
      <span className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${checked ? activeColor : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
    </button>
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

// Rows are clickable when onSelect is given - clicking narrows the
// contacts table below to leads matching that key (clicking the active
// row again clears it, handled by the caller's onSelect). `mode` picks
// message-count vs distinct-lead-count out of each entry without the
// caller needing two separate data shapes.
function BreakdownCard({ title, data, mode, keyLabel, activeKey, onSelect }: {
  title: string;
  data: Record<string, { messages: number; leads: Set<string> }>;
  mode: 'messages' | 'leads';
  keyLabel?: (key: string) => string;
  activeKey?: string | null;
  onSelect: (key: string) => void;
}) {
  const entries = Object.entries(data)
    .map(([key, v]) => [key, mode === 'leads' ? v.leads.size : v.messages] as const)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map(([key, count]) => {
          const isActive = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`w-full flex items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 transition-colors cursor-pointer hover:bg-slate-50 ${isActive ? 'bg-indigo-50' : ''}`}
            >
              <span className={`text-xs w-40 shrink-0 truncate text-left ${isActive ? 'text-indigo-700 font-bold' : 'text-slate-600'}`} title={keyLabel ? keyLabel(key) : key}>
                {keyLabel ? keyLabel(key) : key}
              </span>
              <div className="flex-1 bg-slate-50 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-800'}`} style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className={`text-xs font-black w-8 text-right ${isActive ? 'text-indigo-600' : 'text-slate-500'}`}>{count}</span>
            </button>
          );
        })}
        {entries.length === 0 && <p className="text-xs text-slate-400">No data yet.</p>}
      </div>
    </div>
  );
}
