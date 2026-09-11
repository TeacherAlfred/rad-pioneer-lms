"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getStoredAttribution } from "@/lib/tutorialAttribution";
import { getStoredProgressToken } from "@/lib/tutorialLocalProgress";

type OfferConfig = {
  id: string;
  headline: string;
  body: string | null;
  cta_label: string;
  destination_url: string;
  accent: string;
};

// Reads the single admin-configured offer (spec S6) and renders it at
// whichever emphasis the caller asks for - a quiet Hub-view card, or the
// more prominent series-completion placement. One content source, two
// renderings, so an admin editing the offer updates both at once.
export default function TutorialOfferCard({
  placement,
  seriesId,
  tutorialId,
  prominent = false,
}: {
  placement: "hub_card" | "series_completion";
  seriesId?: string;
  tutorialId?: string;
  prominent?: boolean;
}) {
  const [offer, setOffer] = useState<OfferConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchOffer() {
      const { data } = await supabase
        .from("tutorial_offer_config")
        .select("id, headline, body, cta_label, destination_url, accent")
        .eq("is_active", true)
        .maybeSingle();
      if (!cancelled) setOffer(data);
    }
    fetchOffer();
    return () => { cancelled = true; };
  }, []);

  if (!offer) return null;

  async function handleClick() {
    const attribution = getStoredAttribution();
    fetch("/api/tutorials/offer/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: offer!.id,
        placement,
        seriesId,
        tutorialId,
        progressToken: getStoredProgressToken(),
        ...attribution,
      }),
    }).catch(() => {});

    const destination = new URL(offer!.destination_url, window.location.origin);
    if (attribution.utm_source) destination.searchParams.set("utm_source", attribution.utm_source);
    if (attribution.utm_medium) destination.searchParams.set("utm_medium", attribution.utm_medium);
    if (attribution.utm_campaign) destination.searchParams.set("utm_campaign", attribution.utm_campaign);
    window.location.href = destination.toString();
  }

  if (!prominent) {
    return (
      <button
        onClick={handleClick}
        className={`w-full flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left hover:shadow-md transition-all`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 p-2 rounded-xl text-white ${offer.accent}`}>
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{offer.headline}</p>
            {offer.body && <p className="text-xs text-slate-500 truncate">{offer.body}</p>}
          </div>
        </div>
        <span className="shrink-0 text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
          {offer.cta_label} <ArrowRight size={14} />
        </span>
      </button>
    );
  }

  return (
    <div className={`rounded-3xl p-8 text-white ${offer.accent} shadow-xl`}>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest mb-4">
        <Sparkles size={12} /> Your Next Step
      </div>
      <h3 className="text-2xl font-black uppercase italic tracking-tight mb-2">{offer.headline}</h3>
      {offer.body && <p className="text-white/90 mb-6 leading-relaxed">{offer.body}</p>}
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-100 transition-all"
      >
        {offer.cta_label} <ArrowRight size={16} />
      </button>
    </div>
  );
}
