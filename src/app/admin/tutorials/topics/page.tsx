"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2, Eye, EyeOff, Heart, Phone, ChevronDown, Settings, Pencil, Check, X, Lightbulb } from "lucide-react";

type Topic = {
  id: string;
  title: string;
  sort_order: number;
  is_hidden: boolean;
  vote_count: number;
  interested_phones: { phone: string; created_at: string }[];
};

type VoteSettings = { reveal_threshold: number; min_display_threshold: number };

type OtherSuggestionRow = { id: string; text: string; phone: string | null; created_at: string };
type OtherSuggestionGroup = { key: string; text: string; ids: string[]; phones: string[] };

function groupOtherSuggestions(rows: OtherSuggestionRow[]): OtherSuggestionGroup[] {
  const groups = new Map<string, OtherSuggestionGroup>();
  for (const r of rows) {
    const key = r.text.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(r.id);
      if (r.phone) existing.phones.push(r.phone);
    } else {
      groups.set(key, { key, text: r.text.trim(), ids: [r.id], phones: r.phone ? [r.phone] : [] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.ids.length - a.ids.length);
}

const INPUT_CLS = "w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

// Manages the "what should we build next" topic-voting suggestions shown
// at the bottom of /tutorials (src/components/tutorials/TopicVoteSection.tsx).
// Vote counts here are what decide priority; the phone numbers are the
// actual reason to collect them at all - shown per topic so whoever picks
// the next series to build can go notify the people who asked for it.
export default function TutorialTopicsAdminPage() {
  const [rows, setRows] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoteSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [otherRows, setOtherRows] = useState<OtherSuggestionRow[]>([]);

  async function load() {
    const res = await fetch('/admin/api/tutorials/topics');
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  }

  async function loadSettings() {
    const res = await fetch('/admin/api/tutorials/topics/settings');
    const data = await res.json();
    if (data.row) setSettings({ reveal_threshold: data.row.reveal_threshold, min_display_threshold: data.row.min_display_threshold });
  }

  async function loadOther() {
    const res = await fetch('/admin/api/tutorials/topics/other');
    const data = await res.json();
    setOtherRows(data.rows || []);
  }

  useEffect(() => { load(); loadSettings(); loadOther(); }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/admin/api/tutorials/topics/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function addTopic() {
    if (!newTitle.trim()) return;
    const res = await fetch('/admin/api/tutorials/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, sort_order: rows.length }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    setNewTitle("");
    load();
  }

  function startEditingTitle(t: Topic) {
    setEditingTitleId(t.id);
    setEditingTitleValue(t.title);
  }

  async function saveTitle(id: string) {
    if (!editingTitleValue.trim()) return;
    await fetch('/admin/api/tutorials/topics', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title: editingTitleValue }) });
    setEditingTitleId(null);
    load();
  }

  async function promoteOther(group: OtherSuggestionGroup) {
    const res = await fetch('/admin/api/tutorials/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: group.text, sort_order: rows.length }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    await fetch('/admin/api/tutorials/topics/other', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: group.ids }) });
    load();
    loadOther();
  }

  async function dismissOther(group: OtherSuggestionGroup) {
    await fetch('/admin/api/tutorials/topics/other', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: group.ids }) });
    loadOther();
  }

  async function toggleHidden(t: Topic) {
    await fetch('/admin/api/tutorials/topics', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, is_hidden: !t.is_hidden }) });
    load();
  }

  async function remove(t: Topic) {
    if (!confirm(`Delete "${t.title}"? Its ${t.vote_count} vote(s) go with it.`)) return;
    await fetch('/admin/api/tutorials/topics', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) });
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  const sorted = [...rows].sort((a, b) => b.vote_count - a.vote_count);
  const otherGroups = groupOtherSuggestions(otherRows);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link href="/admin/tutorials" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-4">
        <ArrowLeft size={14} /> Tutorial Hub
      </Link>
      <h1 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-1"><Heart size={18} /> Topic Suggestions & Votes</h1>
      <p className="text-sm text-slate-500 mb-6">Shown to visitors at the bottom of /tutorials as "what should we build next" - ranked by vote count.</p>

      {settings && (
        <form onSubmit={saveSettings} className="border border-slate-200 rounded-2xl p-4 mb-6 bg-slate-50">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
            <Settings size={14} /> Public display thresholds
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Hide all counts until total votes reach</label>
              <input
                type="number"
                min={0}
                value={settings.reveal_threshold}
                onChange={e => setSettings({ ...settings, reveal_threshold: Number(e.target.value) })}
                className={INPUT_CLS}
              />
              <p className="text-[11px] text-slate-400 mt-1">While total votes across every topic stay below this, visitors see no numbers at all - just the ranked list.</p>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Show a dash below</label>
              <input
                type="number"
                min={0}
                value={settings.min_display_threshold}
                onChange={e => setSettings({ ...settings, min_display_threshold: Number(e.target.value) })}
                className={INPUT_CLS}
              />
              <p className="text-[11px] text-slate-400 mt-1">Once counts are showing, any single topic below this many votes still shows "—" instead of its exact number.</p>
            </div>
          </div>
          <button type="submit" disabled={savingSettings} className="bg-blue-600 text-white text-xs font-bold rounded-lg px-4 py-2 disabled:opacity-50">
            {savingSettings ? 'Saving...' : 'Save Thresholds'}
          </button>
        </form>
      )}

      <div className="flex gap-2 mb-6">
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="New topic suggestion" className={INPUT_CLS} />
        <button onClick={addTopic} className="shrink-0 bg-blue-600 text-white rounded-lg px-4 flex items-center gap-1 text-xs font-bold"><Plus size={14} /> Add</button>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map(t => (
          <div key={t.id} className={`border border-slate-200 rounded-2xl bg-white ${t.is_hidden ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3 p-4">
              <div className="flex items-center gap-1.5 text-rad-blue font-black text-sm shrink-0 w-14">
                <Heart size={14} className="fill-rad-blue" /> {t.vote_count}
              </div>
              {editingTitleId === t.id ? (
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={editingTitleValue}
                    onChange={e => setEditingTitleValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(t.id); if (e.key === 'Escape') setEditingTitleId(null); }}
                    className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-900 outline-none"
                  />
                  <button onClick={() => saveTitle(t.id)} className="text-emerald-500 shrink-0"><Check size={16} /></button>
                  <button onClick={() => setEditingTitleId(null)} className="text-slate-400 shrink-0"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => startEditingTitle(t)} className="flex-1 flex items-center gap-1.5 text-left group/title">
                  <span className="text-sm font-bold text-slate-900">{t.title}</span>
                  <Pencil size={12} className="text-slate-300 opacity-0 group-hover/title:opacity-100 shrink-0" />
                </button>
              )}
              {t.interested_phones.length > 0 && (
                <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="flex items-center gap-1 text-xs font-bold text-slate-500 shrink-0">
                  <Phone size={12} /> {t.interested_phones.length} <ChevronDown size={12} className={`transition-transform ${expandedId === t.id ? 'rotate-180' : ''}`} />
                </button>
              )}
              <button onClick={() => toggleHidden(t)} className="text-slate-400 hover:text-slate-700 shrink-0" title={t.is_hidden ? 'Show to visitors' : 'Hide from visitors'}>
                {t.is_hidden ? <EyeOff size={16} /> : <Eye size={16} className="text-emerald-500" />}
              </button>
              <button onClick={() => remove(t)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
            </div>
            {expandedId === t.id && t.interested_phones.length > 0 && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                {t.interested_phones.map((p, i) => (
                  <span key={i} className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600">{p.phone}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm text-slate-400 text-center py-12">No topics yet.</p>}
      </div>

      {otherGroups.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
            <Lightbulb size={14} /> "Other" suggestions
          </div>
          <p className="text-xs text-slate-400 mb-3">Free-text ideas from the "Other" option on /tutorials - never shown to visitors. Promote one to a real topic once enough people ask for it.</p>
          <div className="flex flex-col gap-2">
            {otherGroups.map(g => (
              <div key={g.key} className="flex items-center gap-3 border border-slate-200 rounded-2xl bg-white p-4">
                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">{g.ids.length}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{g.text}</p>
                  {g.phones.length > 0 && <p className="text-[11px] text-slate-400">{g.phones.length} left a number</p>}
                </div>
                <button onClick={() => promoteOther(g)} className="shrink-0 text-xs font-bold text-white bg-blue-600 rounded-lg px-3 py-1.5">Add as Topic</button>
                <button onClick={() => dismissOther(g)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
