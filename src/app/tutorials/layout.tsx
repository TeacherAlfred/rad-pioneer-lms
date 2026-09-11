"use client";

import { useEffect } from "react";
import { captureAttributionOnArrival } from "@/lib/tutorialAttribution";

export default function TutorialsLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    captureAttributionOnArrival();
  }, []);

  return <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">{children}</div>;
}
