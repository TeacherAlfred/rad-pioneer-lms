"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, MessageSquareQuote, ShieldCheck, ShieldAlert, Pencil, Check, X, AlertTriangle,
} from "lucide-react";
import { formatLabel } from "@/lib/sessionReview";

type Testimonial = {
  id: string;
  quote_text: string;
  display_age: number | null;
  display_programme: string | null;
  display_month: string | null;
  consent_verified: boolean;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

const STATUS_TABS = ['pending', 'approved', 'published', 'rejected'] as const;

export default function TestimonialsPage() {
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>('pending');
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/testimonials?status=${tab}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load testimonials');
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  async function setStatus(t: Testimonial, status: string) {
    const res = await fetch('/admin/api/testimonials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, status, approvedBy: 'Alfred' }),
    });
    const data = await res.json();
    // Co-publish safety check (spec S10.2) - advisory, the status change
    // above already happened, this just makes sure it's not missed.
    setWarning(data.warnings?.length > 0 ? data.warnings[0] : null);
    setRows(prev => prev.filter(r => r.id !== t.id));
  }

  function startEdit(t: Testimonial) {
    setEditingId(t.id);
    setEditText(t.quote_text);
  }

  async function saveEdit(t: Testimonial) {
    const res = await fetch('/admin/api/testimonials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, quoteText: editText }),
    });
    const data = await res.json();
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === t.id ? { ...r, quote_text: data.row.quote_text } : r));
    }
    setEditingId(null);
  }

  const stats = useMemo(() => ({ count: rows.length }), [rows]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <Link href="/admin/reviews" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <MessageSquareQuote size={14} /> Reviews
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Testimonials</h1>
          <p className="text-sm text-slate-500 mt-1">Anonymised quotes queued from post-session reviews. Never published without a guardian's quote-consent tick.</p>
        </div>

        <div className="flex gap-2 mb-4">
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${tab === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}
            >
              {t}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-slate-400">{stats.count}</span>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}
        {warning && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl p-4 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <p className="flex-1">{warning}</p>
            <button onClick={() => setWarning(null)} className="text-amber-400 hover:text-amber-600 shrink-0"><X size={15} /></button>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <div className="space-y-3">
            {rows.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingId === t.id ? (
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    ) : (
                      <p className="text-[15px] text-slate-700 italic">"{t.quote_text}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[12px] text-slate-400 flex-wrap">
                      <span>{[t.display_age ? `Age ${t.display_age}` : null, t.display_programme, t.display_month].filter(Boolean).join(' · ') || 'No display details'}</span>
                      {t.consent_verified ? (
                        <span className="flex items-center gap-1 text-emerald-600"><ShieldCheck size={12} /> Quote consent on file</span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-500"><ShieldAlert size={12} /> No quote consent - do not publish</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {editingId === t.id ? (
                      <>
                        <button onClick={() => saveEdit(t)} className="text-emerald-500 hover:text-emerald-700"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-300 hover:text-slate-500"><X size={16} /></button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(t)} className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
                  {tab === 'pending' && (
                    <>
                      <button onClick={() => setStatus(t, 'rejected')} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 hover:border-rose-300 hover:text-rose-500">Reject</button>
                      <button
                        onClick={() => setStatus(t, 'approved')}
                        disabled={!t.consent_verified}
                        title={!t.consent_verified ? 'No quote consent on file for this child' : undefined}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-40"
                      >
                        Approve
                      </button>
                    </>
                  )}
                  {tab === 'approved' && (
                    <button
                      onClick={() => setStatus(t, 'published')}
                      disabled={!t.consent_verified}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-40"
                    >
                      Mark Published
                    </button>
                  )}
                  {tab === 'rejected' && (
                    <button onClick={() => setStatus(t, 'pending')} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">Move back to Pending</button>
                  )}
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                Nothing {formatLabel(tab).toLowerCase()}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
