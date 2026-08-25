"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Sparkles, Plus, X, Pencil, Trash2, GripVertical,
  Image as ImageIcon, Clock, MapPin, Eye, EyeOff, Calendar, CalendarDays,
  Lock, CalendarClock, Home, Package, Mail, AlertTriangle, CheckCircle2, Maximize2,
} from "lucide-react";
import { computeMarginPct, guardrailCheck } from "@/lib/pricingEngine";
import RegisterInterestModal, { dateOptionsWithCombo } from "@/components/RegisterInterestModal";

type DateOption = { id: string; label: string; starts_at: string; description?: string };

type FeaturedProgram = {
  id: string;
  title: string;
  label: string;
  location: string | null;
  details: string | null;
  duration: string | null;
  form_label: string | null;
  series: string | null;
  image_url: string;
  is_video: boolean;
  accent: string;
  sort_order: number;
  live_from: string;
  live_until: string;
  date_options: DateOption[];
  draft: boolean;
  allow_multi_date: boolean;
  show_on_events_page: boolean;
  show_on_homepage: boolean;
  counts_general_attendees: boolean;
  programs_id: string | null;
  default_session_id: string | null;
  expected_attendee_count: number | null;
  quote_email_template_id: string | null;
  quote_email_template_needs_review: boolean;
};

const LABEL_CLS = "block text-[13px] font-medium text-slate-700 mb-1.5";
const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";
const HINT_CLS = "text-[12px] text-slate-400 mt-1.5 leading-relaxed";

const ACCENTS = [
  { value: 'bg-rad-teal', label: 'Teal', swatch: '#45a79a' },
  { value: 'bg-rad-blue', label: 'Blue', swatch: '#5574a9' },
  { value: 'bg-rad-purple', label: 'Purple', swatch: '#5d4385' },
];

const emptyForm = {
  title: '', label: 'Program', location: '', details: '', duration: '', form_label: '', series: '',
  image_url: '', is_video: false, accent: 'bg-rad-blue', sort_order: '0',
  live_from: '', live_until: '', allow_multi_date: false,
  show_on_events_page: true, show_on_homepage: true,
  counts_general_attendees: false,
  programs_id: '', default_session_id: '', expected_attendee_count: '',
  quote_email_template_id: '',
};

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusOf(p: FeaturedProgram): { label: string; cls: string } {
  // draft is a manual override, checked before the date window - forcing
  // a card down right now shouldn't require touching (or losing) its
  // scheduled dates underneath it.
  if (p.draft) return { label: 'Draft', cls: 'bg-slate-200 text-slate-600' };
  const now = Date.now();
  const from = new Date(p.live_from).getTime();
  const until = new Date(p.live_until).getTime();
  if (now < from) return { label: 'Scheduled', cls: 'bg-amber-50 text-amber-600' };
  if (now > until) return { label: 'Hidden', cls: 'bg-slate-100 text-slate-400' };
  return { label: 'Live', cls: 'bg-emerald-50 text-emerald-600' };
}

// A card can be Live (per statusOf above) but still not listed anywhere
// public if both surface flags are off - e.g. a pre-registration-only offer
// shared via a direct link. Distinct from Draft/Hidden: the card still
// exists and is reachable, it's just not surfaced on either public listing.
function isLocked(p: FeaturedProgram): boolean {
  return !p.show_on_events_page && !p.show_on_homepage;
}

