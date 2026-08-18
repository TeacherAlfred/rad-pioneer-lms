"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Users, UserPlus, CalendarClock, PhoneOff,
  MessageCircleWarning, Megaphone, Search, ClipboardList, Home,
  Send, X, Plus, Trash2, AlertTriangle, CheckCircle2, XCircle, MessageSquare, GitBranch, Users2, Pencil, Baby,
  GraduationCap, StickyNote, Tag, BookOpen, Activity, Flame,
} from "lucide-react";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";

type Lead = {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  lifecycle_stage: string | null;
  stage_health?: string | null;
  needs_human?: boolean | null;
  awaiting_reply_label?: string | null;
  is_customer?: boolean | null;
  first_purchase_at?: string | null;
  last_purchase_at?: string | null;
  engagement_recency?: string | null;
  source?: string | null;
  tags?: string[] | null;
  ad_id?: string | null;
  ad_headline?: string | null;
  ctwa_clid?: string | null;
  opted_out?: boolean | null;
  contacted_at?: string | null;
  created_at?: string | null;
  household_id?: string | null;
  household_name?: string | null;
  school?: string | null;
  class?: string | null;
  children_names?: string[] | null;
  is_potential_student?: boolean | null;
  last_sent_at?: string | null;
  last_sent_label?: string | null;
  last_sent_failed?: boolean;
};

type LeadNote = { id: string; note: string; created_at: string; created_by: string | null };
type LeadActivity = { id: string; channel: string; direction: string; outcome: string; note: string | null; created_by: string | null; created_at: string };

// Read-only shapes for the quick-view drawer - trimmed to what's actually
// rendered, not the full API response (see kids/orders/passes routes for
// the complete select).
type KidEnrolment = { id: string; status: string; attended: boolean | null; sessions: { starts_at: string | null; programs: { name: string } | null } | null };
type Kid = { id: string; name: string; age: number | null; grade: string | null; enrolments: KidEnrolment[] };
type Order = { id: string; created_at: string; amount_total: number | null; currency: string; status: string; bundles: { name: string } | null };
type Pass = { id: string; purchased_at: string; expires_at: string; credits_total: number; credits_used: number; first_session: { starts_at: string | null; programs: { name: string } | null } | null };

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600',
  engaged: 'bg-blue-50 text-blue-600',
  qualified: 'bg-amber-50 text-amber-600',
  offered: 'bg-indigo-50 text-indigo-600',
  won: 'bg-emerald-50 text-emerald-600',
  re_nurture: 'bg-purple-50 text-purple-600',
  lost: 'bg-slate-100 text-slate-400',
  opted_out: 'bg-rose-50 text-rose-400',
};

// Per-stage staleness (time-in-stage vs. its expected window) - a
// different axis from engagement recency below, see the Lead Funnel guide.
const STAGE_HEALTH_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600',
  stalled: 'bg-amber-50 text-amber-600',
  dormant: 'bg-rose-50 text-rose-500',
  lost: 'bg-slate-100 text-slate-400',
};

// Global warmth from last_inbound_at, independent of stage - computed by
// the nightly cron (src/app/api/lead-funnel/cron/route.ts).
const RECENCY_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600',
  cooling: 'bg-amber-50 text-amber-600',
  dormant: 'bg-orange-50 text-orange-600',
  cold: 'bg-slate-100 text-slate-400',
};

function statusLabel(status: string | null) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function isWithinDays(iso: string | null | undefined, days: number) {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  return Date.now() - then <= days * 24 * 60 * 60 * 1000;
}

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isWithinHours(iso: string | null | undefined, hours: number) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= hours * 60 * 60 * 1000;
}

// Recency at a glance, not a raw timestamp - the whole point is "did this
// happen a few hours ago" being obvious without doing the math yourself.
function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' });
}

// Threshold for the "you probably shouldn't resend yet" amber flag - matches
// WhatsApp's own 24hr customer-service window, already the central timing
// concept everywhere else in this funnel.
const RECENT_SEND_HOURS = 24;

// Test/staff/teacher leads - kept in the database on purpose (for testing
// the funnel itself) but excluded from every stat below so they don't
// skew real lead numbers. Reuses the existing tags[] column rather than a
// new schema field, same as any other tag (e.g. "Irene Primary").
const INHOUSE_TAG = 'Inhouse';
function isInhouse(lead: Lead) {
  return (lead.tags || []).some(t => t.toLowerCase() === INHOUSE_TAG.toLowerCase());
}

// Matches the server-side cap in /admin/api/lead-funnel/send-template -
// sends happen sequentially in one request, and a Vercel function has a
// hard execution time limit.
const MAX_RECIPIENTS = 50;

type SendResult = { leadId: string; phone: string; ok: boolean; skipped?: boolean; error?: string };
type MetaTemplate = {
  name: string; language: string; category: string; variableNames: string[]; bodyPreview: string;
  quickReplyButtons: { text: string; index: number }[];
};

// Placeholder names that auto-fill from that column on the lead's own row
// (see resolveVariable in the send-template route) instead of needing the
// admin to type a token by hand. Anything else stays blank for manual entry.
const LEAD_AUTOFIELDS = ['name', 'phone', 'email', 'school', 'class', 'source'];

