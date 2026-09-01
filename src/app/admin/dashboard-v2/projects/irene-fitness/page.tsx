"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Users, GraduationCap, Eye, Bell, Gift, MessageCircle, Mail, ShieldAlert } from "lucide-react";
import { DashboardV2Nav } from "../../_components/DashboardV2Nav";
import { LightStatTile } from "../../_components/LightStatTile";
import { IreneFitnessBreadcrumb } from "./_components/IreneFitnessBreadcrumb";

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
type GradeStat = { grade: string; response_count: number; child_count: number; vote_count: number };
type GradeStats = { by_grade: GradeStat[]; top_responses_grade: GradeStat | null; top_votes_grade: GradeStat | null };
type DashboardData = {
  summary: Summary;
  votes: { total: number };
  grade_stats: GradeStats;
};

export default function IreneFitnessOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects/irene-fitness")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  function goToResponses(filter: string) {
    router.push(`/admin/dashboard-v2/projects/irene-fitness/responses?filter=${filter}`);
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
          <IreneFitnessBreadcrumb current="Overview" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Irene Primary Fitness Community</h1>
          <p className="text-stone-500 text-sm mt-1">
            {summary.total_responses} responses · {votes.total} votes cast
          </p>
        </div>

        {/* Response summary */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-4">Response Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <LightStatTile onClick={() => goToResponses("all")} label="Total Responses" value={summary.total_responses} icon={Users} color="text-blue-600" />
            <LightStatTile onClick={() => goToResponses("all")} label="Children Registered" value={summary.total_children} icon={GraduationCap} color="text-violet-600" />
            <LightStatTile onClick={() => goToResponses("public_display")} label="Public Display Consent" value={summary.consent_public_display} icon={Eye} color="text-emerald-600" />
            <LightStatTile onClick={() => goToResponses("qa_pending")} label="Pending QA" value={summary.qa_pending} icon={ShieldAlert} color="text-amber-600" />
            <LightStatTile onClick={() => goToResponses("updates")} label="Community Updates Opt-in" value={summary.consent_updates} icon={Bell} color="text-amber-600" />
            <LightStatTile onClick={() => goToResponses("marketing")} label="Marketing Guide Opt-in" value={summary.consent_marketing} icon={Gift} color="text-rose-600" />
            <LightStatTile onClick={() => goToResponses("whatsapp")} label="WhatsApp Provided" value={summary.whatsapp_provided} icon={MessageCircle} color="text-teal-600" />
            <LightStatTile onClick={() => goToResponses("email")} label="Email Provided" value={summary.email_provided} icon={Mail} color="text-slate-600" />
          </div>
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
      </div>
    </div>
  );
}
