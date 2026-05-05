"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, UserCog, ShieldAlert, Loader2, User, CheckCircle2, Terminal, ArrowRight, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_CONFIG = [
  { id: "student", label: "Student", defaultRoute: "/student/dashboard", dbRoles: ["student"] },
  { id: "parent", label: "Parent", defaultRoute: "/parent/dashboard", dbRoles: ["parent", "guardian"] },
  { id: "teacher", label: "Teacher", defaultRoute: "/teacher/dashboard", dbRoles: ["teacher", "facilitator"] },
  { id: "prospect", label: "Prospect", defaultRoute: "/invite/[USER_ID]", dbRoles: ["prospect"] },
  { id: "guest", label: "Guest / Public", defaultRoute: "/welcome", dbRoles: ["guest"] }
] as const;

export default function RoleSwitcherModal({ isOpen, onClose }: RoleSwitcherModalProps) {
  const router = useRouter();
  
  // Data State
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string>(""); // Store the Admin's UUID
  
  // Flow State
  const [selectedRole, setSelectedRole] = useState<string>("student");
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [targetRoute, setTargetRoute] = useState<string>("/student/dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      // Extract Admin ID from the current active session
      const currentSession = localStorage.getItem("pioneer_session");
      if (currentSession) {
        try {
          const parsed = JSON.parse(currentSession);
          if (parsed.id) setAdminId(parsed.id);
        } catch (e) {
          console.error("Failed to parse admin session");
        }
      }
    }
  }, [isOpen]);

  // Reset profile and update default route when role changes
  useEffect(() => {
    setSelectedProfile(null);
    setSearchQuery("");
    const config = ROLE_CONFIG.find(r => r.id === selectedRole);
    if (config) setTargetRoute(config.defaultRoute);
  }, [selectedRole]);

  const fetchProfiles = async () => {
    setLoading(true);
    setFetchError(null);
    
    try {
      // 1. Fetch active users from 'profiles' table
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, role, metadata')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      // 2. Fetch leads from 'prospects' table
      const { data: prospectsData, error: prospectsError } = await supabase
        .from('prospects')
        .select('id, name, status, email, metadata')
        .order('created_at', { ascending: false });

      if (prospectsError) throw prospectsError;

      // 3. Normalize prospects into the profile shape so the UI can render them seamlessly
      const normalizedProspects = (prospectsData || []).map(p => ({
        id: p.id,
        display_name: p.name,
        role: "prospect", // Hardcode role to match the ROLE_CONFIG
        metadata: { email: p.email, pipeline_status: p.status, ...p.metadata }
      }));

      // 4. Combine both data streams
      setProfiles([...(profilesData || []), ...normalizedProspects]);

    } catch (err: any) {
      console.error("Role Switcher Fetch Error Details:", err);
      setFetchError(err.message || "Unknown DB Error. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const config = ROLE_CONFIG.find(r => r.id === selectedRole);
      if (!config) return false;

      const userRole = String(p.role || "student").toLowerCase(); 
      
      if (!(config.dbRoles as readonly string[]).includes(userRole)) return false;

      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      const name = String(p.display_name || "").toLowerCase();
      const email = String(p.metadata?.email || "").toLowerCase(); 

      return name.includes(search) || email.includes(search);
    });
  }, [profiles, selectedRole, searchQuery]);

  const handleImpersonate = () => {
    if (selectedRole !== "guest" && !selectedProfile) return;

    const currentSession = localStorage.getItem("pioneer_session");
    if (currentSession) {
      localStorage.setItem("admin_backup_session", currentSession);
    }

    let impersonatedSession;
    const resolvedUserId = selectedRole === "guest" ? "mock-guest-id" : selectedProfile?.id;

    if (selectedRole === "guest") {
      impersonatedSession = {
        id: resolvedUserId,
        role: "guest",
        display_name: "Test Guest",
        is_impersonated: true,
        original_admin_id: adminId
      };
    } else {
      impersonatedSession = {
        ...selectedProfile,
        is_impersonated: true,
        original_admin_id: adminId
      };
    }

    localStorage.setItem("pioneer_session", JSON.stringify(impersonatedSession));

    // Dynamic Route Token Replacement
    let finalRoute = targetRoute;
    if (finalRoute.includes("[ADMIN_ID]")) {
      finalRoute = finalRoute.replace(/\[ADMIN_ID\]/g, adminId);
    }
    if (finalRoute.includes("[USER_ID]")) {
      finalRoute = finalRoute.replace(/\[USER_ID\]/g, resolvedUserId);
    }

    router.push(finalRoute);
  };

  // Helper to quickly append tokens to the route input
  const appendToRoute = (token: string) => {
    setTargetRoute(prev => {
      const slash = prev.endsWith("/") ? "" : "/";
      return prev + slash + token;
    });
  };

  const isReadyToTest = selectedRole === "guest" || selectedProfile !== null;

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
            className="relative w-full max-w-3xl bg-[#0a0f1c] border border-violet-500/30 rounded-[32px] shadow-[0_0_50px_rgba(139,92,246,0.15)] flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-500/20 text-violet-400 rounded-2xl border border-violet-500/30">
                  <UserCog size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">Role Tester</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">Manual Route Verification</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-8">
              
              {/* STEP 1: ROLE */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-violet-400 mb-3 flex items-center gap-2">
                  <span className="bg-violet-500 text-white size-5 rounded-full flex items-center justify-center text-[10px]">1</span> 
                  Select Role
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {ROLE_CONFIG.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        selectedRole === role.id 
                          ? 'bg-violet-600/20 text-violet-300 border-violet-500/50 shadow-inner' 
                          : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-slate-300'
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 2: USER PROFILE */}
              <div className="flex flex-col min-h-[280px]">
                <h3 className="text-xs font-black uppercase tracking-widest text-violet-400 mb-3 flex items-center gap-2">
                  <span className="bg-violet-500 text-white size-5 rounded-full flex items-center justify-center text-[10px]">2</span> 
                  Target Profile
                </h3>

                {selectedRole === "guest" ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01] p-6 text-center">
                    <Globe className="text-slate-500 mb-3 opacity-50" size={32} />
                    <p className="text-sm font-bold text-white mb-1">Guest Mode Active</p>
                    <p className="text-xs text-slate-500 max-w-sm">No specific user profile is required. The system will simulate an unauthenticated public visitor.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col bg-[#020617] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="relative p-2 shrink-0 border-b border-white/5">
                      <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Search ${selectedRole}s...`}
                        className="w-full bg-transparent pl-12 pr-4 py-2 text-sm text-white outline-none focus:border-violet-500 transition-colors placeholder:text-slate-600 font-medium"
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar max-h-[220px]">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3 text-violet-500">
                          <Loader2 size={24} className="animate-spin" />
                        </div>
                      ) : fetchError ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-rose-500 text-center px-4">
                          <ShieldAlert size={24} />
                          <span className="text-[10px] text-rose-400/70 font-mono">{fetchError}</span>
                        </div>
                      ) : filteredProfiles.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs font-bold uppercase tracking-widest">
                          No {selectedRole}s found
                        </div>
                      ) : (
                        filteredProfiles.map(profile => {
                          const isSelected = selectedProfile?.id === profile.id;
                          return (
                            <div 
                              key={profile.id} 
                              onClick={() => setSelectedProfile(profile)}
                              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                                isSelected 
                                  ? 'bg-violet-500/10 border-violet-500/50' 
                                  : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                              }`}
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                  <User size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-sm font-bold truncate flex items-center gap-2 ${isSelected ? 'text-violet-300' : 'text-white'}`}>
                                    {profile.display_name || "Unnamed Profile"}
                                    {profile.role === 'prospect' && profile.metadata?.pipeline_status && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase tracking-widest border border-amber-500/20">
                                        {profile.metadata.pipeline_status}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {profile.metadata?.email || profile.id.substring(0, 8)}
                                  </p>
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="text-violet-500 shrink-0" size={18} />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3 & 4: ROUTE AND EXECUTE */}
              <div className="pt-6 border-t border-white/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-violet-400 flex items-center gap-2">
                    <span className="bg-violet-500 text-white size-5 rounded-full flex items-center justify-center text-[10px]">3 & 4</span> 
                    Route & Execute
                  </h3>
                  
                  {/* Dynamic Token Buttons */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => appendToRoute("[USER_ID]")}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] font-bold text-slate-400 hover:text-white transition-colors border border-white/10"
                    >
                      + [USER_ID]
                    </button>
                    <button 
                      onClick={() => appendToRoute("[ADMIN_ID]")}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] font-bold text-slate-400 hover:text-white transition-colors border border-white/10"
                    >
                      + [ADMIN_ID]
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Terminal size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      value={targetRoute}
                      onChange={(e) => setTargetRoute(e.target.value)}
                      placeholder="e.g., /admin/users/[USER_ID]"
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-mono text-white outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>

                  <button 
                    onClick={handleImpersonate}
                    disabled={!isReadyToTest}
                    className="sm:w-auto w-full px-8 py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    Test Route <ArrowRight size={16} />
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}