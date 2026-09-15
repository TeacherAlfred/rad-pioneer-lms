"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Loader2, CheckCircle2, Circle, Compass } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getLocalProgress } from "@/lib/tutorialLocalProgress";
import SeriesIntroCarousel from "@/components/tutorials/SeriesIntroCarousel";

type Series = { id: string; title: string; description: string | null; intro_items_visible: boolean };
type Tutorial = { id: string; slug: string; title: string; description: string | null; estimated_minutes: number | null };
type Hotspot = { id: string; x: number; y: number; label: string; text: string };
type IntroItem = { id: string; title: string; instruction: string; image_url: string | null; hotspots: Hotspot[]; link_url: string | null; link_label: string | null };

export default function SeriesPage() {
  const params = useParams();
  const seriesSlug = params.seriesSlug as string;

  const [series, setSeries] = useState<Series | null>(null);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [introItems, setIntroItems] = useState<IntroItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSeries() {
      const { data: seriesRow } = await supabase
        .from("tutorial_series")
        .select("id, title, description, intro_items_visible")
        .eq("slug", seriesSlug)
        .maybeSingle();

      if (seriesRow) {
        const [{ data: tutorialRows }, introRes] = await Promise.all([
          supabase.from("tutorials").select("id, slug, title, description, estimated_minutes").eq("series_id", seriesRow.id).order("order_index", { ascending: true }),
          seriesRow.intro_items_visible
            ? supabase.from("tutorial_series_intro_items").select("id, title, instruction, image_url, hotspots, link_url, link_label").eq("series_id", seriesRow.id).order("order_index", { ascending: true })
            : Promise.resolve({ data: [] as IntroItem[] }),
        ]);
        setTutorials(tutorialRows || []);
        setIntroItems(introRes.data || []);
      }
      setSeries(seriesRow);
      setLoading(false);
    }
    fetchSeries();
  }, [seriesSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-rad-blue" size={40} />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <h1 className="text-xl font-black uppercase italic tracking-tight text-slate-900 mb-2">Series not found</h1>
        <Link href="/tutorials" className="text-rad-blue font-black uppercase tracking-widest text-xs">Back to Tutorial Hub</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <Link href="/tutorials" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-500 mb-6">
        <ArrowLeft size={14} /> Tutorial Hub
      </Link>

      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 mb-2">{series.title}</h1>
      {series.description && <p className="text-slate-500 leading-relaxed mb-8">{series.description}</p>}

      {introItems.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Compass size={16} className="text-rad-blue" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Getting Started</h2>
          </div>
          <SeriesIntroCarousel items={introItems} />
        </div>
      )}

      <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Tutorials</h2>
      <div className="flex flex-col gap-3">
        {tutorials.map((t, i) => {
          const progress = getLocalProgress(t.id);
          return (
            <Link
              key={t.id}
              href={`/tutorials/${seriesSlug}/${t.slug}`}
              className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-black text-slate-500">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{t.title}</p>
                {t.description && <p className="text-xs text-slate-500 truncate">{t.description}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {t.estimated_minutes && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Clock size={11} /> {t.estimated_minutes}m
                  </span>
                )}
                {progress?.completedAt ? (
                  <CheckCircle2 size={18} className="text-rad-green" />
                ) : progress ? (
                  <Circle size={18} className="text-rad-yellow" />
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