export default function FeaturedProgramsPage() {
  const [rows, setRows] = useState<FeaturedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/featured-programs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load featured programs');
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Lookup lists for the Programme, Packages & Quote Email section - loaded
  // once, reused across every open of the edit modal rather than refetched
  // per-open.
  const [programsList, setProgramsList] = useState<{ id: string; name: string; code: string }[]>([]);
  const [sessionsList, setSessionsList] = useState<{ id: string; programme_id: string; starts_at: string; venue: string | null }[]>([]);
  const [emailTemplatesList, setEmailTemplatesList] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [packagesList, setPackagesList] = useState<any[]>([]);

  useEffect(() => {
    fetch('/admin/api/programs').then(r => r.json()).then(d => setProgramsList(d.rows || [])).catch(() => {});
    fetch('/admin/api/sessions').then(r => r.json()).then(d => setSessionsList(d.rows || [])).catch(() => {});
    fetch('/admin/api/finance-v2/email-templates').then(r => r.json()).then(d => setEmailTemplatesList(d.rows || [])).catch(() => {});
    fetch('/admin/api/pricing/packages').then(r => r.json()).then(d => setPackagesList(d.rows || [])).catch(() => {});
  }, []);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.sort_order - b.sort_order), [rows]);
  const seriesOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.series).filter(Boolean))) as string[],
    [rows]
  );

  const [showModal, setShowModal] = useState(false);
  const [previewProgram, setPreviewProgram] = useState<FeaturedProgram | null>(null);
  const [previewRegisterOpen, setPreviewRegisterOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturedProgram | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [eventPackages, setEventPackages] = useState<any[]>([]);
  const [loadingEventPackages, setLoadingEventPackages] = useState(false);

  async function loadEventPackages(featuredProgramId: string) {
    setLoadingEventPackages(true);
    try {
      const res = await fetch(`/admin/api/pricing/event-packages?featured_program_id=${featuredProgramId}`);
      const data = await res.json();
      setEventPackages(data.rows || []);
    } finally {
      setLoadingEventPackages(false);
    }
  }

  function openAdd() {
    setEditing(null);
    const nextOrder = rows.length ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0;
    setForm({ ...emptyForm, sort_order: String(nextOrder), live_from: toDatetimeLocal(new Date().toISOString()) });
    setDateOptions([]);
    setEventPackages([]);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(p: FeaturedProgram) {
    setEditing(p);
    setForm({
      title: p.title,
      label: p.label,
      location: p.location || '',
      details: p.details || '',
      duration: p.duration || '',
      form_label: p.form_label || '',
      series: p.series || '',
      image_url: p.image_url,
      is_video: p.is_video,
      accent: p.accent,
      sort_order: String(p.sort_order),
      live_from: toDatetimeLocal(p.live_from),
      live_until: toDatetimeLocal(p.live_until),
      allow_multi_date: p.allow_multi_date,
      show_on_events_page: p.show_on_events_page,
      show_on_homepage: p.show_on_homepage,
      counts_general_attendees: p.counts_general_attendees,
      programs_id: p.programs_id || '',
      default_session_id: p.default_session_id || '',
      expected_attendee_count: p.expected_attendee_count === null ? '' : String(p.expected_attendee_count),
      quote_email_template_id: p.quote_email_template_id || '',
    });
    setDateOptions(p.date_options || []);
    setFormError(null);
    setShowModal(true);
    loadEventPackages(p.id);
  }

  function addDateOption() {
    setDateOptions(prev => [...prev, { id: crypto.randomUUID(), label: '', starts_at: '' }]);
  }

  function updateDateOption(id: string, patch: Partial<DateOption>) {
    setDateOptions(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  function removeDateOption(id: string) {
    setDateOptions(prev => prev.filter(d => d.id !== id));
  }

  async function save() {
    if (!form.title.trim()) return setFormError('Title is required.');
    if (!form.image_url.trim()) return setFormError('Image URL is required.');
    if (!form.live_until) return setFormError('Live until date is required.');
    const cleanedDateOptions = dateOptions
      .map(d => ({ ...d, label: d.label.trim() }))
      .filter(d => d.label && d.starts_at);
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title.trim(),
        label: form.label.trim() || 'Program',
        location: form.location.trim() || null,
        details: form.details.trim() || null,
        duration: form.duration.trim() || null,
        form_label: form.form_label.trim() || null,
        series: form.series.trim() || null,
        image_url: form.image_url.trim(),
        is_video: form.is_video,
        accent: form.accent,
        sort_order: form.sort_order,
        live_from: form.live_from ? new Date(form.live_from).toISOString() : new Date().toISOString(),
        live_until: new Date(form.live_until).toISOString(),
        date_options: cleanedDateOptions,
        allow_multi_date: form.allow_multi_date,
        show_on_events_page: form.show_on_events_page,
        show_on_homepage: form.show_on_homepage,
        counts_general_attendees: form.counts_general_attendees,
        programs_id: form.programs_id || null,
        default_session_id: form.default_session_id || null,
        expected_attendee_count: form.expected_attendee_count === '' ? null : Number(form.expected_attendee_count),
        quote_email_template_id: form.quote_email_template_id || null,
      };
      const res = await fetch('/admin/api/featured-programs', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      await load();
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: FeaturedProgram) {
    if (!confirm(`Delete "${p.title}"? This removes it from the landing page immediately.`)) return;
    await fetch('/admin/api/featured-programs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    });
    await load();
  }

  // Master switch: force a card into Draft (hidden immediately, dates left
  // untouched) or back to following its Live From/Until window normally.
  // Optimistic with rollback so the row flips instantly on click.
  async function toggleDraft(p: FeaturedProgram) {
    const next = !p.draft;
    setRows(prev => prev.map(r => r.id === p.id ? { ...r, draft: next } : r));
    try {
      const res = await fetch('/admin/api/featured-programs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, draft: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
    } catch (err: any) {
      setRows(prev => prev.map(r => r.id === p.id ? { ...r, draft: p.draft } : r));
      // Most likely the publish gate (Packages & Quote Email section) -
      // surfaced directly since silently reverting with no explanation
      // would just look like a bug.
      alert(err.message || 'Failed to update.');
    }
  }

  // Same optimistic-with-rollback pattern as toggleDraft, for either
  // surface flag.
  async function toggleVisibility(p: FeaturedProgram, field: 'show_on_events_page' | 'show_on_homepage') {
    const next = !p[field];
    setRows(prev => prev.map(r => r.id === p.id ? { ...r, [field]: next } : r));
    try {
      const res = await fetch('/admin/api/featured-programs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, [field]: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRows(prev => prev.map(r => r.id === p.id ? { ...r, [field]: p[field] } : r));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles size={20} className="text-blue-500" /> Featured Programs
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Every program you&apos;re running - controls both the homepage &quot;Featured Events&quot; carousel and the <Link href="/events" target="_blank" className="underline hover:text-slate-700">/events</Link> page. A card is only visible between its Live From and Live Until dates, and only on the surface(s) you tick below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/registrations" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50">
              <CalendarDays size={14} /> Registrations
            </Link>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
              <Plus size={14} /> Add Card
            </button>
          </div>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <div className="space-y-3">
            {sorted.map(p => {
              const status = statusOf(p);
              const accentMeta = ACCENTS.find(a => a.value === p.accent);
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-300 shrink-0">
                    <GripVertical size={14} />
                    <span className="text-[9px] font-black text-slate-400">{p.sort_order}</span>
                  </div>

                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={18} className="text-slate-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800">{p.title}</h3>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">{p.label}</span>
                      {p.series && (
                        <span title="Series - grouped with other instances on the Registrations page" className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{p.series}</span>
                      )}
                      {accentMeta && (
                        <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: accentMeta.swatch }} title={accentMeta.label} />
                      )}
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 ${status.cls}`}>
                        {status.label === 'Hidden' ? <EyeOff size={10} /> : <Eye size={10} />} {status.label}
                      </span>
                      {status.label === 'Live' && isLocked(p) && (
                        <span title="Live, but not listed on the events page or homepage carousel - not currently visible anywhere on the public site." className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                          <Lock size={10} /> Locked
                        </span>
                      )}
                    </div>
                    {p.location && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <MapPin size={11} /> {p.location}
                      </div>
                    )}
                    {p.details && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{p.details}</p>}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                      <Calendar size={11} /> {fmtDate(p.live_from)} <span className="text-slate-300">→</span> {fmtDate(p.live_until)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                      <CalendarDays size={11} /> {(p.date_options || []).length} date option{(p.date_options || []).length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleVisibility(p, 'show_on_events_page')}
                      title={p.show_on_events_page ? 'Shown on /events. Click to remove from the events page listing.' : 'Not shown on /events. Click to list it there.'}
                      className={p.show_on_events_page ? 'text-slate-300 hover:text-slate-600' : 'text-amber-500 hover:text-amber-600'}
                    >
                      <CalendarClock size={14} />
                    </button>
                    <button
                      onClick={() => toggleVisibility(p, 'show_on_homepage')}
                      title={p.show_on_homepage ? 'Shown on the homepage carousel. Click to remove from Featured Events.' : 'Not shown on the homepage carousel. Click to add it there.'}
                      className={p.show_on_homepage ? 'text-slate-300 hover:text-slate-600' : 'text-amber-500 hover:text-amber-600'}
                    >
                      <Home size={14} />
                    </button>
                    <button
                      onClick={() => toggleDraft(p)}
                      title={p.draft
                        ? 'Draft - hidden from the site regardless of its dates. Click to resume following its Live From/Until window.'
                        : 'Following its Live From/Until dates. Click to force into Draft immediately, hiding it right now without changing those dates.'}
                      className={p.draft ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-600'}
                    >
                      {p.draft ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => setPreviewProgram(p)} title="Preview — works even in Draft" className="text-slate-300 hover:text-blue-600"><Maximize2 size={14} /></button>
                    <button onClick={() => openEdit(p)} title="Edit" className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                    <button onClick={() => remove(p)} title="Delete" className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                No featured program cards yet. Click "Add Card" to publish one to the landing page.
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between px-8 pt-7 pb-5 shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Sparkles size={19} />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-slate-900 tracking-tight leading-tight">
                    {editing ? 'Edit Card' : 'New Card'}
                  </h3>
                  <p className="text-[13px] text-slate-400 mt-0.5">Landing page &quot;Featured Events&quot; carousel</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors duration-150 shrink-0">
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-8 py-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Title</label>
                  <input placeholder="e.g. Game Creator Bootcamp" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Badge Label</label>
                  <input placeholder="e.g. Online Course" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Location</label>
                  <input placeholder="e.g. Virtual Classroom" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Duration</label>
                  <input placeholder="e.g. 6 Week Program" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Series</label>
                <input
                  list="series-options" placeholder="e.g. Robotics Webinar"
                  value={form.series} onChange={e => setForm(f => ({ ...f, series: e.target.value }))} className={INPUT_CLS}
                />
                <datalist id="series-options">
                  {seriesOptions.map(s => <option key={s} value={s} />)}
                </datalist>
                <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
                  Tag recurring instances of the same event (different topic each time) with the same name so <Link href="/admin/registrations" className="underline hover:text-slate-600">Registrations</Link> can compare them month to month. Leave blank for a one-off.
                </p>
              </div>

              <div>
                <label className={LABEL_CLS}>Details</label>
                <textarea rows={3} value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} className={`${INPUT_CLS} resize-none leading-relaxed`} />
              </div>

              <div>
                <label className={LABEL_CLS}>Form Label</label>
                <input placeholder="e.g. Game Creator Bootcamp (Online)" value={form.form_label} onChange={e => setForm(f => ({ ...f, form_label: e.target.value }))} className={INPUT_CLS} />
                <p className={HINT_CLS}>Sent as context when a visitor clicks "Register Interest" on this card.</p>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-[10px] bg-slate-50 border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={form.counts_general_attendees} onChange={e => setForm(f => ({ ...f, counts_general_attendees: e.target.checked }))} className="mt-0.5 w-4 h-4 shrink-0 accent-blue-600" />
                <span>
                  <span className="block text-[13px] font-medium text-slate-700">This is attended by more than just kids</span>
                  <span className="block text-[12px] text-slate-400 mt-0.5">
                    Register Interest asks &quot;Number of Attendees&quot; instead of &quot;Number of Children&quot;, and consent wording drops the &quot;your child&apos;s information&quot; phrasing - for things like a webinar a parent might attend alone, with kids, or both. Leave off for in-person kids&apos; workshops.
                  </span>
                </span>
              </label>

              <div className="pt-1 border-t border-slate-100" />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={LABEL_CLS.replace('mb-1.5', 'mb-0')}>Date Options</label>
                  <button type="button" onClick={addDateOption} className="text-[12px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus size={13} /> Add date
                  </button>
                </div>
                <p className={HINT_CLS}>
                  The dates visitors can pick on this card's Register Interest form. Leave empty for a card with no bookable dates yet. Add two for a one-off event (e.g. Polokwane/Pretoria) or a longer rolling list for recurring online sessions.
                </p>
                {dateOptions.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {dateOptions.map(d => (
                      <div key={d.id} className="p-3 rounded-[10px] bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            placeholder="Label, e.g. Sat 6 Sept, 10:00"
                            value={d.label}
                            onChange={e => updateDateOption(d.id, { label: e.target.value })}
                            className={`${INPUT_CLS} flex-1`}
                          />
                          <input
                            type="datetime-local"
                            value={toDatetimeLocal(d.starts_at || null)}
                            onChange={e => updateDateOption(d.id, { starts_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                            className={`${INPUT_CLS} w-56 shrink-0`}
                          />
                          <button type="button" onClick={() => removeDateOption(d.id)} className="text-slate-300 hover:text-rose-500 shrink-0">
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <input
                          placeholder="What's this day about, e.g. Minecraft Education — game-based learning and creative problem-solving (optional)"
                          value={d.description || ''}
                          onChange={e => updateDateOption(d.id, { description: e.target.value })}
                          className={`${INPUT_CLS} text-[13px]`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {dateOptions.filter(d => d.label.trim()).length >= 2 && (
                  <label className="flex items-start gap-2.5 mt-4 p-3 rounded-[10px] bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allow_multi_date}
                      onChange={e => setForm(f => ({ ...f, allow_multi_date: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 shrink-0 accent-blue-600"
                    />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-700">Let visitors pick more than one date</span>
                      <span className="block text-[12px] text-slate-400 mt-0.5">
                        Adds a combined choice to the form's date dropdown - e.g. "{dateOptions.filter(d => d.label.trim()).map(d => d.label).join(' + ')}" alongside each individual date. Turn on for a multi-day event someone might attend all of (like a 2-day circuit); leave off if the dates are alternatives to pick just one of.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <div className="pt-1 border-t border-slate-100" />

              <div>
                <label className={LABEL_CLS.replace('mb-1.5', 'mb-2')}>Where this shows up</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 rounded-[10px] bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={form.show_on_events_page} onChange={e => setForm(f => ({ ...f, show_on_events_page: e.target.checked }))} className="mt-0.5 w-4 h-4 shrink-0 accent-blue-600" />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-700">List on /events</span>
                      <span className="block text-[12px] text-slate-400 mt-0.5">The public events directory page.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 p-3 rounded-[10px] bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={form.show_on_homepage} onChange={e => setForm(f => ({ ...f, show_on_homepage: e.target.checked }))} className="mt-0.5 w-4 h-4 shrink-0 accent-blue-600" />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-700">List on the homepage</span>
                      <span className="block text-[12px] text-slate-400 mt-0.5">The &quot;Featured Events&quot; carousel.</span>
                    </span>
                  </label>
                </div>
                <p className={HINT_CLS}>Turn both off to keep this card live but unlisted on either public surface - for something not ready to announce yet. There&apos;s no direct-link detail page for a single card today, so &quot;unlisted&quot; currently means &quot;not visible anywhere&quot; rather than &quot;visible only via a private link&quot; - ask if you need that.</p>
              </div>

              <div className="pt-1 border-t border-slate-100" />

              <div>
                <label className={LABEL_CLS}>Curriculum Programme</label>
                <select value={form.programs_id} onChange={e => setForm(f => ({ ...f, programs_id: e.target.value }))} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
                  <option value="">— none linked —</option>
                  {programsList.map(pr => <option key={pr.id} value={pr.id}>{pr.name} ({pr.code})</option>)}
                </select>
                <p className={HINT_CLS}>Which curriculum programme this card's quotes bill against. Required before a quote can be auto-generated for this card.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Default Session</label>
                  <select value={form.default_session_id} onChange={e => setForm(f => ({ ...f, default_session_id: e.target.value }))} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
                    <option value="">— none —</option>
                    {sessionsList.filter(s => !form.programs_id || s.programme_id === form.programs_id).map(s => (
                      <option key={s.id} value={s.id}>{new Date(s.starts_at).toLocaleDateString('en-ZA')}{s.venue ? ` — ${s.venue}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Expected Attendees</label>
                  <input type="number" min={1} value={form.expected_attendee_count} onChange={e => setForm(f => ({ ...f, expected_attendee_count: e.target.value }))} className={INPUT_CLS} placeholder="e.g. 15" />
                </div>
              </div>
              <p className={`${HINT_CLS} -mt-3`}>Expected Attendees is the shared basis flat costs (venue, etc.) are divided across for every package attached below.</p>

              {editing ? (
                <PackagesQuoteEmailSection
                  featuredProgramId={editing.id}
                  expectedAttendeeCount={form.expected_attendee_count === '' ? null : Number(form.expected_attendee_count)}
                  packagesList={packagesList}
                  emailTemplatesList={emailTemplatesList}
                  quoteEmailTemplateId={form.quote_email_template_id}
                  onQuoteEmailTemplateChange={(id) => setForm(f => ({ ...f, quote_email_template_id: id }))}
                  needsReview={editing.quote_email_template_needs_review}
                  eventPackages={eventPackages}
                  loading={loadingEventPackages}
                  onRefresh={() => loadEventPackages(editing.id)}
                />
              ) : (
                <div className="p-4 rounded-[10px] bg-amber-50 border border-amber-200 text-[13px] text-amber-700 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>Save this card first, then reopen it to attach packages and pick a quote email template — both are required before it can go live.</span>
                </div>
              )}

              <div className="pt-1 border-t border-slate-100" />

              <div>
                <label className={LABEL_CLS}>Image / Video URL</label>
                <input placeholder="https://...r2.dev/..." value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className={INPUT_CLS} />
                <p className={HINT_CLS}>Paste the R2 URL for the uploaded image or video.</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-[14px] font-medium text-slate-800">This is a video</div>
                  <div className="text-[12px] text-slate-400">Rendered as an autoplaying muted video instead of a still image.</div>
                </div>
                <Toggle checked={form.is_video} onChange={v => setForm(f => ({ ...f, is_video: v }))} />
              </div>

              <div>
                <label className={LABEL_CLS}>Accent Color</label>
                <div className="flex gap-2">
                  {ACCENTS.map(a => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, accent: a.value }))}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] border text-[13px] font-medium transition-colors duration-150 ${form.accent === a.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: a.swatch }} />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100" />

              <div>
                <label className={LABEL_CLS}>Carousel Order</label>
                <input type="number" min={0} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className={INPUT_CLS} />
                <p className={HINT_CLS}>Lower numbers appear first.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Live From</label>
                  <input type="datetime-local" value={form.live_from} onChange={e => setForm(f => ({ ...f, live_from: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Live Until</label>
                  <input type="datetime-local" value={form.live_until} onChange={e => setForm(f => ({ ...f, live_until: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
              <p className={HINT_CLS}>The card only appears on the landing page between these two dates. To take it down early, edit "Live Until" to now.</p>
            </div>

            <div className="shrink-0 border-t border-slate-100 px-8 py-5">
              {formError && <div className="mb-3 bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{formError}</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 shadow-sm"
                >
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewProgram && (
        <PreviewModal
          program={previewProgram}
          onClose={() => { setPreviewProgram(null); setPreviewRegisterOpen(false); }}
          onOpenRegister={() => setPreviewRegisterOpen(true)}
        />
      )}
      {previewRegisterOpen && previewProgram && (
        <RegisterInterestModal
          program={{
            id: previewProgram.id,
            title: previewProgram.title,
            location: previewProgram.location,
            formLabel: previewProgram.form_label,
            date_options: previewProgram.date_options,
            allow_multi_date: previewProgram.allow_multi_date,
            countsGeneralAttendees: previewProgram.counts_general_attendees,
          }}
          onClose={() => setPreviewRegisterOpen(false)}
          previewMode
        />
      )}
    </div>
  );
}

// Faithful to the public homepage's hero-carousel card (src/app/page.tsx) -
// image/video, accent badge, title, location, details, duration - so an
// admin can actually see what a card will look like before publishing,
// including while it's still in Draft (the public page hides drafts
// entirely, so there was previously no way to check this without going
// live first). "Register Interest" opens the real, live RegisterInterest
// Modal on top, so the package picker/dates can be sanity-checked too -
// actual submission still gets blocked server-side for a Draft program,
// same safeguard as today, just now something you can see coming rather
// than discover on click.
function PreviewModal({ program, onClose, onOpenRegister }: { program: FeaturedProgram; onClose: () => void; onOpenRegister: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-[#020617] rounded-[32px] shadow-2xl ring-1 ring-black/5 w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
          <X size={16} />
        </button>
        {program.draft && (
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-xl bg-amber-500 text-[#020617] text-[10px] font-black uppercase tracking-widest shadow-xl">
            Draft — not visible on the live site
          </div>
        )}

        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 h-56 md:h-[420px] relative bg-[#0f172a] overflow-hidden shrink-0">
            {program.image_url ? (
              program.is_video ? (
                <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                  <source src={program.image_url} type="video/mp4" />
                </video>
              ) : (
                // Plain <img>, not next/image - the R2 image domains aren't
                // configured for Next's optimizer (same reason the admin
                // list thumbnail below uses a plain <img> too).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={program.image_url} alt={program.title} className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600"><ImageIcon size={32} /></div>
            )}
            <div className={`absolute top-8 left-8 px-4 py-2 rounded-2xl ${program.accent} text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl`}>
              {program.label}
            </div>
          </div>

          <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-none text-white">{program.title}</h3>
                {program.location && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin size={14} />
                    <span className="text-[11px] font-black uppercase tracking-widest">{program.location}</span>
                  </div>
                )}
              </div>
              {program.details && <p className="text-slate-400 text-base font-medium leading-relaxed italic">{program.details}</p>}
              {program.duration && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 w-fit">
                  <Clock size={14} className="text-rad-blue" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{program.duration}</span>
                </div>
              )}
              {(program.date_options || []).length > 0 && (
                <div className="space-y-1.5">
                  {dateOptionsWithCombo(program.date_options, program.allow_multi_date).map(d => (
                    <div key={d.id} className="text-[12px] text-slate-400">
                      <span className="font-bold text-slate-300">{d.label}</span>{d.description ? ` — ${d.description}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onOpenRegister}
              className="flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-white text-[#020617] font-black uppercase italic tracking-tighter hover:bg-slate-200 transition-all text-sm shadow-xl w-fit"
            >
              Register Interest
            </button>
            {program.draft && (
              <p className="text-[11px] text-amber-500">Submission will be blocked server-side while this stays in Draft — this is for checking the flow's look and copy, not for testing a real registration.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-out ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// Spec §3 steps 3-8 in one place, plus the quote-email-template pick from
// the founder's compulsory-step requirement - both gate this program's
// draft->live PATCH server-side (checkPublishGate in
// admin/api/featured-programs/route.ts), so this section is where an admin
// actually clears that gate rather than just being told about it.
function PackagesQuoteEmailSection({
  featuredProgramId, expectedAttendeeCount, packagesList, emailTemplatesList,
  quoteEmailTemplateId, onQuoteEmailTemplateChange, needsReview,
  eventPackages, loading, onRefresh,
}: {
  featuredProgramId: string;
  expectedAttendeeCount: number | null;
  packagesList: any[];
  emailTemplatesList: { id: string; slug: string; name: string }[];
  quoteEmailTemplateId: string;
  onQuoteEmailTemplateChange: (id: string) => void;
  needsReview: boolean;
  eventPackages: any[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [attachPackageId, setAttachPackageId] = useState('');
  const [attaching, setAttaching] = useState(false);
  // Deliberately not filtering out already-attached packages - the same
  // package can be attached more than once at a different Days/Units
  // multiplier (e.g. "Single Workshop" ×1 and "Multi-Workshop Pass" ×3),
  // each with its own Display Name/Description override below so they
  // don't read as duplicates on the public tier display.

  async function saveTemplateSelection(id: string) {
    onQuoteEmailTemplateChange(id);
    await fetch('/admin/api/featured-programs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: featuredProgramId, quote_email_template_id: id || null }),
    });
  }

  async function attachPackage() {
    if (!attachPackageId) return;
    setAttaching(true);
    try {
      // Pull the package's own recommended margin in as this attachment's
      // starting target_margin_pct - still just a default, editable per-row
      // immediately after (EventPackageRow), same as any other founder call.
      const chosenPackage = packagesList.find(p => p.id === attachPackageId);
      const res = await fetch('/admin/api/pricing/event-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featured_program_id: featuredProgramId,
          package_id: attachPackageId,
          target_margin_pct: chosenPackage?.recommended_margin_pct ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAttachPackageId('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to attach package.');
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Package size={15} className="text-blue-500" />
        <h4 className="text-[14px] font-semibold text-slate-800">Packages & Quote Email</h4>
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Required to go live</span>
      </div>

      <div>
        <label className={LABEL_CLS}>Quote Email Template</label>
        <select value={quoteEmailTemplateId} onChange={e => saveTemplateSelection(e.target.value)} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
          <option value="">— choose a template —</option>
          {emailTemplatesList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {needsReview && quoteEmailTemplateId && (
          <p className="text-[12px] text-amber-600 mt-1.5 flex items-center gap-1.5"><AlertTriangle size={12} /> Backfilled with the placeholder default — please write a real one for this program.</p>
        )}
      </div>

      <div className="pt-1 border-t border-slate-200" />

      {loading ? (
        <div className="text-[13px] text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading packages...</div>
      ) : (
        <div className="space-y-3">
          {eventPackages.map(ep => (
            <EventPackageRow key={ep.id} eventPackage={ep} expectedAttendeeCount={expectedAttendeeCount} onChange={onRefresh} />
          ))}
          {eventPackages.length === 0 && <p className="text-[13px] text-slate-400">No packages attached yet.</p>}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <select value={attachPackageId} onChange={e => setAttachPackageId(e.target.value)} className={`${INPUT_CLS} appearance-none cursor-pointer flex-1`}>
          <option value="">— attach an existing package —</option>
          {packagesList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.event_type.replace('_', ' ')})</option>)}
        </select>
        <button type="button" onClick={attachPackage} disabled={!attachPackageId || attaching} className="px-4 py-2.5 rounded-[10px] bg-slate-900 text-white text-[13px] font-medium hover:bg-slate-800 disabled:opacity-50 shrink-0 flex items-center gap-1.5">
          {attaching ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Attach
        </button>
      </div>
      <p className={HINT_CLS}>Compose new packages or edit an item's own cost in <Link href="/admin/pricing" target="_blank" className="underline hover:text-slate-600">Pricing Library</Link>.</p>
    </div>
  );
}

function EventPackageRow({ eventPackage, expectedAttendeeCount, onChange }: { eventPackage: any; expectedAttendeeCount: number | null; onChange: () => void }) {
  const ep = eventPackage;
  const pkg = ep.package;
  const [tierRole, setTierRole] = useState(ep.tier_role || '');
  const [displayOrder, setDisplayOrder] = useState(String(ep.display_order ?? 0));
  const [unitMultiplier, setUnitMultiplier] = useState(String(ep.unit_multiplier ?? 1));
  const [displayName, setDisplayName] = useState(ep.display_name || '');
  const [displayDescription, setDisplayDescription] = useState(ep.display_description || '');
  const [targetMarginPct, setTargetMarginPct] = useState(ep.target_margin_pct === null ? '' : String(ep.target_margin_pct));
  const [finalFee, setFinalFee] = useState(ep.final_fee === null ? '' : String(ep.final_fee));
  const [overrideCategory, setOverrideCategory] = useState(ep.override_reason_category || '');
  const [overrideReason, setOverrideReason] = useState(ep.margin_override_reason || '');
  const [published, setPublished] = useState(ep.published);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedCost = Number(ep.computed_cost || 0);
  const finalFeeNum = finalFee === '' ? null : Number(finalFee);
  const guardrail = finalFeeNum !== null ? guardrailCheck(finalFeeNum, computedCost, pkg?.event_type || 'workshop') : null;
  const marginPct = finalFeeNum ? computeMarginPct(finalFeeNum, computedCost) : null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/pricing/event-packages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ep.id,
          tier_role: tierRole || null,
          display_order: displayOrder === '' ? 0 : Number(displayOrder),
          unit_multiplier: unitMultiplier === '' ? 1 : Number(unitMultiplier),
          target_margin_pct: targetMarginPct === '' ? null : Number(targetMarginPct),
          final_fee: finalFee === '' ? null : Number(finalFee),
          override_reason_category: overrideCategory || null,
          margin_override_reason: overrideReason || null,
          published,
          display_name: displayName || null,
          display_description: displayDescription || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange();
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Detach "${pkg?.name}" from this program?`)) return;
    await fetch('/admin/api/pricing/event-packages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ep.id }),
    });
    onChange();
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[14px] text-slate-800">{ep.display_name || pkg?.name}</span>
          {ep.display_name && <span className="text-[10px] text-slate-400">(package: {pkg?.name})</span>}
          {published ? (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Published</span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Draft</span>
          )}
        </div>
        <button type="button" onClick={remove} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div>
          <label className="text-[11px] text-slate-400">Tier</label>
          <select value={tierRole} onChange={e => setTierRole(e.target.value)} className="w-full text-[13px] border border-slate-200 rounded-lg px-2 py-1.5">
            <option value="">— untiered —</option>
            <option value="anchor">Anchor</option>
            <option value="recommended">Recommended</option>
            <option value="lighter">Lighter</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-400">Order</label>
          <input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} className="w-full text-[13px] border border-slate-200 rounded-lg px-2 py-1.5" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400" title="Scales this whole attachment's cost (per-child and flat items alike) — e.g. attach the same 'Per Day' package at ×2 for a two-day pass instead of composing a separate package.">Days / Units ×</label>
          <input type="number" min={1} value={unitMultiplier} onChange={e => setUnitMultiplier(e.target.value)} className="w-full text-[13px] border border-slate-200 rounded-lg px-2 py-1.5" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400">Target Margin %</label>
          <input type="number" value={targetMarginPct} onChange={e => setTargetMarginPct(e.target.value)} className="w-full text-[13px] border border-slate-200 rounded-lg px-2 py-1.5" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400">Final Fee (R)</label>
          <input type="number" value={finalFee} onChange={e => setFinalFee(e.target.value)} className="w-full text-[13px] border border-slate-200 rounded-lg px-2 py-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-slate-400">Display Name (optional override)</label>
          <input placeholder={pkg?.name} value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full text-[13px] border border-slate-200 rounded-lg px-2 py-1.5" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400">Display Description (optional override)</label>
          <input placeholder={pkg?.description || '—'} value={displayDescription} onChange={e => setDisplayDescription(e.target.value)} className="w-full text-[13px] border border-slate-200 rounded-lg px-2 py-1.5" />
        </div>
      </div>
      {(displayName || displayDescription) && (
        <p className="text-[11px] text-slate-400">Only affects this attachment — the underlying package's own name/description stay the same everywhere else it's used.</p>
      )}

      <div className="flex items-center gap-4 text-[12px] text-slate-500">
        <span>Cost: <strong>R {computedCost.toFixed(2)}</strong>{expectedAttendeeCount ? '' : ' (set Expected Attendees above for an accurate rollup)'}{Number(ep.unit_multiplier || 1) > 1 ? ` (×${ep.unit_multiplier} applied)` : ''}</span>
        {ep.recommended_fee !== null && <span>Recommended: <strong>R {Number(ep.recommended_fee).toFixed(2)}</strong></span>}
        {marginPct !== null && <span>Margin at this fee: <strong>{marginPct.toFixed(1)}%</strong></span>}
      </div>

      {guardrail && guardrail.level !== 'ok' && (
        <div className={`text-[12px] rounded-lg px-3 py-2 flex items-start gap-1.5 ${guardrail.level === 'hard' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {guardrail.message}
        </div>
      )}

      {guardrail?.level === 'hard' && (
        <div className="grid grid-cols-2 gap-2">
          <select value={overrideCategory} onChange={e => setOverrideCategory(e.target.value)} className="text-[13px] border border-slate-200 rounded-lg px-2 py-1.5">
            <option value="">— override reason category —</option>
            <option value="penetration_pricing">Penetration pricing</option>
            <option value="loyalty_referral_discount">Loyalty/referral discount</option>
            <option value="competitive_response">Competitive response</option>
            <option value="loss_leader_lead_gen">Loss leader / lead gen</option>
            <option value="founder_discretion_other">Founder discretion (other)</option>
          </select>
          <input placeholder="Why this is priced below cost..." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} className="text-[13px] border border-slate-200 rounded-lg px-2 py-1.5" />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
          <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          Published (visible to leads)
        </label>
        <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="text-[12px] text-rose-500">{error}</p>}
    </div>
  );
}
