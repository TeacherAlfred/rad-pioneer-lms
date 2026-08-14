"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Baby, Users2, BookOpen, Plus, X, Trash2,
  Ticket, Package, Receipt, Search, CalendarClock,
} from "lucide-react";
import { formatLabel, ORDER_STATUSES } from "@/lib/programs";

type LeadRef = { id: string; name: string | null; phone: string };
type ProgramRef = { id: string; code: string; name: string };
type SessionRef = { id: string; starts_at: string | null; venue: string | null; status: string; programme_id: string; programs: ProgramRef | null };
type KidRef = { id: string; name: string };

type Bundle = {
  id: string; name: string; description: string | null; price: number; active: boolean;
  bundle_sessions: { id: string; session_id: string; sessions: SessionRef | null }[];
};

type Order = {
  id: string; created_at: string; guardian_lead_id: string; bundle_id: string | null;
  amount_total: number | null; currency: string; status: string; payment_reference: string | null;
  leads: LeadRef | null; bundles: { id: string; name: string } | null;
};

type PassCredit = {
  id: string; status: string; enrolment_id: string | null; redeemed_at: string | null;
  enrolments: { id: string; student_id: string; session_id: string; kids: { id: string; name: string } | null; sessions: SessionRef | null } | null;
};
type Pass = {
  id: string; guardian_lead_id: string; credits_total: number; credits_used: number;
  qualifying_location: string | null; purchased_at: string; expires_at: string; first_session_id: string;
  unused_credit_value: number; leads: LeadRef | null; pass_credits: PassCredit[];
};

