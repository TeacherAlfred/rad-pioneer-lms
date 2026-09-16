"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertTriangle, X, Send, CheckCircle2, Search,
  Filter as FunnelIcon, ChevronRight, Trash2, Plus,
} from "lucide-react";

type Stage = { key: string; label: string; kind: string; kindLabel: string; currentCount: number; everCount: number; flowId: string | null };
type FunnelLead = {
  leadId: string; name: string | null; phone: string; email: string | null;
  optedOut: boolean; isBusinessNumber: boolean; tags: string[];
  currentStageKey: string | null; lastActivityAt: string | null;
  everStageKeys: { key: string; sentAt: string }[];
};
type Flow = { id: string; label: string; trigger_button_id: string; action_type: 'message' | 'template' | 'bot_media' | 'tag_only'; active: boolean };
type Template = { name: string; language: string; category: string; variableNames: string[]; variableLabels?: string[]; bodyPreview: string; quickReplyButtons: { text: string; index: number }[] };

const KIND_COLORS: Record<string, string> = {
  bot_flow: 'bg-sky-50 text-sky-600 border-sky-200',
  template: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  bot_media: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  welcome_menu: 'bg-amber-50 text-amber-600 border-amber-200',
  human_handoff: 'bg-rose-50 text-rose-600 border-rose-200',
  freeform_bulk: 'bg-purple-50 text-purple-600 border-purple-200',
  text: 'bg-slate-100 text-slate-500 border-slate-200',
};

const MAX_RECIPIENTS = 50;
const MAX_BUTTONS = 3;

// Client-side approximation of resolveVariable() in src/lib/metaTemplate.ts -
// only the fields this page's aggregation endpoint actually returns
// (name/phone/email) resolve in the preview; everything else (school, class,
// source, {{dates}}/{{location}}/{{title}}) resolves fully server-side at
// send time, same rule the send endpoint always applies regardless of what
// the preview could show.
function previewResolve(text: string, lead: FunnelLead): string {
  return text.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (match, field) => {
    const key = String(field).toLowerCase();
    if (key === 'name') return lead.name ? lead.name.trim().split(/\s+/)[0] : match;
    if (key === 'phone') return lead.phone || match;
    if (key === 'email') return lead.email || match;
    return match;
  });
}

type MessageSource = 'flow' | 'template' | 'freeform';

