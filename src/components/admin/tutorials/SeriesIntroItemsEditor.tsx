"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, X, MapPin, ImageOff, ExternalLink } from "lucide-react";

type Hotspot = { id: string; x: number; y: number; label: string; text: string };
type IntroItem = {
  id: string;
  series_id: string;
  title: string;
  instruction: string;
  image_url: string | null;
  hotspots: Hotspot[];
  link_url: string | null;
  link_label: string | null;
  order_index: number;
};

const LABEL_CLS = "block text-[12px] font-medium text-slate-700 mb-1";
const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10";

// Manages the "before the tutorials" onboarding items for one series
// (Accessing the Resources / The Platform UI / Finding Tutorials, seeded
// by default - see src/lib/tutorialSeriesIntroDefaults.ts). The distinct
// feature here is hotspots: clicking anywhere on an item's image drops a
// numbered "Guide" marker at that point (stored as x/y percentages so it
// stays correctly placed at any render size), which the public page shows
// as a tappable dot with a popover. Editing a hotspot's text happens in
// the list below the image, matched to its dot by number, rather than an
// inline edit-on-the-image affordance - simpler to build, same result.
export default function SeriesIntroItemsEditor({ seriesId }: { seriesId: string }) {
  const [items, setItems] = useState<IntroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<IntroItem | null>(null);

  async function load() {
    const res = await fetch(`/admin/api/tutorials/intro-items?seriesId=${seriesId}`);
    const data = await res.json();
    setItems(data.rows || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [seriesId]);

  async function addItem() {
    const res = await fetch('/admin/api/tutorials/intro-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series_id: seriesId, title: 'New item', instruction: '', order_index: items.length }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    await load();
    setEditingItem(data.row);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    const { id, title, instruction, image_url, hotspots, link_url, link_label } = editingItem;
    const res = await fetch('/admin/api/tutorials/intro-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title, instruction, image_url, hotspots, link_url, link_label }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    setEditingItem(null);
    load();
  }

  async function moveItem(item: IntroItem, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex(x => x.id === item.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await fetch('/admin/api/tutorials/intro-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: [{ id: item.id, order_index: swapWith.order_index }, { id: swapWith.id, order_index: item.order_index }] }),
    });
    load();
  }

  async function removeItem(item: IntroItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await fetch('/admin/api/tutorials/intro-items', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    if (editingItem?.id === item.id) setEditingItem(null);
    load();
  }

  function addHotspot(e: React.MouseEvent<HTMLDivElement>) {
    if (!editingItem) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const hotspot: Hotspot = { id: crypto.randomUUID(), x, y, label: `Point ${(editingItem.hotspots?.length || 0) + 1}`, text: '' };
    setEditingItem({ ...editingItem, hotspots: [...(editingItem.hotspots || []), hotspot] });
  }

  function updateHotspot(id: string, field: 'label' | 'text', value: string) {
    if (!editingItem) return;
    setEditingItem({ ...editingItem, hotspots: editingItem.hotspots.map(h => h.id === id ? { ...h, [field]: value } : h) });
  }

  function removeHotspot(id: string) {
    if (!editingItem) return;
    setEditingItem({ ...editingItem, hotspots: editingItem.hotspots.filter(h => h.id !== id) });
  }

  if (loading) return null;

  const sorted = [...items].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Getting Started (shown before the tutorials)</h2>
        <button onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-blue-600"><Plus size={14} /> Add item</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          {sorted.map((item, i) => (
            <div
              key={item.id}
              onClick={() => setEditingItem(item)}
              className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer ${editingItem?.id === item.id ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => moveItem(item, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={14} /></button>
                <button onClick={() => moveItem(item, 1)} disabled={i === sorted.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={14} /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{item.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {!item.image_url && <span className="text-[10px] text-slate-400 flex items-center gap-1"><ImageOff size={10} /> No screenshot yet</span>}
                  {item.image_url && <span className="text-[10px] text-rad-blue flex items-center gap-1"><MapPin size={10} /> {item.hotspots?.length || 0} guide point{item.hotspots?.length === 1 ? '' : 's'}</span>}
                  {item.link_url && <span className="text-[10px] text-slate-400 flex items-center gap-1"><ExternalLink size={10} /> Guide link set</span>}
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item); }} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
          {sorted.length === 0 && <p className="text-sm text-slate-400">No items yet.</p>}
        </div>

        <div>
          {!editingItem ? (
            <p className="text-sm text-slate-400">Select an item to edit it.</p>
          ) : (
            <form onSubmit={saveItem} className="flex flex-col gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Edit Item</h3>
                <button type="button" onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
              </div>
              <div>
                <label className={LABEL_CLS}>Title</label>
                <input required value={editingItem.title} onChange={e => setEditingItem({ ...editingItem, title: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Instruction</label>
                <p className="text-[11px] text-slate-400 mb-1">Supports **bold**, *italic*, `code`, and [links](url).</p>
                <textarea required rows={3} value={editingItem.instruction} onChange={e => setEditingItem({ ...editingItem, instruction: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Screenshot URL (optional)</label>
                <input value={editingItem.image_url || ''} onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value, hotspots: e.target.value ? editingItem.hotspots : [] })} className={INPUT_CLS} placeholder="https://..." />
              </div>

              <div className="border-t border-slate-200 pt-3">
                <label className={LABEL_CLS}>"Open Guide" link (optional)</label>
                <p className="text-[11px] text-slate-400 mb-2">Shown as a button in this item's popup, opening in a new tab - e.g. the MakeCode website, or a specific help page.</p>
                <input value={editingItem.link_url || ''} onChange={e => setEditingItem({ ...editingItem, link_url: e.target.value })} className={INPUT_CLS} placeholder="https://makecode.microbit.org" />
                {editingItem.link_url && (
                  <input value={editingItem.link_label || ''} onChange={e => setEditingItem({ ...editingItem, link_label: e.target.value })} className={`${INPUT_CLS} mt-2`} placeholder="Button label (optional), e.g. Open MakeCode" />
                )}
              </div>

              {editingItem.image_url && (
                <div>
                  <label className={LABEL_CLS}>Guide points</label>
                  <p className="text-[11px] text-slate-400 mb-2">Click anywhere on the screenshot to drop a numbered guide point, then describe it below.</p>
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 cursor-crosshair select-none" onClick={addHotspot}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editingItem.image_url} alt="" className="w-full block pointer-events-none" />
                    {editingItem.hotspots?.map((h, i) => (
                      <div
                        key={h.id}
                        style={{ left: `${h.x}%`, top: `${h.y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-rad-blue text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow pointer-events-none"
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>

                  {editingItem.hotspots?.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {editingItem.hotspots.map((h, i) => (
                        <div key={h.id} className="flex gap-2 items-start bg-white border border-slate-200 rounded-lg p-2">
                          <span className="w-5 h-5 rounded-full bg-rad-blue text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <div className="flex-1 flex flex-col gap-1.5">
                            <input value={h.label} onChange={e => updateHotspot(h.id, 'label', e.target.value)} className={`${INPUT_CLS} text-xs`} placeholder="Short label, e.g. Blocks panel" />
                            <textarea value={h.text} onChange={e => updateHotspot(h.id, 'text', e.target.value)} rows={2} className={`${INPUT_CLS} text-xs`} placeholder="What this is / what to do here" />
                          </div>
                          <button type="button" onClick={() => removeHotspot(h.id)} className="text-slate-400 hover:text-red-500 shrink-0 mt-1"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="bg-blue-600 text-white text-xs font-bold rounded-lg px-4 py-2">Save Item</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
