"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { captureAttributionOnArrival } from "@/lib/tutorialAttribution";

export default function TutorialsLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    captureAttributionOnArrival();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/tutorials" className="flex items-center gap-2">
            <Image src="/logo/rad-logo.png" alt="RAD Academy" width={70} height={23} unoptimized />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-l border-slate-200 pl-2">Tutorial Hub</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
