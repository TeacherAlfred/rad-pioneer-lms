"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Lightbulb, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getLocalProgress, setLocalProgress, getStoredProgressToken } from "@/lib/tutorialLocalProgress";
import { renderStepMarkdown } from "@/lib/renderStepMarkdown";
import TutorialOfferCard from "@/components/tutorials/TutorialOfferCard";
import SaveProgressPrompt from "@/components/tutorials/SaveProgressPrompt";

type Tutorial = { id: string; series_id: string; title: string; link_url: string | null; link_label: string | null };
type Step = { id: string; instruction: string; image_url: string | null; why_this_works: string | null; link_url: string | null; link_label: string | null; order_index: number };

// One step visible at a time (spec S2/S3.2) - the always-obvious dot
// indicator is the single most important thing on this page, since the
// person reading it is glancing back and forth to a laptop, not reading
// this screen in isolation. Current step lives in ?step= so a refresh or
// a closed-and-reopened tab (spec "resilient to interruption") never loses
// the visible position, independent of the localStorage save below.
export default function TutorialStepPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const seriesSlug = params.seriesSlug as string;
  const tutorialSlug = params.tutorialSlug as string;

  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [resumeOffer, setResumeOffer] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    async function fetchTutorial() {
      const { data: seriesRow } = await supabase.from("tutorial_series").select("id").eq("slug", seriesSlug).maybeSingle();
      if (!seriesRow) { setLoading(false); return; }

      const { data: tutorialRow } = await supabase
        .from("tutorials")
        .select("id, series_id, title, link_url, link_label")
        .eq("series_id", seriesRow.id)
        .eq("slug", tutorialSlug)
        .maybeSingle();
      if (!tutorialRow) { setLoading(false); return; }

      const { data: stepRows } = await supabase
        .from("tutorial_steps")
        .select("id, instruction, image_url, why_this_works, link_url, link_label, order_index")
        .eq("tutorial_id", tutorialRow.id)
        .order("order_index", { ascending: true });

      setTutorial(tutorialRow);
      setSteps(stepRows || []);

      const stepParam = searchParams.get("step");
      const saved = getLocalProgress(tutorialRow.id);
      if (stepParam) {
        setIndex(Math.min(Math.max(0, parseInt(stepParam, 10) - 1), (stepRows?.length || 1) - 1));
      } else if (saved && saved.currentStepOrderIndex > 0 && !saved.completedAt) {
        setResumeOffer(saved.currentStepOrderIndex);
      }
      setCompleted(!!saved?.completedAt);
      setLoading(false);
    }
    fetchTutorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesSlug, tutorialSlug]);

  function goToStep(next: number, markCompleted = false) {
    setIndex(next);
    router.replace(`/tutorials/${seriesSlug}/${tutorialSlug}?step=${next + 1}`);
    if (!tutorial) return;
    setLocalProgress(tutorial.id, next, markCompleted);
    if (markCompleted) setCompleted(true);

    const token = getStoredProgressToken();
    if (token) {
      fetch("/api/tutorials/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, tutorialId: tutorial.id, currentStepOrderIndex: next, completed: markCompleted }),
      }).catch(() => {});
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-rad-blue" size={40} />
      </div>
    );
  }

  if (!tutorial || steps.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <h1 className="text-xl font-black uppercase italic tracking-tight text-slate-900 mb-2">Tutorial not found</h1>
        <Link href="/tutorials" className="text-rad-blue font-black uppercase tracking-widest text-xs">Back to Tutorial Hub</Link>
      </div>
    );
  }

  if (resumeOffer !== null) {
    return (
      <div className="max-w-sm mx-auto px-5 py-20 text-center flex flex-col gap-4">
        <h1 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Welcome back!</h1>
        <p className="text-sm text-slate-500">You were on step {resumeOffer + 1} of {steps.length}.</p>
        <button
          onClick={() => { const r = resumeOffer; setResumeOffer(null); goToStep(r); }}
          className="w-full bg-rad-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
        >
          Resume
        </button>
        <button
          onClick={() => { setResumeOffer(null); goToStep(0); }}
          className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
        >
          Start over
        </button>
      </div>
    );
  }

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return (
    <div className="max-w-lg mx-auto px-5 py-8">
      <Link href={`/tutorials/${seriesSlug}`} className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
        <ArrowLeft size={14} /> {tutorial.title}
      </Link>

      {/* Always-obvious "where am I" - spec S2's single biggest requirement */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Step {index + 1} of {steps.length}</span>
        </div>
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s.id} className={`h-2 flex-1 rounded-full ${i <= index ? "bg-rad-blue" : "bg-slate-200"}`} />
          ))}
        </div>
      </div>

      {/* One editor link for the whole tutorial (not per-step) - shown on
          every step for a visitor coding on this same device, per S2's own
          "not everyone has two screens" caveat. */}
      {tutorial.link_url && (
        <a
          href={tutorial.link_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 border-2 border-rad-blue text-rad-blue py-3 rounded-xl font-black uppercase tracking-widest text-xs mb-4"
        >
          {tutorial.link_label || "Open Editor"} <ExternalLink size={14} />
        </a>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-6 min-h-[200px]">
        <p className="text-lg text-slate-900 leading-relaxed mb-4">{renderStepMarkdown(step.instruction)}</p>
        {step.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.image_url} alt="" className="w-full rounded-2xl border border-slate-100 mb-4" />
        )}
        {step.why_this_works && (
          <div className="flex items-start gap-2 bg-rad-yellow/10 border border-rad-yellow/30 rounded-xl p-3">
            <Lightbulb size={16} className="text-rad-yellow shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">{step.why_this_works}</p>
          </div>
        )}
        {step.link_url && (
          <a
            href={step.link_url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-bold text-rad-blue underline underline-offset-2 ${step.why_this_works ? "mt-3" : ""}`}
          >
            <ExternalLink size={12} /> {step.link_label || "View extra resource"}
          </a>
        )}
      </div>

      {/* Large, one-handed tap targets (spec S2) */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => goToStep(index - 1)}
          disabled={isFirst}
          className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-0"
        >
          <ArrowLeft size={16} /> Back
        </button>
        {!isLast ? (
          <button
            onClick={() => goToStep(index + 1)}
            className="flex-1 flex items-center justify-center gap-2 bg-rad-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => goToStep(index, true)}
            className="flex-1 flex items-center justify-center gap-2 bg-rad-green text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
          >
            <CheckCircle2 size={16} /> Finish
          </button>
        )}
      </div>

      {completed && (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <CheckCircle2 size={40} className="text-rad-green mx-auto mb-2" />
            <p className="font-black uppercase italic text-slate-900">Nice work - tutorial complete!</p>
          </div>
          <TutorialOfferCard placement="series_completion" seriesId={tutorial.series_id} tutorialId={tutorial.id} prominent />
          <SaveProgressPrompt variant="prominent" />
        </div>
      )}
    </div>
  );
}
