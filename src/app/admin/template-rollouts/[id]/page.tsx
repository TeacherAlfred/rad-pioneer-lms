"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Plus, Trash2, CheckCircle2, XCircle, GitBranch, Send } from "lucide-react";
import { LEAD_AUTOFIELDS } from "@/lib/metaTemplate";

type ButtonSpec = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone_number?: string };

type Rollout = {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  body_text: string;
  header_text: string | null;
  footer_text: string | null;
  placeholder_labels: string[];
  placeholder_samples: string[];
  buttons: ButtonSpec[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  meta_template_id: string | null;
  meta_status: string | null;
  meta_rejected_reason: string | null;
  submitted_at: string | null;
  last_checked_at: string | null;
  lane: 'a' | 'b' | null;
  linked_bot_flow_id: string | null;
};

const DRAFT_STEPS = ['Basics', 'Body & Placeholders', 'Buttons', 'Review & Submit'] as const;

function placeholderCount(body: string): number {
  const nums = new Set([...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => m[1]));
  return nums.size;
}

export default function TemplateRolloutWizardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [row, setRow] = useState<Rollout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/admin/api/template-rollouts/${id}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed to load'); setLoading(false); return; }
    setRow(data.row);
    setLoading(false);
    return data.row as Rollout;
  }
  useEffect(() => { load(); }, [id]);

  // --- draft-phase local editable state, seeded from the row once loaded ---
  const [draftStep, setDraftStep] = useState(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Rollout['category']>('UTILITY');
  const [language, setLanguage] = useState('en_US');
  const [bodyText, setBodyText] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [samples, setSamples] = useState<string[]>([]);
  const [buttons, setButtons] = useState<ButtonSpec[]>([]);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!row || seeded) return;
    setName(row.name);
    setCategory(row.category);
    setLanguage(row.language);
    setBodyText(row.body_text || '');
    setHeaderText(row.header_text || '');
    setFooterText(row.footer_text || '');
    setLabels(row.placeholder_labels || []);
    setSamples(row.placeholder_samples || []);
    setButtons(row.buttons || []);
    setDraftStep(!row.name ? 1 : !row.body_text?.trim() ? 2 : 4);
    setSeeded(true);
  }, [row, seeded]);

  const pCount = useMemo(() => placeholderCount(bodyText), [bodyText]);

  async function patch(update: Record<string, any>): Promise<Rollout | null> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/template-rollouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save.');
      setRow(data.row);
      return data.row as Rollout;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep1AndNext() {
    const ok = await patch({ name: name.trim(), category, language: language.trim() || 'en_US' });
    if (ok) setDraftStep(2);
  }
  async function saveStep2AndNext() {
    const ok = await patch({
      body_text: bodyText,
      header_text: headerText,
      footer_text: footerText,
      placeholder_labels: labels.slice(0, pCount),
      placeholder_samples: samples.slice(0, pCount),
    });
    if (ok) setDraftStep(3);
  }
  async function saveStep3AndNext() {
    const ok = await patch({ buttons });
    if (ok) setDraftStep(4);
  }

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  async function submitToMeta() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/admin/api/template-rollouts/${id}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Meta rejected this template.');
      setRow(data.row);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const [checking, setChecking] = useState(false);
  async function checkStatus() {
    setChecking(true);
    try {
      const res = await fetch(`/admin/api/template-rollouts/${id}/check-status`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) setRow(data.row);
    } finally {
      setChecking(false);
    }
  }
  // Refresh once automatically whenever a submitted rollout is opened - the
  // whole point of "manual + on-load" is you don't have to remember to click
  // anything just to see whether it's moved.
  useEffect(() => {
    if (row?.status === 'submitted') checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.status === 'submitted']);

  async function reopenForEdit() {
    const updated = await patch({ status: 'draft' });
    if (updated) { setSeeded(false); setDraftStep(2); }
  }

  async function chooseLaneA() {
    await patch({ lane: 'a', lane_completed_at: new Date().toISOString() });
  }
  function chooseLaneB() {
    patch({ lane: 'b' }).then(() => {
      router.push(`/admin/bot-flows?rolloutId=${id}&newFlowTemplate=${encodeURIComponent(`${row!.name}|${row!.language}`)}`);
    });
  }

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: '' }]);
  }
  function updateButton(i: number, patch: Partial<ButtonSpec>) {
    setButtons(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  }
  function removeButton(i: number) {
    setButtons(prev => prev.filter((_, idx) => idx !== i));
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>;
  }
  if (!row) {
    return <div className="min-h-screen bg-slate-50 p-10 text-center text-rose-500">{error || 'Not found.'}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/template-rollouts" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Template Rollouts
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{row.name || 'New template'}</h1>
          <p className="text-sm text-slate-500 mt-1">{row.category} &middot; {row.language}</p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {/* ---------------- DRAFT ---------------- */}
        {row.status === 'draft' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              {DRAFT_STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setDraftStep(i + 1)}
                  className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${draftStep === i + 1 ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  {i + 1}. {s}
                </button>
              ))}
            </div>

            {draftStep === 1 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Template name</label>
                  <input value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400">
                    <option value="UTILITY">Utility - transactional, account-related</option>
                    <option value="MARKETING">Marketing - promotional, requires opt-in</option>
                    <option value="AUTHENTICATION">Authentication - one-time codes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Language code</label>
                  <input value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400" />
                </div>
                <button onClick={saveStep1AndNext} disabled={saving || !name.trim()} className="w-full py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 mt-2">
                  {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Next'}
                </button>
              </div>
            )}

            {draftStep === 2 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Header (optional)</label>
                  <input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="No header" className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Body</label>
                  <textarea
                    rows={4}
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    placeholder={"Hi {{1}}, your session on {{2}} is confirmed."}
                    className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400 resize-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Use numbered placeholders - <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>... in order. Meta sends these positionally either way; the labels below are just so this system (and future you) knows what each one means.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Footer (optional)</label>
                  <input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="No footer" className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-blue-400" />
                </div>

                {pCount > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Placeholders ({pCount})</label>
                    {Array.from({ length: pCount }).map((_, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3">
                        <div className="text-[11px] font-bold text-slate-500 mb-1.5">{'{{' + (i + 1) + '}}'}</div>
                        <div className="flex gap-2 mb-1.5 flex-wrap">
                          {LEAD_AUTOFIELDS.map(f => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setLabels(prev => { const next = [...prev]; next[i] = f; return next; })}
                              className={`text-[10px] font-bold px-2 py-1 rounded-full ${labels[i] === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                        <input
                          value={labels[i] || ''}
                          onChange={e => setLabels(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                          placeholder="Friendly label, e.g. event_date"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none mb-1.5"
                        />
                        <input
                          value={samples[i] || ''}
                          onChange={e => setSamples(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                          placeholder="Sample value for Meta's review, e.g. Jane"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDraftStep(1)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Back</button>
                  <button onClick={saveStep2AndNext} disabled={saving || !bodyText.trim()} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Next'}
                  </button>
                </div>
              </div>
            )}

            {draftStep === 3 && (
              <div className="space-y-3">
                <p className="text-[12px] text-slate-400">Optional. Quick-reply button payloads are only assignable at send time (in Bot Flows or the send picker), not here - Meta doesn't expose them at creation.</p>
                {buttons.map((b, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                    <div className="flex gap-2">
                      <select value={b.type} onChange={e => updateButton(i, { type: e.target.value as ButtonSpec['type'] })} className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-[12px] outline-none">
                        <option value="QUICK_REPLY">Quick Reply</option>
                        <option value="URL">URL</option>
                        <option value="PHONE_NUMBER">Phone</option>
                      </select>
                      <input value={b.text} onChange={e => updateButton(i, { text: e.target.value })} placeholder="Button text" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] outline-none" />
                      <button onClick={() => removeButton(i)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                    </div>
                    {b.type === 'URL' && (
                      <input value={b.url || ''} onChange={e => updateButton(i, { url: e.target.value })} placeholder="https://..." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] outline-none" />
                    )}
                    {b.type === 'PHONE_NUMBER' && (
                      <input value={b.phone_number || ''} onChange={e => updateButton(i, { phone_number: e.target.value })} placeholder="+27..." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] outline-none" />
                    )}
                  </div>
                ))}
                {buttons.length < 3 && (
                  <button onClick={addButton} className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"><Plus size={12} /> Add button</button>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDraftStep(2)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Back</button>
                  <button onClick={saveStep3AndNext} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Next'}
                  </button>
                </div>
              </div>
            )}

            {draftStep === 4 && (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-xl p-4">
                  {headerText && <div className="font-bold text-[13px] mb-1">{headerText}</div>}
                  <p className="text-[13px] whitespace-pre-wrap">{bodyText || '(empty)'}</p>
                  {footerText && <div className="text-[11px] text-slate-400 mt-1">{footerText}</div>}
                  {buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {buttons.map((b, i) => <span key={i} className="text-[11px] font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1">{b.text || '(untitled)'}</span>)}
                    </div>
                  )}
                </div>
                <p className="text-[12px] text-slate-400">Submitting sends this to Meta for review. Name, category, and body text can't change once submitted - Meta requires a new template for that.</p>
                {submitError && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{submitError}</div>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDraftStep(3)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Back</button>
                  <button onClick={submitToMeta} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <><Send size={13} /> Submit to Meta</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- SUBMITTED ---------------- */}
        {row.status === 'submitted' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
            <Loader2 className="mx-auto mb-3 text-amber-500 animate-spin" size={28} />
            <h3 className="text-[16px] font-semibold text-slate-900 mb-1">Waiting on Meta's review</h3>
            <p className="text-[13px] text-slate-400 mb-4">Meta status: <b>{row.meta_status || 'PENDING'}</b>. This can take anywhere from minutes to a day or more - come back and check any time.</p>
            <button onClick={checkStatus} disabled={checking} className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5">
              {checking ? <Loader2 size={14} className="animate-spin" /> : 'Check status'}
            </button>
            {row.last_checked_at && <p className="text-[11px] text-slate-300 mt-3">Last checked {new Date(row.last_checked_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</p>}
          </div>
        )}

        {/* ---------------- REJECTED ---------------- */}
        {row.status === 'rejected' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 text-rose-600 mb-2"><XCircle size={18} /><h3 className="text-[16px] font-semibold">Rejected by Meta</h3></div>
            <p className="text-[13px] text-slate-500 mb-4">{row.meta_rejected_reason || 'No reason given.'}</p>
            <button onClick={reopenForEdit} disabled={saving} className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">
              Edit and resubmit
            </button>
          </div>
        )}

        {/* ---------------- APPROVED, NO LANE YET ---------------- */}
        {row.status === 'approved' && !row.lane && (
          <div>
            <div className="flex items-center gap-2 text-emerald-600 mb-4"><CheckCircle2 size={18} /><h3 className="text-[16px] font-semibold">Approved - pick a lane</h3></div>
            <p className="text-[13px] text-slate-500 mb-4">A bot-flow row is always triggered by a button tap - it's never a standalone broadcast. Only choose Lane B if something in the conversation should fire this automatically.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-emerald-400 p-5">
                <h4 className="text-[15px] font-bold text-slate-900 mb-1">Lane A</h4>
                <p className="text-[12px] text-slate-500 mb-4">Ad-hoc or bulk send. Nothing to build - it's already usable from Message Activity and the Lead list.</p>
                <button onClick={chooseLaneA} disabled={saving} className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">Choose Lane A</button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-amber-400 p-5">
                <h4 className="text-[15px] font-bold text-slate-900 mb-1">Lane B</h4>
                <p className="text-[12px] text-slate-500 mb-4">Fires automatically when a lead taps a specific button. Hands you off to Bot Flows with this template pre-selected.</p>
                <button onClick={chooseLaneB} disabled={saving} className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <GitBranch size={13} /> Choose Lane B
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- DONE ---------------- */}
        {row.status === 'approved' && row.lane === 'a' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={28} />
            <h3 className="text-[16px] font-semibold text-slate-900 mb-1">Ready for ad-hoc &amp; bulk sends</h3>
            <p className="text-[13px] text-slate-400 mb-4">Live in the Send Template picker on both the Lead list and Message Activity.</p>
            <Link href="/admin/lead-funnel/messages" className="inline-block px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800">Send a test from Message Activity</Link>
          </div>
        )}
        {row.status === 'approved' && row.lane === 'b' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
            {row.linked_bot_flow_id ? (
              <>
                <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={28} />
                <h3 className="text-[16px] font-semibold text-slate-900 mb-1">Linked to a bot-flow</h3>
                <p className="text-[13px] text-slate-400 mb-4">Test it by tapping the button that should trigger it, from a real WhatsApp number.</p>
                <Link href="/admin/bot-flows" className="inline-block px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800">Open Bot Flows</Link>
              </>
            ) : (
              <>
                <GitBranch className="mx-auto mb-3 text-indigo-500" size={28} />
                <h3 className="text-[16px] font-semibold text-slate-900 mb-1">Finish setup in Bot Flows</h3>
                <p className="text-[13px] text-slate-400 mb-4">Lane B was chosen but the flow wasn't saved yet - finish it in Bot Flows to close the loop.</p>
                <Link href={`/admin/bot-flows?rolloutId=${id}&newFlowTemplate=${encodeURIComponent(`${row.name}|${row.language}`)}`} className="inline-block px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800">Continue in Bot Flows</Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
