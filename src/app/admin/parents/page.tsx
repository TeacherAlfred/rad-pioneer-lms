"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, ArrowLeft, Eye, ShieldCheck, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminParentSelector() {
  const router = useRouter();
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    async function fetchParents() {
      setLoading(true);
      try {
        // 1. SAFE QUERY: We ONLY ask for id, display_name, and metadata. No email/phone!
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, metadata') 
          .in('role', ['parent', 'Parent', 'guardian', 'Guardian'])
          .limit(1000); 

        if (error) {
          throw error;
        }
        
        // 2. Parse the metadata safely
        const parsedParents = (data || []).map(p => {
          let meta: any = {}; 
          try {
            meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
          } catch (e) {
             // Fallback
          }
          return {
            ...p,
            metaEmail: meta.email || null,
            metaPhone: meta.phone || null
          };
        });

        // 3. Safe Client-Side Filtering (Bypasses the database crash)
        let finalParents = parsedParents;
        
        if (debouncedQuery.trim().length >= 2) {
          const term = debouncedQuery.toLowerCase();
          finalParents = parsedParents.filter(p => 
            (p.display_name && p.display_name.toLowerCase().includes(term)) ||
            (p.metaEmail && p.metaEmail.toLowerCase().includes(term)) ||
            (p.metaPhone && p.metaPhone.toLowerCase().includes(term))
          );
        }

        setParents(finalParents.slice(0, 50));

      } catch (err: any) {
        console.error("Error fetching parents:", err.message || err);
      } finally {
        setLoading(false);
      }
    }

    if (debouncedQuery.trim().length === 0 || debouncedQuery.trim().length >= 2) {
      fetchParents();
    } else {
      setLoading(false);
    }
  }, [debouncedQuery]);

  const isSearching = loading || searchQuery !== debouncedQuery;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="space-y-4">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Command Center</span>
          </Link>
          <div>
            <div className="flex items-center gap-2 text-pink-500 mb-2">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Admin Override</span>
            </div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">Parent Portal <span className="text-pink-500">Viewer</span></h1>
          </div>
        </header>

        <div className="bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
          
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <div className="relative">
              {isSearching ? (
                <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500 animate-spin" size={18} />
              ) : (
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              )}
              
              <input 
                type="text" 
                placeholder="Search by name, email, or phone (min 2 chars)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#020617] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:outline-none focus:border-pink-500 transition-all placeholder:text-slate-600 shadow-inner"
              />
            </div>
          </div>

          <div className="divide-y divide-white/5 min-h-[300px]">
            {loading && parents.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-4">
                <Loader2 className="animate-spin text-pink-500" size={32} />
                <span className="text-[10px] font-black uppercase tracking-widest">Querying Database...</span>
              </div>
            ) : parents.length === 0 ? (
              <div className="p-16 text-center space-y-2">
                <p className="text-lg font-black text-slate-400 italic">No matches found.</p>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Try adjusting your search terms</p>
              </div>
            ) : (
              parents.map((parent) => (
                <div key={parent.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-black text-white italic tracking-tight">{parent.display_name || "Unnamed Guardian"}</h3>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-black/20 px-2.5 py-1 rounded-md border border-white/5">
                        <Mail size={12} className="text-slate-500" /> {parent.metaEmail || "No email on file"}
                      </span>
                      
                      {parent.metaPhone && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-black/20 px-2.5 py-1 rounded-md border border-white/5">
                          <Phone size={12} className="text-slate-500" /> {parent.metaPhone}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => router.push(`/admin/parents/${parent.id}`)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-pink-500/10 text-pink-400 group-hover:bg-pink-500 group-hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-pink-500/20 shadow-lg"
                  >
                    <Eye size={14} /> View Dashboard
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}