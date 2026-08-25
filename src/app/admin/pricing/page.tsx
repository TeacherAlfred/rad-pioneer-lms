"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, DollarSign, Plus, X, Pencil, Trash2, Boxes, Package, Check } from "lucide-react";
import { computeCostRollup, computeRecommendedFee } from "@/lib/pricingEngine";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  cost_type: string;
  unit_cost: number;
  unit_label: string | null;
  active: boolean;
  notes: string | null;
};

type PackageItem = {
  id: string;
  package_id: string;
  inventory_item_id: string;
  quantity_type: 'per_child' | 'flat';
  quantity_override: number | null;
  inventory_item: InventoryItem;
};

type Pkg = {
  id: string;
  name: string;
  event_type: string;
  description: string | null;
  child_facing_blurb: string | null;
  active: boolean;
  recommended_margin_pct: number | null;
  recommended_min_attendance: number | null;
  items: PackageItem[];
};

// A package's real cost can't be fully resolved without a specific
// program's expected_attendee_count (flat items - venue hire etc - get
// apportioned across attendees, spec §5), which doesn't exist yet at the
// library level. Split the two so the library can still show a real,
// honest number instead of silently assuming 1 attendee: per-child cost is
// exact regardless of event; flat cost is shown separately as "shared
// across attendees" unless a recommended_min_attendance reference is set,
// in which case computeCostRollup blends them into one real number - the
// same formula the actual per-program rollup uses, just previewed here.
function splitCost(items: PackageItem[]): { perChild: number; flat: number } {
  let perChild = 0;
  let flat = 0;
  for (const pi of items) {
    // 0 is a legitimate override ("exclude this item"), not "unset" - see
    // the matching fix in src/lib/pricingEngine.ts computeCostRollup.
    const multiplier = pi.quantity_override !== null && pi.quantity_override !== undefined ? pi.quantity_override : 1;
    const contribution = Number(pi.inventory_item?.unit_cost || 0) * multiplier;
    if (pi.quantity_type === 'flat') flat += contribution;
    else perChild += contribution;
  }
  return { perChild, flat };
}

function blendedCost(items: PackageItem[], minAttendance: number | null): number {
  const rollupItems = items.map(pi => ({
    cost_type: pi.inventory_item?.cost_type as any,
    unit_cost: Number(pi.inventory_item?.unit_cost || 0),
    quantity_type: pi.quantity_type,
    quantity_override: pi.quantity_override,
  }));
  return computeCostRollup(rollupItems, minAttendance);
}

const CATEGORIES = ['venue', 'catering', 'materials', 'staffing', 'licensing', 'mentorship', 'other'];
const COST_TYPES = ['flat', 'per_unit', 'per_session'];
const EVENT_TYPES = ['workshop', 'term_lessons', 'priority_coaching', 'webinar'];

const LABEL_CLS = "block text-[13px] font-medium text-slate-700 mb-1.5";
const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

