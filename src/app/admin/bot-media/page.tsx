"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Plus, Trash2, CheckCircle2, XCircle, FileText, ExternalLink,
  AlertTriangle, Pencil, Copy, Archive, ArchiveRestore,
} from "lucide-react";

type Button = { id: string; title: string };

type MediaRow = {
  id: string;
  key: string | null;
  title: string;
  trigger_keywords: string[];
  tag_filter: string | null;
  file_url: string;
  filename: string;
  file_type: string;
  caption: string;
  buttons: Button[];
  active: boolean;
  archived: boolean;
  created_at: string;
};

// Buttons the webhook's own button-tap router currently recognizes - a
// button with any other id will render fine but silently do nothing when
// tapped, since routing is still separate hardcoded logic in the webhook.
const KNOWN_BUTTON_IDS = ['btn_do_it', 'btn_webinar', 'btn_human', 'btn_pta', 'btn_plk', 'btn_webinar_link'];

const emptyForm = {
  title: '', key: '', trigger_keywords: '', tag_filter: '', caption: '',
  file_url: '', filename: '', buttons: [{ id: 'btn_human', title: 'Talk to Educator' }] as Button[],
};

export default function BotMediaPage() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { fetchRows(); }, []);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/bot-media');
      const data = await res.json();
      if (res.ok) setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  async function patchRow(id: string, fields: Record<string, any>) {
    setSavingId(id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    await fetch('/admin/api/bot-media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    setSavingId(null);
  }

  function toggleActive(row: MediaRow) {
    patchRow(row.id, { active: !row.active });
  }

  function toggleArchived(row: MediaRow) {
    const archiving = !row.archived;
    // Archiving also stops it matching keywords; unarchiving leaves active
    // as-is so it doesn't silently start firing again without a deliberate
    // second step.
    patchRow(row.id, archiving ? { archived: true, active: false } : { archived: false });
  }

  async function handleDelete(row: MediaRow) {
    if (!confirm(`Permanently delete "${row.title}"? This can't be undone - consider Archive instead if you might need it again.`)) return;
    setSavingId(row.id);
    const res = await fetch(`/admin/api/bot-media?id=${row.id}`, { method: 'DELETE' });
    if (res.ok) setRows(prev => prev.filter(r => r.id !== row.id));
    setSavingId(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setFile(null);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(row: MediaRow) {
    setForm({
      title: row.title,
      key: row.key || '',
      trigger_keywords: row.trigger_keywords.join(', '),
      tag_filter: row.tag_filter || '',
      caption: row.caption,
      file_url: row.file_url,
      filename: row.filename,
      buttons: row.buttons.length > 0 ? row.buttons : emptyForm.buttons,
    });
    setFile(null);
    setEditingId(row.id);
    setShowForm(true);
  }

  function openDuplicate(row: MediaRow) {
    setForm({
      title: `${row.title} (copy)`,
      key: '',
      trigger_keywords: row.trigger_keywords.join(', '),
      tag_filter: row.tag_filter || '',
      caption: row.caption,
      file_url: row.file_url,
      filename: row.filename,
      buttons: row.buttons.length > 0 ? row.buttons : emptyForm.buttons,
    });
    setFile(null);
    setEditingId(null); // duplicating always creates a new row, never patches the source
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setFile(null);
    setEditingId(null);
  }

  function updateButton(idx: number, field: 'id' | 'title', value: string) {
    setForm(prev => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => i === idx ? { ...b, [field]: value } : b),
    }));
  }

  function addButton() {
    if (form.buttons.length >= 3) return;
    setForm(prev => ({ ...prev, buttons: [...prev.buttons, { id: 'btn_human', title: '' }] }));
  }

  function removeButton(idx: number) {
    setForm(prev => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.caption.trim() || !form.trigger_keywords.trim()) {
      alert('Title, caption, and at least one trigger keyword are required.');
      return;
    }
    if (!editingId && !file && !form.file_url.trim()) {
      alert('Upload a file or paste a file URL.');
      return;
    }
    setIsSaving(true);
    try {
      const trigger_keywords = form.trigger_keywords.split(',').map(k => k.trim()).filter(Boolean);
      const buttons = form.buttons.filter(b => b.title.trim());

      if (editingId) {
        // Edits are field-only - no re-upload here. Swap the file by
        // duplicating and uploading a new one instead.
        const res = await fetch('/admin/api/bot-media', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            title: form.title,
            key: form.key || null,
            trigger_keywords,
            tag_filter: form.tag_filter || null,
            caption: form.caption,
            buttons,
            file_url: form.file_url,
            filename: form.filename,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(prev => prev.map(r => r.id === editingId ? data.row : r));
      } else {
        const fd = new FormData();
        fd.append('title', form.title);
        fd.append('key', form.key);
        fd.append('trigger_keywords', form.trigger_keywords);
        fd.append('tag_filter', form.tag_filter);
        fd.append('caption', form.caption);
        fd.append('buttons', JSON.stringify(buttons));
        if (file) fd.append('file', file);
        else {
          fd.append('file_url', form.file_url);
          fd.append('filename', form.filename);
        }

        const res = await fetch('/admin/api/bot-media', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(prev => [data.row, ...prev]);
      }
      closeForm();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const visibleRows = rows.filter(r => showArchived ? r.archived : !r.archived);
  const archivedCount = rows.filter(r => r.archived).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bot Media</h1>
            <p className="text-sm text-slate-500 mt-1">Files the WhatsApp bot sends, matched by keyword - no more hardcoded links in the route.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowArchived(s => !s)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${showArchived ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              <Archive size={14} /> Archived ({archivedCount})
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">
              <Plus size={14} /> Add Media
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 space-y-4">
            <h3 className="font-black text-slate-800">{editingId ? 'Edit media' : 'Add media'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Title (admin-facing)" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
              <input placeholder="Key (optional, stable slug)" value={form.key} onChange={e => setForm(p => ({ ...p, key: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
            </div>
            <input placeholder="Trigger keywords, comma-separated (e.g. guide, brochure)" value={form.trigger_keywords} onChange={e => setForm(p => ({ ...p, trigger_keywords: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
            <input placeholder="Tag filter (optional - only applies to leads with this tag, e.g. Irene Primary)" value={form.tag_filter} onChange={e => setForm(p => ({ ...p, tag_filter: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
            <textarea placeholder="Caption / message body sent with the file" value={form.caption} onChange={e => setForm(p => ({ ...p, caption: e.target.value }))} rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">File</label>
              {editingId ? (
                <>
                  <p className="text-[11px] text-slate-400 mb-2">Editing doesn't re-upload a file - to swap the file, use Duplicate on the original and upload a new one there.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="File URL" value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-slate-400" />
                    <input placeholder="Filename shown in WhatsApp" value={form.filename} onChange={e => setForm(p => ({ ...p, filename: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-slate-400" />
                  </div>
                </>
              ) : (
                <>
                  <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm mb-2" />
                  {!file && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <input placeholder="...or paste a file URL instead" value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-slate-400" />
                      <input placeholder="Filename shown in WhatsApp" value={form.filename} onChange={e => setForm(p => ({ ...p, filename: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-slate-400" />
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Buttons (max 3)</label>
              <div className="flex items-start gap-2 mb-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                Only the listed button IDs are actually wired up in the webhook's tap router - a custom ID will show but do nothing when tapped, until the webhook is updated to handle it.
              </div>
              {form.buttons.map((b, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select value={KNOWN_BUTTON_IDS.includes(b.id) ? b.id : 'custom'} onChange={e => updateButton(i, 'id', e.target.value === 'custom' ? '' : e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none">
                    {KNOWN_BUTTON_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                    <option value="custom">custom...</option>
                  </select>
                  {!KNOWN_BUTTON_IDS.includes(b.id) && (
                    <input placeholder="custom_button_id" value={b.id} onChange={e => updateButton(i, 'id', e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none w-28" />
                  )}
                  <input placeholder="Button label" value={b.title} onChange={e => updateButton(i, 'title', e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
                  <button type="button" onClick={() => removeButton(i)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              ))}
              {form.buttons.length < 3 && (
                <button type="button" onClick={addButton} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">+ add button</button>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
              <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">{isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Save'}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : visibleRows.length === 0 ? (
          <div className="py-24 text-center text-slate-400 text-sm">{showArchived ? 'Nothing archived.' : 'No media yet. Add the first one.'}</div>
        ) : (
          <div className="space-y-3">
            {visibleRows.map(row => (
              <div key={row.id} className={`bg-white rounded-2xl border p-4 flex items-start gap-4 ${row.active && !row.archived ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
                <FileText size={20} className="text-slate-400 shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-slate-800">{row.title}</b>
                    {row.trigger_keywords.map(k => <span key={k} className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{k}</span>)}
                    {row.tag_filter && <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">only: {row.tag_filter}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{row.caption}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <a href={row.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-600"><ExternalLink size={11} /> {row.filename}</a>
                    {row.buttons.map(b => <span key={b.id} className="bg-slate-50 px-2 py-0.5 rounded-full">{b.title}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {savingId === row.id && <Loader2 size={14} className="animate-spin text-slate-300" />}
                  <button onClick={() => openEdit(row)} title="Edit" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil size={16} /></button>
                  <button onClick={() => openDuplicate(row)} title="Duplicate" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Copy size={16} /></button>
                  {!row.archived && (
                    <button onClick={() => toggleActive(row)} title={row.active ? 'Deactivate' : 'Activate'} className={`p-2 rounded-lg ${row.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                      {row.active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </button>
                  )}
                  <button onClick={() => toggleArchived(row)} title={row.archived ? 'Unarchive' : 'Archive'} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    {row.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  <button onClick={() => handleDelete(row)} title="Delete permanently" className="p-2 rounded-lg text-rose-400 hover:bg-rose-50"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
