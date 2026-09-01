"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Vote, Smile, Sparkles, FlaskConical } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { IreneFitnessBreadcrumb } from "../_components/IreneFitnessBreadcrumb";

type VoteCategory = "funniest" | "most_inspiring" | "mad_scientist";
type VotesData = { total: number; by_category: Record<VoteCategory, number> };

const VOTE_CATEGORY_LABELS: Record<VoteCategory, string> = {
  funniest: "Funny",
  most_inspiring: "Inspiring",
  mad_scientist: "Craziest Diet",
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

export default function IreneFitnessVotesPage() {
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<VotesData | null>(null);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setVotes(d.votes))
      .finally(() => setLoading(false));
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
      </div>
    </div>
  );
}
