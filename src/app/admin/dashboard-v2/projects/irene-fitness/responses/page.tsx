"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import {
  Loader2, ArrowLeft, Check, MessageCircle, Mail, ShieldCheck, ShieldAlert, ClipboardCheck, PartyPopper, SkipForward,
} from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { IreneFitnessBreadcrumb } from "../_components/IreneFitnessBreadcrumb";
import { SidePanelDrawer } from "@/components/admin/SidePanelDrawer";

type VoteCategory = "funniest" | "most_inspiring" | "mad_scientist";
type StoryFieldKey =
  | "motivation"
  | "toughest_challenge"
  | "proudest_moment"
  | "weirdest_fuel"
  | "funniest_fail"
  | "boss_level_challenge_2026";

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
  access_token: string;
};
type Summary = { qa_pending: number };
type DashboardData = { summary: Summary; rows: ResponseRow[] };

type QaStory = {
  motivation: string | null;
  club_member: boolean | null;
  club_names: string | null;
  shoe_count: number | null;
  boss_level_challenge_2026: string | null;
  toughest_challenge: string | null;
  proudest_moment: string | null;
  weirdest_fuel: string | null;
  funniest_fail: string | null;
} | null;
type QaQueueItem = {
  response_id: string;
  display_name: string;
  created_at: string;
  whatsapp: string | null;
  email: string | null;
  children: ChildRow[];
  story: QaStory;
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All Responses" },
  { key: "public_display", label: "Public Display Consent" },
  { key: "qa_pending", label: "Pending QA" },
  { key: "updates", label: "Community Updates" },
  { key: "marketing", label: "Marketing Guide" },
  { key: "whatsapp", label: "Has WhatsApp" },
  { key: "email", label: "Has Email" },
];

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

// Same label set as the public feed's own full-story view
// (community/page.tsx's storyAnswers) - the admin should see exactly what a
// visitor would see, not a differently-worded version of it.
function qaStoryAnswers(story: QaStory): { label: string; value: string }[] {
  if (!story) return [];
  const answers: { label: string; value: string }[] = [];
  if (story.motivation) answers.push({ label: "Why I started", value: story.motivation });
  if (story.club_member === true) answers.push({ label: "Fitness club", value: story.club_names || "Yes" });
  if (story.shoe_count !== null && story.shoe_count !== undefined) {
    answers.push({ label: "Pairs of shoes owned", value: String(story.shoe_count) });
  }
  if (story.boss_level_challenge_2026) answers.push({ label: '2026 "Boss Level" goal', value: story.boss_level_challenge_2026 });
  if (story.toughest_challenge) answers.push({ label: "Toughest challenge yet", value: story.toughest_challenge });
  if (story.proudest_moment) answers.push({ label: "Proudest moment", value: story.proudest_moment });
  if (story.weirdest_fuel) answers.push({ label: "Weirdest training fuel", value: story.weirdest_fuel });
  if (story.funniest_fail) answers.push({ label: "Funniest fitness fail", value: story.funniest_fail });
  return answers;
}

type MessageTemplateRecord = { whatsapp_body: string; email_subject: string | null; email_body: string | null };

// {{name}}/{{link}} are the only substitutions performed - everything else
// in an admin-edited template (Settings page) is sent exactly as written.
function fillTemplate(template: string, vars: { name?: string; link?: string }): string {
  let out = template;
  if (vars.name !== undefined) out = out.split("{{name}}").join(vars.name);
  if (vars.link !== undefined) out = out.split("{{link}}").join(vars.link);
  return out;
}

