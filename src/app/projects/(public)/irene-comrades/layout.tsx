import React from 'react';
import Image from 'next/image';

export const metadata = {
  title: 'Irene Primary Comrades Tracker | Powered by RAD Academy',
  description: 'Vote for your favorite Comrades Marathon stories and help your class win!',
};

export default function IreneComradesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Apple-esque base: Off-white background, default text color slate-900
    <div className="min-h-screen bg-[#f5f5f7] text-slate-900 font-sans selection:bg-[#0066cc]/30">
      
      {/* Sleek, frosted-glass top navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Minimalist Logo Area */}
            <div className="w-8 h-8 rounded-lg bg-[#0066cc] flex items-center justify-center text-white font-black italic text-xs">
              RAD
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none">Irene Primary</h1>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Comrades Tracker</p>
            </div>
          </div>
          <Image src="/logo/rad-logo.png" alt="RAD Academy" width={70} height={23} unoptimized />
        </div>
      </nav>

      {/* Main Content Constraint */}
      <main className="w-full">
        {children}
      </main>
      
    </div>
  );
}