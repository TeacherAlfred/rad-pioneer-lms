"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  MessageCircle,
  Mail,
  ArrowLeft,
  Check,
  Users,
  GraduationCap,
  Eye,
  Bell,
  Gift,
  Vote,
  Smile,
  Sparkles,
  FlaskConical,
  Lock,
  Unlock,
  BarChart3,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Archive,
  ArchiveRestore,
  Plus,
} from "lucide-react";
import { DashboardV2Nav } from "../../_components/DashboardV2Nav";
import { LightStatTile } from "../../_components/LightStatTile";

type ChildRow = { grade: string; class: string | null };
type ResponseRow = {
  family_id: string;
  response_id: string | null;
  display_name: string;
  whatsapp: string | null;
  email: string | null;
  consent_public_display: boolean;
  consent_updates: boolean;
  consent_marketing: boolean;
  qa_confirmed: boolean | null;
  created_at: string;
  children: ChildRow[];
};
type Summary = {
  total_responses: number;
  total_children: number;
  consent_public_display: number;
  consent_updates: number;
  consent_marketing: number;
  whatsapp_provided: number;
  email_provided: number;
  qa_pending: number;
};
type VoteCategory = "funniest" | "most_inspiring" | "mad_scientist";
type VotesSummary = { total: number; by_category: Record<VoteCategory, number> };
type GradeStat = { grade: string; response_count: number; child_count: number; vote_count: number };
type GradeStats = { by_grade: GradeStat[]; top_responses_grade: GradeStat | null; top_votes_grade: GradeStat | null };
type Phase = "locked" | "open" | "standings_only";
type DashboardData = {
  summary: Summary;
  votes: VotesSummary;
  grade_stats: GradeStats;
  settings: { phase: Phase; updated_at: string | null };
  rows: ResponseRow[];
};
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

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All Responses" },
  { key: "public_display", label: "Public Display Consent" },
  { key: "qa_pending", label: "Pending QA" },
  { key: "updates", label: "Community Updates" },
  { key: "marketing", label: "Marketing Guide" },
  { key: "whatsapp", label: "Has WhatsApp" },
  { key: "email", label: "Has Email" },
];

const VOTE_CATEGORY_LABELS: Record<VoteCategory, string> = {
  funniest: "Funny",
  most_inspiring: "Inspiring",
  mad_scientist: "Craziest Diet",
};

const PHASES: { key: Phase; label: string; icon: typeof Lock; description: string }[] = [
  { key: "locked", label: "Locked", icon: Lock, description: "Voting page hidden entirely" },
  { key: "open", label: "Open for Votes", icon: Unlock, description: "Anyone can vote" },
  { key: "standings_only", label: "Closed, Standings Visible", icon: BarChart3, description: "Voting stopped, results still shown" },
];