function toWaPhone(phone: string) {
  let p = (phone || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "27" + p.substring(1);
  return p;
}

// The family's durable "my link" (/projects/irene-fitness/me/{access_token})
// - built client-side from window.location.origin since there's no site-URL
// env constant in this codebase, and this button only ever runs in a real
// browser tab anyway.
function myLinkUrl(accessToken: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/projects/irene-fitness/me/${accessToken}`;
}

function QaReviewDrawer({
  queue,
  index,
  confirming,
  onConfirm,
  onSkip,
  onBack,
  onClose,
}: {
  queue: QaQueueItem[];
  index: number;
  confirming: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const item = queue[index];

  if (!item) {
    return (
      <SidePanelDrawer
        onClose={onClose}
        panelClassName="bg-white border-l border-stone-200"
        header={
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600 mb-1">QA Review</p>
            <h2 className="text-xl font-black text-stone-900">All caught up</h2>
          </div>
        }
      >
        <div className="text-center py-12">
          <PartyPopper className="mx-auto mb-4 text-emerald-500" size={40} />
          <p className="text-stone-500 text-sm">Nothing left pending QA right now.</p>
        </div>
      </SidePanelDrawer>
    );
  }

  const answers = qaStoryAnswers(item.story);

  return (
    <SidePanelDrawer
      onClose={onClose}
      panelClassName="bg-white border-l border-stone-200"
      header={
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-1">
            QA Review · {index + 1} of {queue.length}
          </p>
          <h2 className="text-xl font-black text-stone-900">{item.display_name}</h2>
        </div>
      }
      subheader={
        <div className="px-6 md:px-8 py-3 bg-stone-50 border-b border-stone-100 flex flex-wrap gap-2">
          {item.children.length === 0 && <span className="text-xs text-stone-400">No grade on file</span>}
          {item.children.map((c, i) => (
            <span key={i} className="text-[10px] font-bold bg-white text-stone-600 border border-stone-200 px-2 py-1 rounded-full">
              Grade {c.grade}
              {c.class ? ` ${c.class}` : ""}
            </span>
          ))}
          <span className="text-[10px] font-bold bg-white text-stone-600 border border-stone-200 px-2 py-1 rounded-full">
            {item.whatsapp || item.email || "No contact on file"}
          </span>
        </div>
      }
      footer={
        <>
          <button
            onClick={onSkip}
            disabled={confirming}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            <SkipForward size={14} />
            Skip for now
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            <ShieldCheck size={14} />
            {confirming ? "Confirming…" : "Confirm & Next"}
          </button>
        </>
      }
    >
      {index > 0 && (
        <button onClick={onBack} className="text-[11px] font-bold text-stone-400 hover:text-stone-900 mb-4">
          ← Back to previous
        </button>
      )}
      {answers.length === 0 && (
        <p className="text-sm text-stone-400 italic">No story shared — just a display name entry.</p>
      )}
      {answers.map((a, i) => (
        <div key={i} className="mb-5 last:mb-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{a.label}</p>
          <p className="text-sm text-stone-700 leading-relaxed">{a.value}</p>
        </div>
      ))}
    </SidePanelDrawer>
  );
}

type DetailStory = {
  motivation: string | null;
  club_member: boolean | null;
  club_names: string | null;
  shoe_count: number | null;
  boss_level_challenge_2026: string | null;
  toughest_challenge: string | null;
  proudest_moment: string | null;
  weirdest_fuel: string | null;
  funniest_fail: string | null;
  category_overrides: Partial<Record<VoteCategory, StoryFieldKey>> | null;
  featured_category: VoteCategory | null;
};
type ResponseDetail = { display_name: string; story: DetailStory | null };

const CATEGORY_LABELS: Record<VoteCategory, string> = {
  funniest: "Funny",
  most_inspiring: "Inspiring",
  mad_scientist: "Craziest Diet",
};

// Same label set as qaStoryAnswers above - kept as a separate keyed map here
// since the override picker needs to look labels up by field key, not just
// list them in a fixed order.
const STORY_FIELD_LABELS: Record<StoryFieldKey, string> = {
  motivation: "Why I started",
  toughest_challenge: "Toughest challenge yet",
  proudest_moment: "Proudest moment",
  weirdest_fuel: "Weirdest training fuel",
  funniest_fail: "Funniest fitness fail",
  boss_level_challenge_2026: '2026 "Boss Level" goal',
};

// Same field-priority each category defaults to on the public feed
// (community/page.tsx's categoryExcerpt) - shown here so "Auto" in the
// picker tells the admin what it currently resolves to, not just "Auto".
const DEFAULT_CATEGORY_FIELDS: Record<VoteCategory, StoryFieldKey[]> = {
  funniest: ["funniest_fail", "proudest_moment"],
  most_inspiring: ["proudest_moment", "motivation"],
  mad_scientist: ["weirdest_fuel", "toughest_challenge"],
};

function fieldsWithContent(story: DetailStory | null): { key: StoryFieldKey; value: string }[] {
  if (!story) return [];
  return (Object.keys(STORY_FIELD_LABELS) as StoryFieldKey[])
    .map((key) => ({ key, value: story[key] }))
    .filter((f): f is { key: StoryFieldKey; value: string } => !!f.value);
}

function defaultFieldFor(story: DetailStory | null, category: VoteCategory): StoryFieldKey | null {
  if (!story) return null;
  for (const key of DEFAULT_CATEGORY_FIELDS[category]) {
    if (story[key]) return key;
  }
  return null;
}

// Mirrors community/page.tsx's categoryExcerpt/teaserLine exactly (override
// then default-field-priority) so the admin's "what would show right now"
// preview never drifts from what the public card actually renders.
function categoryExcerptPreview(
  story: DetailStory | null,
  category: VoteCategory
): { label: string; value: string } | null {
  if (!story) return null;
  const overrideKey = story.category_overrides?.[category];
  if (overrideKey && story[overrideKey]) return { label: STORY_FIELD_LABELS[overrideKey], value: story[overrideKey]! };
  if (category === "funniest") {
    return story.funniest_fail ? { label: "Funniest fitness fail", value: story.funniest_fail } : null;
  }
  if (category === "most_inspiring") {
    if (story.proudest_moment) return { label: "Proudest moment", value: story.proudest_moment };
    if (story.motivation) return { label: "Why I started", value: story.motivation };
    return null;
  }
  if (story.weirdest_fuel) return { label: "Weirdest training fuel", value: story.weirdest_fuel };
  if (story.toughest_challenge) return { label: "Toughest challenge yet", value: story.toughest_challenge };
  return null;
}

function previewTeaser(story: DetailStory | null): { label: string; value: string } | null {
  if (!story) return null;
  if (story.featured_category) {
    const featured = categoryExcerptPreview(story, story.featured_category);
    if (featured) return featured;
  }
  const overrideKey = story.category_overrides?.funniest;
  if (overrideKey && story[overrideKey]) return { label: STORY_FIELD_LABELS[overrideKey], value: story[overrideKey]! };
  if (story.funniest_fail) return { label: "Funniest fitness fail", value: story.funniest_fail };
  if (story.proudest_moment) return { label: "Proudest moment", value: story.proudest_moment };
  return null;
}

// Lets the admin pick which written answer stands in for each category on
// the public feed/leaderboard, for the responses where the default answer
// (funniest_fail etc.) is blank or just says "N/A" - a per-category select,
// defaulting to "Auto" (whatever community/page.tsx's categoryExcerpt would
// already pick), overridable to any other answer the family actually wrote.
function ResponseDetailDrawer({
  displayName,
  detail,
  loading,
  saving,
  savingFeatured,
  onSetOverride,
  onSetFeatured,
  onClose,
}: {
  displayName: string;
  detail: ResponseDetail | null;
  loading: boolean;
  saving: VoteCategory | null;
  savingFeatured: boolean;
  onSetOverride: (category: VoteCategory, field: StoryFieldKey | null) => void;
  onSetFeatured: (category: VoteCategory | null) => void;
  onClose: () => void;
}) {
  const story = detail?.story ?? null;
  const answers = qaStoryAnswers(story);
  const available = fieldsWithContent(story);
  const preview = previewTeaser(story);

  return (
    <SidePanelDrawer
      onClose={onClose}
      panelClassName="bg-white border-l border-stone-200"
      header={
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1">Response</p>
          <h2 className="text-xl font-black text-stone-900">{displayName}</h2>
        </div>
      }
    >
      {loading && <p className="text-sm text-stone-400 py-12 text-center">Loading…</p>}

      {!loading && (
        <>
          <section className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Featured on card</h3>
            <p className="text-xs text-stone-400 mb-3 leading-relaxed">
              Which category&apos;s answer shows as the one teaser line on the card before &quot;Read full
              story&quot; - the default always picks the funny answer first, which is how a blank or
              &quot;N/A&quot; answer ends up showing publicly.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => onSetFeatured(null)}
                disabled={savingFeatured}
                className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                  !story?.featured_category ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500 hover:text-stone-900"
                }`}
              >
                Auto
              </button>
              {(Object.keys(CATEGORY_LABELS) as VoteCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => onSetFeatured(cat)}
                  disabled={savingFeatured}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    story?.featured_category === cat ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500 hover:text-stone-900"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            {preview ? (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{preview.label}</p>
                <p className="text-sm text-stone-700">{preview.value}</p>
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Nothing would show as a teaser right now.</p>
            )}
          </section>

          <section className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
              Public display, per category
            </h3>
            <p className="text-xs text-stone-400 mb-4 leading-relaxed">
              Choose which answer stands in for each category on the public feed - useful when the default answer is
              blank or just says &quot;N/A&quot;.
            </p>
            {available.length === 0 ? (
              <p className="text-sm text-stone-400 italic">No story shared - nothing to choose from.</p>
            ) : (
              <div className="space-y-3">
                {(Object.keys(CATEGORY_LABELS) as VoteCategory[]).map((cat) => {
                  const override = story?.category_overrides?.[cat] || "";
                  const fallback = defaultFieldFor(story, cat);
                  return (
                    <div key={cat}>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                        {CATEGORY_LABELS[cat]}
                      </label>
                      <select
                        value={override}
                        disabled={saving === cat}
                        onChange={(e) => onSetOverride(cat, (e.target.value || null) as StoryFieldKey | null)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white disabled:opacity-50"
                      >
                        <option value="">Auto{fallback ? ` — ${STORY_FIELD_LABELS[fallback]}` : " — nothing to show"}</option>
                        {available.map((f) => (
                          <option key={f.key} value={f.key}>
                            {STORY_FIELD_LABELS[f.key]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Full story</h3>
            {answers.length === 0 && <p className="text-sm text-stone-400 italic">No story shared.</p>}
            {answers.map((a, i) => (
              <div key={i} className="mb-5 last:mb-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{a.label}</p>
                <p className="text-sm text-stone-700 leading-relaxed">{a.value}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </SidePanelDrawer>
  );
}

function IreneFitnessResponsesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = searchParams.get("filter") || "all";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savingQa, setSavingQa] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, MessageTemplateRecord> | null>(null);

  const [qaQueue, setQaQueue] = useState<QaQueueItem[] | null>(null);
  const [qaDrawerOpen, setQaDrawerOpen] = useState(false);
  const [qaIndex, setQaIndex] = useState(0);
  const [confirmingQa, setConfirmingQa] = useState(false);

  const [detailResponseId, setDetailResponseId] = useState<string | null>(null);
  const [detailDisplayName, setDetailDisplayName] = useState("");
  const [detail, setDetail] = useState<ResponseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingOverride, setSavingOverride] = useState<VoteCategory | null>(null);
  const [savingFeatured, setSavingFeatured] = useState(false);

  function openResponseDetail(row: ResponseRow) {
    if (!row.response_id) return;
    const responseId = row.response_id;
    setDetailResponseId(responseId);
    setDetailDisplayName(row.display_name);
    setDetail(null);
    setDetailLoading(true);
    fetch(`/admin/api/dashboard-v2/projects/irene-fitness/responses/${responseId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .finally(() => setDetailLoading(false));
  }

  async function setOverride(category: VoteCategory, field: StoryFieldKey | null) {
    if (!detailResponseId || savingOverride) return;
    setSavingOverride(category);
    const prevDetail = detail;
    setDetail((d) =>
      d && d.story
        ? {
            ...d,
            story: {
              ...d.story,
              category_overrides: { ...(d.story.category_overrides || {}), [category]: field || undefined },
            },
          }
        : d
    );
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/responses/${detailResponseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_overrides: { [category]: field } }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setDetail(prevDetail);
    } finally {
      setSavingOverride(null);
    }
  }

  async function setFeatured(category: VoteCategory | null) {
    if (!detailResponseId || savingFeatured) return;
    setSavingFeatured(true);
    const prevDetail = detail;
    setDetail((d) => (d && d.story ? { ...d, story: { ...d.story, featured_category: category } } : d));
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/responses/${detailResponseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured_category: category }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setDetail(prevDetail);
    } finally {
      setSavingFeatured(false);
    }
  }

  function loadQaQueue() {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/qa-queue")
      .then((r) => r.json())
      .then((d) => setQaQueue(d.items || []));
  }

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
    loadQaQueue();
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/message-templates")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, MessageTemplateRecord> = {};
        (d.items || []).forEach((t: MessageTemplateRecord & { key: string }) => {
          map[t.key] = t;
        });
        setTemplates(map);
      });
  }, []);

  const rows = data?.rows;
  const filtered = useMemo(() => (rows || []).filter((r) => matchesFilter(r, filter)), [rows, filter]);

  function setFilter(key: string) {
    router.push(`/admin/dashboard-v2/projects/irene-fitness/responses?filter=${key}`);
  }

  function openQaReview() {
    setQaIndex(0);
    setQaDrawerOpen(true);
  }

  function skipQaCurrent() {
    setQaIndex((i) => i + 1);
  }

  function backQaCurrent() {
    setQaIndex((i) => Math.max(0, i - 1));
  }

  // Confirming removes the item from the queue (it's no longer pending) but
  // deliberately doesn't move qaIndex - whatever was "next" slides into the
  // same slot, so the reviewer just keeps hitting the same button in the
  // same place rather than the list jumping around under them.
  async function confirmQaCurrent() {
    const item = qaQueue?.[qaIndex];
    if (!item || confirmingQa) return;
    setConfirmingQa(true);
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/responses/${item.response_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qa_confirmed: true }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setQaQueue((q) => (q || []).filter((it) => it.response_id !== item.response_id));
      setData((d) =>
        d
          ? {
              ...d,
              summary: { ...d.summary, qa_pending: Math.max(0, d.summary.qa_pending - 1) },
              rows: d.rows.map((r) => (r.response_id === item.response_id ? { ...r, qa_confirmed: true } : r)),
            }
          : d
      );
    } catch {
      // Left as-is (still in the queue) so the reviewer can just retry -
      // no partial/ambiguous state to reconcile.
    } finally {
      setConfirmingQa(false);
    }
  }

  async function toggleQa(responseId: string, next: boolean) {
    if (!data || savingQa) return;
    setSavingQa(responseId);
    const prevRows = data.rows;
    const prevPending = data.summary.qa_pending;
    setData({
      ...data,
      summary: { ...data.summary, qa_pending: prevPending + (next ? -1 : 1) },
      rows: data.rows.map((r) => (r.response_id === responseId ? { ...r, qa_confirmed: next } : r)),
    });
    try {
      const res = await fetch(`/admin/api/dashboard-v2/projects/irene-fitness/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qa_confirmed: next }),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Keeps the review queue in sync with a toggle made directly from the
      // table, rather than only reflecting toggles made inside the drawer.
      loadQaQueue();
    } catch {
      setData((d) => (d ? { ...d, rows: prevRows, summary: { ...d.summary, qa_pending: prevPending } } : d));
    } finally {
      setSavingQa(null);
    }
  }

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
    const template = templates?.guide;
    if (!template) return;
    const digits = toWaPhone(row.whatsapp || "");
    const message = fillTemplate(template.whatsapp_body, { name: row.display_name });
    copyToClipboard(message, `${row.family_id}-wa`);
    window.open(`https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`, "_blank");
  }

  function sendGuideEmail(row: ResponseRow) {
    const template = templates?.guide;
    if (!template || !template.email_body) return;
    const subject = template.email_subject || "Your Free Parent's Guide to Hacking Screen Time";
    const body = fillTemplate(template.email_body, { name: row.display_name });
    copyToClipboard(body, `${row.family_id}-email`);
    window.open(`mailto:${row.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  }

  function sendMyLinkWhatsapp(row: ResponseRow) {
    const template = templates?.my_link;
    if (!template) return;
    const digits = toWaPhone(row.whatsapp || "");
    const message = fillTemplate(template.whatsapp_body, { name: row.display_name, link: myLinkUrl(row.access_token) });
    copyToClipboard(message, `${row.family_id}-mylink-wa`);
    window.open(`https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`, "_blank");
  }

  function sendMyLinkEmail(row: ResponseRow) {
    const template = templates?.my_link;
    if (!template || !template.email_body) return;
    const subject = template.email_subject || "Your personal Fit Fam link";
    const body = fillTemplate(template.email_body, { name: row.display_name, link: myLinkUrl(row.access_token) });
    copyToClipboard(body, `${row.family_id}-mylink-email`);
    window.open(`mailto:${row.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  }

  if (loading || !data) {
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
          <IreneFitnessBreadcrumb current="Responses" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Irene Primary Fitness Community</h1>
          <p className="text-stone-500 text-sm mt-1">{data.rows.length} responses</p>
        </div>

        {/* Content moderation */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Content Moderation</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${data.summary.qa_pending > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                <ClipboardCheck size={22} />
              </div>
              <div>
                <p className="font-black text-stone-900">
                  {data.summary.qa_pending > 0
                    ? `${data.summary.qa_pending} response${data.summary.qa_pending === 1 ? "" : "s"} pending QA`
                    : "Nothing pending QA"}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Only QA-confirmed responses show on the public feed or can be voted on.
                </p>
              </div>
            </div>
            <button
              onClick={openQaReview}
              disabled={!qaQueue || qaQueue.length === 0}
              className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-stone-900 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity shrink-0"
            >
              {qaQueue === null ? "Loading…" : "Start reviewing"}
            </button>
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
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">My Link</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.family_id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="px-6 py-4">
                      {row.response_id ? (
                        <button
                          onClick={() => openResponseDetail(row)}
                          className="font-bold text-stone-800 hover:text-[#0066cc] hover:underline text-left"
                        >
                          {row.display_name}
                        </button>
                      ) : (
                        <p className="font-bold text-stone-800">{row.display_name}</p>
                      )}
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
                    <td className="px-6 py-4">
                      {row.whatsapp || row.email ? (
                        <div className="flex items-center gap-2">
                          {row.whatsapp && (
                            <button
                              onClick={() => sendMyLinkWhatsapp(row)}
                              title="Copy my-link message & open WhatsApp"
                              className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                                copiedKey === `${row.family_id}-mylink-wa` ? "bg-emerald-100 text-emerald-700" : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                              }`}
                            >
                              {copiedKey === `${row.family_id}-mylink-wa` ? <Check size={16} /> : <MessageCircle size={16} />}
                              {copiedKey === `${row.family_id}-mylink-wa` && <span className="text-[10px] font-bold">Copied, paste it in</span>}
                            </button>
                          )}
                          {row.email && (
                            <button
                              onClick={() => sendMyLinkEmail(row)}
                              title="Copy my-link message & open email"
                              className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 ${
                                copiedKey === `${row.family_id}-mylink-email` ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {copiedKey === `${row.family_id}-mylink-email` ? <Check size={16} /> : <Mail size={16} />}
                              {copiedKey === `${row.family_id}-mylink-email` && <span className="text-[10px] font-bold">Copied, paste it in</span>}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-300 text-xs">No contact on file</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-stone-400 text-sm">
                      No responses match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {qaDrawerOpen && qaQueue && (
          <QaReviewDrawer
            queue={qaQueue}
            index={qaIndex}
            confirming={confirmingQa}
            onConfirm={confirmQaCurrent}
            onSkip={skipQaCurrent}
            onBack={backQaCurrent}
            onClose={() => setQaDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailResponseId && (
          <ResponseDetailDrawer
            displayName={detailDisplayName}
            detail={detail}
            loading={detailLoading}
            saving={savingOverride}
            savingFeatured={savingFeatured}
            onSetOverride={setOverride}
            onSetFeatured={setFeatured}
            onClose={() => setDetailResponseId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function IreneFitnessResponsesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
          <Loader2 className="animate-spin text-stone-300" size={32} />
        </div>
      }
    >
      <IreneFitnessResponsesInner />
    </Suspense>
  );
}