export default function PricingLibraryPage() {
  const [tab, setTab] = useState<'inventory' | 'packages'>('inventory');

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Command Center
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign size={20} className="text-blue-500" /> Pricing Library
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Compose what a package <em>is</em> — the items that make it up. Attaching a package to a real program, pricing it, and publishing happens on that program's own edit page in <Link href="/admin/featured-programs" className="underline hover:text-slate-700">Featured Programs</Link>.
          </p>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button onClick={() => setTab('inventory')} className={`px-4 py-2.5 text-[13px] font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${tab === 'inventory' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <Boxes size={14} /> Inventory Items
          </button>
          <button onClick={() => setTab('packages')} className={`px-4 py-2.5 text-[13px] font-bold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${tab === 'packages' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <Package size={14} /> Packages
          </button>
        </div>

        {tab === 'inventory' ? <InventoryTab /> : <PackagesTab />}
      </div>
    </div>
  );
}

function InventoryTab() {
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ name: '', category: 'other', cost_type: 'flat', unit_cost: '0', unit_label: '', notes: '', active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/admin/api/pricing/inventory');
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', category: 'other', cost_type: 'flat', unit_cost: '0', unit_label: '', notes: '', active: true });
    setError(null);
    setShowModal(true);
  }
  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      name: item.name, category: item.category, cost_type: item.cost_type,
      unit_cost: String(item.unit_cost), unit_label: item.unit_label || '', notes: item.notes || '', active: item.active,
    });
    setError(null);
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) return setError('Name is required.');
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, name: form.name.trim(), unit_cost: Number(form.unit_cost) || 0, unit_label: form.unit_label.trim() || null, notes: form.notes.trim() || null };
      const res = await fetch('/admin/api/pricing/inventory', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: InventoryItem) {
    if (!confirm(`Delete "${item.name}"? Packages using it will need a new item.`)) return;
    await fetch('/admin/api/pricing/inventory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    await load();
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
          <Plus size={14} /> Add Item
        </button>
      </div>

      {loading ? (
        <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
      ) : (
        <div className="space-y-2">
          {rows.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">{item.category}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{item.cost_type}</span>
                  {!item.active && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Inactive</span>}
                </div>
                <p className="text-xs text-slate-400 mt-1">R {Number(item.unit_cost).toFixed(2)}{item.unit_label ? ` — ${item.unit_label}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(item)} className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                <button onClick={() => remove(item)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No inventory items yet.</div>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md p-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-slate-900">{editing ? 'Edit Item' : 'New Inventory Item'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div>
              <label className={LABEL_CLS}>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} placeholder="e.g. Venue hire — Pretoria half-day" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Cost Type</label>
                <select value={form.cost_type} onChange={e => setForm(f => ({ ...f, cost_type: e.target.value }))} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
                  {COST_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Unit Cost (R)</label>
                <input type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Unit Label</label>
                <input value={form.unit_label} onChange={e => setForm(f => ({ ...f, unit_label: e.target.value }))} className={INPUT_CLS} placeholder="per child" />
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${INPUT_CLS} resize-none`} />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-blue-600" /> Active
            </label>
            {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackagesTab() {
  const [rows, setRows] = useState<Pkg[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [form, setForm] = useState({ name: '', event_type: 'workshop', description: '', child_facing_blurb: '', active: true, recommended_margin_pct: '', recommended_min_attendance: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addItemId, setAddItemId] = useState('');
  const [addItemQty, setAddItemQty] = useState<'per_child' | 'flat'>('per_child');
  const [addItemMultiplier, setAddItemMultiplier] = useState('');

  async function load() {
    setLoading(true);
    const [pRes, iRes] = await Promise.all([fetch('/admin/api/pricing/packages'), fetch('/admin/api/pricing/inventory')]);
    const pData = await pRes.json();
    const iData = await iRes.json();
    setRows(pData.rows || []);
    setInventory(iData.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', event_type: 'workshop', description: '', child_facing_blurb: '', active: true, recommended_margin_pct: '', recommended_min_attendance: '' });
    setError(null);
    setShowModal(true);
  }
  function openEdit(pkg: Pkg) {
    setEditing(pkg);
    setForm({
      name: pkg.name, event_type: pkg.event_type, description: pkg.description || '', child_facing_blurb: pkg.child_facing_blurb || '', active: pkg.active,
      recommended_margin_pct: pkg.recommended_margin_pct === null ? '' : String(pkg.recommended_margin_pct),
      recommended_min_attendance: pkg.recommended_min_attendance === null ? '' : String(pkg.recommended_min_attendance),
    });
    setError(null);
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) return setError('Name is required.');
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form, name: form.name.trim(), description: form.description.trim() || null, child_facing_blurb: form.child_facing_blurb.trim() || null,
        recommended_margin_pct: form.recommended_margin_pct === '' ? null : Number(form.recommended_margin_pct),
        recommended_min_attendance: form.recommended_min_attendance === '' ? null : Number(form.recommended_min_attendance),
      };
      const res = await fetch('/admin/api/pricing/packages', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(pkg: Pkg) {
    if (!confirm(`Delete "${pkg.name}"? This fails if it's attached to a live program.`)) return;
    const res = await fetch('/admin/api/pricing/packages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pkg.id }) });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    await load();
  }

  async function addItem() {
    if (!editing || !addItemId) return;
    if (addItemMultiplier !== '' && Number(addItemMultiplier) === 0) {
      setError('Quantity can\'t be 0 — just don\'t add the item if it doesn\'t belong in this package.');
      return;
    }
    const res = await fetch('/admin/api/pricing/packages/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package_id: editing.id,
        inventory_item_id: addItemId,
        quantity_type: addItemQty,
        quantity_override: addItemMultiplier === '' ? null : Number(addItemMultiplier),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setError(null);
    setAddItemId('');
    setAddItemMultiplier('');
    await load();
  }

  async function updateItem(itemId: string, patch: { quantity_type?: 'per_child' | 'flat'; quantity_override?: number | null }) {
    await fetch('/admin/api/pricing/packages/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, ...patch }),
    });
    await load();
  }

  async function removeItem(itemId: string) {
    await fetch('/admin/api/pricing/packages/items', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: itemId }) });
    await load();
  }

  const editingLive = useMemo(() => rows.find(r => r.id === editing?.id) || editing, [rows, editing]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800">
          <Plus size={14} /> New Package
        </button>
      </div>

      {loading ? (
        <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
      ) : (
        <div className="space-y-2">
          {rows.map(pkg => {
            const { perChild, flat } = splitCost(pkg.items);
            const hasReferenceAttendance = pkg.recommended_min_attendance !== null && pkg.recommended_min_attendance > 0;
            const displayCost = hasReferenceAttendance ? blendedCost(pkg.items, pkg.recommended_min_attendance) : perChild;
            const referenceFee = pkg.recommended_margin_pct !== null ? computeRecommendedFee(displayCost, pkg.recommended_margin_pct) : null;
            return (
              <div key={pkg.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm">{pkg.name}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">{pkg.event_type.replace('_', ' ')}</span>
                    {!pkg.active && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Inactive</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{pkg.items.length} item{pkg.items.length === 1 ? '' : 's'}{pkg.description ? ` — ${pkg.description}` : ''}</p>
                  <div className="flex items-center gap-3 mt-2 text-[12px] flex-wrap">
                    <span className="font-medium text-slate-600">
                      {hasReferenceAttendance
                        ? `Cost: R ${displayCost.toFixed(2)}/child (at ${pkg.recommended_min_attendance} attendees)`
                        : `Cost: R ${perChild.toFixed(2)}/child${flat > 0 ? ` + R ${flat.toFixed(2)} flat (unapportioned — set Recommended Min. Attendance for a real blended figure)` : ''}`}
                    </span>
                    {pkg.recommended_margin_pct !== null && referenceFee !== null && (
                      <span className="text-blue-600">
                        @ {pkg.recommended_margin_pct}% margin ≈ R {referenceFee.toFixed(2)}{!hasReferenceAttendance && flat > 0 ? ' (per-child portion only)' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(pkg)} className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                  <button onClick={() => remove(pkg)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No packages yet.</div>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-[17px] font-semibold text-slate-900">{editing ? 'Edit Package' : 'New Package'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-7 py-5 space-y-4">
              <div>
                <label className={LABEL_CLS}>Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLS} placeholder="e.g. Pretoria Workshop — Half Day" />
              </div>
              <div>
                <label className={LABEL_CLS}>Event Type</label>
                <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} className={`${INPUT_CLS} appearance-none cursor-pointer`}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Description (parent-facing)</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${INPUT_CLS} resize-none`} placeholder="Outcome-framed — what the child walks away with." />
              </div>
              <div>
                <label className={LABEL_CLS}>Child-facing blurb (optional)</label>
                <input value={form.child_facing_blurb} onChange={e => setForm(f => ({ ...f, child_facing_blurb: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Recommended Margin %</label>
                  <input type="number" min={0} max={99} value={form.recommended_margin_pct} onChange={e => setForm(f => ({ ...f, recommended_margin_pct: e.target.value }))} className={INPUT_CLS} placeholder="e.g. 60" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Recommended Min. Attendance</label>
                  <input type="number" min={1} value={form.recommended_min_attendance} onChange={e => setForm(f => ({ ...f, recommended_min_attendance: e.target.value }))} className={INPUT_CLS} placeholder="e.g. 15" />
                </div>
              </div>
              <p className="text-[12px] text-slate-400 -mt-3">
                Margin pre-fills Target Margin % when attached to a program. Attendance is preview-only, so this page's cost estimate can apportion flat items (venue, etc.) into a real per-child figure instead of showing them as an unapportioned lump — the actual quote always uses that program's own Expected Attendees.
              </p>
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-blue-600" /> Active
              </label>

              {editing && editingLive && (() => {
                const { perChild, flat } = splitCost(editingLive.items);
                const marginPct = form.recommended_margin_pct === '' ? null : Number(form.recommended_margin_pct);
                const minAttendance = form.recommended_min_attendance === '' ? null : Number(form.recommended_min_attendance);
                const displayCost = minAttendance ? blendedCost(editingLive.items, minAttendance) : perChild;
                const referenceFee = marginPct !== null ? computeRecommendedFee(displayCost, marginPct) : null;
                return editingLive.items.length > 0 && (
                  <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 text-[13px] text-slate-700 space-y-1">
                    <p>
                      <strong>Cost:</strong>{' '}
                      {minAttendance
                        ? `R ${displayCost.toFixed(2)}/child (blended, at ${minAttendance} attendees)`
                        : `R ${perChild.toFixed(2)}/child${flat > 0 ? ` + R ${flat.toFixed(2)} flat (set Recommended Min. Attendance above to blend this in)` : ''}`}
                    </p>
                    {referenceFee !== null && (
                      <p><strong>At {marginPct}% margin:</strong> ≈ R {referenceFee.toFixed(2)}/child{!minAttendance && flat > 0 ? ' (per-child portion only)' : ''}</p>
                    )}
                  </div>
                );
              })()}

              {editing && editingLive && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div>
                    <label className={LABEL_CLS}>Composition</label>
                    <p className="text-[12px] text-slate-400 -mt-1">
                      Each row's <strong>×</strong> multiplier scales that item's own cost — e.g. reuse "Venue hire — half-day" at ×3 for a multi-day pass instead of creating a duplicate item.
                    </p>
                  </div>

                  {editingLive.items.length === 0 && (
                    <p className="text-[13px] text-slate-400 italic">No items yet — add one below.</p>
                  )}

                  <div className="space-y-2">
                    {editingLive.items.map(pi => (
                      <PackageItemEditRow key={pi.id} item={pi} onUpdate={(patch) => updateItem(pi.id, patch)} onRemove={() => removeItem(pi.id)} />
                    ))}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500">Add an inventory item</label>
                      <select value={addItemId} onChange={e => setAddItemId(e.target.value)} className={`${INPUT_CLS} appearance-none cursor-pointer mt-1`}>
                        <option value="">— choose an item —</option>
                        {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="text-[11px] font-medium text-slate-500">Charged</label>
                        <select value={addItemQty} onChange={e => setAddItemQty(e.target.value as any)} className={`${INPUT_CLS} appearance-none cursor-pointer mt-1`}>
                          <option value="per_child">per child</option>
                          <option value="flat">flat (shared across attendees)</option>
                        </select>
                      </div>
                      <div className="w-24 shrink-0">
                        <label className="text-[11px] font-medium text-slate-500">× multiplier</label>
                        <input type="number" min={1} placeholder="1" value={addItemMultiplier} onChange={e => setAddItemMultiplier(e.target.value)} className={`${INPUT_CLS} mt-1`} />
                      </div>
                      <button onClick={addItem} disabled={!addItemId || (addItemMultiplier !== '' && Number(addItemMultiplier) === 0)} className="h-[46px] px-4 rounded-[10px] bg-slate-900 text-white text-[13px] font-medium disabled:opacity-50 shrink-0 flex items-center gap-1.5">
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-7 py-4">
              {error && <div className="mb-3 bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Close</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Package'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline-editable composition row - quantity_type and quantity_override
// (the "×N" multiplier) both already exist end-to-end on package_items and
// the pricing rollup (computeCostRollup treats quantity_override as a
// per-item multiplier), they just had no UI before. Local draft state with
// an explicit Save avoids firing a PATCH on every keystroke.
function PackageItemEditRow({ item, onUpdate, onRemove }: {
  item: PackageItem;
  onUpdate: (patch: { quantity_type?: 'per_child' | 'flat'; quantity_override?: number | null }) => void;
  onRemove: () => void;
}) {
  const [quantityType, setQuantityType] = useState(item.quantity_type);
  const [multiplier, setMultiplier] = useState(item.quantity_override === null ? '' : String(item.quantity_override));
  const [saving, setSaving] = useState(false);

  const dirty = quantityType !== item.quantity_type || multiplier !== (item.quantity_override === null ? '' : String(item.quantity_override));
  // 0 isn't a valid quantity - it means "not in this package," which is
  // what the remove button is for. Blocked client-side and server-side
  // (see validateQuantityOverride in admin/api/pricing/packages/items).
  const isZero = multiplier !== '' && Number(multiplier) === 0;

  async function save() {
    if (isZero) return;
    setSaving(true);
    try {
      await onUpdate({ quantity_type: quantityType, quantity_override: multiplier === '' ? null : Number(multiplier) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="flex-1 min-w-[140px] font-medium text-slate-700">{item.inventory_item?.name}</span>
        <select value={quantityType} onChange={e => setQuantityType(e.target.value as any)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white cursor-pointer">
          <option value="per_child">per child</option>
          <option value="flat">flat</option>
        </select>
        <div className="flex items-center gap-1">
          <span className="text-slate-400">×</span>
          <input type="number" min={1} placeholder="1" value={multiplier} onChange={e => setMultiplier(e.target.value)} className={`w-16 border rounded-lg px-2 py-1.5 bg-white ${isZero ? 'border-rose-400' : 'border-slate-200'}`} />
        </div>
        {dirty && (
          <button onClick={save} disabled={saving || isZero} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40" title={isZero ? 'Fix the quantity first' : 'Save'}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
        )}
        <button onClick={onRemove} className="text-slate-300 hover:text-rose-500" title="Remove"><Trash2 size={14} /></button>
      </div>
      {isZero && <p className="text-[11px] text-rose-500">Quantity can&apos;t be 0 — remove the item instead (trash icon) if it doesn&apos;t belong in this package.</p>}
    </div>
  );
}
