"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Loader2, Rocket, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAllLocalProgress } from "@/lib/tutorialLocalProgress";
import { TUTORIAL_LEVELS, TUTORIAL_CATEGORIES } from "@/lib/tutorialTaxonomy";
import TutorialOfferCard from "@/components/tutorials/TutorialOfferCard";
import SaveProgressPrompt from "@/components/tutorials/SaveProgressPrompt";
import TopicVoteSection from "@/components/tutorials/TopicVoteSection";

type Series = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: "beginner" | "intermediate" | "advanced";
  category: string | null;
  estimated_minutes: number | null;
  cover_image_url: string | null;
};

type TutorialRef = { id: string; series_id: string };

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function TutorialsHubPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [tutorialRefs, setTutorialRefs] = useState<TutorialRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchLibrary() {
      const [{ data: seriesRows }, { data: tutorialRows }] = await Promise.all([
        supabase.from("tutorial_series").select("id, slug, title, description, level, category, estimated_minutes, cover_image_url").order("sort_order", { ascending: true }),
        supabase.from("tutorials").select("id, series_id"),
      ]);
      setSeries(seriesRows || []);
      setTutorialRefs(tutorialRows || []);
      setLoading(false);
    }
    fetchLibrary();
  }, []);

  const filtered = series.filter(s =>
    (levelFilter === "all" || s.level === levelFilter) &&
    (categoryFilter === "all" || s.category === categoryFilter)
  );

  const localProgress = typeof window !== "undefined" ? getAllLocalProgress() : {};

  function seriesProgress(seriesId: string) {
    const tutorialIds = tutorialRefs.filter(t => t.series_id === seriesId).map(t => t.id);
    if (tutorialIds.length === 0) return null;
    const started = tutorialIds.filter(id => localProgress[id]);
    if (started.length === 0) return null;
    const completed = tutorialIds.filter(id => localProgress[id]?.completedAt).length;
    return { total: tutorialIds.length, completed };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-rad-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 bg-rad-blue/10 text-rad-blue text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 mb-4">
          <Sparkles size={12} /> Free coding tutorials
        </div>
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900 mb-2">Tutorial Hub</h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">Step-by-step coding tutorials.</p>
      </div>

      <div className="flex flex-nowrap gap-2 mb-8">
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="flex-1 min-w-0 text-xs font-bold border border-slate-200 rounded-full px-3 py-2 bg-white truncate">
          <option value="all">All levels</option>
          {TUTORIAL_LEVELS.map(o => <option key={o.value} value={o.value} disabled={!o.enabled}>{o.label}{!o.enabled ? ' (Coming soon)' : ''}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="flex-1 min-w-0 text-xs font-bold border border-slate-200 rounded-full px-3 py-2 bg-white truncate">
          <option value="all">All categories</option>
          {TUTORIAL_CATEGORIES.map(o => <option key={o.value} value={o.value} disabled={!o.enabled}>{o.label}{!o.enabled ? ' (Coming soon)' : ''}</option>)}
        </select>
      </div>

      <div className="mb-6">
        <TutorialOfferCard placement="hub_card" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {filtered.map(s => {
          const progress = seriesProgress(s.id);
          const pct = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
          return (
            <Link
              key={s.id}
              href={`/tutorials/${s.slug}`}
              className="group bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative w-full aspect-video bg-gradient-to-br from-rad-blue/10 to-rad-purple/10 overflow-hidden">
                {s.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Rocket className="text-rad-blue/30" size={36} />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1">{LEVEL_LABEL[s.level]}</span>
                  {s.category && <span className="text-[9px] font-black uppercase tracking-widest text-white bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1">{s.category}</span>}
                </div>
                {progress?.completed === progress?.total && progress && (
                  <div className="absolute top-2.5 right-2.5 bg-rad-green rounded-full p-1 shadow-lg">
                    <CheckCircle2 size={16} className="text-white" />
                  </div>
                )}
              </div>

              <div className="p-4">
                <h2 className="text-sm font-black text-slate-900 mb-1 leading-tight">{s.title}</h2>
                {s.description && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">{s.description}</p>}

                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {s.estimated_minutes ? (
                    <span className="flex items-center gap-1"><Clock size={11} /> {s.estimated_minutes} min</span>
                  ) : <span />}
                  {progress && <span className="text-rad-blue">{progress.completed}/{progress.total} done</span>}
                </div>

                {progress && (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-rad-blue rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                <div className="flex justify-end mt-2">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rad-blue">
                    Click to access <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-slate-400 py-12">No tutorials match those filters yet.</p>
        )}
      </div>

      <div className="mb-6">
        <TopicVoteSection />
      </div>

      <SaveProgressPrompt variant="quiet" />
    </div>
  );
}
