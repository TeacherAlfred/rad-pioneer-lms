"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Baby, ShoppingBag, Plus, X, Pencil, Trash2, Users2,
  Calendar, MapPin, CalendarClock, Layers,
} from "lucide-react";
import { formatLabel, PROGRAM_TYPES, AUDIENCES, PROGRAM_LEVELS, SESSION_STATUSES } from "@/lib/programs";

type PrereqRef = { id: string; code: string; name: string } | null;

type Programme = {
  id: string;
  code: string;
  name: string;
  type: string;
  audience: string;
  level: string | null;
  sequence: number | null;
  version: number;
  age_min: number | null;
  age_max: number | null;
  duration_hours: number | null;
  prerequisite_programme_id: string | null;
  prerequisite: PrereqRef;
  description_short: string | null;
  description_long: string | null;
  includes: string[] | null;
  active: boolean;
  session_count: number;
};

type Session = {
  id: string;
  programme_id: string;
  parent_session_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sales_open_at: string | null;
  sales_close_at: string | null;
  early_bird_ends_at: string | null;
  venue: string | null;
  capacity: number | null;
  min_viable_enrolments: number | null;
  go_no_go_at: string | null;
  status: string;
  price: number | null;
  currency: string;
  notes: string | null;
  programs: { id: string; code: string; name: string } | null;
  enrolment_count: number;
};

const LABEL_CLS = "block text-[13px] font-medium text-slate-700 mb-1.5";
const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";
const HINT_CLS = "text-[12px] text-slate-400 mt-1.5 leading-relaxed";

const PROG_TABS = ['basics', 'details', 'content'] as const;
type ProgTab = typeof PROG_TABS[number];
const PROG_TAB_LABELS: Record<ProgTab, string> = { basics: 'Basics', details: 'Details', content: 'Content' };

const emptyProgrammeForm = {
  code: '', name: '', type: 'workshop', audience: 'student', level: '', sequence: '', version: '1',
  age_min: '', age_max: '', duration_hours: '', prerequisite_programme_id: '',
  description_short: '', description_long: '', includes: '', active: true,
};

const emptySessionForm = {
  starts_at: '', ends_at: '', sales_open_at: '', sales_close_at: '', venue: '',
  capacity: '', min_viable_enrolments: '', go_no_go_at: '', status: 'draft', price: '', notes: '',
};

const TYPE_STYLES: Record<string, string> = {
  workshop: 'bg-blue-50 text-blue-600',
  term_course: 'bg-emerald-50 text-emerald-600',
  webinar: 'bg-amber-50 text-amber-600',
  holiday_programme: 'bg-purple-50 text-purple-600',
  competition: 'bg-rose-50 text-rose-600',
  year_end: 'bg-indigo-50 text-indigo-600',
  b2b_training: 'bg-slate-100 text-slate-500',
  b2b_school: 'bg-slate-100 text-slate-500',
  private: 'bg-slate-100 text-slate-500',
};

