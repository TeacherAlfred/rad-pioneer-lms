"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import ParentDashboard from "@/components/ParentDashboard"; 

export default function AdminParentViewerPage() {
  const params = useParams();
  const parentId = params?.id as string;

  if (!parentId) return null;

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* PERSISTENT ADMIN WARNING BANNER */}
      <div className="sticky top-0 z-[100] bg-pink-500 text-black px-6 py-3 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <ShieldAlert size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Admin Override Active - Viewing as Parent</span>
        </div>
        <Link 
          href="/admin/parents" 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-black/10 hover:bg-black/20 px-4 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft size={14} /> Exit View
        </Link>
      </div>

      {/* Render the actual Parent Dashboard inside the wrapper */}
      <div className="pt-8">
        <ParentDashboard parentId={parentId} />
      </div>
    </div>
  );
}