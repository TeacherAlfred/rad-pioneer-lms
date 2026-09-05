"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Lock, Unlock, BarChart3, EyeOff, Pencil, Archive, ArchiveRestore, Plus, DatabaseBackup, Download } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { IreneFitnessBreadcrumb } from "../_components/IreneFitnessBreadcrumb";

type Phase = "locked" | "open" | "standings_only";
type Settings = { phase: Phase; updated_at: string | null };
type FaqItem = {
  id: string;
  question: string;
  answer: string;
  link_url: string | null;
  link_label: string | null;
  sort_order: number;
  archived: boolean;
};
type FaqDraft = { question: string; answer: string; link_url: string; link_label: string; sort_order: string };

const EMPTY_FAQ_DRAFT: FaqDraft = { question: "", answer: "", link_url: "", link_label: "", sort_order: "0" };

type MessageTemplate = {
  key: string;
  label: string;
  whatsapp_body: string;
  email_subject: string | null;
  email_body: string | null;
  updated_at: string;
};
type TemplateDraft = { whatsapp_body: string; email_subject: string; email_body: string };

function TemplateEditForm({
  draft,
  hasEmail,
  onChange,
}: {
  draft: TemplateDraft;
  hasEmail: boolean;
  onChange: (d: TemplateDraft) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
          WhatsApp message
        </label>
        <textarea
          value={draft.whatsapp_body}
          onChange={(e) => onChange({ ...draft, whatsapp_body: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </div>
      {hasEmail && (
        <>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
              Email subject
            </label>
            <input
              type="text"
              value={draft.email_subject}
              onChange={(e) => onChange({ ...draft, email_subject: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
              Email message
            </label>
            <textarea
              value={draft.email_body}
              onChange={(e) => onChange({ ...draft, email_body: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
        </>
      )}
      <p className="text-[11px] text-stone-400">
        {"{{name}}"} and {"{{link}}"} (where used) are filled in automatically for each family - everything else is
        sent exactly as written.
      </p>
    </div>
  );
}

type BackupItem = { key: string; size_bytes: number; created_at: string | null; download_url: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PHASES: { key: Phase; label: string; icon: typeof Lock; description: string }[] = [
  { key: "locked", label: "Locked", icon: Lock, description: "Voting page hidden entirely" },
  { key: "open", label: "Open for Votes", icon: Unlock, description: "Anyone can vote" },
  { key: "standings_only", label: "Closed, Standings Visible", icon: BarChart3, description: "Voting stopped, results still shown" },
];

function FaqEditForm({ draft, onChange }: { draft: FaqDraft; onChange: (d: FaqDraft) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Question</label>
        <input
          type="text"
          value={draft.question}
          onChange={(e) => onChange({ ...draft, question: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </div>
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Answer</label>
        <textarea
          value={draft.answer}
          onChange={(e) => onChange({ ...draft, answer: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
            Link URL (optional)
          </label>
          <input
            type="text"
            value={draft.link_url}
            onChange={(e) => onChange({ ...draft, link_url: e.target.value })}
            placeholder="/projects/irene-fitness"
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
            Link label
          </label>
          <input
            type="text"
            value={draft.link_label}
            onChange={(e) => onChange({ ...draft, link_label: e.target.value })}
            placeholder="Go to the submission page"
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Order</label>
          <input
            type="number"
            value={draft.sort_order}
            onChange={(e) => onChange({ ...draft, sort_order: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
      </div>
      <p className="text-[11px] text-stone-400">
        Opt out and Ask us are always shown at the bottom of the FAQ automatically - no need to add them here.
      </p>
    </div>
  );
}

export default function IreneFitnessSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingPhase, setSavingPhase] = useState(false);

  const [faqItems, setFaqItems] = useState<FaqItem[] | null>(null);
  const [faqEditingId, setFaqEditingId] = useState<string | "new" | null>(null);
  const [faqDraft, setFaqDraft] = useState<FaqDraft>(EMPTY_FAQ_DRAFT);
  const [savingFaq, setSavingFaq] = useState(false);

  const [backups, setBackups] = useState<BackupItem[] | null>(null);
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [templateEditingKey, setTemplateEditingKey] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({
    whatsapp_body: "",
    email_subject: "",
    email_body: "",
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  function loadBackups() {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/backup")
      .then((r) => r.json())
      .then((d) => setBackups(d.items || []));
  }

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .finally(() => setLoading(false));
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/faq")
      .then((r) => r.json())
      .then((d) => setFaqItems(d.items || []));
    loadBackups();
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/message-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.items || []));
  }, []);

  function startEditTemplate(t: MessageTemplate) {
    setTemplateEditingKey(t.key);
    setTemplateDraft({
      whatsapp_body: t.whatsapp_body,
      email_subject: t.email_subject || "",
      email_body: t.email_body || "",
    });
  }

  async function saveTemplateDraft() {
    if (!templateEditingKey || savingTemplate || !templateDraft.whatsapp_body.trim()) return;
    setSavingTemplate(true);
    const hasEmail = (templates || []).find((t) => t.key === templateEditingKey)?.email_body !== null;
    const payload = {
      whatsapp_body: templateDraft.whatsapp_body,
      ...(hasEmail
        ? { email_subject: templateDraft.email_subject || null, email_body: templateDraft.email_body || null }
        : {}),
    };
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/message-templates/${templateEditingKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Failed to save");
      setTemplates((items) => (items || []).map((it) => (it.key === templateEditingKey ? updated : it)));
      setTemplateEditingKey(null);
    } catch {
      // Left in edit mode with the draft intact so nothing typed is lost -
      // the admin can just retry Save.
    } finally {
      setSavingTemplate(false);
    }
  }

  async function runBackup() {
    if (runningBackup) return;
    setRunningBackup(true);
    setBackupError(null);
    try {
      const res = await fetch("/admin/api/dashboard-v2/projects/irene-fitness/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backup failed");
      loadBackups();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setRunningBackup(false);
    }
  }

  async function setPhase(phase: Phase) {
    if (!settings || savingPhase || settings.phase === phase) return;
    setSavingPhase(true);
    const prevPhase = settings.phase;
    setSettings({ ...settings, phase });
    try {
      const res = await fetch("/admin/api/dashboard-v2/projects/irene-fitness", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setSettings((s) => (s ? { ...s, phase: prevPhase } : s));
    } finally {
      setSavingPhase(false);
    }
  }

  function startEditFaq(item: FaqItem) {
    setFaqEditingId(item.id);
    setFaqDraft({
      question: item.question,
      answer: item.answer,
      link_url: item.link_url || "",
      link_label: item.link_label || "",
      sort_order: String(item.sort_order),
    });
  }

  function startNewFaq() {
    setFaqEditingId("new");
    setFaqDraft({ ...EMPTY_FAQ_DRAFT, sort_order: String((faqItems?.length || 0) + 1) });
  }

  async function saveFaqDraft() {
    if (!faqEditingId || savingFaq) return;
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
    setSavingFaq(true);
    const payload = {
      question: faqDraft.question.trim(),
      answer: faqDraft.answer.trim(),
      link_url: faqDraft.link_url.trim() || null,
      link_label: faqDraft.link_label.trim() || null,
      sort_order: Number(faqDraft.sort_order) || 0,
    };
    try {
      if (faqEditingId === "new") {
        const res = await fetch("/admin/api/dashboard-v2/projects/irene-fitness/faq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.error || "Failed to save");
        setFaqItems((items) => [...(items || []), created.item]);
      } else {
        const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/faq/${faqEditingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save");
        setFaqItems((items) => (items || []).map((it) => (it.id === faqEditingId ? { ...it, ...payload } : it)));
      }
      setFaqEditingId(null);
    } catch {
      // Left in edit mode with the draft intact so nothing typed is lost -
      // the admin can just retry Save.
    } finally {
      setSavingFaq(false);
    }
  }

  async function toggleFaqArchived(item: FaqItem) {
    const nextArchived = !item.archived;
    setFaqItems((items) => (items || []).map((it) => (it.id === item.id ? { ...it, archived: nextArchived } : it)));
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/faq/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: nextArchived }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setFaqItems((items) => (items || []).map((it) => (it.id === item.id ? { ...it, archived: item.archived } : it)));
    }
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link
            href="/admin/dashboard-v2/projects"
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3"
          >
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <IreneFitnessBreadcrumb current="Settings" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Irene Primary Fitness Community</h1>
          <p className="text-stone-500 text-sm mt-1">Voting phase and public FAQ content</p>
        </div>

        {/* Voting page control */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Voting Page Control</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6 flex flex-col lg:flex-row lg:items-center gap-6 lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {PHASES.map((p) => {
                const isActive = settings.phase === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPhase(p.key)}
                    disabled={savingPhase}
                    title={p.description}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-60 ${
                      isActive ? "bg-stone-900 text-white shadow-sm" : "bg-stone-50 text-stone-500 hover:text-stone-900"
                    }`}
                  >
                    <p.icon size={14} />
                    {p.label}
                  </button>
                );
              })}
            </div>
            <a
              href="/projects/irene-fitness/community"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-50 text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
            >
              <EyeOff size={14} />
              View as Anonymous
            </a>
          </div>
        </section>

        {/* Backups - on-demand snapshots of every Irene Fitness table to R2, so a bad
            change to live data (or an over-eager QA pass) can be recovered from. */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Backups</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-stone-50 text-stone-600">
                  <DatabaseBackup size={22} />
                </div>
                <div>
                  <p className="font-black text-stone-900">Back up every Irene Fitness table</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Families, responses, children, stories, votes, settings and FAQ - one JSON snapshot, stored
                    privately. Restoring from one is a manual process, not automatic.
                  </p>
                </div>
              </div>
              <button
                onClick={runBackup}
                disabled={runningBackup}
                className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-900 text-white disabled:opacity-50 transition-opacity shrink-0"
              >
                {runningBackup ? "Backing up…" : "Back up now"}
              </button>
            </div>

            {backupError && <p className="text-sm text-red-600 mb-4">{backupError}</p>}

            {backups === null ? (
              <p className="text-sm text-stone-400">Loading…</p>
            ) : backups.length === 0 ? (
              <p className="text-sm text-stone-400">No backups yet.</p>
            ) : (
              <div className="border border-stone-100 rounded-2xl divide-y divide-stone-100">
                {backups.map((b) => (
                  <div key={b.key} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-800">
                        {b.created_at
                          ? new Date(b.created_at).toLocaleString("en-ZA", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : b.key}
                      </p>
                      <p className="text-[11px] text-stone-400">{formatBytes(b.size_bytes)}</p>
                    </div>
                    <a
                      href={b.download_url}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors shrink-0"
                      title="Link expires in 10 minutes"
                    >
                      <Download size={14} />
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* FAQ content - read by the public page's FAQ modal, no redeploy needed to change */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400">FAQ Content</h2>
            {faqEditingId !== "new" && (
              <button
                onClick={startNewFaq}
                className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900"
              >
                <Plus size={14} />
                Add question
              </button>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm divide-y divide-stone-100">
            {faqEditingId === "new" && (
              <div className="p-5">
                <FaqEditForm draft={faqDraft} onChange={setFaqDraft} />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={saveFaqDraft}
                    disabled={savingFaq || !faqDraft.question.trim() || !faqDraft.answer.trim()}
                    className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-900 text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setFaqEditingId(null)}
                    className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-50 text-stone-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {faqItems === null && <p className="p-6 text-sm text-stone-400">Loading…</p>}
            {faqItems?.length === 0 && faqEditingId !== "new" && (
              <p className="p-6 text-sm text-stone-400">No FAQ items yet.</p>
            )}

            {faqItems
              ?.slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div key={item.id} className={`p-5 ${item.archived ? "opacity-50" : ""}`}>
                  {faqEditingId === item.id ? (
                    <>
                      <FaqEditForm draft={faqDraft} onChange={setFaqDraft} />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={saveFaqDraft}
                          disabled={savingFaq || !faqDraft.question.trim() || !faqDraft.answer.trim()}
                          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-900 text-white disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setFaqEditingId(null)}
                          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-50 text-stone-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-stone-800 text-sm">
                          {item.archived && (
                            <span className="mr-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-400">
                              Archived
                            </span>
                          )}
                          {item.question}
                        </p>
                        <p className="text-stone-500 text-sm mt-1">{item.answer}</p>
                        {item.link_url && (
                          <p className="text-[11px] text-stone-400 mt-1">
                            Link: {item.link_label || item.link_url} → {item.link_url}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEditFaq(item)}
                          title="Edit"
                          className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-50"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => toggleFaqArchived(item)}
                          title={item.archived ? "Unarchive" : "Archive"}
                          className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-50"
                        >
                          {item.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>

        {/* Message templates - the actual wording behind every WhatsApp/email
            "send" button in this project (guide, personal link, and the
            public share-for-votes button on the community feed).
            {{name}}/{{link}} are the only parts app code substitutes. */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Message Templates</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm divide-y divide-stone-100">
            {templates === null && <p className="p-6 text-sm text-stone-400">Loading…</p>}
            {templates?.map((t) => {
              const hasEmail = t.email_body !== null;
              return (
                <div key={t.key} className="p-5">
                  {templateEditingKey === t.key ? (
                    <>
                      <TemplateEditForm draft={templateDraft} hasEmail={hasEmail} onChange={setTemplateDraft} />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={saveTemplateDraft}
                          disabled={savingTemplate || !templateDraft.whatsapp_body.trim()}
                          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-900 text-white disabled:opacity-40"
                        >
                          {savingTemplate ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setTemplateEditingKey(null)}
                          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-50 text-stone-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-stone-800 text-sm">{t.label}</p>
                        <p className="text-stone-500 text-sm mt-1 whitespace-pre-line line-clamp-3">{t.whatsapp_body}</p>
                      </div>
                      <button
                        onClick={() => startEditTemplate(t)}
                        title="Edit"
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-50 shrink-0"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
