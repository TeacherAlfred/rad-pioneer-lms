"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ParentDashboard from "@/components/ParentDashboard"; 
import { Loader2, LogOut, ShieldCheck } from "lucide-react";

export default function ParentDashboardPage() {
  const router = useRouter();
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        // 1. Get the current active session
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          router.push("/");
          return;
        }

        // 2. Fetch the profile. Note: Ensure RLS "Public profiles are viewable" is active
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_user_id", session.user.id)
          .single();

        if (profileError || !profile) {
          console.error("Link broken: Auth ID not found in profiles table.");
          router.push("/");
          return;
        }

        setParentId(profile.id);
      } catch (error) {
        console.error("Critical session error:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-green-500" size={40} />
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Initializing Portal...</p>
      </div>
    );
  }

  if (!parentId) return null; 

  return (
    <main className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30">
      {/* Navigation Header */}
      <header className="border-b border-white/10 bg-[#0f172a]/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black uppercase italic tracking-tighter">
            RAD <span className="text-green-500">Parent</span> Dashboard
          </h1>
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
            <ShieldCheck size={12} className="text-green-500" />
            <span className="text-[10px] font-bold uppercase text-green-500 tracking-wider">Secure Access</span>
          </div>
        </div>
        
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all bg-white/5 px-4 py-2 rounded-xl border border-white/5 hover:border-white/10"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      {/* Main Content Area */}
      <div className="p-6 md:p-10">
         <ParentDashboard parentId={parentId} />
      </div>
      
      <footer className="py-10 text-center border-t border-white/5 mt-10">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">
          RAD Academy HQ &copy; 2026 | Redefining African Dreams
        </p>
      </footer>
    </main>
  );
}