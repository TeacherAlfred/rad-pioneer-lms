"use client";

import { useState } from "react";
import { Loader2, MessageCircle, X, Sparkles, ShieldCheck } from "lucide-react";
import { LEAD_AUTOFIELDS, resolveVariable } from "@/lib/metaTemplate";

type MetaTemplate = {
  name: string;
  language: string;
  variableNames: string[];
  variableLabels?: string[];
  bodyPreview: string;
};

// Fields DesktopSendButton knows how to auto-resolve a template variable
// against, same set as LEAD_AUTOFIELDS - optional because two of this
// component's four call sites (Message Activity, the Lead Journey
// dashboard) only have leadId/phone in scope, not the full lead row. With
// none of these, an autofield token is just left as literal "{{name}}" text
// in the composer for the admin to fill in by hand, same degraded case
// resolveVariable already handles for an unmatched column.
type LeadFields = { name?: string | null; email?: string | null; school?: string | null; class?: string | null; source?: string | null };

// Logs a manual "opened WhatsApp Desktop/Web to send this" attempt before
// handing off to wa.me - there's no API delivery confirmation possible for
// a message sent by hand, so the honest record is "the admin clicked send
// with this text," not a real status. Same log-before-open pattern as
// dashboard-v2/projects/irene-fitness's message-sends click log, applied to
// the lead-funnel Messages Outbox (2026-09-08) rather than duplicated again.
//
// Template mode (2026-09-10) reuses the same approved-templates list and
// variable auto-fill as the List/Messages pages' WABA send flow, but there's
// no Meta template-send call here - wa.me only ever carries plain text, so
// picking a template just composes its resolved wording into the same
// freeform textarea as a starting draft, same as "Start from a bot-flow
// message" does for a WABA reply. The admin can still edit it before
// sending, unlike a real WABA template send where Meta enforces the exact
// registered wording.
export function DesktopSendButton({
  leadId,
  phone,
  lead,
  className,
}: {
  leadId: string;
  phone: string;
  lead?: LeadFields;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"freeform" | "template">("freeform");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const selectedTemplate = templates.find(t => `${t.name}|${t.language}` === selectedTemplateKey) || null;

  function openModal() {
    setOpen(true);
    setMode("freeform");
    setText("");
    setError(null);
    setSelectedTemplateKey("");
    setTemplateVariables([]);
  }

  async function chooseTemplateMode() {
    setMode("template");
    if (templates.length === 0 && !templatesError && !templatesLoading) {
      setTemplatesLoading(true);
      try {
        const res = await fetch("/admin/api/lead-funnel/templates");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load templates");
        setTemplates(data.templates || []);
      } catch (err: any) {
        setTemplatesError(err.message);
      } finally {
        setTemplatesLoading(false);
      }
    }
  }

  function composeText(template: MetaTemplate, vars: string[]) {
    const leadRecord = { name: lead?.name, phone, email: lead?.email, school: lead?.school, class: lead?.class, source: lead?.source };
    let i = 0;
    return template.bodyPreview.replace(/\{\{\s*[\w]+\s*\}\}/g, () => resolveVariable(vars[i++] || "", leadRecord));
  }

  function selectTemplate(key: string) {
    setSelectedTemplateKey(key);
    const t = templates.find(t => `${t.name}|${t.language}` === key);
    if (!t) return;
    const initialVars = t.variableNames.map((vn, i) => {
      const label = (t.variableLabels?.[i] || vn).toLowerCase();
      return LEAD_AUTOFIELDS.includes(label) ? `{{${label}}}` : "";
    });
    setTemplateVariables(initialVars);
    setText(composeText(t, initialVars));
  }

  function updateTemplateVariable(index: number, value: string) {
    setTemplateVariables(prev => {
      const next = [...prev];
      next[index] = value;
      if (selectedTemplate) setText(composeText(selectedTemplate, next));
      return next;
    });
  }

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/lead-funnel/sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, phone, body: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log the send");
      const digits = phone.replace(/\D/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`, "_blank", "noopener,noreferrer");
      setText("");
      setOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        title="Open WhatsApp Desktop/Web with a message, and log the attempt"
        className={className || "inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"}
      >
        <MessageCircle size={12} /> Desktop WA
      </button>

      {open && (
        <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 pt-6 pb-1 shrink-0">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">Send via WhatsApp Desktop</h3>
                <p className="text-[13px] text-slate-400 mt-0.5">+{phone} · opens outside the system, no delivery confirmation possible</p>
              </div>
              <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"><X size={13} /></button>
            </div>

            <div className="px-6 pt-4 shrink-0">
              <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setMode("freeform")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${mode === "freeform" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Freeform
                </button>
                <button
                  onClick={chooseTemplateMode}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${mode === "template" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Template
                </button>
              </div>
            </div>

            <div className="px-6 pt-4 pb-5 space-y-3 overflow-y-auto">
              {mode === "template" && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><ShieldCheck size={11} /> Start from an approved template</label>
                  {templatesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader2 size={14} className="animate-spin" /> Loading approved templates from Meta...</div>
                  ) : (
                    <select
                      value={selectedTemplateKey}
                      onChange={e => selectTemplate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-700 outline-none focus:border-blue-400"
                    >
                      <option value="">Choose a template...</option>
                      {templates.map(t => (
                        <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>
                      ))}
                    </select>
                  )}
                  {templatesError && <p className="text-[11px] text-amber-600 mt-1">Couldn't load templates from Meta ({templatesError}).</p>}
                  {!templatesLoading && !templatesError && templates.length === 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">No approved templates found.</p>
                  )}

                  {selectedTemplate && (
                    <div className="mt-2.5 space-y-2 bg-slate-50 rounded-[10px] p-3">
                      <p className="text-[12px] text-slate-500 italic">"{selectedTemplate.bodyPreview}"</p>
                      {selectedTemplate.variableNames.map((vn, i) => (
                        <input
                          key={i}
                          value={templateVariables[i] || ""}
                          onChange={e => updateTemplateVariable(i, e.target.value)}
                          placeholder={`{{${selectedTemplate.variableLabels?.[i] || vn}}} or literal text`}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-blue-400"
                        />
                      ))}
                      <p className="text-[11px] text-slate-400 flex items-center gap-1"><Sparkles size={11} /> Composed below - edit freely before sending, this isn't a Meta template send.</p>
                    </div>
                  )}
                </div>
              )}

              <textarea
                autoFocus={mode === "freeform"}
                rows={4}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What are you sending?"
                className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 resize-none"
              />
              {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150">Cancel</button>
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : "Log & Open WhatsApp"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
