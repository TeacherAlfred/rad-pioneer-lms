"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Plus, Trash2, CheckCircle2, XCircle, Pencil, AlertTriangle,
  ArrowLeft, MessageSquare, Send, GitBranch,
} from "lucide-react";

type Button = { id: string; title: string };

type FlowRow = {
  id: string;
  trigger_button_id: string;
  label: string;
  action_type: 'message' | 'template';
  message_body: string | null;
  message_buttons: Button[];
  template_name: string | null;
  template_language: string | null;
  template_variables: string[];
  template_variable_names: string[];
  set_source: string | null;
  add_tags: string[];
  notify_admin: boolean;
  skip_human_handoff: boolean;
  active: boolean;
  created_at: string;
};

type MetaTemplate = { name: string; language: string; category: string; variableNames: string[]; bodyPreview: string };

const emptyForm = {
  trigger_button_id: '',
  label: '',
  action_type: 'message' as 'message' | 'template',
  message_body: '',
  message_buttons: [] as Button[],
  template_key: '', // "name|language" combined key for the picker
  template_name: '',
  template_language: '',
  template_variables: [] as string[],
  template_variable_names: [] as string[],
  set_source: '',
  add_tags: '',
  notify_admin: false,
  skip_human_handoff: true,
};

export default function BotFlowsPage() {
  const [rows, setRows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => { fetchRows(); }, []);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/bot-flows');
      const data = await res.json();
      if (res.ok) setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplatesIfNeeded() {
    if (templates.length > 0 || templatesLoading) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch('/admin/api/lead-funnel/templates');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load templates');
      setTemplates(data.templates || []);
    } catch (err: any) {
      setTemplatesError(err.message);
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function patchRow(id: string, fields: Record<string, any>) {
    setSavingId(id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    await fetch('/admin/api/bot-flows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    setSavingId(null);
  }

  function toggleActive(row: FlowRow) {
    patchRow(row.id, { active: !row.active });
  }

  async function handleDelete(row: FlowRow) {
    if (!confirm(`Delete the "${row.label}" flow (trigger: ${row.trigger_button_id})? This can't be undone.`)) return;
    setSavingId(row.id);
    const res = await fetch(`/admin/api/bot-flows?id=${row.id}`, { method: 'DELETE' });
    if (res.ok) setRows(prev => prev.filter(r => r.id !== row.id));
    setSavingId(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setSaveError(null);
    setShowForm(true);
    loadTemplatesIfNeeded();
  }

  function openEdit(row: FlowRow) {
    const templateKey = row.template_name && row.template_language ? `${row.template_name}|${row.template_language}` : '';
    setForm({
      trigger_button_id: row.trigger_button_id,
      label: row.label,
      action_type: row.action_type,
      message_body: row.message_body || '',
      message_buttons: row.message_buttons || [],
      template_key: templateKey,
      template_name: row.template_name || '',
      template_language: row.template_language || '',
      template_variables: row.template_variables || [],
      template_variable_names: row.template_variable_names || [],
      set_source: row.set_source || '',
      add_tags: (row.add_tags || []).join(', '),
      notify_admin: row.notify_admin,
      skip_human_handoff: row.skip_human_handoff,
    });
    setEditingId(row.id);
    setSaveError(null);
    setShowForm(true);
    loadTemplatesIfNeeded();
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
    setSaveError(null);
  }

  function selectTemplate(key: string) {
    const t = templates.find(t => `${t.name}|${t.language}` === key);
    setForm(f => ({
      ...f,
      template_key: key,
      template_name: t?.name || '',
      template_language: t?.language || '',
      template_variables: t ? Array(t.variableNames.length).fill('') : [],
      template_variable_names: t?.variableNames || [],
    }));
  }

  function updateButton(idx: number, field: 'id' | 'title', value: string) {
    setForm(prev => ({
      ...prev,
      message_buttons: prev.message_buttons.map((b, i) => i === idx ? { ...b, [field]: value } : b),
    }));
  }

  function addButton() {
    if (form.message_buttons.length >= 3) return;
    setForm(prev => ({ ...prev, message_buttons: [...prev.message_buttons, { id: '', title: '' }] }));
  }

  function removeButton(idx: number) {
    setForm(prev => ({ ...prev, message_buttons: prev.message_buttons.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    if (!form.trigger_button_id.trim() || !form.label.trim()) {
      setSaveError('Trigger button id and label are required.');
      return;
    }
    if (form.action_type === 'message' && !form.message_body.trim()) {
      setSaveError('Message body is required for a message flow.');
      return;
    }
    if (form.action_type === 'template' && (!form.template_name.trim() || !form.template_language.trim())) {
      setSaveError('Pick an approved template.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        trigger_button_id: form.trigger_button_id.trim(),
        label: form.label.trim(),
        action_type: form.action_type,
        message_body: form.action_type === 'message' ? form.message_body.trim() : null,
        message_buttons: form.action_type === 'message' ? form.message_buttons.filter(b => b.id.trim() && b.title.trim()) : [],
        template_name: form.action_type === 'template' ? form.template_name.trim() : null,
        template_language: form.action_type === 'template' ? form.template_language.trim() : null,
        template_variables: form.action_type === 'template' ? form.template_variables : [],
        template_variable_names: form.action_type === 'template' ? form.template_variable_names : [],
        set_source: form.set_source.trim() || null,
        add_tags: form.add_tags.split(',').map(t => t.trim()).filter(Boolean),
        notify_admin: form.notify_admin,
        skip_human_handoff: form.skip_human_handoff,
      };

      const res = editingId
        ? await fetch('/admin/api/bot-flows', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, ...payload }),
          })
        : await fetch('/admin/api/bot-flows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (editingId) {
        setRows(prev => prev.map(r => r.id === editingId ? data.row : r));
      } else {
        setRows(prev => [data.row, ...prev]);
      }
      closeForm();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
            <ArrowLeft size={14} /> Lead Funnel
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bot Flows</h1>
            <p className="text-sm text-slate-500 mt-1">Automated responses keyed by button id - chain a self-serve message or fire a template, without a code change.</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">
            <Plus size={14} /> Add Flow
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 space-y-4">
            <h3 className="font-black text-slate-800">{editingId ? 'Edit flow' : 'Add flow'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input placeholder="Trigger button id, e.g. btn_events" value={form.trigger_button_id} onChange={e => setForm(p => ({ ...p, trigger_button_id: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                <p className="text-[11px] text-slate-400 mt-1">The exact button id that fires this - the welcome message's own buttons (btn_events, btn_human) work here too, as do other flows' own button ids for chaining.</p>
              </div>
              <input placeholder="Label (admin-facing)" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400 h-fit" />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, action_type: 'message' }))} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border ${form.action_type === 'message' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}>
                <MessageSquare size={13} className="inline -mt-0.5 mr-1" /> Freeform Message
              </button>
              <button type="button" onClick={() => { setForm(p => ({ ...p, action_type: 'template' })); loadTemplatesIfNeeded(); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border ${form.action_type === 'template' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}>
                <Send size={13} className="inline -mt-0.5 mr-1" /> Meta Template
              </button>
            </div>

            {form.action_type === 'message' ? (
              <>
                <textarea placeholder="Message body sent when this fires" value={form.message_body} onChange={e => setForm(p => ({ ...p, message_body: e.target.value }))} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Buttons (max 3, optional)</label>
                  {form.message_buttons.map((b, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input placeholder="button_id (or another flow's trigger id, to chain)" value={b.id} onChange={e => updateButton(i, 'id', e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none w-64" />
                      <div className="flex-1 relative">
                        <input placeholder="Button label" value={b.title} onChange={e => updateButton(i, 'title', e.target.value)} maxLength={20} className={`w-full bg-slate-50 border rounded-lg px-3 py-2 pr-10 text-xs outline-none ${b.title.length > 20 ? 'border-rose-400' : 'border-slate-200'}`} />
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold ${b.title.length > 20 ? 'text-rose-500' : 'text-slate-300'}`}>{b.title.length}/20</span>
                      </div>
                      <button type="button" onClick={() => removeButton(i)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {form.message_buttons.length < 3 && (
                    <button type="button" onClick={addButton} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">+ add button</button>
                  )}
                </div>
              </>
            ) : (
              <div>
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader2 size={14} className="animate-spin" /> Loading approved templates...</div>
                ) : templatesError ? (
                  <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Couldn't load templates ({templatesError}).</p>
                ) : (
                  <>
                    <select value={form.template_key} onChange={e => selectTemplate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400 mb-2">
                      <option value="">Select an approved template...</option>
                      {templates.map(t => (
                        <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language}, {t.category})</option>
                      ))}
                    </select>
                    {form.template_key && (
                      <p className="text-[11px] text-slate-400 italic mb-2">"{templates.find(t => `${t.name}|${t.language}` === form.template_key)?.bodyPreview}"</p>
                    )}
                    {form.template_variable_names.map((vn, i) => (
                      <input
                        key={i}
                        placeholder={`{{${vn}}} - literal text or {{name}}/{{phone}}/{{school}}/{{class}}/{{source}} to auto-fill from the lead`}
                        value={form.template_variables[i] || ''}
                        onChange={e => setForm(p => ({ ...p, template_variables: p.template_variables.map((v, idx) => idx === i ? e.target.value : v) }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none mb-2"
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input placeholder="Tag on lead.source (optional)" value={form.set_source} onChange={e => setForm(p => ({ ...p, set_source: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400" />
                <p className="text-[11px] text-slate-400 mt-1">e.g. warm_list_whats_on_pretoria - so you can tell which flow actually converts.</p>
              </div>
              <input placeholder="Add tags, comma-separated (optional)" value={form.add_tags} onChange={e => setForm(p => ({ ...p, add_tags: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400 h-fit" />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.skip_human_handoff} onChange={e => setForm(p => ({ ...p, skip_human_handoff: e.target.checked }))} /> Self-serve (don't flag needs_human)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.notify_admin} onChange={e => setForm(p => ({ ...p, notify_admin: e.target.checked }))} /> Notify admin when this fires
              </label>
            </div>

            {saveError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-3">{saveError}</div>}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 border border-slate-200">Cancel</button>
              <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-slate-900 disabled:opacity-50">{isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Save'}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-24 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" /> Loading...</div>
        ) : rows.length === 0 ? (
          <div className="py-24 text-center text-slate-400 text-sm">No flows yet. Add the first one.</div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.id} className={`bg-white rounded-2xl border p-4 flex items-start gap-4 ${row.active ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
                <GitBranch size={20} className="text-slate-400 shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-slate-800">{row.label}</b>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{row.trigger_button_id}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${row.action_type === 'template' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                      {row.action_type === 'template' ? 'Template' : 'Message'}
                    </span>
                    {row.set_source && <span className="text-[10px] font-black uppercase tracking-widest bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">source: {row.set_source}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {row.action_type === 'template' ? `Template: ${row.template_name} (${row.template_language})` : row.message_body}
                  </p>
                  {row.message_buttons?.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                      {row.message_buttons.map(b => <span key={b.id} className="bg-slate-50 px-2 py-0.5 rounded-full">{b.title} → {b.id}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {savingId === row.id && <Loader2 size={14} className="animate-spin text-slate-300" />}
                  <button onClick={() => openEdit(row)} title="Edit" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil size={16} /></button>
                  <button onClick={() => toggleActive(row)} title={row.active ? 'Deactivate' : 'Activate'} className={`p-2 rounded-lg ${row.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                    {row.active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
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
