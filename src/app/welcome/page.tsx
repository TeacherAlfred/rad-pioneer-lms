"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, UserCog, ShieldAlert, Loader2, User, ChevronRight, FolderLock, CornerDownRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 1. Defined a recursive type to future-proof nested routes
type SubRouteConfig = {
  label: string;
  path: string;
  children?: SubRouteConfig[];
};

type BaseRouteConfig = {
  allowedRoles: readonly string[];
  subRoutes: SubRouteConfig[];
};

// Map base environments to their sub-routes and the roles allowed to access them
const ROUTE_CONFIG: Record<string, BaseRouteConfig> = {
  "/student": {
    allowedRoles: ["student"],
    subRoutes: [
      { label: "Hub", path: "/dashboard" },
      { label: "Blueprints", path: "/blueprints" },
      { label: "All Courses", path: "/courses" },
      { label: "Course Player", path: "/course" },
    ]
  },
  "/parent": {
    allowedRoles: ["parent", "guardian"],
    subRoutes: [
      { label: "Portal", path: "/dashboard" },
    ]
  },
  "/teacher": {
    allowedRoles: ["teacher", "facilitator"],
    subRoutes: [
      { label: "Command", path: "/dashboard" },
    ]
  },
  "/guest": {
    allowedRoles: ["guest", "lead", "prospect"],
    subRoutes: [
      { label: "Welcome", path: "/welcome" },
      { label: "Landing Page", path: "/landing" },
      { 
        label: "Booking", 
        path: "/booking",
        // 2. Example of a nested sub-route. The UI will now handle this recursively.
        children: [
          { label: "In Person", path: "/booking/in_person" },
          { label: "Virtual", path: "/booking/virtual" }
        ]
      },
      { label: "Event", path: "/event" },
    ]
  }
} as const;