const TABS = ['bundles', 'orders', 'passes'] as const;
type Tab = typeof TABS[number];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CommercePage() {
  const [tab, setTab] = useState<Tab>('bundles');
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [leads, setLeads] = useState<LeadRef[]>([]);
  const [sessions, setSessions] = useState<SessionRef[]>([]);
  const [kids, setKids] = useState<KidRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [bRes, oRes, pRes, lRes, sRes, kRes] = await Promise.all([
        fetch('/admin/api/bundles'),
        fetch('/admin/api/orders'),
        fetch('/admin/api/passes'),
        fetch('/admin/api/lead-funnel'),
        fetch('/admin/api/sessions'),
        fetch('/admin/api/kids'),
      ]);
      const [bData, oData, pData, lData, sData, kData] = await Promise.all([bRes, oRes, pRes, lRes, sRes, kRes].map(r => r.json()));
      if (!bRes.ok) throw new Error(bData.error || 'Failed to load bundles');
      setBundles(bData.rows || []);
      setOrders(oData.rows || []);
      setPasses(pData.rows || []);
      setLeads((lData.rows || []).map((r: any) => ({ id: r.id, name: r.name, phone: r.phone })));
      setSessions(sData.rows || []);
      setKids((kData.rows || []).map((r: any) => ({ id: r.id, name: r.name })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
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
            <Link href="/admin/programs" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <BookOpen size={14} /> Programmes
            </Link>
            <Link href="/admin/sessions" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <CalendarClock size={14} /> Upcoming Sessions
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Commerce</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bundles, Orders, and Passes - the purchase layer over Programmes/Sessions. Structure only for now: no payment wiring or automated redemption nudges yet.
          </p>
        </div>

        {error && <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>}

        <div className="flex gap-2 mb-4">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${tab === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            {tab === 'bundles' && <BundlesTab bundles={bundles} sessions={sessions} onChange={load} />}
            {tab === 'orders' && <OrdersTab orders={orders} bundles={bundles} leads={leads} onChange={load} />}
            {tab === 'passes' && <PassesTab passes={passes} leads={leads} sessions={sessions} kids={kids} onChange={load} />}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Bundles ----------------

function BundlesTab({ bundles, sessions, onChange }: { bundles: Bundle[]; sessions: SessionRef[]; onChange: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addingSessionTo, setAddingSessionTo] = useState<string | null>(null);
  const [sessionPick, setSessionPick] = useState('');

  async function save() {
    if (!form.name.trim() || !form.price) {
      setFormError('Name and price are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/admin/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, price: form.price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create bundle');
      onChange();
      setShowAdd(false);
      setForm({ name: '', description: '', price: '' });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this bundle?')) return;
    await fetch('/admin/api/bundles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    onChange();
  }

  async function addSessionToBundle(bundleId: string) {
    if (!sessionPick) return;
    const res = await fetch('/admin/api/bundles/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundleId, sessionId: sessionPick }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to add session'); return; }
    setSessionPick('');
    setAddingSessionTo(null);
    onChange();
  }

  async function removeSessionFromBundle(bundleId: string, sessionId: string) {
    await fetch('/admin/api/bundles/sessions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundleId, sessionId }) });
    onChange();
  }

  return (
    <div>
      <button onClick={() => setShowAdd(true)} className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
        <Plus size={14} /> Add Bundle
      </button>

      <div className="grid md:grid-cols-2 gap-4">
        {bundles.map(b => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Package size={14} className="text-slate-400" /> {b.name}</h3>
                {b.description && <p className="text-xs text-slate-500 mt-1">{b.description}</p>}
                <p className="text-sm font-black text-slate-700 mt-1">R{b.price}</p>
              </div>
              <button onClick={() => remove(b.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
            </div>
            <div className="mt-3 space-y-1">
              {b.bundle_sessions.map(bs => (
                <div key={bs.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                  <span>{bs.sessions?.programs?.code} · {fmtDate(bs.sessions?.starts_at || null)}</span>
                  <button onClick={() => removeSessionFromBundle(b.id, bs.session_id)} className="text-slate-300 hover:text-rose-500"><X size={12} /></button>
                </div>
              ))}
            </div>
            {addingSessionTo === b.id ? (
              <div className="mt-2 flex gap-2">
                <select value={sessionPick} onChange={e => setSessionPick(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none">
                  <option value="">Select session...</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.programs?.code} · {fmtDate(s.starts_at)}</option>)}
                </select>
                <button onClick={() => addSessionToBundle(b.id)} className="text-xs font-black uppercase text-emerald-600">Add</button>
                <button onClick={() => setAddingSessionTo(null)} className="text-xs font-black uppercase text-slate-400">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddingSessionTo(b.id)} className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                <Plus size={10} className="inline -mt-0.5" /> Add session to bundle
              </button>
            )}
          </div>
        ))}
        {bundles.length === 0 && <div className="md:col-span-2 py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No bundles yet.</div>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Add Bundle</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Name, e.g. Polokwane Two-Day" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              <input type="number" min={0} placeholder="Price (ZAR)" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              {formError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{formError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Orders ----------------

function OrdersTab({ orders, bundles, leads, onChange }: { orders: Order[]; bundles: Bundle[]; leads: LeadRef[]; onChange: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [guardianQuery, setGuardianQuery] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const guardianMatches = useMemo(() => {
    const q = guardianQuery.trim().toLowerCase();
    if (!q) return [];
    return leads.filter(l => `${l.name || ''} ${l.phone}`.toLowerCase().includes(q)).slice(0, 6);
  }, [leads, guardianQuery]);

  async function save() {
    if (!guardianId) {
      setFormError('Pick a guardian.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/admin/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianLeadId: guardianId, bundleId: bundleId || null, amount_total: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      onChange();
      setShowAdd(false);
      setGuardianId(''); setGuardianQuery(''); setBundleId(''); setAmount('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/admin/api/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    onChange();
  }

  return (
    <div>
      <button onClick={() => setShowAdd(true)} className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
        <Plus size={14} /> Add Order
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Guardian</th>
              <th className="px-4 py-3">Bundle</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5"><Receipt size={12} className="text-slate-300" />{o.leads?.name || `+${o.leads?.phone}`}</div>
                </td>
                <td className="px-4 py-3 text-slate-500">{o.bundles?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-700 font-bold">{o.amount_total !== null ? `${o.currency} ${o.amount_total}` : '—'}</td>
                <td className="px-4 py-3">
                  <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border border-slate-200 rounded-full px-2 py-1 outline-none">
                    {ORDER_STATUSES.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{o.payment_reference || '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(o.created_at)}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-sm">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Add Order</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Guardian</label>
                {guardianId ? (
                  <div className="flex items-center justify-between bg-purple-50 text-purple-600 rounded-xl px-3 py-2 text-xs">
                    {leads.find(l => l.id === guardianId)?.name || '(selected)'}
                    <button onClick={() => setGuardianId('')}><X size={12} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input placeholder="Search leads..." value={guardianQuery} onChange={e => setGuardianQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-slate-400" />
                    {guardianMatches.length > 0 && (
                      <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                        {guardianMatches.map(l => (
                          <button key={l.id} type="button" onClick={() => { setGuardianId(l.id); setGuardianQuery(''); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            {l.name || '(no name)'} · +{l.phone}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Bundle (optional)</label>
                <select value={bundleId} onChange={e => setBundleId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                  <option value="">None</option>
                  {bundles.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Amount (ZAR)</label>
                <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              </div>
              {formError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{formError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Passes ----------------

function PassesTab({ passes, leads, sessions, kids, onChange }: { passes: Pass[]; leads: LeadRef[]; sessions: SessionRef[]; kids: KidRef[]; onChange: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [guardianQuery, setGuardianQuery] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [creditsTotal, setCreditsTotal] = useState('3');
  const [qualifyingLocation, setQualifyingLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const guardianMatches = useMemo(() => {
    const q = guardianQuery.trim().toLowerCase();
    if (!q) return [];
    return leads.filter(l => `${l.name || ''} ${l.phone}`.toLowerCase().includes(q)).slice(0, 6);
  }, [leads, guardianQuery]);

  async function save() {
    if (!guardianId || !studentId || !sessionId) {
      setFormError('Guardian, student, and first session are all required - the first session is booked at purchase.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/admin/api/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardianLeadId: guardianId, firstStudentId: studentId, firstSessionId: sessionId,
          creditsTotal, qualifyingLocation: qualifyingLocation || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create pass');
      onChange();
      setShowAdd(false);
      setGuardianId(''); setGuardianQuery(''); setStudentId(''); setSessionId(''); setCreditsTotal('3'); setQualifyingLocation('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Redeem an unredeemed credit ---
  const [redeeming, setRedeeming] = useState<{ passId: string; creditId: string } | null>(null);
  const [redeemStudentId, setRedeemStudentId] = useState('');
  const [redeemSessionId, setRedeemSessionId] = useState('');
  const [redeemSaving, setRedeemSaving] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  function openRedeem(passId: string, creditId: string) {
    setRedeeming({ passId, creditId });
    setRedeemStudentId('');
    setRedeemSessionId('');
    setRedeemError(null);
  }

  async function redeem() {
    if (!redeeming || !redeemStudentId || !redeemSessionId) {
      setRedeemError('Pick who this credit is for and which session.');
      return;
    }
    setRedeemSaving(true);
    setRedeemError(null);
    try {
      const res = await fetch('/admin/api/passes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passId: redeeming.passId, redeemCreditId: redeeming.creditId,
          studentId: redeemStudentId, sessionId: redeemSessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to redeem credit');
      onChange();
      setRedeeming(null);
    } catch (err: any) {
      setRedeemError(err.message);
    } finally {
      setRedeemSaving(false);
    }
  }

  return (
    <div>
      <button onClick={() => setShowAdd(true)} className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
        <Plus size={14} /> Add Pass
      </button>

      <div className="grid md:grid-cols-2 gap-4">
        {passes.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <Ticket size={14} className="text-slate-400" />
              <h3 className="font-bold text-slate-800">{p.leads?.name || `+${p.leads?.phone}`}</h3>
            </div>
            <p className="text-sm text-slate-600 mt-1">{p.credits_used}/{p.credits_total} credits used</p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
              {p.qualifying_location && <span>{p.qualifying_location}</span>}
              <span>Expires {fmtDate(p.expires_at)}</span>
            </div>
            <div className="mt-2 space-y-1">
              {p.pass_credits.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  {c.status === 'redeemed' ? (
                    <span className="flex items-center gap-1.5 text-slate-500 truncate">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">Redeemed</span>
                      <span className="truncate">
                        {c.enrolments?.kids?.name || '?'} · {c.enrolments?.sessions?.programs?.code} {fmtDate(c.enrolments?.sessions?.starts_at || null)}
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Unredeemed</span>
                      <button
                        onClick={() => openRedeem(p.id, c.id)}
                        className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700"
                      >
                        Redeem →
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {passes.length === 0 && <div className="md:col-span-2 py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No passes yet.</div>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Add Pass</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Guardian (payer)</label>
                {guardianId ? (
                  <div className="flex items-center justify-between bg-purple-50 text-purple-600 rounded-xl px-3 py-2 text-xs">
                    {leads.find(l => l.id === guardianId)?.name || '(selected)'}
                    <button onClick={() => setGuardianId('')}><X size={12} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input placeholder="Search leads..." value={guardianQuery} onChange={e => setGuardianQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-slate-400" />
                    {guardianMatches.length > 0 && (
                      <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                        {guardianMatches.map(l => (
                          <button key={l.id} type="button" onClick={() => { setGuardianId(l.id); setGuardianQuery(''); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            {l.name || '(no name)'} · +{l.phone}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">First Credit's Student</label>
                <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                  <option value="">Select kid...</option>
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">First Session (required at purchase)</label>
                <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                  <option value="">Select session...</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.programs?.code} · {fmtDate(s.starts_at)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Credits</label>
                  <input type="number" min={1} value={creditsTotal} onChange={e => setCreditsTotal(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Qualifying Location</label>
                  <input placeholder="e.g. Pretoria" value={qualifyingLocation} onChange={e => setQualifyingLocation(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              {formError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{formError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {redeeming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">Redeem Credit</h3>
              <button onClick={() => setRedeeming(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              If the student is already enrolled on the session you pick, this attaches the credit to that existing enrolment instead of creating a second one - they won't be double-counted on the roster.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Student</label>
                <select value={redeemStudentId} onChange={e => setRedeemStudentId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                  <option value="">Select kid...</option>
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Session</label>
                <select value={redeemSessionId} onChange={e => setRedeemSessionId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400">
                  <option value="">Select session...</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.programs?.code} · {fmtDate(s.starts_at)}</option>)}
                </select>
              </div>
              {redeemError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{redeemError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setRedeeming(null)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
                <button onClick={redeem} disabled={redeemSaving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">
                  {redeemSaving ? 'Redeeming...' : 'Redeem'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