const SESSION_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  selling: 'bg-blue-50 text-blue-600',
  confirmed: 'bg-emerald-50 text-emerald-600',
  delivered: 'bg-purple-50 text-purple-600',
  cancelled: 'bg-rose-50 text-rose-500',
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ProgramsPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [progRes, sessRes] = await Promise.all([
        fetch('/admin/api/programs'),
        fetch('/admin/api/sessions'),
      ]);
      const progData = await progRes.json();
      if (!progRes.ok) throw new Error(progData.error || 'Failed to load programmes');
      const sessData = await sessRes.json();
      setProgrammes(progData.rows || []);
      setSessions(sessData.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programmes.filter(p => {
      if (!showInactive && !p.active) return false;
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (q && !`${p.code} ${p.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [programmes, search, typeFilter, showInactive]);

  const stats = useMemo(() => {
    const total = programmes.length;
    const active = programmes.filter(p => p.active).length;
    const upcoming = sessions.filter(s => s.starts_at && new Date(s.starts_at) > new Date() && s.status !== 'cancelled').length;
    const totalSessions = sessions.length;
    return { total, active, upcoming, totalSessions };
  }, [programmes, sessions]);

  // --- Programme add/edit modal ---
  const [showProgModal, setShowProgModal] = useState(false);
  const [editingProg, setEditingProg] = useState<Programme | null>(null);
  const [progForm, setProgForm] = useState(emptyProgrammeForm);
  const [progSaving, setProgSaving] = useState(false);
  const [progError, setProgError] = useState<string | null>(null);
  const [progTab, setProgTab] = useState<ProgTab>('basics');

  function openAddProg() {
    setEditingProg(null);
    setProgForm(emptyProgrammeForm);
    setProgError(null);
    setProgTab('basics');
    setShowProgModal(true);
  }

  function openEditProg(p: Programme) {
    setEditingProg(p);
    setProgForm({
      code: p.code,
      name: p.name,
      type: p.type,
      audience: p.audience,
      level: p.level || '',
      sequence: p.sequence === null ? '' : String(p.sequence),
      version: String(p.version),
      age_min: p.age_min === null ? '' : String(p.age_min),
      age_max: p.age_max === null ? '' : String(p.age_max),
      duration_hours: p.duration_hours === null ? '' : String(p.duration_hours),
      prerequisite_programme_id: p.prerequisite_programme_id || '',
      description_short: p.description_short || '',
      description_long: p.description_long || '',
      includes: (p.includes || []).join(', '),
      active: p.active,
    });
    setProgError(null);
    setProgTab('basics');
    setShowProgModal(true);
  }

  async function saveProgramme() {
    if (!progForm.code.trim() || !progForm.name.trim()) {
      setProgError('Code and name are required.');
      return;
    }
    setProgSaving(true);
    setProgError(null);
    try {
      const payload = {
        code: progForm.code.trim(),
        name: progForm.name.trim(),
        type: progForm.type,
        audience: progForm.audience,
        level: progForm.level || null,
        sequence: progForm.sequence,
        version: progForm.version,
        age_min: progForm.age_min,
        age_max: progForm.age_max,
        duration_hours: progForm.duration_hours,
        prerequisite_programme_id: progForm.prerequisite_programme_id || null,
        description_short: progForm.description_short.trim() || null,
        description_long: progForm.description_long.trim() || null,
        includes: progForm.includes.split(',').map(s => s.trim()).filter(Boolean),
        active: progForm.active,
      };
      const res = await fetch('/admin/api/programs', {
        method: editingProg ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProg ? { id: editingProg.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      await load();
      setShowProgModal(false);
    } catch (err: any) {
      setProgError(err.message);
    } finally {
      setProgSaving(false);
    }
  }

  async function deleteProgramme(p: Programme) {
    const warning = p.session_count > 0
      ? `Delete "${p.name}"? This also removes ${p.session_count} session${p.session_count === 1 ? '' : 's'} and every enrolment under them.`
      : `Delete "${p.name}"?`;
    if (!confirm(warning)) return;
    await fetch('/admin/api/programs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    });
    await load();
  }

  // --- Session manager modal (per programme) ---
  const [managingProg, setManagingProg] = useState<Programme | null>(null);
  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  function openSessions(p: Programme) {
    setManagingProg(p);
    setSessionForm(emptySessionForm);
    setSessionError(null);
  }

  const sessionsForManaging = useMemo(
    () => managingProg ? sessions.filter(s => s.programme_id === managingProg.id).sort((a, b) => (a.starts_at || '').localeCompare(b.starts_at || '')) : [],
    [sessions, managingProg]
  );

  async function addSession() {
    if (!managingProg) return;
    setSessionSaving(true);
    setSessionError(null);
    try {
      const res = await fetch('/admin/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programmeId: managingProg.id,
          starts_at: sessionForm.starts_at || null,
          ends_at: sessionForm.ends_at || null,
          sales_open_at: sessionForm.sales_open_at || null,
          sales_close_at: sessionForm.sales_close_at || null,
          venue: sessionForm.venue.trim() || null,
          capacity: sessionForm.capacity,
          min_viable_enrolments: sessionForm.min_viable_enrolments,
          go_no_go_at: sessionForm.go_no_go_at || null,
          status: sessionForm.status,
          price: sessionForm.price,
          notes: sessionForm.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add session');
      await load();
      setSessionForm(emptySessionForm);
    } catch (err: any) {
      setSessionError(err.message);
    } finally {
      setSessionSaving(false);
    }
  }

  async function updateSessionStatus(id: string, status: string) {
    await fetch('/admin/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  async function deleteSession(s: Session) {
    const warning = s.enrolment_count > 0
      ? `Delete this session? ${s.enrolment_count} student${s.enrolment_count === 1 ? '' : 's'} enrolled on it will lose that enrolment.`
      : 'Delete this session?';
    if (!confirm(warning)) return;
    await fetch('/admin/api/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id }),
    });
    await load();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Command Center
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Users2 size={14} /> Lead Funnel
            </Link>
            <Link href="/admin/kids" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <Baby size={14} /> Kids
            </Link>
            <Link href="/admin/commerce" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <ShoppingBag size={14} /> Commerce
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Programmes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Curriculum only - never dated or priced. Each card's <b>Sessions</b> button manages the dated, priced, staffed deliveries of it.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard icon={Layers} label="Programmes" value={stats.total} />
              <StatCard icon={Layers} label="Active" value={stats.active} accent="text-emerald-600" />
              <StatCard icon={Calendar} label="Sessions Scheduled" value={stats.totalSessions} accent="text-indigo-600" />
              <StatCard icon={CalendarClock} label="Upcoming" value={stats.upcoming} accent="text-blue-600" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <input
                placeholder="Search code or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="all">All types</option>
                {PROGRAM_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive
              </label>
              <button onClick={openAddProg} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 ml-auto">
                <Plus size={14} /> Add Programme
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {filtered.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-slate-400">{p.code}</span>
                        <h3 className="font-bold text-slate-800">{p.name}</h3>
                        {!p.active && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Inactive</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${TYPE_STYLES[p.type] || 'bg-slate-100 text-slate-500'}`}>{formatLabel(p.type)}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">{formatLabel(p.audience)}</span>
                        {p.level && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">{p.level}</span>}
                      </div>
                      {p.description_short && <p className="text-xs text-slate-500 mt-2">{p.description_short}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
                        {(p.age_min || p.age_max) && <span>Ages {p.age_min ?? '?'}–{p.age_max ?? '?'}</span>}
                        {p.duration_hours && <span>{p.duration_hours}h</span>}
                        {p.prerequisite && <span>Requires {p.prerequisite.code}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openEditProg(p)} title="Edit" className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                      <button onClick={() => deleteProgramme(p)} title="Delete" className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <button
                    onClick={() => openSessions(p)}
                    className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg w-fit"
                  >
                    <Calendar size={12} /> Sessions ({p.session_count})
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="md:col-span-2 py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                  No programmes match these filters.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showProgModal && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-8 pt-7 pb-1 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Layers size={19} />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-slate-900 tracking-tight leading-tight">
                    {editingProg ? 'Edit Programme' : 'New Programme'}
                  </h3>
                  <p className="text-[13px] text-slate-400 mt-0.5">
                    {editingProg ? `${editingProg.code} · ${editingProg.name}` : 'Curriculum only — dates and pricing live on Sessions'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProgModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors duration-150 shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-8 pt-5 pb-1 shrink-0">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-0.5">
                {PROG_TABS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setProgTab(t)}
                    className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      progTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {PROG_TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-8 py-6">
              {progTab === 'basics' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_CLS}>Code</label>
                      <input placeholder="e.g. ROB-101" value={progForm.code} onChange={e => setProgForm(f => ({ ...f, code: e.target.value }))} className={`${INPUT_CLS} font-mono`} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Name</label>
                      <input placeholder="e.g. Robotics for a Sporty World" value={progForm.name} onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_CLS}>Type</label>
                      <select value={progForm.type} onChange={e => setProgForm(f => ({ ...f, type: e.target.value }))} className={INPUT_CLS}>
                        {PROGRAM_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Audience</label>
                      <select value={progForm.audience} onChange={e => setProgForm(f => ({ ...f, audience: e.target.value }))} className={INPUT_CLS}>
                        {AUDIENCES.map(a => <option key={a} value={a}>{formatLabel(a)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 pb-0.5">
                    <div>
                      <div className="text-[14px] font-medium text-slate-800">Active</div>
                      <div className="text-[12px] text-slate-400">Inactive programmes stay in the catalogue but stop showing as options elsewhere.</div>
                    </div>
                    <Toggle checked={progForm.active} onChange={v => setProgForm(f => ({ ...f, active: v }))} />
                  </div>
                </div>
              )}

              {progTab === 'details' && (
                <div className="space-y-6">
                  <div>
                    <label className={LABEL_CLS}>Level</label>
                    <select value={progForm.level} onChange={e => setProgForm(f => ({ ...f, level: e.target.value }))} className={INPUT_CLS}>
                      <option value="">Not leveled</option>
                      {PROGRAM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={LABEL_CLS}>Age Min</label>
                      <input type="number" min={0} value={progForm.age_min} onChange={e => setProgForm(f => ({ ...f, age_min: e.target.value }))} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Age Max</label>
                      <input type="number" min={0} value={progForm.age_max} onChange={e => setProgForm(f => ({ ...f, age_max: e.target.value }))} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Duration (h)</label>
                      <input type="number" step="0.5" min={0} value={progForm.duration_hours} onChange={e => setProgForm(f => ({ ...f, duration_hours: e.target.value }))} className={INPUT_CLS} />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Prerequisite Programme</label>
                    <select value={progForm.prerequisite_programme_id} onChange={e => setProgForm(f => ({ ...f, prerequisite_programme_id: e.target.value }))} className={INPUT_CLS}>
                      <option value="">None</option>
                      {programmes.filter(p => p.id !== editingProg?.id).map(p => (
                        <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <p className="text-[12px] font-medium text-slate-400 pt-4 pb-1">Curriculum ordering</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL_CLS}>Sequence</label>
                        <input type="number" min={0} value={progForm.sequence} onChange={e => setProgForm(f => ({ ...f, sequence: e.target.value }))} className={INPUT_CLS} />
                        <p className={HINT_CLS}>Where this sits within its level, for "what's next" recommendations.</p>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Version</label>
                        <input type="number" min={1} value={progForm.version} onChange={e => setProgForm(f => ({ ...f, version: e.target.value }))} className={INPUT_CLS} />
                        <p className={HINT_CLS}>Bump this for minor content changes; a new code for substantive ones.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {progTab === 'content' && (
                <div className="space-y-5">
                  <div>
                    <label className={LABEL_CLS}>Short Description</label>
                    <input placeholder="One line, benefit-led" value={progForm.description_short} onChange={e => setProgForm(f => ({ ...f, description_short: e.target.value }))} className={INPUT_CLS} />
                    <p className={HINT_CLS}>Shown on the programme card and anywhere space is tight.</p>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Long Description</label>
                    <textarea value={progForm.description_long} onChange={e => setProgForm(f => ({ ...f, description_long: e.target.value }))} rows={5} className={`${INPUT_CLS} resize-none leading-relaxed`} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Includes</label>
                    <input placeholder="e.g. Take-home kit, Certificate, 1-month licence" value={progForm.includes} onChange={e => setProgForm(f => ({ ...f, includes: e.target.value }))} className={INPUT_CLS} />
                    <p className={HINT_CLS}>Comma-separated - each becomes its own line item where this programme is shown.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-100 px-8 py-5">
              {progError && <div className="mb-3 bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{progError}</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowProgModal(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">
                  Cancel
                </button>
                <button
                  onClick={saveProgramme}
                  disabled={progSaving}
                  className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 shadow-sm"
                >
                  {progSaving ? 'Saving…' : editingProg ? 'Save Changes' : 'Add Programme'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {managingProg && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Sessions - {managingProg.code} {managingProg.name}</h3>
              <button onClick={() => setManagingProg(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-2 mb-4">
              {sessionsForManaging.map(s => (
                <div key={s.id} className="border border-slate-100 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-700">{fmtDate(s.starts_at) || 'No date set'}</span>
                      {s.ends_at && <span className="text-slate-400">→ {fmtDate(s.ends_at)}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                      {s.venue && <span className="flex items-center gap-1"><MapPin size={11} /> {s.venue}</span>}
                      {s.capacity && <span>{s.enrolment_count}/{s.capacity} seats</span>}
                      {s.price !== null && <span>{s.currency} {s.price}</span>}
                      {s.sales_close_at && <span>Sales close {fmtDate(s.sales_close_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={s.status}
                      onChange={e => updateSessionStatus(s.id, e.target.value)}
                      className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border-0 outline-none ${SESSION_STATUS_STYLES[s.status] || 'bg-slate-100 text-slate-500'}`}
                    >
                      {SESSION_STATUSES.map(st => <option key={st} value={st}>{formatLabel(st)}</option>)}
                    </select>
                    <button onClick={() => deleteSession(s)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {sessionsForManaging.length === 0 && <p className="text-xs text-slate-400">No sessions yet for this programme.</p>}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Add Session</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Starts</label>
                  <input type="datetime-local" value={sessionForm.starts_at} onChange={e => setSessionForm(f => ({ ...f, starts_at: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ends</label>
                  <input type="datetime-local" value={sessionForm.ends_at} onChange={e => setSessionForm(f => ({ ...f, ends_at: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sales Close</label>
                  <input type="datetime-local" value={sessionForm.sales_close_at} onChange={e => setSessionForm(f => ({ ...f, sales_close_at: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Must be ≥48h before start - a later booking can't complete the deposit flow.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Venue</label>
                  <input value={sessionForm.venue} onChange={e => setSessionForm(f => ({ ...f, venue: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Capacity</label>
                  <input type="number" min={0} value={sessionForm.capacity} onChange={e => setSessionForm(f => ({ ...f, capacity: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Price (ZAR)</label>
                  <input type="number" min={0} value={sessionForm.price} onChange={e => setSessionForm(f => ({ ...f, price: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Min Viable Enrolments</label>
                  <input type="number" min={0} value={sessionForm.min_viable_enrolments} onChange={e => setSessionForm(f => ({ ...f, min_viable_enrolments: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</label>
                  <select value={sessionForm.status} onChange={e => setSessionForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-400">
                    {SESSION_STATUSES.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                  </select>
                </div>
              </div>
              {sessionError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3 mb-3">{sessionError}</div>}
              <button onClick={addSession} disabled={sessionSaving} className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                {sessionSaving ? 'Adding...' : 'Add Session'}
              </button>
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

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <Icon size={16} className={accent || 'text-slate-400'} />
      <div className={`text-2xl font-black mt-2 ${accent || 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
