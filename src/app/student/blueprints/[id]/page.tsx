"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Loader2, Globe, Download, Box } from "lucide-react";
import Link from "next/link";

export default function BlueprintDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAsset() {
      try {
        const { data, error } = await supabase
          .from("tech_archive")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setAsset(data);
      } catch (err) {
        router.push("/student/blueprints");
      } finally {
        setLoading(false);
      }
    }
    loadAsset();
  }, [id, router]);

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#5574a9]" size={40} />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] text-white p-8 md:p-16 font-sans">
      <div className="max-w-5xl mx-auto space-y-12">
        <Link href="/student/blueprints" className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors group text-left">
          <ArrowLeft size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Archive</span>
        </Link>

        <header className="space-y-4 text-left">
          <span className="px-3 py-1 bg-[#5574a9]/20 text-[#5574a9] text-[10px] font-black uppercase tracking-widest rounded-full border border-[#5574a9]/20">
            {asset.type} Project
          </span>
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">{asset.title}</h1>
          <p className="text-slate-400 max-w-2xl font-medium italic">{asset.description || "No project notes available."}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white/5 rounded-[48px] border border-white/10 aspect-video flex items-center justify-center relative overflow-hidden">
               {asset.media_url ? (
                 <img src={asset.media_url} alt="" className="w-full h-full object-cover" />
               ) : (
                 <div className="text-center">
                    <Box size={64} className="text-slate-800 mb-4" />
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No Image Found</p>
                 </div>
               )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 space-y-6 text-left">
              <button className="w-full py-4 bg-[#5574a9] rounded-2xl flex items-center justify-center gap-3 font-black uppercase italic text-xs shadow-lg">
                <Globe size={16} /> View Online
              </button>
              <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 font-black uppercase italic text-xs">
                <Download size={16} /> Save File
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}