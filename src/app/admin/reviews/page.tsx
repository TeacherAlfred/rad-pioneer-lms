"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Baby, CalendarClock,
  AlertTriangle, Quote, Sparkles, X, Check,
} from "lucide-react";
import { ENJOYMENT_FACES, TIMING_OPTIONS, formatLabel } from "@/lib/sessionReview";

type ProgramRef = { id: string; code: string; name: string };
type SessionRef = { id: string; starts_at: string | null; programs: ProgramRef | null };
type KidRef = { id: string; name: string };

type Review = {
  id: string;
  session_id: string;
  enjoyment: number | null;
  built_text: string | null;
  difficulty: string | null;
  completion: string | null;
  wants_more: string | null;
  open_text: string | null;
  hold_status: string;
  completed_at: string | null;
  submitted_at: string;
  kids: KidRef | null;
  sessions: SessionRef | null;
};

type EducatorForm = {
  id?: string;
  educator_name: string;
  attendance_actual: string;
  timing: string;
  failures_text: string;
  curriculum_notes: string;
  media_captured: boolean;
  media_count: string;
};

const emptyEducatorForm: EducatorForm = {
  educator_name: '', attendance_actual: '', timing: '', failures_text: '', curriculum_notes: '', media_captured: false, media_count: '',
};

