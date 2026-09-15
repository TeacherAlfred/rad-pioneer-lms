"use client";

import { useState } from "react";
import { X, ExternalLink, Compass } from "lucide-react";
import { renderStepMarkdown } from "@/lib/renderStepMarkdown";
import GuidedImage from "@/components/tutorials/GuidedImage";

type Hotspot = { id: string; x: number; y: number; label: string; text: string };
type IntroItem = {
  id: string;
  title: string;
  instruction: string;
  image_url: string | null;
  hotspots: Hotspot[];
  link_url: string | null;
  link_label: string | null;
};

// Horizontal, swipeable card row for the "before the tutorials" onboarding
// items - tapping a card opens its full content in a popup rather than
// expanding inline, so the series page stays scannable regardless of how
// long an item's instruction or screenshot guide gets.
export default function SeriesIntroCarousel({ items }: { items: IntroItem[] }) {
  const [activeItem, setActiveItem] = useState<IntroItem | null>(null);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setActiveItem(item)}
            className="shrink-0 w-56 snap-start bg-white border border-slate-200 rounded-2xl overflow-hidden text-left hover:shadow-md transition-all"
          >
            <div className="relative w-full aspect-video bg-slate-100">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Compass className="text-slate-300" size={28} />
                </div>
              )}
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-black flex items-center justify-center shadow">
                {i + 1}
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm font-bold text-slate-900 leading-tight">{item.title}</p>
            </div>
          </button>
        ))}
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setActiveItem(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-y-auto p-6"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-lg font-black text-slate-900 leading-tight">{activeItem.title}</h3>
              <button onClick={() => setActiveItem(null)} className="text-slate-400 hover:text-slate-700 shrink-0"><X size={20} /></button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">{renderStepMarkdown(activeItem.instruction)}</p>

            {activeItem.image_url && (
              <div className="mb-4">
                <GuidedImage imageUrl={activeItem.image_url} hotspots={activeItem.hotspots || []} />
              </div>
            )}

            {activeItem.link_url && (
              <a
                href={activeItem.link_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-rad-blue text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-xs"
              >
                {activeItem.link_label || "Open Guide"} <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
