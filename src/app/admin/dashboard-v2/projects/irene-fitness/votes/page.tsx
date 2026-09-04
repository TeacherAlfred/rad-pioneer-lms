"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Vote, Smile, Sparkles, FlaskConical, Trophy } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { IreneFitnessBreadcrumb } from "../_components/IreneFitnessBreadcrumb";

type VoteCategory = "funniest" | "most_inspiring" | "mad_scientist";
type VotesData = { total: number; by_category: Record<VoteCategory, number> };
type OverallEntry = {
  response_id: string;
  display_name: string;
  total: number;
  funniest: number;
  most_inspiring: number;
  mad_scientist: number;
};
type CategoryEntry = { response_id: string; display_name: string; votes: number };
type LeaderboardData = { overall: OverallEntry[]; by_category: Record<VoteCategory, CategoryEntry[]> };

const VOTE_CATEGORIES: VoteCategory[] = ["funniest", "most_inspiring", "mad_scientist"];

const VOTE_CATEGORY_LABELS: Record<VoteCategory, string> = {
  funniest: "Funny",
  most_inspiring: "Inspiring",
  mad_scientist: "Craziest Diet",
};
const VOTE_CATEGORY_ICONS: Record<VoteCategory, typeof Smile> = {
  funniest: Smile,
  most_inspiring: Sparkles,
  mad_scientist: FlaskConical,
};
// Same accent colours as the public vote buttons (community/page.tsx's
// CATEGORY_CONFIG) - the category is instantly recognisable to whoever
// already knows the public page, not a differently-coloured version of it.
const VOTE_CATEGORY_COLORS: Record<VoteCategory, { text: string; bgTint: string }> = {
  funniest: { text: "text-teal-700", bgTint: "bg-teal-50" },
  most_inspiring: { text: "text-[#0066cc]", bgTint: "bg-blue-50" },
  mad_scientist: { text: "text-violet-700", bgTint: "bg-violet-50" },
};

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

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${
        rank === 1 ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"
      }`}
    >
      {rank}
    </span>
  );
}

function OverallLeaderboard({ entries }: { entries: OverallEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-stone-400 p-6">No votes cast yet.</p>;
  }
  return (
    <div className="divide-y divide-stone-100">
      {entries.map((e, i) => (
        <div key={e.response_id} className="flex items-center gap-4 px-6 py-4">
          <RankBadge rank={i + 1} />
          <p className="font-bold text-stone-800 flex-1 min-w-0 truncate">{e.display_name}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {VOTE_CATEGORIES.map((cat) => {
              const Icon = VOTE_CATEGORY_ICONS[cat];
              const colors = VOTE_CATEGORY_COLORS[cat];
              const count = e[cat];
              if (count === 0) return null;
              return (
                <span
                  key={cat}
                  title={VOTE_CATEGORY_LABELS[cat]}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black ${colors.bgTint} ${colors.text}`}
                >
                  <Icon size={11} />
                  {count}
                </span>
              );
            })}
          </div>
          <p className="text-lg font-black text-stone-900 w-10 text-right shrink-0">{e.total}</p>
        </div>
      ))}
    </div>
  );
}

function CategoryLeaderboard({ category, entries }: { category: VoteCategory; entries: CategoryEntry[] }) {
  const Icon = VOTE_CATEGORY_ICONS[category];
  const colors = VOTE_CATEGORY_COLORS[category];
  return (
    <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-4 border-b border-stone-100`}>
        <span className={`p-1.5 rounded-lg ${colors.bgTint} ${colors.text}`}>
          <Icon size={14} />
        </span>
        <p className="text-[11px] font-black uppercase tracking-widest text-stone-500">
          {VOTE_CATEGORY_LABELS[category]}
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-400 p-5">No votes in this category yet.</p>
      ) : (
        <div className="divide-y divide-stone-50">
          {entries.map((e, i) => (
            <div key={e.response_id} className="flex items-center gap-3 px-5 py-3">
              <RankBadge rank={i + 1} />
              <p className="text-sm font-bold text-stone-800 flex-1 min-w-0 truncate">{e.display_name}</p>
              <p className="text-sm font-black text-stone-900 shrink-0">{e.votes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IreneFitnessVotesPage() {
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<VotesData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setVotes(d.votes))
      .finally(() => setLoading(false));
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/vote-leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaderboard(d));
  }, []);

  if (loading || !votes) {
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
          <IreneFitnessBreadcrumb current="Votes" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Irene Primary Fitness Community</h1>
          <p className="text-stone-500 text-sm mt-1">{votes.total} votes cast</p>
        </div>

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
              No votes yet — check the Responses page for how many are still pending QA (only QA-confirmed responses
              are voteable).
            </p>
          )}
        </section>

        {/* Leaderboards - where the votes have actually gone, not just how many */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Overall Leaderboard</h2>
          <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-100">
              <Trophy size={16} className="text-amber-500" />
              <p className="text-[11px] font-black uppercase tracking-widest text-stone-500">Top {leaderboard?.overall.length || 0} by total votes</p>
            </div>
            {leaderboard ? (
              <OverallLeaderboard entries={leaderboard.overall} />
            ) : (
              <p className="text-sm text-stone-400 p-6">Loading…</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Leaderboard by Category</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {VOTE_CATEGORIES.map((cat) => (
              <CategoryLeaderboard key={cat} category={cat} entries={leaderboard?.by_category[cat] || []} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
