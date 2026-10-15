"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Archive, Check, Loader2, PenLine, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import ReportCard from "@/components/reports/ReportCard";
import { FACT_NAMES, GenerationError, PLACEHOLDERS, generateContent, unknownPlaceholders } from "@/lib/reports/generate";
import { api } from "@/lib/reports/client";
import {
  SECTION_FIELDS, type Condition, type ConditionOp, type FactValue, type NarrativeTemplate, type ReportContent,
  type Rubric, type TemplateSection,
} from "@/lib/reports/types";

const SECTIONS: { key: TemplateSection; label: string }[] = [
  { key: "strength", label: "Strengths" },
  { key: "growth", label: "Area to grow" },
  { key: "learner_note", label: "Note for the learner" },
  { key: "whats_next", label: "What's next" },
];
const OPS: ConditionOp[] = ["eq", "neq", "gt", "gte", "lt", "lte", "in"];

type Draft = {
  key: string; section: TemplateSection; label: string; priority: number;
  fields: Record<string, string>; conds: { fact: string; op: ConditionOp; value: string }[]; area: string;
};

function showValue(v: Condition["value"]): string {
  return Array.isArray(v) ? v.map(x => String(x)).join(", ") : String(v);
}
function parseValue(raw: string, op: ConditionOp): Condition["value"] {
  const one = (s: string): FactValue => {
    const t = s.trim();
    if (t === "true") return true;
    if (t === "false") return false;
    if (t === "null") return null;
    if (t !== "" && !Number.isNaN(Number(t))) return Number(t);
    return t;
  };
  return op === "in" ? raw.split(",").map(one) : one(raw);
}
function toDraft(t: NarrativeTemplate): Draft {
  return {
    key: t.key, section: t.section, label: t.label, priority: t.priority, fields: { ...t.fields },
    conds: t.conditions.all.map(c => ({ fact: c.fact, op: c.op, value: showValue(c.value) })), area: t.conditions.area ?? "",
  };
}
function fromDraft(d: Draft): Pick<NarrativeTemplate, "key" | "section" | "label" | "priority" | "fields" | "conditions"> {
  const all = d.conds.map(c => ({ fact: c.fact, op: c.op, value: parseValue(c.value, c.op) }));
  return { key: d.key, section: d.section, label: d.label, priority: d.priority, fields: d.fields, conditions: d.area ? { all, area: d.area } : { all } };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<NarrativeTemplate[] | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"templates" | "rubrics">("templates");

  async function load() {
    try {
      const d = await api<{ templates: NarrativeTemplate[]; rubrics: Rubric[] }>("/admin/api/reports/templates");
      setTemplates(d.templates);
      setRubrics(d.rubrics);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api("/admin/api/reports/templates", { method: "POST", json: fromDraft(draft) });
      toast.success("Saved as a new version. Existing reports are unchanged.");
      setDraft(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function retire(key: string) {
    if (!confirm(`Retire ${key}? New drafts stop using it; existing reports keep their wording.`)) return;
    try {
      await api(`/admin/api/reports/templates?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      toast.success("Retired");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) return <div className="min-h-screen flex items-center justify-center text-rose-500 text-sm">{error}</div>;
  if (!templates) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  const active = templates.filter(t => t.is_active);
  const retiredKeys = [...new Set(templates.filter(t => !active.some(a => a.key === t.key)).map(t => t.key))];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-5">
        <Link href="/admin/reports" className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 mb-2 w-fit"><ArrowLeft size={13} /> Report cards</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Templates &amp; rubrics</h1>
            <p className="text-[13px] text-slate-400 mt-1">Rules pick a template per section from the learner&apos;s scores. Saving creates a new version; reports already generated never change.</p>
          </div>
          <div className="inline-flex rounded-full bg-slate-100 p-0.5">
            {(["templates", "rubrics"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`text-[13px] font-medium rounded-full px-4 py-1 ${tab === t ? "bg-white shadow-sm" : "text-slate-500"}`}>{t === "templates" ? "Templates" : "Rubrics"}</button>
            ))}
          </div>
        </div>
      </header>

      {tab === "rubrics" ? <RubricsEditor rubrics={rubrics} onSaved={load} /> : (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          <div className="space-y-6">
            {SECTIONS.map(sec => (
              <section key={sec.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{sec.label} · tried in priority order</h2>
                  <button
                    onClick={() => setDraft({ key: `${sec.key}.`, section: sec.key, label: "", priority: 50, fields: Object.fromEntries(SECTION_FIELDS[sec.key].map(f => [f.key, ""])), conds: [], area: "" })}
                    className="text-[12px] text-slate-600 inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white"
                  ><Plus size={13} /> New</button>
                </div>
                {active.filter(t => t.section === sec.key).sort((a, b) => a.priority - b.priority).map(t => (
                  <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-start gap-3">
                    <span className="text-[11px] tabular-nums text-slate-400 w-6 pt-0.5">{t.priority}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{t.label} <code className="text-[11px] text-slate-400">{t.key} v{t.version}</code></p>
                      <p className="text-[12px] text-slate-500 truncate">{t.fields.title ?? t.fields.text}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t.conditions.all.length ? t.conditions.all.map(c => `${c.fact} ${c.op} ${showValue(c.value)}`).join(" and ") : "Always (fallback)"}
                        {t.conditions.area ? ` · goal area ${t.conditions.area}` : ""}
                      </p>
                    </div>
                    <button onClick={() => setDraft(toDraft(t))} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Edit ${t.key}`}><PenLine size={15} /></button>
                    <button onClick={() => retire(t.key)} className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Retire ${t.key}`}><Archive size={15} /></button>
                  </div>
                ))}
              </section>
            ))}
            {retiredKeys.length > 0 && <p className="text-[12px] text-slate-400">Retired: {retiredKeys.join(", ")} (open a new template with the same key to bring one back).</p>}
          </div>
          <SamplePreview rubrics={rubrics} templates={active} draft={draft} />
        </main>
      )}

      <AnimatePresence>
        {draft && (
          <motion.div className="fixed inset-0 z-50 bg-slate-900/30 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDraft(null)}>
            <motion.aside className="h-full w-full max-w-xl bg-white overflow-y-auto shadow-xl" initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} onClick={e => e.stopPropagation()}>
              <TemplateForm draft={draft} rubrics={rubrics} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} saving={saving} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TemplateForm({ draft, rubrics, onChange, onClose, onSave, saving }: {
  draft: Draft; rubrics: Rubric[]; onChange: (d: Draft) => void; onClose: () => void; onSave: () => void; saving: boolean;
}) {
  const facts = FACT_NAMES(rubrics);
  const areaRefs = rubrics.flatMap(r => r.areas.map(a => `${r.subject}.${a.key}`));
  const badPlaceholders = Object.values(draft.fields).flatMap(unknownPlaceholders);
  return (
    <div className="text-slate-900">
      <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-2">
        <h2 className="font-semibold mr-auto">{draft.label || draft.key}</h2>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onSave} disabled={saving || badPlaceholders.length > 0} className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-slate-900 rounded-full px-3.5 py-2 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save new version
        </motion.button>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
          <Field label="Key"><input value={draft.key} onChange={e => onChange({ ...draft, key: e.target.value })} className="input" /></Field>
          <Field label="Label"><input value={draft.label} onChange={e => onChange({ ...draft, label: e.target.value })} className="input" /></Field>
          <Field label="Priority"><input type="number" value={draft.priority} onChange={e => onChange({ ...draft, priority: Number(e.target.value) })} className="input" /></Field>
        </div>

        <div className="space-y-2">
          <p className="text-[12px] text-slate-500">Conditions (all must match; none = fallback)</p>
          {draft.conds.map((c, i) => (
            <div key={i} className="flex gap-1.5">
              <select value={c.fact} onChange={e => onChange({ ...draft, conds: draft.conds.map((x, j) => j === i ? { ...x, fact: e.target.value } : x) })} className="input flex-1">
                {facts.map(f => <option key={f}>{f}</option>)}
              </select>
              <select value={c.op} onChange={e => onChange({ ...draft, conds: draft.conds.map((x, j) => j === i ? { ...x, op: e.target.value as ConditionOp } : x) })} className="input w-20">
                {OPS.map(o => <option key={o}>{o}</option>)}
              </select>
              <input value={c.value} onChange={e => onChange({ ...draft, conds: draft.conds.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} placeholder="excellent / 0 / true" className="input flex-1" />
              <button onClick={() => onChange({ ...draft, conds: draft.conds.filter((_, j) => j !== i) })} className="p-2 text-slate-400 hover:text-rose-600" aria-label="Remove condition"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => onChange({ ...draft, conds: [...draft.conds, { fact: facts[0], op: "eq", value: "" }] })} className="text-[12px] text-slate-600 inline-flex items-center gap-1 hover:underline"><Plus size={12} /> Add condition</button>
        </div>

        {draft.section === "growth" && (
          <Field label="Goal area (optional - otherwise the learner's weakest area)">
            <select value={draft.area} onChange={e => onChange({ ...draft, area: e.target.value })} className="input">
              <option value="">Weakest area</option>
              {areaRefs.map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>
        )}

        {SECTION_FIELDS[draft.section].map(f => (
          <Field key={f.key} label={`${f.label} · aim for ${f.limit} characters`}>
            <textarea value={draft.fields[f.key] ?? ""} onChange={e => onChange({ ...draft, fields: { ...draft.fields, [f.key]: e.target.value } })} rows={f.key === "title" ? 1 : 4} className="input resize-y" />
          </Field>
        ))}
        {badPlaceholders.length > 0 && <p className="text-[12px] text-rose-600">Unknown placeholder: {`{{${badPlaceholders[0]}}}`}</p>}
        <p className="text-[12px] text-slate-400">Placeholders: {PLACEHOLDERS.map(p => `{{${p}}}`).join(" ")}</p>
      </div>
      <style>{`.input{width:100%;font-size:14px;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;background:#fff;outline:none}.input:focus{border-color:#94a3b8}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[12px] text-slate-500 mb-1">{label}</span>{children}</label>;
}

// Runs the real generator in the browser against a hand-picked sample
// learner, with the template being edited swapped in for its active version.
function SamplePreview({ rubrics, templates, draft }: { rubrics: Rubric[]; templates: NarrativeTemplate[]; draft: Draft | null }) {
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [lessons, setLessons] = useState(0);
  const levelFor = (r: Rubric) => levels[r.subject] ?? r.levels[r.levels.length - 1]?.id ?? "";

  const scores = Object.fromEntries(rubrics.flatMap(r => r.areas.map(a => [a.id, levelFor(r)])));
  let pool = templates;
  if (draft) {
    const d = fromDraft(draft);
    pool = [...templates.filter(t => t.key !== d.key), { ...d, id: "draft", version: 0, is_active: true, created_by: null, created_at: "" }];
  }
  let content: ReportContent | null = null;
  let err: string | null = null;
  try {
    content = generateContent({
      rubrics, templates: pool,
      learner: { firstName: "Sam", programmeName: "Coding & Robotics Programme", programmeLine: "Coding & Robotics Programme", periodLabel: "Sample", issuedOn: new Date().toISOString().slice(0, 10), scores, lessonsToCatchUp: lessons },
    });
  } catch (e) {
    err = e instanceof GenerationError ? e.message : (e as Error).message;
  }
  const draftMatches = draft && content ? content.sections.some(s => s.template_key === draft.key) : false;

  return (
    <div className="lg:sticky lg:top-4 space-y-3">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2 text-slate-900">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sample learner</p>
        {rubrics.map(r => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <span className="w-20 text-slate-500">{r.label}</span>
            {r.levels.map(l => (
              <button key={l.id} onClick={() => setLevels({ ...levels, [r.subject]: l.id })} className={`text-[12px] rounded-full px-2.5 py-1 border ${levelFor(r) === l.id ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500"}`}>{l.label}</button>
            ))}
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <span className="w-20 text-slate-500">Catch up</span>
          <input type="number" min={0} max={20} value={lessons} onChange={e => setLessons(Math.max(0, Number(e.target.value)))} className="w-16 border border-slate-200 rounded-lg px-2 py-1" />
          <span className="text-[12px] text-slate-400">lessons</span>
        </label>
        {draft && (
          <p className={`text-[12px] flex items-center gap-1 ${draftMatches ? "text-emerald-700" : "text-slate-400"}`}>
            {draftMatches ? <><Check size={12} /> {draft.key} is used for this learner</> : <>{draft.key} doesn&apos;t match this learner</>}
          </p>
        )}
      </div>
      {err && <p className="text-[13px] text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{err}</p>}
      {content && (
        <div className="rounded-[28px] border-8 border-slate-900 bg-[#F3F5F4] overflow-y-auto max-h-[70vh] p-3">
          <ReportCard content={content} theme="light" />
        </div>
      )}
    </div>
  );
}

// Descriptor wording per area and level. Edited in place: every report
// snapshots the descriptors it showed, so old reports keep their wording.
function RubricsEditor({ rubrics, onSaved }: { rubrics: Rubric[]; onSaved: () => void }) {
  const [savedKey, setSavedKey] = useState<string | null>(null);

  async function save(areaId: string, levelId: string, text: string, original: string) {
    if (text.trim() === original.trim() || !text.trim()) return;
    try {
      await api("/admin/api/reports/rubrics", { method: "PATCH", json: { areaId, levelId, text } });
      setSavedKey(`${areaId}:${levelId}`);
      setTimeout(() => setSavedKey(k => (k === `${areaId}:${levelId}` ? null : k)), 1500);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-900">
      {rubrics.map(r => (
        <section key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 font-semibold border-b border-slate-100">{r.label} <span className="text-[12px] font-normal text-slate-400">v{r.version}</span></h2>
          <div className="divide-y divide-slate-50">
            {r.areas.map(a => (
              <div key={a.id} className="px-4 py-3 grid sm:grid-cols-[180px_1fr] gap-2">
                <p className="text-sm font-medium">{a.label}</p>
                <div className="space-y-1.5">
                  {[...r.levels].reverse().map(l => {
                    const original = a.descriptors[l.key] ?? "";
                    const k = `${a.id}:${l.id}`;
                    return (
                      <label key={l.id} className="flex items-center gap-2">
                        <span className="w-20 text-[12px] text-slate-400">{l.label}</span>
                        <input
                          defaultValue={original}
                          onBlur={e => save(a.id, l.id, e.target.value, original)}
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                        <span className="w-4">{savedKey === k && <Check size={14} className="text-emerald-600" />}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
