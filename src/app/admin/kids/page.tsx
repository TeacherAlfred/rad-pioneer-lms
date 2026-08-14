"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2, ArrowLeft, Baby, Users2, Phone, GraduationCap, Search, X, Plus,
  Trash2, Pencil, BookOpen, Link as LinkIcon,
} from "lucide-react";
import { formatLabel, ENROLLMENT_STATUSES } from "@/lib/programs";

type LeadRef = { id: string; name: string | null; phone: string };
type Guardian = { id: string; relationship: string | null; lead_id: string; leads: LeadRef | null };
type ProgramRef = { id: string; name: string; type: string };
type Enrollment = { id: string; status: string; notes: string | null; program_id: string; programs: ProgramRef | null };

type Kid = {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: string | null;
  created_at: string | null;
  kid_guardians: Guardian[];
  program_enrollments: Enrollment[];
};

type LeadOption = { id: string; name: string | null; phone: string };
type ProgramOption = { id: string; name: string; type: string; status: string };

const ENROLLMENT_STATUS_STYLES: Record<string, string> = {
  interested: 'bg-slate-100 text-slate-500',
  registered: 'bg-blue-50 text-blue-600',
  active: 'bg-emerald-50 text-emerald-600',
  completed: 'bg-purple-50 text-purple-600',
  withdrawn: 'bg-rose-50 text-rose-500',
};

const emptyForm = { name: '', age: '', grade: '', phone: '', email: '', notes: '' };

export default function KidsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}>
      <KidsPageInner />
    </Suspense>
  );
}

