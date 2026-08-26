import React from 'react';
import Image from 'next/image';

export const metadata = {
  title: 'Irene Primary Fitness Challenge | Powered by RAD Academy',
  description: "Give consent and add your family's response to the Irene Primary Fitness Challenge.",
};

export default function IreneFitnessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-slate-900 font-sans selection:bg-[#0066cc]/30">
      <nav className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0066cc] flex items-center justify-center text-white font-black italic text-xs">
              IPS
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none">Irene Primary</h1>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Fitness Community</p>
            </div>
          </div>
          <Image src="/logo/rad-logo.png" alt="RAD Academy" width={70} height={23} unoptimized />
        </div>
      </nav>

      <main className="w-full">{children}</main>
    </div>
  );
}