// Families type local SA numbers on the consent form (e.g. "082 123 4567"),
// stored digits-only with the leading 0 intact. WhatsApp's click-to-chat
// needs the full international form (27...) to resolve to that specific
// contact - without it, api.whatsapp.com can't match anyone and just opens
// the app's home screen instead of the chat. Same fix as session-photos'
// toWaPhone.
function toWaPhone(phone: string) {
  let p = (phone || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "27" + p.substring(1);
  return p;
}

function matchesFilter(row: ResponseRow, filter: string) {
  switch (filter) {
    case "public_display":
      return row.consent_public_display;
    case "qa_pending":
      return row.qa_confirmed === false;
    case "updates":
      return row.consent_updates;
    case "marketing":
      return row.consent_marketing;
    case "whatsapp":
      return !!row.whatsapp;
    case "email":
      return !!row.email;
    default:
      return true;
  }
}

// The chat/email can't carry an attachment, so these just open pre-filled
// with the guide copy - the admin still attaches the actual PDF by hand in
// WhatsApp Business (desktop) or their mail client before sending.
// Gated on consent_marketing: that's the specific opt-in this guide was
// promised under, so it's the only group these actions show up for.
//
// Addressed by the full display name as entered on the form, not a
// first-name split - some are entered as e.g. "Nxumalo Family", and
// truncating to the first word there reads as addressing a person named
// "Nxumalo" instead of the family.
function guideMessageBody(displayName: string, { markdown }: { markdown: boolean }) {
  const communityLine = markdown
    ? "Thanks for joining the _Irene Primary Health & Wellness community_!"
    : "Thanks for joining the Irene Primary Health & Wellness community!";
  return `Good afternoon ${displayName},\n\n${communityLine}\n\nAs promised, here's RAD Academy's free Parent's Guide to Hacking Screen Time - a quick read on turning screen time into a real skill (yes, even Minecraft - and applies to any kids who spend time on a screen).\n\nNext week we'll send a second free guide too - this one all about getting kids to understand how fitness devices work, a guide to go with the community you've just joined.\n\nNo strings attached, just something useful for your family 🙌`;
}
function guideEmailBody(displayName: string) {
  return `${guideMessageBody(displayName, { markdown: false })}\n\nBest regards,\nThe RAD Academy Team`;
}

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

function VoteBadge({ icon: Icon, label, value }: { icon: typeof Vote; label: string; value: number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-stone-50 text-rose-600">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.15em]">{label}</p>
        <p className="text-xl font-black text-stone-900">{value}</p>
      </div>
    </div>
  );
}

function IreneFitnessDashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = searchParams.get("filter") || "all";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savingPhase, setSavingPhase] = useState(false);
  const [savingQa, setSavingQa] = useState<string | null>(null);

  const [faqItems, setFaqItems] = useState<FaqItem[] | null>(null);
  const [faqEditingId, setFaqEditingId] = useState<string | "new" | null>(null);
  const [faqDraft, setFaqDraft] = useState<FaqDraft>(EMPTY_FAQ_DRAFT);
  const [savingFaq, setSavingFaq] = useState(false);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/faq")
      .then((r) => r.json())
      .then((d) => setFaqItems(d.items || []));
  }, []);

  const rows = data?.rows;
  const filtered = useMemo(() => (rows || []).filter((r) => matchesFilter(r, filter)), [rows, filter]);

  function setFilter(key: string) {
    router.push(`/admin/dashboard-v2/projects/irene-fitness?filter=${key}`);
  }

  async function setPhase(phase: Phase) {
    if (!data || savingPhase || data.settings.phase === phase) return;
    setSavingPhase(true);
    const prevPhase = data.settings.phase;
    setData({ ...data, settings: { ...data.settings, phase } });
    try {
      const res = await fetch("/admin/api/dashboard-v2/projects/irene-fitness", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setData((d) => (d ? { ...d, settings: { ...d.settings, phase: prevPhase } } : d));
    } finally {
      setSavingPhase(false);
    }
  }

  // Optimistic toggle + rollback, same shape as everywhere else in this
  // dashboard. responseId can be null for a family with no response row yet
  // ("(no response yet)") - nothing to QA in that case, so the button is
  // disabled rather than reachable.
  async function toggleQa(responseId: string, next: boolean) {
    if (!data || savingQa) return;
    setSavingQa(responseId);
    const prevRows = data.rows;
    setData({
      ...data,
      rows: data.rows.map((r) => (r.response_id === responseId ? { ...r, qa_confirmed: next } : r)),
    });
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qa_confirmed: next }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setData((d) => (d ? { ...d, rows: prevRows } : d));
    } finally {
      setSavingQa(null);
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

  // Neither wa.me nor api.whatsapp.com reliably carries ?text= through to
  // the WhatsApp desktop app - it opens the right chat but drops the
  // pre-fill (a long-standing desktop-client limitation, not a URL-format
  // bug). So the message is copied to the clipboard first, guaranteed to
  // work regardless of that quirk - the admin just pastes it once the
  // chat/email window is open.
  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 3000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) - the ?text=
      // param still gets a shot at pre-filling on its own in that case.
    }
  }

  function sendGuideWhatsapp(row: ResponseRow) {
    const digits = toWaPhone(row.whatsapp || "");
    const message = guideMessageBody(row.display_name, { markdown: true });
    copyToClipboard(message, `${row.family_id}-wa`);
    window.open(`https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`, "_blank");
  }

  function sendGuideEmail(row: ResponseRow) {
    const subject = "Your Free Parent's Guide to Hacking Screen Time";
    const body = guideEmailBody(row.display_name);
    copyToClipboard(body, `${row.family_id}-email`);
    window.open(`mailto:${row.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  const { summary, votes, grade_stats } = data;

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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Irene Primary Fitness Community</h1>
          <p className="text-stone-500 text-sm mt-1">
            {summary.total_responses} responses · {votes.total} votes cast
          </p>
        </div>

        {/* Response summary */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Response Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <LightStatTile onClick={() => setFilter("all")} label="Total Responses" value={summary.total_responses} icon={Users} color="text-blue-600" />
            <LightStatTile onClick={() => setFilter("all")} label="Children Registered" value={summary.total_children} icon={GraduationCap} color="text-violet-600" />
            <LightStatTile onClick={() => setFilter("public_display")} label="Public Display Consent" value={summary.consent_public_display} icon={Eye} color="text-emerald-600" />
            <LightStatTile onClick={() => setFilter("qa_pending")} label="Pending QA" value={summary.qa_pending} icon={ShieldAlert} color="text-amber-600" />
            <LightStatTile onClick={() => setFilter("updates")} label="Community Updates Opt-in" value={summary.consent_updates} icon={Bell} color="text-amber-600" />
            <LightStatTile onClick={() => setFilter("marketing")} label="Marketing Guide Opt-in" value={summary.consent_marketing} icon={Gift} color="text-rose-600" />
            <LightStatTile onClick={() => setFilter("whatsapp")} label="WhatsApp Provided" value={summary.whatsapp_provided} icon={MessageCircle} color="text-teal-600" />
            <LightStatTile onClick={() => setFilter("email")} label="Email Provided" value={summary.email_provided} icon={Mail} color="text-slate-600" />
          </div>
        </section>

        {/* Vote summary */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Vote Counts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <VoteBadge icon={Vote} label="Total Votes" value={votes.total} />
            <VoteBadge icon={Smile} label={VOTE_CATEGORY_LABELS.funniest} value={votes.by_category.funniest} />
            <VoteBadge icon={Sparkles} label={VOTE_CATEGORY_LABELS.most_inspiring} value={votes.by_category.most_inspiring} />
            <VoteBadge icon={FlaskConical} label={VOTE_CATEGORY_LABELS.mad_scientist} value={votes.by_category.mad_scientist} />
          </div>
          {votes.total === 0 && (
            <p className="text-[11px] text-stone-400 mt-2">
              No votes yet - the public voting page hasn&apos;t shipped, so this will read 0 until it does.
            </p>
          )}
        </section>

        {/* Grade stats */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Grade Stats</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-5">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.15em] mb-1">Most Responses</p>
              {grade_stats.top_responses_grade ? (
                <p className="text-2xl font-black text-stone-900">
                  Grade {grade_stats.top_responses_grade.grade}
                  <span className="text-sm font-bold text-stone-400 ml-2">({grade_stats.top_responses_grade.response_count})</span>
                </p>
              ) : (
                <p className="text-sm text-stone-300">No data yet</p>
              )}
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.15em] mb-1">Most Votes</p>
              {grade_stats.top_votes_grade ? (
                <p className="text-2xl font-black text-stone-900">
                  Grade {grade_stats.top_votes_grade.grade}
                  <span className="text-sm font-bold text-stone-400 ml-2">({grade_stats.top_votes_grade.vote_count})</span>
                </p>
              ) : (
                <p className="text-sm text-stone-300">No votes yet</p>
              )}
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Grade</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Responses</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Children</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-400">Votes</th>
                </tr>
              </thead>
              <tbody>
                {grade_stats.by_grade.map((g) => (
                  <tr key={g.grade} className="border-b border-stone-50 last:border-0">
                    <td className="px-6 py-3 font-bold text-stone-800">Grade {g.grade}</td>
                    <td className="px-6 py-3 text-stone-600">{g.response_count}</td>
                    <td className="px-6 py-3 text-stone-600">{g.child_count}</td>
                    <td className="px-6 py-3 text-stone-600">{g.vote_count}</td>
                  </tr>
                ))}
                {grade_stats.by_grade.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-stone-400 text-sm">
                      No grade data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Voting page control */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Voting Page Control</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6 flex flex-col lg:flex-row lg:items-center gap-6 lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {PHASES.map((p) => {
                const isActive = data.settings.phase === p.key;
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

        {/* Response table */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">
            Responses ({filtered.length} of {data.rows.length})
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  filter === f.key
                    ? "bg-stone-900 text-white shadow-sm"
                    : "bg-white border border-stone-200 text-stone-500 hover:text-stone-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Family</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Children</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Consent</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">QA</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Submitted</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Guide</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.family_id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="px-6 py-4">
                      <p className="font-bold text-stone-800">{row.display_name}</p>
                      <p className="text-[11px] text-stone-400">{row.whatsapp || row.email || "No contact on file"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {row.children.length === 0 && <span className="text-stone-300 text-xs">—</span>}
                        {row.children.map((c, i) => (
                          <span key={i} className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
                            Grade {c.grade}
                            {c.class ? ` ${c.class}` : ""}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {row.consent_public_display && (
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Public</span>
                        )}
                        {row.consent_updates && (
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700">Updates</span>
                        )}
                        {row.consent_marketing && (
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-rose-100 text-rose-700">Marketing</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {row.response_id ? (
                        <button
                          onClick={() => toggleQa(row.response_id!, !row.qa_confirmed)}
                          disabled={savingQa === row.response_id}
                          title={row.qa_confirmed ? "QA confirmed - click to mark pending" : "Pending QA - click to confirm"}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                            row.qa_confirmed
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          {row.qa_confirmed ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                          {row.qa_confirmed ? "Confirmed" : "Pending"}
                        </button>
                      ) : (
                        <span className="text-stone-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-500">
                      {new Date(row.created_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      {row.consent_marketing ? (
                        <div className="flex items-center gap-2">
                          {row.whatsapp && (
                            <button
                              onClick={() => sendGuideWhatsapp(row)}
                              title="Copy guide message & open WhatsApp"
                              className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                                copiedKey === `${row.family_id}-wa` ? "bg-emerald-100 text-emerald-700" : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                              }`}
                            >
                              {copiedKey === `${row.family_id}-wa` ? <Check size={16} /> : <MessageCircle size={16} />}
                              {copiedKey === `${row.family_id}-wa` && <span className="text-[10px] font-bold">Copied, paste it in</span>}
                            </button>
                          )}
                          {row.email && (
                            <button
                              onClick={() => sendGuideEmail(row)}
                              title="Copy guide message & open email"
                              className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                                copiedKey === `${row.family_id}-email` ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {copiedKey === `${row.family_id}-email` ? <Check size={16} /> : <Mail size={16} />}
                              {copiedKey === `${row.family_id}-email` && <span className="text-[10px] font-bold">Copied, paste it in</span>}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-300 text-xs">Not opted in</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-stone-400 text-sm">
                      No responses match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function IreneFitnessDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
          <Loader2 className="animate-spin text-stone-300" size={32} />
        </div>
      }
    >
      <IreneFitnessDashboardInner />
    </Suspense>
  );
}
