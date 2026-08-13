"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Users, UserPlus, CalendarClock, PhoneOff,
  MessageCircleWarning, Megaphone, Search, ClipboardList, Home,
  Send, X, Plus, Trash2, AlertTriangle, CheckCircle2, XCircle, MessageSquare,
} from "lucide-react";

type Lead = {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  status: string | null;
  source?: string | null;
  tags?: string[] | null;
  ad_id?: string | null;
  ad_headline?: string | null;
  ctwa_clid?: string | null;
  opted_out?: boolean | null;
  contacted_at?: string | null;
  created_at?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  new_lead: 'bg-slate-100 text-slate-600',
  needs_human: 'bg-amber-50 text-amber-600',
  contacted: 'bg-emerald-50 text-emerald-600',
  no_response: 'bg-rose-50 text-rose-600',
  followup_scheduled: 'bg-indigo-50 text-indigo-600',
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
type MetaTemplate = { name: string; language: string; category: string; variableNames: string[]; bodyPreview: string };

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
  }

  function selectTemplate(key: string) {
    setSelectedTemplateKey(key);
    const t = templates.find(t => `${t.name}|${t.language}` === key);
    if (!t) return;
    setTemplateName(t.name);
    setLanguageCode(t.language);
    setVariables(t.variableNames.map(vn => LEAD_AUTOFIELDS.includes(vn.toLowerCase()) ? `{{${vn}}}` : ''));
    setSelectedVariableNames(t.variableNames);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const selectable = filteredRows.filter(r => !r.opted_out);
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
      const res = await fetch('/admin/api/lead-funnel/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: Array.from(selectedIds),
          templateName: templateName.trim(),
          languageCode: languageCode.trim(),
          variables,
          variableNames: manualEntry ? [] : selectedVariableNames,
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
    const needsHuman = statsRows.filter(r => r.status === 'needs_human').length;
    const optedOut = statsRows.filter(r => r.opted_out).length;
    const fromAds = statsRows.filter(r => r.ad_id).length;

    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byAd: Record<string, number> = {};

    for (const r of statsRows) {
      const s = r.status || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;

      const src = r.source || 'organic / direct';
      bySource[src] = (bySource[src] || 0) + 1;

      if (r.ad_id) {
        const key = r.ad_headline || r.ad_id;
        byAd[key] = (byAd[key] || 0) + 1;
      }
    }

    return { total, newToday, newThisWeek, needsHuman, optedOut, fromAds, byStatus, bySource, byAd };
  }, [statsRows]);

  const statusOptions = useMemo(() => Array.from(new Set(rows.map(r => r.status || 'unknown'))).sort(), [rows]);
  const sourceOptions = useMemo(() => Array.from(new Set(rows.map(r => r.source || 'organic / direct'))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = showInhouse ? rows : statsRows;
    return source.filter(r => {
      if (statusFilter !== 'all' && (r.status || 'unknown') !== statusFilter) return false;
      if (sourceFilter !== 'all' && (r.source || 'organic / direct') !== sourceFilter) return false;
      if (adOnly && !r.ad_id) return false;
      if (q) {
        const haystack = `${r.phone} ${r.name || ''} ${r.email || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statsRows, showInhouse, statusFilter, sourceFilter, adOnly, search]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/lead-funnel/messages" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <MessageSquare size={14} /> Message Activity
            </Link>
            <Link href="/admin/warm-list" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <ClipboardList size={14} /> Import / Review Leads (Warm List)
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard icon={Users} label="Total Leads" value={stats.total} />
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
                          checked={filteredRows.filter(r => !r.opted_out).length > 0 && filteredRows.filter(r => !r.opted_out).every(r => selectedIds.has(r.id))}
                          onChange={toggleSelectAllVisible}
                        />
                      </th>
                      <th className="px-4 py-3">Lead</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Tags</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Inhouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(r => (
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
                          <div className="font-bold text-slate-800">{r.name || '(no name)'}</div>
                          <div className="text-xs text-slate-400">+{r.phone}{r.email ? ` · ${r.email}` : ''}</div>
                          {r.opted_out && <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">Opted out</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${STATUS_STYLES[r.status || ''] || 'bg-slate-100 text-slate-500'}`}>
                            {statusLabel(r.status)}
                          </span>
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
                            {(r.tags || []).map(t => (
                              <span key={t} className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : '—'}
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
                      <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400 text-sm">No leads match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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
