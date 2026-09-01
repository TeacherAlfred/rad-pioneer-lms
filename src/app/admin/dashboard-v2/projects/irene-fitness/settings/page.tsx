"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Lock, Unlock, BarChart3, EyeOff, Pencil, Archive, ArchiveRestore, Plus } from "lucide-react";
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

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .finally(() => setLoading(false));
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/faq")
      .then((r) => r.json())
      .then((d) => setFaqItems(d.items || []));
  }, []);

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
      </div>
    </div>
  );
}