function emojiFor(v: number | null) {
  return ENJOYMENT_FACES.find(f => f.value === v)?.emoji || '—';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReviewsPage() {
  const [heldReviews, setHeldReviews] = useState<Review[]>([]);
  const [sessions, setSessions] = useState<SessionRef[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionReviews, setSessionReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHeldAndSessions() {
    setLoading(true);
    setError(null);
    try {
      const [heldRes, sessRes] = await Promise.all([
        fetch('/admin/api/session-reviews?heldOnly=true'),
        fetch('/admin/api/sessions'),
      ]);
      const heldData = await heldRes.json();
      if (!heldRes.ok) throw new Error(heldData.error || 'Failed to load held reviews');
      setHeldReviews(heldData.rows || []);
      setSessions((await sessRes.json()).rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadHeldAndSessions(); }, []);

  async function loadSessionReviews(sessionId: string) {
    setSelectedSessionId(sessionId);
    if (!sessionId) { setSessionReviews([]); return; }
    const res = await fetch(`/admin/api/session-reviews?sessionId=${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    setSessionReviews(data.rows || []);
    await loadEducatorForm(sessionId);
  }

  async function releaseReview(review: Review) {
    await fetch('/admin/api/session-reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: review.id, hold_status: 'released', released_by: 'Alfred' }),
    });
    setHeldReviews(prev => prev.filter(r => r.id !== review.id));
    setSessionReviews(prev => prev.map(r => r.id === review.id ? { ...r, hold_status: 'released' } : r));
  }

  // --- Educator form ---
  const [educatorForm, setEducatorForm] = useState<EducatorForm>(emptyEducatorForm);
  const [educatorSaving, setEducatorSaving] = useState(false);
  const [educatorSaved, setEducatorSaved] = useState(false);

  async function loadEducatorForm(sessionId: string) {
    const res = await fetch(`/admin/api/session-reviews-educator?sessionId=${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    const row = data.row;
    setEducatorForm(row ? {
      id: row.id,
      educator_name: row.educator_name || '',
      attendance_actual: row.attendance_actual === null ? '' : String(row.attendance_actual),
      timing: row.timing || '',
      failures_text: row.failures_text || '',
      curriculum_notes: row.curriculum_notes || '',
      media_captured: row.media_captured || false,
      media_count: row.media_count === null ? '' : String(row.media_count),
    } : emptyEducatorForm);
    setEducatorSaved(false);
  }

  async function saveEducatorForm() {
    if (!selectedSessionId) return;
    setEducatorSaving(true);
    try {
      await fetch('/admin/api/session-reviews-educator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          educatorName: educatorForm.educator_name.trim() || null,
          attendanceActual: educatorForm.attendance_actual,
          timing: educatorForm.timing || null,
          failuresText: educatorForm.failures_text.trim() || null,
          curriculumNotes: educatorForm.curriculum_notes.trim() || null,
          mediaCaptured: educatorForm.media_captured,
          mediaCount: educatorForm.media_count,
        }),
      });
      setEducatorSaved(true);
    } finally {
      setEducatorSaving(false);
    }
  }

  // --- Add to testimonials ---
  const [testimonialFor, setTestimonialFor] = useState<Review | null>(null);
  const [testimonialText, setTestimonialText] = useState('');
  const [testimonialSaving, setTestimonialSaving] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);
  const [testimonialDone, setTestimonialDone] = useState(false);

  function openTestimonial(review: Review) {
    setTestimonialFor(review);
    setTestimonialText(review.built_text || review.open_text || '');
    setTestimonialError(null);
    setTestimonialDone(false);
  }

  async function saveTestimonial() {
    if (!testimonialFor || !testimonialText.trim()) return;
    setTestimonialSaving(true);
    setTestimonialError(null);
    try {
      const res = await fetch('/admin/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceReviewId: testimonialFor.id, quoteText: testimonialText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setTestimonialDone(true);
    } catch (err: any) {
      setTestimonialError(err.message);
    } finally {
      setTestimonialSaving(false);
    }
  }

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.starts_at || '').localeCompare(a.starts_at || '')),
    [sessions]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/sessions" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <CalendarClock size={14} /> Sessions
            </Link>
            <Link href="/admin/kids" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Baby size={14} /> Kids
            </Link>
            <Link href="/admin/testimonials" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Quote size={14} /> Testimonials
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Post-Session Reviews</h1>
          <p className="text-sm text-slate-500 mt-1">What kids said right after their session, and what educators noted.</p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-[13px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-1.5 mb-3">
                <AlertTriangle size={14} /> Needs Attention ({heldReviews.length})
              </h2>
              {heldReviews.length === 0 ? (
                <p className="text-sm text-slate-400 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">Nothing held right now.</p>
              ) : (
                <div className="space-y-2">
                  {heldReviews.map(r => (
                    <div key={r.id} className="bg-white rounded-2xl border border-rose-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{r.kids?.name}</span>
                            <span className="text-[11px] text-slate-400">{r.sessions?.programs?.code} · {fmtDate(r.sessions?.starts_at || null)}</span>
                          </div>
                          <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                            <span>{emojiFor(r.enjoyment)} Enjoyment</span>
                            {r.wants_more && <span>Wants more: <b>{r.wants_more}</b></span>}
                            {r.completion && <span>Completion: <b>{r.completion}</b></span>}
                          </div>
                          {(r.built_text || r.open_text) && (
                            <p className="text-[13px] text-slate-600 italic mt-2">"{r.built_text || r.open_text}"</p>
                          )}
                        </div>
                        <button onClick={() => releaseReview(r)} className="shrink-0 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-white bg-slate-900">
                          Release
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">View a session's reviews</label>
              <select value={selectedSessionId} onChange={e => loadSessionReviews(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                <option value="">Select a session...</option>
                {sortedSessions.map(s => (
                  <option key={s.id} value={s.id}>{s.programs?.code} · {fmtDate(s.starts_at)}</option>
                ))}
              </select>
            </div>

            {selectedSessionId && (
              <>
                <div className="space-y-2 mb-6">
                  {sessionReviews.map(r => (
                    <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{r.kids?.name}</span>
                            {r.hold_status === 'held' && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">Held</span>}
                            {r.hold_status === 'released' && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Released</span>}
                            {!r.completed_at && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">In progress</span>}
                          </div>
                          <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                            <span>{emojiFor(r.enjoyment)}</span>
                            {r.difficulty && <span>{r.difficulty}</span>}
                            {r.completion && <span>{r.completion}</span>}
                            {r.wants_more && <span>Wants more: <b>{r.wants_more}</b></span>}
                          </div>
                          {r.built_text && <p className="text-[13px] text-slate-600 italic mt-2">"{r.built_text}"</p>}
                          {r.open_text && <p className="text-[12px] text-slate-400 mt-1">{r.open_text}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 items-end shrink-0">
                          {r.hold_status === 'held' && (
                            <button onClick={() => releaseReview(r)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white bg-slate-900">Release</button>
                          )}
                          {(r.built_text || r.open_text) && (
                            <button onClick={() => openTestimonial(r)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700">
                              <Sparkles size={11} /> Testimonial
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sessionReviews.length === 0 && (
                    <p className="text-sm text-slate-400 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">No reviews submitted for this session yet.</p>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-400 mb-3">Educator Notes</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Educator</label>
                      <input value={educatorForm.educator_name} onChange={e => setEducatorForm(f => ({ ...f, educator_name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Attendance (actual)</label>
                      <input type="number" min={0} value={educatorForm.attendance_actual} onChange={e => setEducatorForm(f => ({ ...f, attendance_actual: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ran to time</label>
                      <select value={educatorForm.timing} onChange={e => setEducatorForm(f => ({ ...f, timing: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
                        <option value="">Select...</option>
                        {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Photos/video captured</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} value={educatorForm.media_count} onChange={e => setEducatorForm(f => ({ ...f, media_count: e.target.value, media_captured: !!e.target.value }))} placeholder="Count" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Hardware/software failures</label>
                    <textarea value={educatorForm.failures_text} onChange={e => setEducatorForm(f => ({ ...f, failures_text: e.target.value }))} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  </div>
                  <div className="mb-4">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Curriculum notes for next time</label>
                    <textarea value={educatorForm.curriculum_notes} onChange={e => setEducatorForm(f => ({ ...f, curriculum_notes: e.target.value }))} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                  </div>
                  <button onClick={saveEducatorForm} disabled={educatorSaving} className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                    {educatorSaving ? 'Saving...' : educatorSaved ? 'Saved ✓' : 'Save Educator Notes'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {testimonialFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Add to Testimonials</h3>
              <button onClick={() => setTestimonialFor(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            {testimonialDone ? (
              <div className="text-center py-4">
                <Check size={28} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Added to the testimonial queue for approval.</p>
                <button onClick={() => setTestimonialFor(null)} className="mt-4 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900">Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Light edits only - fix spelling, leave the phrasing alone. It's queued for approval, not published yet.</p>
                <textarea value={testimonialText} onChange={e => setTestimonialText(e.target.value)} rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
                {testimonialError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{testimonialError}</div>}
                <div className="flex gap-2">
                  <button onClick={() => setTestimonialFor(null)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                  <button onClick={saveTestimonial} disabled={testimonialSaving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                    {testimonialSaving ? 'Saving...' : 'Add to Queue'}
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
