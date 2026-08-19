"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Sparkles, Plus, X, Pencil, Trash2, GripVertical,
  Image as ImageIcon, Clock, MapPin, Eye, EyeOff, Calendar, CalendarDays,
} from "lucide-react";

type DateOption = { id: string; label: string; starts_at: string };

type FeaturedProgram = {
  id: string;
  title: string;
  label: string;
  location: string | null;
  details: string | null;
  duration: string | null;
  form_label: string | null;
  image_url: string;
  is_video: boolean;
  accent: string;
  sort_order: number;
  live_from: string;
  live_until: string;
  date_options: DateOption[];
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
  title: '', label: 'Program', location: '', details: '', duration: '', form_label: '',
  image_url: '', is_video: false, accent: 'bg-rad-blue', sort_order: '0',
  live_from: '', live_until: '',
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
  const now = Date.now();
  const from = new Date(p.live_from).getTime();
  const until = new Date(p.live_until).getTime();
  if (now < from) return { label: 'Scheduled', cls: 'bg-amber-50 text-amber-600' };
  if (now > until) return { label: 'Hidden', cls: 'bg-slate-100 text-slate-400' };
  return { label: 'Live', cls: 'bg-emerald-50 text-emerald-600' };
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

  const sorted = useMemo(() => [...rows].sort((a, b) => a.sort_order - b.sort_order), [rows]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FeaturedProgram | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    const nextOrder = rows.length ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0;
    setForm({ ...emptyForm, sort_order: String(nextOrder), live_from: toDatetimeLocal(new Date().toISOString()) });
    setDateOptions([]);
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
      image_url: p.image_url,
      is_video: p.is_video,
      accent: p.accent,
      sort_order: String(p.sort_order),
      live_from: toDatetimeLocal(p.live_from),
      live_until: toDatetimeLocal(p.live_until),
    });
    setDateOptions(p.date_options || []);
    setFormError(null);
    setShowModal(true);
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
        image_url: form.image_url.trim(),
        is_video: form.is_video,
        accent: form.accent,
        sort_order: form.sort_order,
        live_from: form.live_from ? new Date(form.live_from).toISOString() : new Date().toISOString(),
        live_until: new Date(form.live_until).toISOString(),
        date_options: cleanedDateOptions,
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
              Controls the "Current Programs" carousel on the landing page. A card is only visible between its Live From and Live Until dates.
            </p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
            <Plus size={14} /> Add Card
          </button>
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
                      {accentMeta && (
                        <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: accentMeta.swatch }} title={accentMeta.label} />
                      )}
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 ${status.cls}`}>
                        {status.label === 'Hidden' ? <EyeOff size={10} /> : <Eye size={10} />} {status.label}
                      </span>
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
                  <p className="text-[13px] text-slate-400 mt-0.5">Landing page "Current Programs" carousel</p>
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
                <label className={LABEL_CLS}>Details</label>
                <textarea rows={3} value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} className={`${INPUT_CLS} resize-none leading-relaxed`} />
              </div>

              <div>
                <label className={LABEL_CLS}>Form Label</label>
                <input placeholder="e.g. Game Creator Bootcamp (Online)" value={form.form_label} onChange={e => setForm(f => ({ ...f, form_label: e.target.value }))} className={INPUT_CLS} />
                <p className={HINT_CLS}>Sent as context when a visitor clicks "Register Interest" on this card.</p>
              </div>

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
                  <div className="space-y-2 mt-3">
                    {dateOptions.map(d => (
                      <div key={d.id} className="flex items-center gap-2">
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
                    ))}
                  </div>
                )}
              </div>

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
