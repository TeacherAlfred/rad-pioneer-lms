"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Vote, Smile, Sparkles, FlaskConical, Trophy } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
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
type CategoryEntry = { response_id: string; display_name: string; votes: number; excerpt: string | null };
type LeaderboardData = { overall: OverallEntry[]; by_category: Record<VoteCategory, CategoryEntry[]> };

type DailyPoint = { date: string; votes: number; people: number };
type ClassPodiumEntry = { grade: string; class: string; votes: number };
type VotesInsights = {
  daily: DailyPoint[];
  class_podiums: { grade_r_to_3: ClassPodiumEntry[]; grade_4_to_7: ClassPodiumEntry[] };
};

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

// Quick-glance "category champion" strip - who's leading each category
// right now, at a glance, before the full ranked-by-total list below. Shows
// only that category's count for that response, not the full per-category
// breakdown OverallLeaderboard's rows show.
function CategoryChampionCard({ category, entry }: { category: VoteCategory; entry: CategoryEntry | null }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = VOTE_CATEGORY_ICONS[category];
  const colors = VOTE_CATEGORY_COLORS[category];
  return (
    // h-full + grid's default row-stretch keeps all three cards the same
    // height regardless of how long any one parent's excerpt runs -
    // line-clamp-3 below caps the excerpt itself so a long answer doesn't
    // still blow the row out to essay length.
    <div className="h-full flex flex-col bg-white border border-stone-200 rounded-[24px] shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={`p-1.5 rounded-lg ${colors.bgTint} ${colors.text}`}>
          <Icon size={14} />
        </span>
        <p className="text-[11px] font-black uppercase tracking-widest text-stone-500">
          {VOTE_CATEGORY_LABELS[category]}
        </p>
      </div>
      {entry ? (
        <>
          <div className="flex items-center gap-3">
            <RankBadge rank={1} />
            <p className="text-sm font-bold text-stone-800 flex-1 min-w-0 truncate">{entry.display_name}</p>
            <p className="text-sm font-black text-stone-900 shrink-0">{entry.votes}</p>
          </div>
          {entry.excerpt && (
            <div className="mt-3 pt-3 border-t border-stone-100 flex-1 flex flex-col">
              <p className={`text-sm text-stone-600 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
                {entry.excerpt}
              </p>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-xs font-bold text-[#0066cc] mt-1 self-start"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-stone-400">No votes yet.</p>
      )}
    </div>
  );
}

// "Votes cast" (bars) is every category tap, same convention as the Vote
// Counts tiles above (a person voted for in all 3 categories counts 3
// times) - "people voted for" (line) is distinct responses that received
// at least one vote that day, so the two series read very differently on
// a day with a few people getting swept in every category vs. many people
// each getting just one tap.
function VotesDailyChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-stone-400 flex items-center justify-center h-full">No votes yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0eee9" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#a8a29e" }}
          tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        />
        {/* Two separate number lines, not one shared axis - votes and
            people are different units and can sit at very different scales
            once a full week of data is in. */}
        <YAxis
          yAxisId="votes"
          tick={{ fontSize: 11, fill: "#0066cc" }}
          width={30}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="people"
          orientation="right"
          tick={{ fontSize: 11, fill: "#f59e0b" }}
          width={30}
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* maxBarSize keeps bars from ballooning wide with only a few days
            of data, so a full 7-day week fits the same footprint without
            the chart needing to grow or the bars needing to shrink later. */}
        <Bar yAxisId="votes" dataKey="votes" name="Votes cast" fill="#0066cc" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line
          yAxisId="people"
          type="monotone"
          dataKey="people"
          name="People voted for"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ClassPodium({ title, entries }: { title: string; entries: ClassPodiumEntry[] }) {
  return (
    <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100">
        <Trophy size={14} className="text-amber-500" />
        <p className="text-[11px] font-black uppercase tracking-widest text-stone-500">{title}</p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-400 p-5">No votes yet.</p>
      ) : (
        <div className="divide-y divide-stone-50">
          {entries.map((e, i) => (
            <div key={`${e.grade}-${e.class}`} className="flex items-center gap-3 px-5 py-3">
              <RankBadge rank={i + 1} />
              <p className="text-sm font-bold text-stone-800 flex-1 min-w-0 truncate">
                Grade {e.grade} — {e.class}
              </p>
              <p className="text-sm font-black text-stone-900 shrink-0">{e.votes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
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
  const [insights, setInsights] = useState<VotesInsights | null>(null);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setVotes(d.votes))
      .finally(() => setLoading(false));
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/vote-leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaderboard(d));
    fetch("/admin/api/dashboard-v2/projects/irene-fitness/votes-insights")
      .then((r) => r.json())
      .then((d) => setInsights(d));
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

        {/* Admin-only read on how voting is going - not shown on the public
            feed/leaderboard. Daily trend on the left, top classes by grade
            band on the right. */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-3">
                Daily Votes &amp; People Voted For
              </p>
              <div className="h-52">
                <VotesDailyChart data={insights?.daily || []} />
              </div>
            </div>
            <div className="space-y-4">
              <ClassPodium title="Top Classes — Grade R to 3" entries={insights?.class_podiums.grade_r_to_3 || []} />
              <ClassPodium title="Top Classes — Grade 4 to 7" entries={insights?.class_podiums.grade_4_to_7 || []} />
            </div>
          </div>
        </section>

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {VOTE_CATEGORIES.map((cat) => (
              <CategoryChampionCard key={cat} category={cat} entry={leaderboard?.by_category[cat]?.[0] || null} />
            ))}
          </div>

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