export default function MessageFunnelPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<FunnelLead[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);

  const [viewMode, setViewMode] = useState<'current' | 'ever'>('current');
  const [selectedStageKey, setSelectedStageKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [source, setSource] = useState<MessageSource>('flow');
  const [flowId, setFlowId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateKey, setTemplateKey] = useState('');
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [freeformLabel, setFreeformLabel] = useState('');
  const [freeformBody, setFreeformBody] = useState('');
  const [freeformButtons, setFreeformButtons] = useState<{ id: string; title: string }[]>([]);
  const [confirmResend, setConfirmResend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<{ leadId: string; phone: string; ok: boolean; skipped?: boolean; error?: string }[] | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [funnelRes, flowsRes] = await Promise.all([
        fetch('/admin/api/lead-funnel/message-funnel'),
        fetch('/admin/api/bot-flows'),
      ]);
      const funnelData = await funnelRes.json();
      if (!funnelRes.ok) throw new Error(funnelData.error || 'Failed to load funnel');
      setStages(funnelData.stages || []);
      setLeads(funnelData.leads || []);
      const flowsData = await flowsRes.json();
      setFlows((flowsData.rows || []).filter((f: any) => f.active && f.action_type !== 'tag_only'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => (viewMode === 'current' ? b.currentCount - a.currentCount : b.everCount - a.everCount));
  }, [stages, viewMode]);

  const filteredLeads = useMemo(() => {
    if (!selectedStageKey) return [];
    let rows = leads.filter(l =>
      viewMode === 'current' ? l.currentStageKey === selectedStageKey : l.everStageKeys.some(s => s.key === selectedStageKey)
    );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(l => (l.name || '').toLowerCase().includes(q) || l.phone.includes(q));
    }
    return rows;
  }, [leads, selectedStageKey, viewMode, search]);

  function selectStage(key: string) {
    setSelectedStageKey(prev => prev === key ? null : key);
    setSelectedLeadIds(new Set());
  }

  function toggleLead(id: string) {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const selectable = filteredLeads.filter(l => !l.optedOut);
    const allSelected = selectable.length > 0 && selectable.every(l => selectedLeadIds.has(l.leadId));
    setSelectedLeadIds(allSelected ? new Set() : new Set(selectable.map(l => l.leadId)));
  }

  function openWizard() {
    setWizardOpen(true);
    setWizardStep(1);
    setSource('flow');
    setFlowId('');
    setTemplateKey('');
    setTemplateVariables([]);
    setFreeformLabel('');
    setFreeformBody('');
    setFreeformButtons([]);
    setConfirmResend(false);
    setSendError(null);
    setSendResults(null);
    if (templates.length === 0) loadTemplates();
  }

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const res = await fetch('/admin/api/lead-funnel/templates');
      const data = await res.json();
      if (res.ok) setTemplates(data.templates || []);
    } finally {
      setTemplatesLoading(false);
    }
  }

  const selectedFlow = flows.find(f => f.id === flowId) || null;
  const selectedTemplate = templates.find(t => `${t.name}|${t.language}` === templateKey) || null;

  function selectTemplate(key: string) {
    setTemplateKey(key);
    const t = templates.find(x => `${x.name}|${x.language}` === key);
    setTemplateVariables(t ? t.variableNames.map(() => '') : []);
  }

  // What the funnel's own stage-key scheme will produce for this target -
  // has to mirror src/lib/messageFunnel.ts's stageKeyFor() exactly, since
  // that's what decides whether a selected lead gets the resend warning.
  const targetStageKey = useMemo(() => {
    if (source === 'flow' && selectedFlow) {
      if (selectedFlow.action_type === 'template') return null; // resolved server-side (template_name lives on the flow row, not fetched here)
      if (selectedFlow.action_type === 'message') return `bot_flow:${selectedFlow.label}`;
      return null; // bot_media varies per-lead - can't preflight a single key client-side
    }
    if (source === 'template' && selectedTemplate) return `template:${selectedTemplate.name}`;
    if (source === 'freeform' && freeformLabel.trim()) return `freeform_bulk:${freeformLabel.trim()}`;
    return null;
  }, [source, selectedFlow, selectedTemplate, freeformLabel]);

  const reviewLeads = filteredLeadsForSend();
  function filteredLeadsForSend() {
    return leads.filter(l => selectedLeadIds.has(l.leadId));
  }

  const flaggedAlreadyReceived = useMemo(() => {
    if (!targetStageKey) return new Set<string>();
    const flagged = new Set<string>();
    for (const l of reviewLeads) {
      if (l.everStageKeys.some(s => s.key === targetStageKey)) flagged.add(l.leadId);
    }
    return flagged;
  }, [reviewLeads, targetStageKey]);

  function previewFor(lead: FunnelLead): string {
    if (source === 'flow' && selectedFlow) {
      if (selectedFlow.action_type === 'message') return previewResolve('(flow message - see Bot Flows for exact wording)', lead);
      if (selectedFlow.action_type === 'template') return '(Meta template - exact wording fixed, variables resolve per lead)';
      if (selectedFlow.action_type === 'bot_media') return '(bot media item - resolved per lead by tag, see Bot Media)';
    }
    if (source === 'template' && selectedTemplate) return previewResolve(selectedTemplate.bodyPreview, lead);
    if (source === 'freeform') return previewResolve(freeformBody, lead);
    return '';
  }

  function canGoToStep2() {
    if (source === 'flow') return !!flowId;
    if (source === 'template') return !!templateKey;
    return !!freeformLabel.trim() && !!freeformBody.trim();
  }

  function needsVariableStep() {
    if (source === 'template' && selectedTemplate) return selectedTemplate.variableNames.length > 0;
    return false;
  }

  function addFreeformButton() {
    if (freeformButtons.length >= MAX_BUTTONS) return;
    setFreeformButtons(prev => [...prev, { id: '', title: '' }]);
  }

  async function doSend(force: boolean) {
    setSending(true);
    setSendError(null);
    try {
      let target: any;
      if (source === 'flow') target = { kind: 'flow', flowId };
      else if (source === 'template' && selectedTemplate) {
        target = {
          kind: 'template', templateName: selectedTemplate.name, languageCode: selectedTemplate.language,
          variables: templateVariables, variableNames: selectedTemplate.variableNames, buttonPayloads: [],
        };
      } else {
        target = { kind: 'freeform', body: freeformBody, buttons: freeformButtons.filter(b => b.id.trim() && b.title.trim()), label: freeformLabel.trim() };
      }
      const res = await fetch('/admin/api/lead-funnel/message-funnel/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeadIds), target, confirmResend: force }),
      });
      const data = await res.json();
      if (res.status === 409 && !force) {
        // Server disagrees with (or confirms) the client's own flagged set -
        // trust it and require the checkbox rather than silently retrying.
        setSendError('Some selected leads already received this exact message - tick the confirmation below and send again.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setSendResults(data.results || []);
      setSelectedLeadIds(new Set());
      load();
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin/bot-flows" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Bot Flows
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FunnelIcon size={22} className="text-blue-500" /> Message Funnel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every message a lead can receive, and who's currently stuck there vs. who's ever received it. Pick a stage to filter leads, select some, and send a follow-up.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="inline-flex bg-white border border-slate-200 rounded-xl p-1">
                <button onClick={() => setViewMode('current')} className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${viewMode === 'current' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                  Currently Sitting
                </button>
                <button onClick={() => setViewMode('ever')} className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${viewMode === 'ever' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                  Ever Received
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                {viewMode === 'current' ? "Where each lead's most recent message left them" : 'Every stage a lead has passed through, ever'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {sortedStages.length === 0 && (
                <div className="col-span-full text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">No stages yet - nothing's gone out to a lead.</div>
              )}
              {sortedStages.map(stage => {
                const count = viewMode === 'current' ? stage.currentCount : stage.everCount;
                if (count === 0) return null;
                const active = selectedStageKey === stage.key;
                const colors = KIND_COLORS[stage.kind] || KIND_COLORS.text;
                return (
                  <button
                    key={stage.key}
                    onClick={() => selectStage(stage.key)}
                    className={`text-left bg-white rounded-2xl border p-4 transition-all ${active ? 'border-slate-900 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}
                  >
                    <div className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border mb-2 ${colors}`}>{stage.kindLabel}</div>
                    <div className="text-2xl font-black text-slate-900 tabular-nums">{count}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5" title={stage.label}>{stage.label}</div>
                  </button>
                );
              })}
            </div>

            {selectedStageKey && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filteredLeads.filter(l => !l.optedOut).length > 0 && filteredLeads.filter(l => !l.optedOut).every(l => selectedLeadIds.has(l.leadId))}
                        onChange={toggleSelectAllVisible}
                      />
                      Select all ({filteredLeads.length})
                    </label>
                  </div>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input placeholder="Filter by name/phone" value={search} onChange={e => setSearch(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none w-56" />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {filteredLeads.map(lead => (
                    <label key={lead.leadId} className={`flex items-center gap-3 py-2.5 px-1 text-sm ${lead.optedOut ? 'opacity-40' : 'hover:bg-slate-50 cursor-pointer'}`}>
                      <input type="checkbox" disabled={lead.optedOut} checked={selectedLeadIds.has(lead.leadId)} onChange={() => toggleLead(lead.leadId)} />
                      <span className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-800">{lead.name || 'Unnamed'}</span>{' '}
                        <span className="text-slate-400">{lead.phone}</span>
                      </span>
                      {lead.optedOut && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opted Out</span>}
                      {lead.isBusinessNumber && <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Business #</span>}
                      {lead.lastActivityAt && <span className="text-[11px] text-slate-400 tabular-nums">{new Date(lead.lastActivityAt).toLocaleDateString()}</span>}
                    </label>
                  ))}
                  {filteredLeads.length === 0 && <div className="py-6 text-center text-sm text-slate-400">No leads match.</div>}
                </div>
              </div>
            )}

            {selectedLeadIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl shadow-xl px-5 py-3 flex items-center gap-4 z-40">
                <span className="text-sm font-bold">{selectedLeadIds.size} selected</span>
                {selectedLeadIds.size > MAX_RECIPIENTS && <span className="text-xs text-amber-300 flex items-center gap-1"><AlertTriangle size={13} /> Max {MAX_RECIPIENTS} per send</span>}
                <button onClick={openWizard} className="flex items-center gap-1.5 bg-white text-slate-900 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest">
                  <Send size={13} /> Send Message
                </button>
              </div>
            )}
          </>
        )}

        {wizardOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800">
                  {sendResults ? 'Send Results' : `Send Message — Step ${wizardStep} of 3`}
                </h3>
                <button onClick={() => setWizardOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>

              {sendResults ? (
                <div>
                  <p className="text-sm text-slate-500 mb-4">
                    {sendResults.filter(r => r.ok).length} sent, {sendResults.filter(r => r.skipped).length} skipped, {sendResults.filter(r => !r.ok && !r.skipped).length} failed.
                  </p>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto mb-4">
                    {sendResults.map(r => (
                      <div key={r.leadId} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-600">{r.phone}</span>
                        {r.ok ? <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={13} /> Sent</span>
                          : r.skipped ? <span className="text-slate-400 text-xs">{r.error}</span>
                          : <span className="text-rose-500 text-xs">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setWizardOpen(false)} className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900">Done</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">Sending to <b>{selectedLeadIds.size}</b> lead{selectedLeadIds.size === 1 ? '' : 's'}. Opted-out leads are skipped automatically.</p>

                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      <div className="inline-flex bg-slate-50 border border-slate-200 rounded-xl p-1">
                        {(['flow', 'template', 'freeform'] as MessageSource[]).map(s => (
                          <button key={s} onClick={() => setSource(s)} className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest ${source === s ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                            {s === 'flow' ? 'Bot Flow' : s === 'template' ? 'Meta Template' : 'Freeform'}
                          </button>
                        ))}
                      </div>

                      {source === 'flow' && (
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Flow</label>
                          <select value={flowId} onChange={e => setFlowId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none">
                            <option value="">Select a flow...</option>
                            {flows.map(f => <option key={f.id} value={f.id}>{f.label} ({f.action_type})</option>)}
                          </select>
                        </div>
                      )}

                      {source === 'template' && (
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Approved Template</label>
                          {templatesLoading ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader2 size={14} className="animate-spin" /> Loading...</div>
                          ) : (
                            <select value={templateKey} onChange={e => selectTemplate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none">
                              <option value="">Select a template...</option>
                              {templates.map(t => <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>)}
                            </select>
                          )}
                          {selectedTemplate && <p className="text-[11px] text-slate-400 italic mt-1.5">"{selectedTemplate.bodyPreview}"</p>}
                        </div>
                      )}

                      {source === 'freeform' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Campaign Label</label>
                            <p className="text-[11px] text-slate-400 mb-1.5">Short name for this blast - becomes its own funnel stage so a future resend gets flagged correctly.</p>
                            <input value={freeformLabel} onChange={e => setFreeformLabel(e.target.value)} placeholder="e.g. Sept nudge" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Message</label>
                            <textarea value={freeformBody} onChange={e => setFreeformBody(e.target.value)} rows={4} placeholder="Supports {{name}}, {{phone}}, {{email}}" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Buttons (optional, max {MAX_BUTTONS})</label>
                            {freeformButtons.map((b, i) => (
                              <div key={i} className="flex gap-2 mb-2">
                                <input placeholder="button_id" value={b.id} onChange={e => setFreeformButtons(prev => prev.map((x, xi) => xi === i ? { ...x, id: e.target.value } : x))} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none w-36" />
                                <input placeholder="Label" value={b.title} onChange={e => setFreeformButtons(prev => prev.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x))} maxLength={20} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
                                <button type="button" onClick={() => setFreeformButtons(prev => prev.filter((_, xi) => xi !== i))} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                              </div>
                            ))}
                            {freeformButtons.length < MAX_BUTTONS && (
                              <button type="button" onClick={addFreeformButton} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"><Plus size={11} className="inline -mt-0.5" /> add button</button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          disabled={!canGoToStep2()}
                          onClick={() => setWizardStep(needsVariableStep() ? 2 : 3)}
                          className="flex items-center gap-1 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-40"
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 2 && selectedTemplate && (
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Body Variables ({selectedTemplate.variableNames.length}, in order)
                      </label>
                      <p className="text-[11px] text-slate-400 -mt-2">Fields matching a lead column (<code>{'{{name}}'}</code>, <code>{'{{phone}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{school}}'}</code>, <code>{'{{class}}'}</code>, <code>{'{{source}}'}</code>) auto-fill per lead.</p>
                      {templateVariables.map((v, i) => (
                        <input
                          key={i}
                          placeholder={selectedTemplate.variableLabels?.[i] || selectedTemplate.variableNames[i] ? `{{${selectedTemplate.variableLabels?.[i] || selectedTemplate.variableNames[i]}}}` : `Variable ${i + 1}`}
                          value={v}
                          onChange={e => setTemplateVariables(prev => prev.map((x, xi) => xi === i ? e.target.value : x))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none mb-2"
                        />
                      ))}
                      <div className="flex justify-between pt-2">
                        <button onClick={() => setWizardStep(1)} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Back</button>
                        <button onClick={() => setWizardStep(3)} className="flex items-center gap-1 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900">Next <ChevronRight size={14} /></button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto border border-slate-100 rounded-xl">
                        {reviewLeads.map(lead => {
                          const flagged = flaggedAlreadyReceived.has(lead.leadId);
                          const priorSend = lead.everStageKeys.find(s => s.key === targetStageKey);
                          return (
                            <div key={lead.leadId} className="p-3 text-sm">
                              <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <span className="font-semibold text-slate-800">{lead.name || 'Unnamed'} <span className="text-slate-400 font-normal">{lead.phone}</span></span>
                                <div className="flex items-center gap-1.5">
                                  {lead.isBusinessNumber && <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Business Number</span>}
                                  {flagged && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                      Already received{priorSend ? ` - sent ${new Date(priorSend.sentAt).toLocaleDateString()}` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 italic mt-1">{previewFor(lead)}</p>
                            </div>
                          );
                        })}
                      </div>

                      {flaggedAlreadyReceived.size > 0 && (
                        <label className="flex items-start gap-2 text-xs bg-rose-50 text-rose-700 rounded-xl px-3.5 py-2.5 cursor-pointer">
                          <input type="checkbox" checked={confirmResend} onChange={e => setConfirmResend(e.target.checked)} className="mt-0.5" />
                          I understand {flaggedAlreadyReceived.size} lead{flaggedAlreadyReceived.size === 1 ? '' : 's'} already received this exact message before, and want to resend anyway.
                        </label>
                      )}

                      {sendError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{sendError}</div>}

                      <div className="flex justify-between pt-2">
                        <button onClick={() => setWizardStep(needsVariableStep() ? 2 : 1)} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Back</button>
                        <button
                          disabled={sending || (flaggedAlreadyReceived.size > 0 && !confirmResend)}
                          onClick={() => doSend(flaggedAlreadyReceived.size > 0 ? confirmResend : true)}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-40"
                        >
                          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to {reviewLeads.length}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
