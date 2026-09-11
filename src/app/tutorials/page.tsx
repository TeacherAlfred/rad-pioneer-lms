"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Loader2, Rocket, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAllLocalProgress } from "@/lib/tutorialLocalProgress";
import TutorialOfferCard from "@/components/tutorials/TutorialOfferCard";
import SaveProgressPrompt from "@/components/tutorials/SaveProgressPrompt";

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

  const categories = useMemo(() => Array.from(new Set(series.map(s => s.category).filter(Boolean))) as string[], [series]);

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
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900 mb-2">Tutorial Hub</h1>
        <p className="text-slate-500 text-sm">Step-by-step coding tutorials - follow along on your phone while you build.</p>
      </div>

      {(categories.length > 0 || filtered.length > 3) && (
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="text-xs font-bold border border-slate-200 rounded-full px-4 py-2 bg-white">
            <option value="all">All levels</option>
            {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {categories.length > 0 && (
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="text-xs font-bold border border-slate-200 rounded-full px-4 py-2 bg-white">
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="mb-6">
        <TutorialOfferCard placement="hub_card" />
      </div>

      <div className="flex flex-col gap-4 mb-8">
        {filtered.map(s => {
          const progress = seriesProgress(s.id);
          return (
            <Link
              key={s.id}
              href={`/tutorials/${s.slug}`}
              className="flex gap-4 bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                {s.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Rocket className="text-slate-300" size={28} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-black text-slate-900 truncate">{s.title}</h2>
                  {progress?.completed === progress?.total && progress && (
                    <CheckCircle2 size={14} className="text-rad-green shrink-0" />
                  )}
                </div>
                {s.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{s.description}</p>}
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>{LEVEL_LABEL[s.level]}</span>
                  {s.estimated_minutes && (
                    <span className="flex items-center gap-1"><Clock size={11} /> {s.estimated_minutes} min</span>
                  )}
                  {progress && <span className="text-rad-blue">{progress.completed}/{progress.total} done</span>}
                </div>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-12">No tutorials match those filters yet.</p>
        )}
      </div>

      <SaveProgressPrompt variant="quiet" />
    </div>
  );
}
