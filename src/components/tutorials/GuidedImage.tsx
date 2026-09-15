"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Hotspot = { id: string; x: number; y: number; label: string; text: string };

// Renders an admin-placed screenshot with tappable "Guide" markers (the
// x/y percentages are placed by clicking the image in the admin editor,
// src/components/admin/tutorials/SeriesIntroItemsEditor.tsx). Rather than
// a floating tooltip pinned exactly at each dot - fragile near the edges
// of a narrow mobile viewport - the active hotspot's text renders in a
// fixed panel below the image, so it never overflows or gets clipped.
export default function GuidedImage({ imageUrl, hotspots }: { imageUrl: string; hotspots: Hotspot[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = hotspots.find(h => h.id === activeId) || null;

  return (
    <div>
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="w-full block" />
        {hotspots.map((h, i) => (
          <button
            key={h.id}
            onClick={() => setActiveId(activeId === h.id ? null : h.id)}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center border-2 border-white shadow-lg transition-transform ${activeId === h.id ? "bg-rad-purple scale-110" : "bg-rad-blue"}`}
            aria-label={h.label || `Guide point ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-3 flex items-start gap-3 bg-rad-blue/5 border border-rad-blue/20 rounded-xl p-4">
          <div className="flex-1 min-w-0">
            {active.label && <p className="text-sm font-bold text-slate-900 mb-1">{active.label}</p>}
            {active.text && <p className="text-xs text-slate-600 leading-relaxed">{active.text}</p>}
          </div>
          <button onClick={() => setActiveId(null)} className="text-slate-400 hover:text-slate-700 shrink-0"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