export default function RoleSwitcherModal({ isOpen, onClose }: RoleSwitcherModalProps) {
  const router = useRouter();
  
  // Data State
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Navigation State
  const [baseRoute, setBaseRoute] = useState<string>("/student");
  const [subRoute, setSubRoute] = useState<string>("/dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) fetchProfiles();
  }, [isOpen]);

  // Auto-select the first sub-route when the base route changes
  useEffect(() => {
    if (ROUTE_CONFIG[baseRoute]?.subRoutes[0]) {
      setSubRoute(ROUTE_CONFIG[baseRoute].subRoutes[0].path);
    }
    setSearchQuery("");
  }, [baseRoute]);

  const fetchProfiles = async () => {
    setLoading(true);
    setFetchError(null);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, metadata')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Role Switcher Fetch Error Details:", JSON.stringify(error, null, 2), error);
      setFetchError(error.message || "Unknown DB Error. Check console.");
    } else if (data) {
      setProfiles(data);
    }
    
    setLoading(false);
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const allowedRoles = ROUTE_CONFIG[baseRoute].allowedRoles;
      const userRole = String(p.role || "student").toLowerCase(); 
      
      if (!allowedRoles.includes(userRole)) return false;

      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      const name = String(p.display_name || "").toLowerCase();
      const email = String(p.metadata?.email || "").toLowerCase(); 

      return name.includes(search) || email.includes(search);
    });
  }, [profiles, baseRoute, searchQuery]);

  const handleImpersonate = (profile: any) => {
    const currentSession = localStorage.getItem("pioneer_session");
    if (currentSession) {
      localStorage.setItem("admin_backup_session", currentSession);
    }

    const impersonatedSession = {
      ...profile,
      is_impersonated: true,
      original_admin_id: JSON.parse(currentSession || "{}").id
    };

    localStorage.setItem("pioneer_session", JSON.stringify(impersonatedSession));
    
    const finalRoute = `${baseRoute === "/guest" ? "" : baseRoute}${subRoute === '/' ? '' : subRoute}`;
    router.push(finalRoute);
  };

  // 3. Recursive component to render nested sub-routes indefinitely
  const RecursiveRouteList = ({ routes, level = 0 }: { routes: SubRouteConfig[], level?: number }) => {
    return (
      <div className={`flex flex-col gap-2 ${level > 0 ? 'ml-3 pl-3 border-l border-white/10 mt-2' : ''}`}>
        {routes.map((route) => (
          <div key={route.path} className="flex flex-col">
            <button 
              onClick={() => setSubRoute(route.path)}
              className={`px-3 py-2 text-left rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                subRoute === route.path 
                  ? 'bg-white text-black border-white' 
                  : 'bg-[#020617] text-slate-400 border-white/10 hover:border-white/30'
              }`}
            >
              {level > 0 && <CornerDownRight size={12} className="opacity-50" />}
              {route.label} <span className={subRoute === route.path ? 'text-slate-500' : 'text-slate-600'}>({route.path})</span>
            </button>
            
            {/* If children exist, recursively render them */}
            {route.children && route.children.length > 0 && (
              <RecursiveRouteList routes={route.children} level={level + 1} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }} 
            className="relative w-full max-w-4xl bg-[#0a0f1c] border border-violet-500/30 rounded-[32px] shadow-[0_0_50px_rgba(139,92,246,0.15)] flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-500/20 text-violet-400 rounded-2xl border border-violet-500/30">
                  <UserCog size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Role Testing Environment</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Impersonate users & test auth barriers</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
              
              {/* LEFT COLUMN: STEP 1 - ROUTE CONFIGURATION */}
              <div className="w-full md:w-[40%] bg-white/[0.01] border-b md:border-b-0 md:border-r border-white/5 p-6 md:p-8 flex flex-col gap-8 shrink-0 overflow-y-auto custom-scrollbar">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-violet-400 mb-4 flex items-center gap-2">
                    <span className="bg-violet-500 text-white size-5 rounded-full flex items-center justify-center text-[10px]">1</span> 
                    Target Environment
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      {Object.keys(ROUTE_CONFIG).map((route) => (
                        <button 
                          key={route}
                          onClick={() => setBaseRoute(route)}
                          className={`px-4 py-3 text-left rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-between ${
                            baseRoute === route 
                              ? 'bg-violet-600/20 text-violet-300 border-violet-500/50 shadow-inner' 
                              : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-slate-300'
                          }`}
                        >
                          {route === "/guest" ? "Public / Guest" : route}
                          {baseRoute === route && <ChevronRight size={14} className="text-violet-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Available Sub-Routes</label>
                  {/* Render the recursive tree based on selected base route */}
                  <RecursiveRouteList routes={ROUTE_CONFIG[baseRoute]?.subRoutes || []} />
                </div>

                <div className="mt-auto pt-6 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Final Target URL</p>
                  <div className="bg-[#020617] border border-violet-500/30 rounded-xl px-4 py-3 font-mono text-xs text-violet-300 break-all">
                    {baseRoute === "/guest" ? "" : baseRoute}{subRoute === '/' ? '' : subRoute}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: STEP 2 - PROFILE SELECTION */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#020617] p-6 md:p-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-violet-400 mb-4 flex items-center gap-2 shrink-0">
                  <span className="bg-violet-500 text-white size-5 rounded-full flex items-center justify-center text-[10px]">2</span> 
                  Select Authorized Profile
                </h3>

                <div className="relative mb-4 shrink-0">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${ROUTE_CONFIG[baseRoute]?.allowedRoles.join(" or ") || "users"}s...`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-violet-500 transition-colors placeholder:text-slate-600 font-medium"
                  />
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-violet-500">
                      <Loader2 size={24} className="animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fetching Database...</span>
                    </div>
                  ) : fetchError ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-rose-500 text-center px-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                      <ShieldAlert size={24} />
                      <span className="text-xs font-bold uppercase tracking-widest">Failed to load profiles</span>
                      <span className="text-[10px] text-rose-400/70 font-mono">{fetchError}</span>
                    </div>
                  ) : filteredProfiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-3 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
                      <FolderLock size={28} className="opacity-40" />
                      <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">No authorized users found</p>
                        <p className="text-[10px] font-medium text-slate-600 mt-1">No users with access to {baseRoute === "/guest" ? "Public Areas" : baseRoute} match your search.</p>
                      </div>
                    </div>
                  ) : (
                    filteredProfiles.map(profile => (
                      <div key={profile.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 shadow-inner">
                            <User size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{profile.display_name || "Unnamed Profile"}</p>
                            <p className="text-xs text-slate-500 truncate">{profile.metadata?.email || profile.id.substring(0, 8) + '...'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 pl-4">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-400 border border-white/10 hidden sm:block">
                            {profile.role || 'student'}
                          </span>
                          <button 
                            onClick={() => handleImpersonate(profile)}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-violet-900/20 whitespace-nowrap active:scale-95"
                          >
                            Execute
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}