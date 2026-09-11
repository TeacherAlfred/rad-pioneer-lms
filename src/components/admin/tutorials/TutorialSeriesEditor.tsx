"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Image as ImageIcon, Lightbulb, ExternalLink, Pencil, X } from "lucide-react";

type Tutorial = {
  id: string;
  series_id: string;
  title: string;
  description: string | null;
  estimated_minutes: number | null;
  link_url: string | null;
  link_label: string | null;
  order_index: number;
  is_hidden: boolean;
};

type Step = {
  id: string;
  tutorial_id: string;
  instruction: string;
  image_url: string | null;
  why_this_works: string | null;
  link_url: string | null;
  link_label: string | null;
  order_index: number;
};

const LABEL_CLS = "block text-[12px] font-medium text-slate-700 mb-1";
const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10";

// Peer to LinearCourseEditor.tsx's nested Course->Module->Mission editor,
// but for the free public tutorial_series -> tutorials -> tutorial_steps
// content (see migration 20260911090000_tutorial_hub_content.sql). Reorder
// is up/down buttons rather than @hello-pangea/dnd drag handles - same
// end result (a non-technical admin can reorder), less wiring for two
// nested lists in one screen.
export default function TutorialSeriesEditor({ seriesId }: { seriesId: string }) {
  const [seriesTitle, setSeriesTitle] = useState("");
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedTutorialId, setSelectedTutorialId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTutorialTitle, setNewTutorialTitle] = useState("");
  const [editingStep, setEditingStep] = useState<Step | Partial<Step> | null>(null);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);

  async function loadTutorials() {
    const [seriesRes, tutorialsRes] = await Promise.all([
      fetch('/admin/api/tutorials/series').then(r => r.json()),
      fetch(`/admin/api/tutorials/tutorials?seriesId=${seriesId}`).then(r => r.json()),
    ]);
    const series = (seriesRes.rows || []).find((s: any) => s.id === seriesId);
    setSeriesTitle(series?.title || 'Series');
    setTutorials(tutorialsRes.rows || []);
    setLoading(false);
  }

  useEffect(() => { loadTutorials(); }, [seriesId]);

  async function loadSteps(tutorialId: string) {
    const res = await fetch(`/admin/api/tutorials/steps?tutorialId=${tutorialId}`);
    const data = await res.json();
    setSteps(data.rows || []);
  }

  useEffect(() => {
    if (selectedTutorialId) loadSteps(selectedTutorialId);
    else setSteps([]);
    setEditingStep(null);
  }, [selectedTutorialId]);

  async function addTutorial() {
    if (!newTutorialTitle.trim()) return;
    const res = await fetch('/admin/api/tutorials/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series_id: seriesId, title: newTutorialTitle, order_index: tutorials.length }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    setNewTutorialTitle("");
    await loadTutorials();
    setSelectedTutorialId(data.row.id);
  }

  async function saveTutorial(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTutorial) return;
    const { id, title, description, estimated_minutes, link_url, link_label } = editingTutorial;
    const res = await fetch('/admin/api/tutorials/tutorials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title, description, estimated_minutes, link_url, link_label }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    setEditingTutorial(null);
    loadTutorials();
  }

  async function toggleTutorialPublish(t: Tutorial) {
    await fetch('/admin/api/tutorials/tutorials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, is_hidden: !t.is_hidden }) });
    loadTutorials();
  }

  async function moveTutorial(t: Tutorial, direction: -1 | 1) {
    const sorted = [...tutorials].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex(x => x.id === t.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      fetch('/admin/api/tutorials/tutorials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, order_index: swapWith.order_index }) }),
      fetch('/admin/api/tutorials/tutorials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: swapWith.id, order_index: t.order_index }) }),
    ]);
    loadTutorials();
  }

  async function removeTutorial(t: Tutorial) {
    if (!confirm(`Delete "${t.title}" and all its steps?`)) return;
    await fetch('/admin/api/tutorials/tutorials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) });
    if (selectedTutorialId === t.id) setSelectedTutorialId(null);
    loadTutorials();
  }

  async function saveStep(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStep || !selectedTutorialId) return;
    const payload = {
      instruction: editingStep.instruction,
      image_url: editingStep.image_url,
      why_this_works: editingStep.why_this_works,
      link_url: editingStep.link_url,
      link_label: editingStep.link_label,
    };
    if (editingStep.id) {
      await fetch('/admin/api/tutorials/steps', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingStep.id, ...payload }) });
    } else {
      const res = await fetch('/admin/api/tutorials/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorial_id: selectedTutorialId, order_index: steps.length, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error);
    }
    setEditingStep(null);
    loadSteps(selectedTutorialId);
  }

  async function moveStep(s: Step, direction: -1 | 1) {
    const sorted = [...steps].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex(x => x.id === s.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await fetch('/admin/api/tutorials/steps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: [{ id: s.id, order_index: swapWith.order_index }, { id: swapWith.id, order_index: s.order_index }] }),
    });
    if (selectedTutorialId) loadSteps(selectedTutorialId);
  }

  async function removeStep(s: Step) {
    if (!confirm('Delete this step?')) return;
    await fetch('/admin/api/tutorials/steps', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) });
    if (selectedTutorialId) loadSteps(selectedTutorialId);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  const sortedTutorials = [...tutorials].sort((a, b) => a.order_index - b.order_index);
  const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/admin/tutorials" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-4">
        <ArrowLeft size={14} /> All Series
      </Link>
      <h1 className="text-lg font-black text-slate-900 mb-6">{seriesTitle}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tutorials column */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Tutorials</h2>
          <div className="flex flex-col gap-2 mb-4">
            {sortedTutorials.map((t, i) => (
              <div
                key={t.id}
                onClick={() => setSelectedTutorialId(t.id)}
                className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer ${selectedTutorialId === t.id ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-white'} ${t.is_hidden ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => moveTutorial(t, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={14} /></button>
                  <button onClick={() => moveTutorial(t, 1)} disabled={i === sortedTutorials.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={14} /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-slate-900 truncate block">{t.title}</span>
                  {t.link_url && <span className="text-[10px] text-rad-blue flex items-center gap-1"><ExternalLink size={10} /> Editor link set</span>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditingTutorial(t); }} className="text-slate-400 hover:text-blue-600 shrink-0"><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); toggleTutorialPublish(t); }} className="text-slate-400 hover:text-slate-700 shrink-0">
                  {t.is_hidden ? <EyeOff size={14} /> : <Eye size={14} className="text-emerald-500" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeTutorial(t); }} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          {editingTutorial ? (
            <form onSubmit={saveTutorial} className="flex flex-col gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Edit Tutorial</h3>
                <button type="button" onClick={() => setEditingTutorial(null)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
              </div>
              <div>
                <label className={LABEL_CLS}>Title</label>
                <input required value={editingTutorial.title} onChange={e => setEditingTutorial({ ...editingTutorial, title: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Description (optional)</label>
                <textarea rows={2} value={editingTutorial.description || ''} onChange={e => setEditingTutorial({ ...editingTutorial, description: e.target.value })} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Est. minutes</label>
                <input type="number" value={editingTutorial.estimated_minutes ?? ''} onChange={e => setEditingTutorial({ ...editingTutorial, estimated_minutes: e.target.value === '' ? null : Number(e.target.value) })} className={INPUT_CLS} />
              </div>
              <div className="border-t border-slate-200 pt-3">
                <label className={LABEL_CLS}>Editor link (opens in a new tab)</label>
                <p className="text-[11px] text-slate-400 mb-2">One link for the whole tutorial - shown on every step, for someone coding on this same device (e.g. the MakeCode project for this tutorial).</p>
                <input value={editingTutorial.link_url || ''} onChange={e => setEditingTutorial({ ...editingTutorial, link_url: e.target.value })} className={INPUT_CLS} placeholder="https://makecode.microbit.org/..." />
                {editingTutorial.link_url && (
                  <input value={editingTutorial.link_label || ''} onChange={e => setEditingTutorial({ ...editingTutorial, link_label: e.target.value })} className={`${INPUT_CLS} mt-2`} placeholder="Button label (optional), e.g. Open MakeCode" />
                )}
              </div>
              <button type="submit" className="bg-blue-600 text-white text-xs font-bold rounded-lg px-4 py-2">Save Tutorial</button>
            </form>
          ) : (
            <div className="flex gap-2">
              <input value={newTutorialTitle} onChange={e => setNewTutorialTitle(e.target.value)} placeholder="New tutorial title" className={INPUT_CLS} />
              <button onClick={addTutorial} className="shrink-0 bg-blue-600 text-white rounded-lg px-3 flex items-center gap-1 text-xs font-bold"><Plus size={14} /> Add</button>
            </div>
          )}
        </div>

        {/* Steps column */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Steps</h2>
          {!selectedTutorialId ? (
            <p className="text-sm text-slate-400">Select a tutorial to manage its steps.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-4">
                {sortedSteps.map((s, i) => (
                  <div key={s.id} className="flex items-start gap-2 border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="flex flex-col shrink-0">
                      <button onClick={() => moveStep(s, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={14} /></button>
                      <button onClick={() => moveStep(s, 1)} disabled={i === sortedSteps.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={14} /></button>
                    </div>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditingStep(s)}>
                      <p className="text-sm text-slate-900 line-clamp-2">{i + 1}. {s.instruction}</p>
                      <div className="flex gap-2 mt-1">
                        {s.image_url && <ImageIcon size={12} className="text-slate-400" />}
                        {s.why_this_works && <Lightbulb size={12} className="text-rad-yellow" />}
                        {s.link_url && <ExternalLink size={12} className="text-rad-blue" />}
                      </div>
                    </div>
                    <button onClick={() => removeStep(s)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              {editingStep ? (
                <form onSubmit={saveStep} className="flex flex-col gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div>
                    <label className={LABEL_CLS}>Instruction</label>
                    <p className="text-[11px] text-slate-400 mb-1">Keep it short - a glance, not a paragraph. Supports **bold**, *italic*, `code`, and [links](url).</p>
                    <textarea required rows={3} value={editingStep.instruction || ''} onChange={e => setEditingStep({ ...editingStep, instruction: e.target.value })} className={INPUT_CLS} placeholder="e.g. Drag an **on start** block into the workspace" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Image URL (optional)</label>
                    <input value={editingStep.image_url || ''} onChange={e => setEditingStep({ ...editingStep, image_url: e.target.value })} className={INPUT_CLS} placeholder="https://..." />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>"Why this works" note (optional)</label>
                    <textarea rows={2} value={editingStep.why_this_works || ''} onChange={e => setEditingStep({ ...editingStep, why_this_works: e.target.value })} className={INPUT_CLS} />
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <label className={LABEL_CLS}>
                      Additional resource for this step (optional)
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">A video or image explainer just for this step - not the tutorial's editor link (set that once on the tutorial itself).</p>
                    <input value={editingStep.link_url || ''} onChange={e => setEditingStep({ ...editingStep, link_url: e.target.value })} className={INPUT_CLS} placeholder="https://youtube.com/..." />
                    {editingStep.link_url && (
                      <input value={editingStep.link_label || ''} onChange={e => setEditingStep({ ...editingStep, link_label: e.target.value })} className={`${INPUT_CLS} mt-2`} placeholder="Link label (optional), e.g. Watch a demo" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-blue-600 text-white text-xs font-bold rounded-lg px-4 py-2">Save Step</button>
                    <button type="button" onClick={() => setEditingStep(null)} className="text-xs font-bold text-slate-500 px-4 py-2">Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setEditingStep({ instruction: '', image_url: '', why_this_works: '', link_url: '', link_label: '' })} className="w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-300 text-slate-500 rounded-xl py-3 text-xs font-bold">
                  <Plus size={14} /> Add Step
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