export default function LeadFunnelPage() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [adOnly, setAdOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [showInhouse, setShowInhouse] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSendModal, setShowSendModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('en_US');
  const [variables, setVariables] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);

  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [manualEntry, setManualEntry] = useState(false);
  const [selectedVariableNames, setSelectedVariableNames] = useState<string[]>([]);
  const [selectedQuickReplyButtons, setSelectedQuickReplyButtons] = useState<{ text: string; index: number }[]>([]);
  const [buttonPayloads, setButtonPayloads] = useState<Record<number, string>>({});
  const [knownTriggerIds, setKnownTriggerIds] = useState<string[]>([]);
  // "btn_guide" is no longer hardcoded/reserved (see whatsapp-webhook's
  // 2026-08-15 change) - it's just whatever bot_flows rows happen to exist.
  const payloadOptions = Array.from(new Set(knownTriggerIds)).sort();

  async function openSendModal() {
    setShowSendModal(true);
    if (templates.length === 0 && !templatesError) {
      setTemplatesLoading(true);
      try {
        const res = await fetch('/admin/api/lead-funnel/templates');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load templates');
        setTemplates(data.templates || []);
        if ((data.templates || []).length === 0) setManualEntry(true);
      } catch (err: any) {
        setTemplatesError(err.message);
        setManualEntry(true);
      } finally {
        setTemplatesLoading(false);
      }
    }
    if (knownTriggerIds.length === 0) {
      try {
        const res = await fetch('/admin/api/bot-flows');
        const data = await res.json();
        if (res.ok) setKnownTriggerIds((data.rows || []).map((r: any) => r.trigger_button_id));
      } catch {
        // Non-fatal - payload dropdowns just fall back to btn_guide only.
      }
    }
  }

  function selectTemplate(key: string) {
    setSelectedTemplateKey(key);
    const t = templates.find(t => `${t.name}|${t.language}` === key);
    if (!t) return;
    setTemplateName(t.name);
    setLanguageCode(t.language);
    setVariables(t.variableNames.map(vn => LEAD_AUTOFIELDS.includes(vn.toLowerCase()) ? `{{${vn}}}` : ''));
    setSelectedVariableNames(t.variableNames);
    setSelectedQuickReplyButtons(t.quickReplyButtons || []);
    setButtonPayloads({});
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const selectable = pagedRows.filter(r => !r.opted_out);
    const allSelected = selectable.length > 0 && selectable.every(r => selectedIds.has(r.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        selectable.forEach(r => next.delete(r.id));
      } else {
        selectable.forEach(r => next.add(r.id));
      }
      return next;
    });
  }

  function addVariable() {
    setVariables(prev => [...prev, '']);
  }

  function updateVariable(idx: number, value: string) {
    setVariables(prev => prev.map((v, i) => i === idx ? value : v));
  }

  function removeVariable(idx: number) {
    setVariables(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSend() {
    setSendError(null);
    if (!templateName.trim() || !languageCode.trim()) {
      setSendError('Template name and language code are required.');
      return;
    }
    if (variables.some(v => !v.trim())) {
      setSendError('Every body variable needs a value - fill in each field (or use a {{column}} token) before sending. Meta rejects the whole send otherwise.');
      return;
    }
    setSending(true);
    setSendResults(null);
    try {
      // Sparse -> dense array up to the highest button index actually set,
      // since sendMetaTemplate positions these by array index directly.
      const maxIndex = Math.max(-1, ...Object.keys(buttonPayloads).map(Number));
      const buttonPayloadsArray = Array.from({ length: maxIndex + 1 }, (_, i) => buttonPayloads[i] || '');

      const res = await fetch('/admin/api/lead-funnel/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: Array.from(selectedIds),
          templateName: templateName.trim(),
          languageCode: languageCode.trim(),
          variables,
          variableNames: manualEntry ? [] : selectedVariableNames,
          buttonPayloads: buttonPayloadsArray,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setSendResults(data.results || []);
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  function closeSendModal() {
    setShowSendModal(false);
    setTemplateName('');
    setLanguageCode('en_US');
    setVariables([]);
    setSendError(null);
    setSendResults(null);
    setSelectedTemplateKey('');
    setManualEntry(false);
    setSelectedVariableNames([]);
    setSelectedQuickReplyButtons([]);
    setButtonPayloads({});
  }

  const [showHouseholdModal, setShowHouseholdModal] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [householdSaving, setHouseholdSaving] = useState(false);
  const [householdError, setHouseholdError] = useState<string | null>(null);

  function closeHouseholdModal() {
    setShowHouseholdModal(false);
    setHouseholdName('');
    setHouseholdError(null);
  }

  async function linkHousehold() {
    setHouseholdSaving(true);
    setHouseholdError(null);
    try {
      const res = await fetch('/admin/api/lead-funnel/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), name: householdName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link household');
      const refreshed = await fetch('/admin/api/lead-funnel');
      const refreshedData = await refreshed.json();
      setRows(refreshedData.rows || []);
      setSelectedIds(new Set());
      closeHouseholdModal();
    } catch (err: any) {
      setHouseholdError(err.message);
    } finally {
      setHouseholdSaving(false);
    }
  }

  async function unlinkHousehold(lead: Lead) {
    setSavingId(lead.id);
    setRows(prev => prev.map(r => r.id === lead.id ? { ...r, household_id: null, household_name: null } : r));
    try {
      await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, household_id: null }),
      });
    } finally {
      setSavingId(null);
    }
  }

  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', school: '', class: '', children_names: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(lead: Lead) {
    setViewingLead(null);
    setEditingLead(lead);
    setEditForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      school: lead.school || '',
      class: lead.class || '',
      children_names: (lead.children_names || []).join(', '),
    });
    setEditError(null);
    setNewTag('');
    loadNotes(lead.id);
  }

  function closeEdit() {
    setEditingLead(null);
    setEditError(null);
    setLeadNotes([]);
  }

  // --- Quick-view drawer: read-only, opened by clicking a lead's name.
  // Pulls together everything about a lead - funnel axes, contact
  // outcomes, notes, kids/enrolments, orders/passes - in one place.
  // Editing (tags, notes, contact fields) stays exclusively behind the
  // pencil icon / openEdit above. ---
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [kids, setKids] = useState<Kid[]>([]);
  const [kidsLoading, setKidsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);

  function openView(lead: Lead) {
    setEditingLead(null);
    setViewingLead(lead);
    loadNotes(lead.id);
    loadActivities(lead.id);
    loadKids(lead.id);
    loadFinance(lead.id);
  }

  function closeView() {
    setViewingLead(null);
    setLeadNotes([]);
    setLeadActivities([]);
    setKids([]);
    setOrders([]);
    setPasses([]);
  }

  function switchToEdit() {
    if (!viewingLead) return;
    openEdit(viewingLead);
  }

  async function loadKids(leadId: string) {
    setKidsLoading(true);
    try {
      const res = await fetch(`/admin/api/kids?leadId=${encodeURIComponent(leadId)}`);
      const data = await res.json();
      setKids(data.rows || []);
    } finally {
      setKidsLoading(false);
    }
  }

  async function loadFinance(leadId: string) {
    setFinanceLoading(true);
    try {
      const [ordersRes, passesRes] = await Promise.all([
        fetch(`/admin/api/orders?guardianLeadId=${encodeURIComponent(leadId)}`),
        fetch(`/admin/api/passes?guardianLeadId=${encodeURIComponent(leadId)}`),
      ]);
      const [ordersData, passesData] = await Promise.all([ordersRes.json(), passesRes.json()]);
      setOrders(ordersData.rows || []);
      setPasses(passesData.rows || []);
    } finally {
      setFinanceLoading(false);
    }
  }

  // --- Tags: general-purpose add/remove, saved immediately (same
  // pattern as toggleInhouse, which is really just a shortcut for one
  // specific tag value). ---
  const [newTag, setNewTag] = useState('');

  async function addTag() {
    if (!editingLead || !newTag.trim()) return;
    const tag = newTag.trim();
    const currentTags = editingLead.tags || [];
    if (currentTags.some(t => t.toLowerCase() === tag.toLowerCase())) { setNewTag(''); return; }
    const nextTags = [...currentTags, tag];
    await patchLeadField(editingLead.id, { tags: nextTags });
    setEditingLead(l => l ? { ...l, tags: nextTags } : l);
    setNewTag('');
  }

  async function removeTag(tag: string) {
    if (!editingLead) return;
    const nextTags = (editingLead.tags || []).filter(t => t !== tag);
    await patchLeadField(editingLead.id, { tags: nextTags });
    setEditingLead(l => l ? { ...l, tags: nextTags } : l);
  }

  async function togglePotentialStudent() {
    if (!editingLead) return;
    const next = !editingLead.is_potential_student;
    await patchLeadField(editingLead.id, { is_potential_student: next });
    setEditingLead(l => l ? { ...l, is_potential_student: next } : l);
  }

  async function patchLeadField(id: string, patch: Record<string, any>) {
    const res = await fetch('/admin/api/lead-funnel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (res.ok) setRows(prev => prev.map(r => r.id === id ? { ...r, ...data.row } : r));
  }

  // --- Notes: a running log per lead (location, feedback from calls/
  // WhatsApp), not a single overwritable field. ---
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  async function loadNotes(leadId: string) {
    setNotesLoading(true);
    try {
      const res = await fetch(`/admin/api/lead-funnel/notes?leadId=${encodeURIComponent(leadId)}`);
      const data = await res.json();
      setLeadNotes(data.rows || []);
    } finally {
      setNotesLoading(false);
    }
  }

  async function addNote() {
    if (!editingLead || !newNote.trim()) return;
    setNoteSaving(true);
    try {
      const res = await fetch('/admin/api/lead-funnel/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: editingLead.id, note: newNote.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeadNotes(prev => [data.row, ...prev]);
        setNewNote('');
      }
    } finally {
      setNoteSaving(false);
    }
  }

  async function deleteNote(id: string) {
    setLeadNotes(prev => prev.filter(n => n.id !== id));
    await fetch('/admin/api/lead-funnel/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  // --- Contact outcomes: read-only feed of lead_activities (Contacted /
  // No Response / Follow-up Set, and bot_flow reply captures). Written only
  // by the webhook - nothing here writes to it. ---
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  async function loadActivities(leadId: string) {
    setActivitiesLoading(true);
    try {
      const res = await fetch(`/admin/api/lead-funnel/activities?leadId=${encodeURIComponent(leadId)}`);
      const data = await res.json();
      setLeadActivities(data.rows || []);
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function saveEdit() {
    if (!editingLead) return;
    if (!editForm.phone.trim()) {
      setEditError('Phone cannot be empty.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLead.id,
          name: editForm.name.trim() || null,
          phone: editForm.phone.trim(),
          email: editForm.email.trim() || null,
          school: editForm.school.trim() || null,
          class: editForm.class.trim() || null,
          children_names: editForm.children_names.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      // Merge rather than replace - the PATCH response is a bare leads row
      // (no households(name) embed), so this preserves household_name.
      setRows(prev => prev.map(r => r.id === editingLead.id ? { ...r, ...data.row } : r));
      setEditingLead(null);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleInhouse(lead: Lead) {
    const currentTags = lead.tags || [];
    const newTags = isInhouse(lead)
      ? currentTags.filter(t => t.toLowerCase() !== INHOUSE_TAG.toLowerCase())
      : [...currentTags, INHOUSE_TAG];

    setSavingId(lead.id);
    setRows(prev => prev.map(r => r.id === lead.id ? { ...r, tags: newTags } : r));
    try {
      await fetch('/admin/api/lead-funnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, tags: newTags }),
      });
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/admin/api/lead-funnel');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load leads');
        setRows(data.rows || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Every stat below is computed off statsRows (inhouse leads excluded) -
  // the table listing is the only thing the showInhouse toggle affects.
  const statsRows = useMemo(() => rows.filter(r => !isInhouse(r)), [rows]);
  const inhouseCount = rows.length - statsRows.length;

  const stats = useMemo(() => {
    const total = statsRows.length;
    const newToday = statsRows.filter(r => isToday(r.created_at)).length;
    const newThisWeek = statsRows.filter(r => isWithinDays(r.created_at, 7)).length;
    const needsHuman = statsRows.filter(r => r.needs_human).length;
    const optedOut = statsRows.filter(r => r.opted_out).length;
    const fromAds = statsRows.filter(r => r.ad_id).length;

    // Distinct households + leads with no household count once each - the
    // "how many actual prospects/families" number, vs. raw lead-row count
    // above which counts both parents of the same family separately.
    const householdIds = new Set(statsRows.filter(r => r.household_id).map(r => r.household_id));
    const standalone = statsRows.filter(r => !r.household_id).length;
    const households = householdIds.size + standalone;

    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byAd: Record<string, number> = {};

    for (const r of statsRows) {
      const s = r.lifecycle_stage || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;

      const src = r.source || 'organic / direct';
      bySource[src] = (bySource[src] || 0) + 1;

      if (r.ad_id) {
        const key = r.ad_headline || r.ad_id;
        byAd[key] = (byAd[key] || 0) + 1;
      }
    }

    return { total, newToday, newThisWeek, needsHuman, optedOut, fromAds, households, byStatus, bySource, byAd };
  }, [statsRows]);

  const statusOptions = useMemo(() => Array.from(new Set(rows.map(r => r.lifecycle_stage || 'unknown'))).sort(), [rows]);
  const sourceOptions = useMemo(() => Array.from(new Set(rows.map(r => r.source || 'organic / direct'))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = showInhouse ? rows : statsRows;
    return source.filter(r => {
      if (statusFilter !== 'all' && (r.lifecycle_stage || 'unknown') !== statusFilter) return false;
      if (sourceFilter !== 'all' && (r.source || 'organic / direct') !== sourceFilter) return false;
      if (adOnly && !r.ad_id) return false;
      if (q) {
        const haystack = `${r.phone} ${r.name || ''} ${r.email || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statsRows, showInhouse, statusFilter, sourceFilter, adOnly, search]);

  const [sortColumn, setSortColumn] = useState<string | null>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }
  const sortedRows = useMemo(() => sortRows(filteredRows, sortColumn, sortDirection), [filteredRows, sortColumn, sortDirection]);

  // Stats/breakdowns above need the full filtered set - only the table
  // rendering itself is paged, so this never truncates what the numbers say.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(0); }, [statusFilter, sourceFilter, adOnly, search, showInhouse]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(
    () => sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [sortedRows, currentPage, pageSize]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/lead-funnel/guide" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <BookOpen size={14} /> Guide
            </Link>
            <Link href="/admin/bot-flows" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <GitBranch size={14} /> Bot Flows
            </Link>
            <Link href="/admin/lead-funnel/stages" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <GitBranch size={14} /> Funnel Stages
            </Link>
            <Link href="/admin/lead-funnel/messages" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <MessageSquare size={14} /> Message Activity
            </Link>
            <Link href="/admin/warm-list" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <ClipboardList size={14} /> Import / Review Leads (Warm List)
            </Link>
            <Link href="/admin/kids" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Baby size={14} /> Kids
            </Link>
            <Link href="/admin/sessions" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <CalendarClock size={14} /> Upcoming Sessions
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lead Funnel</h1>
          <p className="text-sm text-slate-500 mt-1">Everyone in the `leads` table - WhatsApp bot, Irene voting consent, and warm-list imports. Not the registrations/profiles pipeline at /admin/leads.</p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <StatCard icon={Users} label="Total Leads" value={stats.total} />
              <StatCard icon={Users2} label="Households" value={stats.households} accent="text-purple-600" />
              <StatCard icon={UserPlus} label="New Today" value={stats.newToday} />
              <StatCard icon={CalendarClock} label="New This Week" value={stats.newThisWeek} />
              <StatCard icon={MessageCircleWarning} label="Needs Human" value={stats.needsHuman} accent="text-amber-600" />
              <StatCard icon={Megaphone} label="From Ads" value={stats.fromAds} accent="text-indigo-600" />
              <StatCard icon={PhoneOff} label="Opted Out" value={stats.optedOut} accent="text-rose-600" />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <BreakdownCard title="By Status" data={stats.byStatus} formatLabel={statusLabel} />
              <BreakdownCard title="By Source" data={stats.bySource} />
            </div>

            {Object.keys(stats.byAd).length > 0 && (
              <div className="mb-6">
                <BreakdownCard title="By Ad Creative (which ad brought them in)" data={stats.byAd} />
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  placeholder="Search phone, name, email, tags..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All statuses</option>
                {statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All sources</option>
                {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                <input type="checkbox" checked={adOnly} onChange={e => setAdOnly(e.target.checked)} /> Ad-attributed only
              </label>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showInhouse} onChange={e => setShowInhouse(e.target.checked)} /> Show inhouse ({inhouseCount})
              </label>
              <span className="text-xs text-slate-400 ml-auto">{filteredRows.length} of {showInhouse ? rows.length : statsRows.length}</span>
            </div>

            {selectedIds.size > 0 && (
              <div className="bg-slate-900 text-white rounded-2xl p-4 mb-4 flex items-center gap-4 flex-wrap">
                <span className="text-sm font-bold">{selectedIds.size} lead{selectedIds.size === 1 ? '' : 's'} selected</span>
                {selectedIds.size > MAX_RECIPIENTS && (
                  <span className="flex items-center gap-1 text-xs text-amber-300"><AlertTriangle size={13} /> Max {MAX_RECIPIENTS} per send - deselect some first</span>
                )}
                <button onClick={openSendModal} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100">
                  <Send size={14} /> Send Template
                </button>
                <button
                  onClick={() => setShowHouseholdModal(true)}
                  disabled={selectedIds.size < 2}
                  title={selectedIds.size < 2 ? 'Select at least 2 leads (e.g. both parents)' : undefined}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50"
                >
                  <Users2 size={14} /> Link as Household
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white ml-auto">
                  Clear selection
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={pagedRows.filter(r => !r.opted_out).length > 0 && pagedRows.filter(r => !r.opted_out).every(r => selectedIds.has(r.id))}
                          onChange={toggleSelectAllVisible}
                        />
                      </th>
                      <SortableHeader label="Lead" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Status" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Source" column="source" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <th className="px-4 py-3">Tags</th>
                      <SortableHeader label="Created" column="created_at" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <SortableHeader label="Last Sent" column="last_sent_at" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                      <th className="px-4 py-3">Inhouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            disabled={!!r.opted_out}
                            title={r.opted_out ? "Opted out - can't send a template to this lead" : undefined}
                            onChange={() => toggleSelect(r.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openView(r)} title="View lead details" className="font-bold text-slate-800 hover:underline text-left">
                              {r.name || '(no name)'}
                            </button>
                            <button onClick={() => openEdit(r)} title="Edit lead details" className="text-slate-300 hover:text-slate-600">
                              <Pencil size={11} />
                            </button>
                          </div>
                          <div className="text-xs text-slate-400">+{r.phone}{r.email ? ` · ${r.email}` : ''}</div>
                          {(r.children_names || []).length > 0 && (
                            <div className="text-[11px] text-slate-400 mt-0.5">Children: {(r.children_names || []).join(', ')}</div>
                          )}
                          {r.opted_out && <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">Opted out</span>}
                          {r.household_name && (
                            <div className="inline-flex items-center gap-1 mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                <Users2 size={10} /> {r.household_name}
                              </span>
                              <button
                                onClick={() => unlinkHousehold(r)}
                                disabled={savingId === r.id}
                                title="Unlink from household"
                                className="text-slate-300 hover:text-rose-500 disabled:opacity-50"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${STATUS_STYLES[r.lifecycle_stage || ''] || 'bg-slate-100 text-slate-500'}`}>
                              {statusLabel(r.lifecycle_stage)}
                            </span>
                            {r.needs_human && (
                              <span title="Awaiting a human reply" className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-600">
                                Needs Reply
                              </span>
                            )}
                            {r.awaiting_reply_label && (
                              <span title="Bot is waiting on this from the lead" className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-blue-50 text-blue-500">
                                Awaiting: {r.awaiting_reply_label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-600">{r.source || 'organic / direct'}</div>
                          {r.ad_id && (
                            <div className="flex items-center gap-1 mt-1 text-[11px] text-indigo-600">
                              <Megaphone size={11} /> {r.ad_headline || r.ad_id}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.is_potential_student && (
                              <span title="Potential Student" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                                <GraduationCap size={10} /> Student
                              </span>
                            )}
                            {(r.tags || []).map(t => (
                              <span key={t} className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {r.last_sent_at ? (
                            <span
                              title={`${r.last_sent_label}${r.last_sent_failed ? ' (failed)' : ''}\n${new Date(r.last_sent_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}`}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full cursor-default ${
                                r.last_sent_failed
                                  ? 'bg-rose-50 text-rose-500'
                                  : isWithinHours(r.last_sent_at, RECENT_SEND_HOURS)
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-slate-50 text-slate-400'
                              }`}
                            >
                              {r.last_sent_failed ? <XCircle size={11} /> : <Send size={11} />}
                              {formatRelativeTime(r.last_sent_at)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-300">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleInhouse(r)}
                            disabled={savingId === r.id}
                            title="Toggle Inhouse - excludes this lead from all stats above, keeps it in the database"
                            className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border transition-colors disabled:opacity-50 ${isInhouse(r) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                          >
                            <Home size={11} /> {savingId === r.id ? '...' : isInhouse(r) ? 'Inhouse' : 'Mark'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm">No leads match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredRows.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>
                      Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredRows.length)} of {filteredRows.length}
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

      {showSendModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Send Meta Template</h3>
              <button onClick={closeSendModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Sending to <b>{selectedIds.size}</b> lead{selectedIds.size === 1 ? '' : 's'}. Template name must exactly match one approved in Meta Business Manager - this doesn't validate that for you. Opted-out leads in your selection are skipped automatically.
            </p>

            {sendResults ? (
              <div className="space-y-3">
                <div className="flex gap-3 text-xs font-black uppercase tracking-widest">
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} /> {sendResults.filter(r => r.ok).length} delivered</span>
                  <span className="flex items-center gap-1 text-rose-500"><XCircle size={14} /> {sendResults.filter(r => !r.ok && !r.skipped).length} failed</span>
                  <span className="flex items-center gap-1 text-slate-400"><PhoneOff size={14} /> {sendResults.filter(r => r.skipped).length} skipped</span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {sendResults.filter(r => !r.ok).map(r => (
                    <div key={r.leadId} className="text-xs bg-rose-50 text-rose-600 rounded-lg px-3 py-2">
                      +{r.phone}: {r.skipped ? 'Skipped (opted out)' : r.error}
                    </div>
                  ))}
                </div>
                <button onClick={closeSendModal} className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900">Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader2 size={14} className="animate-spin" /> Loading approved templates from Meta...</div>
                ) : !manualEntry && templates.length > 0 ? (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Approved Template</label>
                    <select value={selectedTemplateKey} onChange={e => selectTemplate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400 mb-1">
                      <option value="">Select a template...</option>
                      {templates.map(t => (
                        <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language}, {t.category})</option>
                      ))}
                    </select>
                    {selectedTemplateKey && (
                      <p className="text-[11px] text-slate-400 italic mb-1">"{templates.find(t => `${t.name}|${t.language}` === selectedTemplateKey)?.bodyPreview}"</p>
                    )}
                    <button type="button" onClick={() => setManualEntry(true)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                      Type name/language manually instead
                    </button>

                    {selectedQuickReplyButtons.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Button Payloads (optional)</label>
                        <p className="text-[11px] text-slate-400 mb-2">
                          Meta only lets you set a quick-reply button's payload here, at send time - not when the template was created. Choices below are limited to ids that actually exist in Bot Flows, so you can't pick one that won't route anywhere.
                        </p>
                        {selectedQuickReplyButtons.map(b => (
                          <div key={b.index} className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-500 w-32 shrink-0 truncate" title={b.text}>{b.text}</span>
                            <select
                              value={buttonPayloads[b.index] || ''}
                              onChange={e => setButtonPayloads(prev => ({ ...prev, [b.index]: e.target.value }))}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
                            >
                              <option value="">— Use Meta's default (won't match Bot Flows) —</option>
                              {payloadOptions.map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {templatesError && (
                      <p className="text-[11px] text-amber-600 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Couldn't load templates from Meta ({templatesError}) - enter details manually.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Template name (exact)" value={templateName} onChange={e => setTemplateName(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                      <input placeholder="Language code (e.g. en_US)" value={languageCode} onChange={e => setLanguageCode(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                    </div>
                    {templates.length > 0 && (
                      <button type="button" onClick={() => setManualEntry(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mt-2">
                        Choose from approved list instead
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Body Variables{!manualEntry && selectedVariableNames.length > 0 ? ` (${selectedVariableNames.length} required by this template, in order)` : ''}
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">Fields matching a lead column (<code>{'{{name}}'}</code>, <code>{'{{phone}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{school}}'}</code>, <code>{'{{class}}'}</code>, <code>{'{{source}}'}</code>) auto-fill per lead. Anything else is sent as literal text to everyone.</p>
                  {variables.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        placeholder={selectedVariableNames[i] ? `{{${selectedVariableNames[i]}}} - e.g. {{name}}` : `Variable ${i + 1}, e.g. {{name}}`}
                        value={v}
                        onChange={e => updateVariable(i, e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
                      />
                      {manualEntry && (
                        <button type="button" onClick={() => removeVariable(i)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                  {manualEntry && (
                    <button type="button" onClick={addVariable} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                      <Plus size={11} className="inline -mt-0.5" /> add variable
                    </button>
                  )}
                </div>

                {sendError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{sendError}</div>}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeSendModal} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || selectedIds.size === 0 || selectedIds.size > MAX_RECIPIENTS}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : `Send to ${selectedIds.size}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showHouseholdModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Link as Household</h3>
              <button onClick={closeHouseholdModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Linking <b>{selectedIds.size}</b> leads as one household - e.g. both parents of the same child. Each keeps their own conversation and status; this only groups them for counting and display.
            </p>
            <input
              placeholder="Household name, e.g. Smith Family"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400 mb-3"
            />
            {householdError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3 mb-3">{householdError}</div>}
            <div className="flex gap-2">
              <button onClick={closeHouseholdModal} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
              <button
                onClick={linkHousehold}
                disabled={householdSaving}
                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50"
              >
                {householdSaving ? 'Linking...' : 'Link Household'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Edit Lead</h3>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                <p className="text-[11px] text-slate-400 mt-1">Normalized to digits only on save - this is what the bot matches future messages against.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email</label>
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">School</label>
                  <input value={editForm.school} onChange={e => setEditForm(f => ({ ...f, school: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Class</label>
                  <input value={editForm.class} onChange={e => setEditForm(f => ({ ...f, class: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Children's Names</label>
                <input
                  placeholder="Comma-separated, e.g. Liam, Ava"
                  value={editForm.children_names}
                  onChange={e => setEditForm(f => ({ ...f, children_names: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Informal list only. For ages, grades, contact details, and course/event registrations, use{' '}
                  <Link href={`/admin/kids?leadId=${editingLead.id}`} className="underline inline-flex items-center gap-0.5">
                    <Baby size={11} /> Kids
                  </Link>.
                </p>
              </div>

              <div>
                <button
                  onClick={togglePotentialStudent}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border transition-colors ${
                    editingLead.is_potential_student ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest">
                    <GraduationCap size={13} /> Potential Student
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{editingLead.is_potential_student ? 'Yes' : 'Mark'}</span>
                </button>
                <p className="text-[11px] text-slate-400 mt-1">
                  This lead is themselves within RAD's student age range (not a parent enquiring for a child). Flags them for follow-up - it doesn't create a Kids record, since attending still needs a guardian's consent.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1"><Tag size={11} /> Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(editingLead.tags || []).map(t => (
                    <span key={t} className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-rose-500"><X size={10} /></button>
                    </span>
                  ))}
                  {(editingLead.tags || []).length === 0 && <span className="text-xs text-slate-300">No tags yet</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="e.g. Menlyn, Referral, Polokwane"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                  <button onClick={addTag} className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900">Add</button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1"><StickyNote size={11} /> Notes</label>
                <div className="flex gap-2 mb-2">
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Location, feedback from a call or WhatsApp exchange..."
                    rows={2}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <button onClick={addNote} disabled={noteSaving || !newNote.trim()} className="w-full mb-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                  {noteSaving ? 'Adding...' : 'Add Note'}
                </button>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {notesLoading ? (
                    <div className="flex items-center justify-center py-4 text-slate-300"><Loader2 className="animate-spin" size={16} /></div>
                  ) : leadNotes.length === 0 ? (
                    <p className="text-xs text-slate-300 text-center py-2">No notes yet.</p>
                  ) : (
                    leadNotes.map(n => (
                      <div key={n.id} className="bg-slate-50 rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] text-slate-700">{n.note}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button onClick={() => deleteNote(n.id)} className="text-slate-300 hover:text-rose-500 shrink-0"><X size={12} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {editError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{editError}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={closeEdit} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingLead && (
        <div className="fixed inset-0 bg-black/40 z-50" onClick={closeView}>
          <div
            className="fixed inset-y-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-slate-900 truncate">{viewingLead.name || '(no name)'}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">+{viewingLead.phone}{viewingLead.email ? ` · ${viewingLead.email}` : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={switchToEdit} title="Edit this lead" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-slate-400">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={closeView} className="text-slate-400 hover:text-slate-600 p-2"><X size={18} /></button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${STATUS_STYLES[viewingLead.lifecycle_stage || ''] || 'bg-slate-100 text-slate-500'}`}>
                  {statusLabel(viewingLead.lifecycle_stage)}
                </span>
                {viewingLead.stage_health && viewingLead.stage_health !== 'active' && (
                  <span title="Time in current stage vs. its expected window" className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${STAGE_HEALTH_STYLES[viewingLead.stage_health] || 'bg-slate-100 text-slate-500'}`}>
                    <Activity size={10} /> {viewingLead.stage_health}
                  </span>
                )}
                {viewingLead.engagement_recency && (
                  <span title="Warmth from last inbound message, independent of stage" className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${RECENCY_STYLES[viewingLead.engagement_recency] || 'bg-slate-100 text-slate-500'}`}>
                    <Flame size={10} /> {viewingLead.engagement_recency}
                  </span>
                )}
                {viewingLead.needs_human && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-600">Needs Reply</span>
                )}
                {viewingLead.awaiting_reply_label && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-blue-50 text-blue-500">Awaiting: {viewingLead.awaiting_reply_label}</span>
                )}
                {viewingLead.opted_out && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-rose-50 text-rose-500">Opted Out</span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Status</div>
                  {viewingLead.is_customer ? (
                    <p className="text-slate-600 flex items-center gap-1"><GraduationCap size={13} className="text-emerald-600" /> Since {viewingLead.first_purchase_at ? new Date(viewingLead.first_purchase_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown'}</p>
                  ) : (
                    <p className="text-slate-400">Not yet a customer</p>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Source</div>
                  <p className="text-slate-600">{viewingLead.source || 'organic / direct'}</p>
                  {viewingLead.ad_id && <p className="flex items-center gap-1 text-indigo-600 mt-0.5"><Megaphone size={11} /> {viewingLead.ad_headline || viewingLead.ad_id}</p>}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">School / Class</div>
                  <p className="text-slate-600">{viewingLead.school || '—'}{viewingLead.class ? ` · ${viewingLead.class}` : ''}</p>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Household</div>
                  <p className="text-slate-600">{viewingLead.household_name || '—'}</p>
                </div>
              </div>

              {(viewingLead.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {viewingLead.is_potential_student && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      <GraduationCap size={10} /> Student
                    </span>
                  )}
                  {(viewingLead.tags || []).map(t => (
                    <span key={t} className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><MessageSquare size={11} /> Contact Outcomes</label>
                <div className="space-y-1.5">
                  {activitiesLoading ? (
                    <div className="flex items-center justify-center py-3 text-slate-300"><Loader2 className="animate-spin" size={14} /></div>
                  ) : leadActivities.length === 0 ? (
                    <p className="text-[11px] text-slate-300">No contact attempts logged yet.</p>
                  ) : (
                    leadActivities.map(a => (
                      <div key={a.id} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-600">
                          <b className="capitalize">{a.outcome.replace(/_/g, ' ')}</b>
                          <span className="text-slate-400"> · {a.channel} · {a.direction}{a.created_by ? ` · ${a.created_by}` : ''}</span>
                        </span>
                        <span className="text-slate-400 shrink-0">{new Date(a.created_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' })}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><StickyNote size={11} /> Notes</label>
                <div className="space-y-1.5">
                  {notesLoading ? (
                    <div className="flex items-center justify-center py-3 text-slate-300"><Loader2 className="animate-spin" size={14} /></div>
                  ) : leadNotes.length === 0 ? (
                    <p className="text-[11px] text-slate-300">No notes yet.</p>
                  ) : (
                    leadNotes.map(n => (
                      <div key={n.id} className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <p className="text-[12px] text-slate-700">{n.note}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Baby size={11} /> Children</label>
                  <Link href={`/admin/kids?leadId=${viewingLead.id}`} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Manage →</Link>
                </div>
                <div className="space-y-1.5">
                  {kidsLoading ? (
                    <div className="flex items-center justify-center py-3 text-slate-300"><Loader2 className="animate-spin" size={14} /></div>
                  ) : kids.length === 0 ? (
                    <p className="text-[11px] text-slate-300">No linked children.</p>
                  ) : (
                    kids.map(k => (
                      <div key={k.id} className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <p className="text-[12px] font-bold text-slate-700">{k.name}{k.age ? `, age ${k.age}` : ''}{k.grade ? ` · ${k.grade}` : ''}</p>
                        {(k.enrolments || []).length > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            {k.enrolments.map(e => (
                              <p key={e.id} className="text-[11px] text-slate-500">
                                {e.sessions?.programs?.name || 'Session'} — {e.sessions?.starts_at ? new Date(e.sessions.starts_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' }) : 'unscheduled'}
                                {' · '}{e.attended ? <span className="text-emerald-600 font-bold">Attended</span> : <span className="text-slate-400">{e.status}</span>}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-300 mt-0.5">Not enrolled on any session yet.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Send size={11} /> Finance</label>
                  <Link href="/admin/commerce" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Manage in Commerce →</Link>
                </div>
                <div className="space-y-1.5">
                  {financeLoading ? (
                    <div className="flex items-center justify-center py-3 text-slate-300"><Loader2 className="animate-spin" size={14} /></div>
                  ) : orders.length === 0 && passes.length === 0 ? (
                    <p className="text-[11px] text-slate-300">No orders or passes yet.</p>
                  ) : (
                    <>
                      {orders.map(o => (
                        <div key={o.id} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 rounded-lg px-2.5 py-1.5">
                          <span className="text-slate-600">
                            <b>{o.bundles?.name || 'Order'}</b>
                            <span className="text-slate-400"> · {o.status}{o.amount_total != null ? ` · ${o.currency} ${o.amount_total}` : ''}</span>
                          </span>
                          <span className="text-slate-400 shrink-0">{new Date(o.created_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' })}</span>
                        </div>
                      ))}
                      {passes.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 rounded-lg px-2.5 py-1.5">
                          <span className="text-slate-600">
                            <b>Pass</b>
                            <span className="text-slate-400"> · {p.credits_used}/{p.credits_total} credits used · expires {new Date(p.expires_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <Link href="/admin/lead-funnel/messages" className="block text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 pt-2 border-t border-slate-100">
                View full message history →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <Icon size={16} className={accent || 'text-slate-400'} />
      <div className={`text-2xl font-black mt-2 ${accent || 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, data, formatLabel }: { title: string; data: Record<string, number>; formatLabel?: (s: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-40 shrink-0 truncate" title={key}>{formatLabel ? formatLabel(key) : key}</span>
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