function KidsPageInner() {
  const searchParams = useSearchParams();
  const leadIdFilter = searchParams.get('leadId');

  const [kids, setKids] = useState<Kid[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const kidsUrl = leadIdFilter ? `/admin/api/kids?leadId=${encodeURIComponent(leadIdFilter)}` : '/admin/api/kids';
      const [kidsRes, leadsRes, programsRes] = await Promise.all([
        fetch(kidsUrl),
        fetch('/admin/api/lead-funnel'),
        fetch('/admin/api/programs'),
      ]);
      const kidsData = await kidsRes.json();
      if (!kidsRes.ok) throw new Error(kidsData.error || 'Failed to load kids');
      const leadsData = await leadsRes.json();
      const programsData = await programsRes.json();
      setKids(kidsData.rows || []);
      setLeads((leadsData.rows || []).map((r: any) => ({ id: r.id, name: r.name, phone: r.phone })));
      setPrograms(programsData.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [leadIdFilter]);

  const filteredKids = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return kids;
    return kids.filter(k => {
      const guardianNames = k.kid_guardians.map(g => `${g.leads?.name || ''} ${g.leads?.phone || ''}`).join(' ');
      const haystack = `${k.name} ${k.grade || ''} ${k.phone || ''} ${k.email || ''} ${guardianNames}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [kids, search]);

  const stats = useMemo(() => {
    const total = kids.length;
    const withOwnContact = kids.filter(k => k.phone || k.email).length;
    const linkedToGuardian = kids.filter(k => k.kid_guardians.length > 0).length;
    const enrolled = kids.filter(k => k.program_enrollments.some(e => e.status === 'active' || e.status === 'registered')).length;
    return { total, withOwnContact, linkedToGuardian, enrolled };
  }, [kids]);

  // --- Add / Edit kid modal ---
  const [showKidModal, setShowKidModal] = useState(false);
  const [editingKid, setEditingKid] = useState<Kid | null>(null);
  const [kidForm, setKidForm] = useState(emptyForm);
  const [kidSaving, setKidSaving] = useState(false);
  const [kidError, setKidError] = useState<string | null>(null);
  const [pendingGuardianIds, setPendingGuardianIds] = useState<Set<string>>(new Set());

  function openAddKid() {
    setEditingKid(null);
    setKidForm(emptyForm);
    setKidError(null);
    setPendingGuardianIds(leadIdFilter ? new Set([leadIdFilter]) : new Set());
    setShowKidModal(true);
  }

  function openEditKid(kid: Kid) {
    setEditingKid(kid);
    setKidForm({
      name: kid.name,
      age: kid.age === null ? '' : String(kid.age),
      grade: kid.grade || '',
      phone: kid.phone || '',
      email: kid.email || '',
      notes: kid.notes || '',
    });
    setKidError(null);
    setPendingGuardianIds(new Set());
    setShowKidModal(true);
  }

  function closeKidModal() {
    setShowKidModal(false);
    setEditingKid(null);
    setKidError(null);
  }

  async function saveKid() {
    if (!kidForm.name.trim()) {
      setKidError('Name is required.');
      return;
    }
    setKidSaving(true);
    setKidError(null);
    try {
      if (editingKid) {
        const res = await fetch('/admin/api/kids', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingKid.id,
            name: kidForm.name.trim(),
            age: kidForm.age,
            grade: kidForm.grade.trim(),
            phone: kidForm.phone.trim(),
            email: kidForm.email.trim(),
            notes: kidForm.notes.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
      } else {
        const res = await fetch('/admin/api/kids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: kidForm.name.trim(),
            age: kidForm.age,
            grade: kidForm.grade.trim(),
            phone: kidForm.phone.trim(),
            email: kidForm.email.trim(),
            notes: kidForm.notes.trim(),
            leadIds: Array.from(pendingGuardianIds),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create');
      }
      await loadAll();
      closeKidModal();
    } catch (err: any) {
      setKidError(err.message);
    } finally {
      setKidSaving(false);
    }
  }

  async function deleteKid(kid: Kid) {
    if (!confirm(`Delete ${kid.name}? This also removes their guardian links and enrollments.`)) return;
    await fetch('/admin/api/kids', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kid.id }),
    });
    await loadAll();
  }

  async function addGuardian(kidId: string, leadId: string) {
    const res = await fetch('/admin/api/kids/guardians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kidId, leadId }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to link guardian'); return; }
    await loadAll();
  }

  async function removeGuardian(kidId: string, leadId: string) {
    await fetch('/admin/api/kids/guardians', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kidId, leadId }),
    });
    await loadAll();
  }

  // --- Enrollment modal ---
  const [enrollingKid, setEnrollingKid] = useState<Kid | null>(null);
  const [enrollProgramId, setEnrollProgramId] = useState('');
  const [enrollSaving, setEnrollSaving] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  function openEnroll(kid: Kid) {
    setEnrollingKid(kid);
    setEnrollProgramId('');
    setEnrollError(null);
  }

  async function addEnrollment() {
    if (!enrollingKid || !enrollProgramId) return;
    setEnrollSaving(true);
    setEnrollError(null);
    try {
      const res = await fetch('/admin/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kidId: enrollingKid.id, programId: enrollProgramId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enroll');
      await loadAll();
      setEnrollingKid(null);
    } catch (err: any) {
      setEnrollError(err.message);
    } finally {
      setEnrollSaving(false);
    }
  }

  async function updateEnrollmentStatus(enrollmentId: string, status: string) {
    await fetch('/admin/api/enrollments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: enrollmentId, status }),
    });
    await loadAll();
  }

  async function removeEnrollment(enrollmentId: string) {
    await fetch('/admin/api/enrollments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: enrollmentId }),
    });
    await loadAll();
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
            <Link href="/admin/programs" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <BookOpen size={14} /> Programs
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kids</h1>
          <p className="text-sm text-slate-500 mt-1">
            Registered students, linked to their parent/parents in the lead funnel - independent of the older profiles/courses pipeline.
            {leadIdFilter && (
              <> Showing kids linked to one lead only - <Link href="/admin/kids" className="underline">clear filter</Link>.</>
            )}
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard icon={Baby} label="Total Kids" value={stats.total} />
              <StatCard icon={Users2} label="Linked to a Guardian" value={stats.linkedToGuardian} />
              <StatCard icon={Phone} label="Own Contact Info" value={stats.withOwnContact} accent="text-indigo-600" />
              <StatCard icon={GraduationCap} label="Enrolled" value={stats.enrolled} accent="text-emerald-600" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  placeholder="Search kid name, grade, guardian..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <button onClick={openAddKid} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
                <Plus size={14} /> Add Kid
              </button>
              <span className="text-xs text-slate-400 ml-auto">{filteredKids.length} of {kids.length}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3">Kid</th>
                      <th className="px-4 py-3">Age / Grade</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Guardians</th>
                      <th className="px-4 py-3">Enrollments</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKids.map(kid => (
                      <tr key={kid.id} className="border-b border-slate-50 last:border-0 align-top hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="font-bold text-slate-800">{kid.name}</div>
                            <button onClick={() => openEditKid(kid)} title="Edit" className="text-slate-300 hover:text-slate-600">
                              <Pencil size={11} />
                            </button>
                          </div>
                          {kid.notes && <div className="text-[11px] text-slate-400 mt-0.5 max-w-[180px]">{kid.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {kid.age ? `${kid.age} yrs` : '—'}{kid.grade ? ` · ${kid.grade}` : ''}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {kid.phone || kid.email ? (
                            <>
                              {kid.phone && <div>+{kid.phone}</div>}
                              {kid.email && <div>{kid.email}</div>}
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {kid.kid_guardians.map(g => (
                              <span key={g.id} className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full w-fit">
                                {g.leads?.name || `+${g.leads?.phone}`}
                                <button onClick={() => removeGuardian(kid.id, g.lead_id)} title="Unlink guardian" className="hover:text-rose-500">
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                            {kid.kid_guardians.length === 0 && <span className="text-xs text-slate-300">None linked</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {kid.program_enrollments.map(e => (
                              <div key={e.id} className="flex items-center gap-1">
                                <select
                                  value={e.status}
                                  onChange={ev => updateEnrollmentStatus(e.id, ev.target.value)}
                                  className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-0 outline-none ${ENROLLMENT_STATUS_STYLES[e.status] || 'bg-slate-100 text-slate-500'}`}
                                >
                                  {ENROLLMENT_STATUSES.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                                </select>
                                <span className="text-xs text-slate-500 truncate max-w-[100px]" title={e.programs?.name}>{e.programs?.name}</span>
                                <button onClick={() => removeEnrollment(e.id)} title="Remove enrollment" className="text-slate-300 hover:text-rose-500">
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            <button onClick={() => openEnroll(kid)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 w-fit">
                              <Plus size={10} /> Enroll
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteKid(kid)} title="Delete kid" className="text-slate-300 hover:text-rose-500">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredKids.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-sm">No kids match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {showKidModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">{editingKid ? 'Edit Kid' : 'Add Kid'}</h3>
              <button onClick={closeKidModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Name</label>
                <input value={kidForm.name} onChange={e => setKidForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Age</label>
                  <input type="number" min={0} value={kidForm.age} onChange={e => setKidForm(f => ({ ...f, age: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Grade</label>
                  <input placeholder="e.g. Grade 4" value={kidForm.grade} onChange={e => setKidForm(f => ({ ...f, grade: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-1">Phone/email below are optional - only fill in if this kid has their own contact details on file.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Phone</label>
                  <input value={kidForm.phone} onChange={e => setKidForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email</label>
                  <input value={kidForm.email} onChange={e => setKidForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</label>
                <textarea value={kidForm.notes} onChange={e => setKidForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>

              {editingKid ? (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Guardians</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editingKid.kid_guardians.map(g => (
                      <span key={g.id} className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                        {g.leads?.name || `+${g.leads?.phone}`}
                        <button onClick={() => removeGuardian(editingKid.id, g.lead_id)} className="hover:text-rose-500"><X size={10} /></button>
                      </span>
                    ))}
                    {editingKid.kid_guardians.length === 0 && <span className="text-xs text-slate-300">None linked yet</span>}
                  </div>
                  <GuardianPicker leads={leads} exclude={new Set(editingKid.kid_guardians.map(g => g.lead_id))} onPick={leadId => addGuardian(editingKid.id, leadId)} />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Link Guardian(s)</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Array.from(pendingGuardianIds).map(id => {
                      const lead = leads.find(l => l.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                          {lead?.name || `+${lead?.phone}`}
                          <button onClick={() => setPendingGuardianIds(prev => { const next = new Set(prev); next.delete(id); return next; })} className="hover:text-rose-500"><X size={10} /></button>
                        </span>
                      );
                    })}
                  </div>
                  <GuardianPicker leads={leads} exclude={pendingGuardianIds} onPick={leadId => setPendingGuardianIds(prev => new Set(prev).add(leadId))} />
                </div>
              )}

              {kidError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{kidError}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={closeKidModal} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                <button onClick={saveKid} disabled={kidSaving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                  {kidSaving ? 'Saving...' : editingKid ? 'Save Changes' : 'Add Kid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {enrollingKid && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Enroll {enrollingKid.name}</h3>
              <button onClick={() => setEnrollingKid(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <select value={enrollProgramId} onChange={e => setEnrollProgramId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400 mb-3">
              <option value="">Select a program...</option>
              {programs.filter(p => p.status === 'active').map(p => (
                <option key={p.id} value={p.id}>{p.name} ({formatLabel(p.type)})</option>
              ))}
            </select>
            {programs.length === 0 && (
              <p className="text-xs text-slate-400 mb-3">No programs yet - <Link href="/admin/programs" className="underline">create one first</Link>.</p>
            )}
            {enrollError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3 mb-3">{enrollError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setEnrollingKid(null)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
              <button onClick={addEnrollment} disabled={enrollSaving || !enrollProgramId} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                {enrollSaving ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GuardianPicker({ leads, exclude, onPick }: { leads: LeadOption[]; exclude: Set<string>; onPick: (leadId: string) => void }) {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return leads.filter(l => !exclude.has(l.id) && `${l.name || ''} ${l.phone}`.toLowerCase().includes(query)).slice(0, 6);
  }, [leads, exclude, q]);

  return (
    <div className="relative">
      <div className="relative">
        <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          placeholder="Search leads by name or phone..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-slate-400"
        />
      </div>
      {matches.length > 0 && (
        <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
          {matches.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => { onPick(l.id); setQ(''); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0"
            >
              {l.name || '(no name)'} · +{l.phone}
            </button>
          ))}
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
