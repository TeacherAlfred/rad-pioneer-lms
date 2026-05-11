"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Users, Search, ShieldAlert, ArrowRight, X, Mail, Phone, 
  Calendar, BookOpen, User, Key, Copy, RotateCcw, Save, GraduationCap,
  Loader2, ArrowLeft, ListTree, CheckCircle2, AlertCircle, UserPlus, PowerOff, Shield, BellRing, Plus, Trash2, ChevronDown, CreditCard, ChevronRight, ChevronLeft, Send, Eye, PenTool, LayoutTemplate, Clock, Star, Globe, Link2, Zap, MessageCircle
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const FUNNEL_STAGES = [
  "Lead",
  "Onboarding",
  "Active (LMS Access)", // <-- NEW UNIFIED STAGE
  "Active (Bootcamp)",
  "Paused",
  "Churned"
];

const getFunnelBadgeStyle = (stage: string) => {
  switch(stage) {
    // We added the new stage and kept the old 'Paid Client'/'Trial' as fallbacks so old records don't lose their color
    case 'Active (LMS Access)': 
    case 'Active (Paid Client)': 
    case 'Trial Active': 
      return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    case 'Active (Bootcamp)': return 'text-teal-400 border-teal-500/20 bg-teal-500/10';
    case 'Onboarding': return 'text-blue-400 border-blue-500/20 bg-blue-500/10';
    case 'Lead': return 'text-purple-400 border-purple-500/20 bg-purple-500/10';
    case 'Paused': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    case 'Churned': return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
    default: return 'text-slate-400 border-slate-500/20 bg-slate-500/10';
  }
};

const safeParse = (val: any) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch(e) { return {}; }
  }
  return val || {};
};

const DiffLabel = ({ label, value, previousValue, onChange, type="text", disabled=false }: any) => {
  const hasChanged = previousValue !== undefined && previousValue !== value && previousValue !== null && previousValue !== "";
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-end">
        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">{label}</label>
        {hasChanged && (
          <span className="text-[9px] text-yellow-500 font-bold italic bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
            Prev: <span className="line-through">{previousValue}</span>
          </span>
        )}
      </div>
      <input 
        type={type} disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-[#0f172a] rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all ${hasChanged ? 'border-2 border-yellow-500/50 focus:border-yellow-400 text-yellow-50' : 'border border-white/10 text-white focus:border-purple-500'}`}
      />
    </div>
  );
};

export default function DirectoryPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "review">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedProfileLeadGuardian, setSelectedProfileLeadGuardian] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  
  const [browseQueue, setBrowseQueue] = useState<any[]>([]);
  const [browseIndex, setBrowseIndex] = useState(-1);
  const [isBrowseMode, setIsBrowseMode] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewIndex, setReviewIndex] = useState(-1);

  const [workspaceEditData, setWorkspaceEditData] = useState<any>(null);

  const [childrenMap, setChildrenMap] = useState<Record<string, any[]>>({});

  // COMMS STATE
  const [commsMode, setCommsMode] = useState<'none' | 'whatsapp' | 'email'>('none');
  const [customMessage, setCustomMessage] = useState("");

  const [tick, setTick] = useState(0);

  // NEW: Add Pioneer State
  const [isAddPioneerModalOpen, setIsAddPioneerModalOpen] = useState(false);
  const [newPioneerData, setNewPioneerData] = useState({ name: "", dob: "", grade: "" });

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchDirectory();
    const directorySubscription = supabase
      .channel('directory-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchDirectory())
      .subscribe();
    return () => { supabase.removeChannel(directorySubscription); };
  }, []);

  useEffect(() => {
    async function populateWorkspaceEditData() {
      if (selectedProfile) {
          const linkedParentId = selectedProfile.linked_parent_id || selectedProfile.metadata?.household_lead_id;
          const isSupportCrew = !!linkedParentId;

          let leadGuardianData = null;
          let existingCrew: any[] = [];

          if (isSupportCrew) {
             leadGuardianData = profiles.find(p => p.id === linkedParentId);
             setSelectedProfileLeadGuardian(leadGuardianData);
          } else {
             leadGuardianData = selectedProfile;
             setSelectedProfileLeadGuardian(leadGuardianData);
             existingCrew = profiles
                .filter(p => p.role === 'guardian' && (p.linked_parent_id === selectedProfile.id || p.metadata?.household_lead_id === selectedProfile.id))
                .map(p => ({
                    id: p.id,
                    name: p.display_name,
                    email: p.metadata?.email || "",
                    phone: p.phone || p.metadata?.phone || "",
                    relationship: p.metadata?.relationship || "Co-Guardian",
                    isPrimaryContact: p.metadata?.is_primary_contact ?? false
                }));
          }

          const meta = { ...(selectedProfile.metadata || {}) };
          const legacyMetaToken = meta.onboarding_token;
          delete meta.onboarding_token; 

          setWorkspaceEditData({
            display_name: selectedProfile.display_name || "",
            status: selectedProfile.status || 'active',
            inactive_since: selectedProfile.inactive_since || '',
            payment_plan_preference: selectedProfile.payment_plan_preference || "",
            funnel_stage: selectedProfile.funnel_stage || "",
            lead_source: selectedProfile.lead_source || "",
            account_tier: selectedProfile.account_tier || "none",
            onboarding_token: selectedProfile.onboarding_token || legacyMetaToken || "", 
            metadata: {
              ...meta, 
              email: meta?.email || "",
              phone: meta?.phone || "",
              relationship: meta?.relationship || "Guardian",
              is_primary_contact: meta?.is_primary_contact ?? true,
              lesson_delivery_format: meta?.lesson_delivery_format || "", // NEW: Added Delivery Format
              admin_notes: meta?.admin_notes || "",
              username: meta?.username || "",
              date_of_birth: meta?.date_of_birth || "",
              tc_accepted_version: meta?.tc_accepted_version || "",
              agreements: meta?.agreements || {}
            },
            supportCrew: existingCrew
          });
          setCommsMode('none'); 
      } else {
          setWorkspaceEditData(null);
          setSelectedProfileLeadGuardian(null);
      }
    }
    populateWorkspaceEditData();
  }, [selectedProfile, profiles]);

  async function fetchDirectory() {
    setLoading(true);
    try {
      const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('status', ['active', 'inactive']);
          
      if (error) throw error;

      const parsedProfiles = (data || []).map(p => ({
        ...p,
        metadata: safeParse(p.metadata),
        previous_state: safeParse(p.previous_state)
      }));

      setProfiles(parsedProfiles);

      const cMap: Record<string, any[]> = {};
      parsedProfiles.forEach(p => {
        if (p.role === 'student' && p.linked_parent_id) {
          if (!cMap[p.linked_parent_id]) cMap[p.linked_parent_id] = [];
          cMap[p.linked_parent_id].push(p);
        }
      });
      setChildrenMap(cMap);

    } catch (error) {
      console.error("Failed to fetch directory:", error);
    } finally {
      setLoading(false);
    }
  }

  const getHighlightLevel = (profile: any) => {
    const timestamps = [
      profile.updated_at,
      profile.created_at,
      profile.metadata?.onboarded_at 
    ].filter(Boolean).map(ts => new Date(ts).getTime());

    if (timestamps.length === 0) return null;

    const latestUpdate = new Date(Math.max(...timestamps));
    const reviewedStr = profile.metadata?.last_reviewed_at;
    
    if (reviewedStr && new Date(reviewedStr) >= latestUpdate) return null;

    const diffMs = new Date().getTime() - latestUpdate.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    if (diffHrs <= 2) return { level: 1, color: 'border-rose-500 bg-rose-500/10', label: '< 2 hrs ago', text: 'text-rose-400' };
    if (diffHrs <= 4) return { level: 2, color: 'border-orange-500 bg-orange-500/10', label: '< 4 hrs ago', text: 'text-orange-400' };
    if (diffHrs <= 12) return { level: 3, color: 'border-yellow-500 bg-yellow-500/10', label: '< 12 hrs ago', text: 'text-yellow-400' };
    if (diffHrs <= 24) return { level: 4, color: 'border-blue-500 bg-blue-500/10', label: '< 24 hrs ago', text: 'text-blue-400' };
    
    const midnight = new Date();
    midnight.setHours(0,0,0,0);
    if (latestUpdate > midnight) return { level: 4, color: 'border-blue-500 bg-blue-500/10', label: 'Today', text: 'text-blue-400' };

    return null;
  }

  const handleMarkReviewed = async (e: React.MouseEvent, profileId: string) => {
    if(e) e.stopPropagation();
    setIsProcessing(true);
    try {
      const p = profiles.find(x => x.id === profileId);
      const currentMeta = p.metadata || {};
      const newMeta = { ...currentMeta, last_reviewed_at: new Date().toISOString() };
      const { error } = await supabase.from('profiles').update({ 
        metadata: newMeta,
        updated_at: new Date().toISOString() 
      }).eq('id', profileId);
      if (error) throw error;
      await fetchDirectory(); 
    } catch (err) {
      console.error("Failed to mark reviewed", err);
    } finally {
      setIsProcessing(false);
    }
  }

  const filteredProfiles = profiles.filter(p => {
    if (p.role !== 'guardian') return false; 
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.metadata?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || (roleFilter === "review" && p.requires_review === true);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  }).sort((a, b) => {
    const highlightA = getHighlightLevel(a);
    const highlightB = getHighlightLevel(b);
    const levelA = highlightA ? highlightA.level : 5;
    const levelB = highlightB ? highlightB.level : 5;

    if (levelA !== levelB) {
      return levelA - levelB; 
    }

    const nameA = a.display_name?.toLowerCase() || "";
    const nameB = b.display_name?.toLowerCase() || "";
    return nameA.localeCompare(nameB);
  });

  const handleCloseWorkspace = () => {
    setSelectedProfile(null);
    setIsReviewMode(false);
    setIsBrowseMode(false);
  };

  const handleInspectProfile = (profile: any) => {
    const idx = filteredProfiles.findIndex(p => p.id === profile.id);
    setBrowseQueue(filteredProfiles);
    setBrowseIndex(idx !== -1 ? idx : 0);
    setSelectedProfile(profile);
    setIsBrowseMode(true);
  };

  const startRapidReview = () => {
    const queue = profiles.filter(p => p.role === 'guardian' && p.requires_review === true);
    if (queue.length === 0) return alert("No profiles require review.");
    setReviewQueue(queue);
    setReviewIndex(0);
    setSelectedProfile(queue[0]);
    setIsReviewMode(true);
  };

  const nextReviewProfile = () => {
    if (reviewIndex < reviewQueue.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setSelectedProfile(reviewQueue[reviewIndex + 1]);
    } else {
      handleCloseWorkspace();
    }
  };

  const handleUpdateProfile = async (autoAdvance = false) => {
    if (!selectedProfile || !workspaceEditData) return;
    setIsProcessing(true);
    try {
      const cleanMeta = { ...workspaceEditData.metadata, last_reviewed_at: new Date().toISOString() };
      delete cleanMeta.onboarding_token;

      const payload: any = {
          display_name: workspaceEditData.display_name,
          status: workspaceEditData.status,
          inactive_since: workspaceEditData.status === 'inactive' ? workspaceEditData.inactive_since : null,
          payment_plan_preference: workspaceEditData.payment_plan_preference,
          funnel_stage: workspaceEditData.funnel_stage,
          lead_source: workspaceEditData.lead_source,
          account_tier: workspaceEditData.account_tier,
          onboarding_token: workspaceEditData.onboarding_token, 
          updated_at: new Date().toISOString(), 
          metadata: cleanMeta
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', selectedProfile.id);
      if (error) throw error;

      await fetchDirectory();
      
      if (!isReviewMode) {
        setShowSuccessModal(true);
        handleCloseWorkspace(); 
      } else if (autoAdvance) {
        nextReviewProfile();
      }
    } catch (err) {
      alert("Update failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptReview = async () => {
    if (!selectedProfile || !workspaceEditData) return;
    setIsProcessing(true);
    try {
      const cleanMeta = { ...workspaceEditData.metadata, last_reviewed_at: new Date().toISOString() };
      delete cleanMeta.onboarding_token;

      const { error } = await supabase.from('profiles').update({
          ...workspaceEditData,
          requires_review: false,
          previous_state: {},
          inactive_since: workspaceEditData.status === 'inactive' ? workspaceEditData.inactive_since : null,
          account_tier: workspaceEditData.account_tier,
          onboarding_token: workspaceEditData.onboarding_token, 
          updated_at: new Date().toISOString(), 
          metadata: cleanMeta
      }).eq('id', selectedProfile.id);
      if (error) throw error;
      await fetchDirectory();
      nextReviewProfile();
    } catch (err) {
      alert("Review approval failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile || !window.confirm(`Permanently delete ${selectedProfile.display_name}?`)) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', selectedProfile.id);
      if (error) throw error;
      await fetchDirectory();
      handleCloseWorkspace();
    } catch (err) {
      alert("Delete failed. Check for linked records.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateToken = async () => {
    setIsProcessing(true);
    try {
      const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const { error } = await supabase.from('profiles').update({
        onboarding_token: newToken,
        updated_at: new Date().toISOString()
      }).eq('id', selectedProfile.id);

      if (error) throw error;

      setWorkspaceEditData({
        ...workspaceEditData,
        onboarding_token: newToken
      });
      await fetchDirectory(); 
      alert("Token generated and saved to database successfully!"); 
    } catch (err) {
      alert("Failed to generate token.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getTemplateMessage = (mode: 'whatsapp' | 'email') => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/welcome?t=${workspaceEditData?.onboarding_token}`;
    const firstName = workspaceEditData?.display_name?.split(' ')[0] || 'there';

    if (mode === 'whatsapp') {
      return `Hi ${firstName},\n\nWelcome to RAD Academy! Please use this secure link to set up your family profile and access the platform:\n\n${link}\n\nLet us know if you need any help!`;
    } else {
      return `Hi ${firstName},\n\nWelcome to RAD Academy!\n\nPlease use the secure link below to set up your family profile, complete your agreements, and access the platform.\n\nSecure Link: ${link}\n\nIf you have any questions, just reply to this email.\n\nBest regards,\nThe RAD Academy Team`;
    }
  };

  const handleSendComms = () => {
    if (commsMode === 'whatsapp') {
      const phone = workspaceEditData?.metadata?.phone;
      if (!phone) return alert("No phone number on file for this guardian.");
      const cleanPhone = phone.replace(/\D/g, ''); 
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMessage)}`, '_blank');
    } else if (commsMode === 'email') {
      const email = workspaceEditData?.metadata?.email;
      if (!email) return alert("No email address on file for this guardian.");
      window.open(`mailto:${email}?subject=${encodeURIComponent("Welcome to RAD Academy")}&body=${encodeURIComponent(customMessage)}`, '_blank');
    }
  };

  const handleAddPioneer = async () => {
    if (!newPioneerData.name.trim()) return alert("Pioneer name is required.");
    setIsProcessing(true);
    try {
      // Inherit the tier from the primary guardian, safely fallback to 'none' just in case
      const parentTier = selectedProfileLeadGuardian?.account_tier || 'none';

      const payload = {
        role: 'student',
        display_name: newPioneerData.name,
        linked_parent_id: householdLeadId, // Links directly to the active parent
        status: 'active',
        account_tier: parentTier, // <-- THE FIX: Explicitly set to match the parent
        metadata: {
          dob: newPioneerData.dob,
          grade: newPioneerData.grade
        }
      };
      
      const { error } = await supabase.from('profiles').insert([payload]);
      if (error) throw error;
      
      await fetchDirectory(); // Instantly refreshes the UI
      setIsAddPioneerModalOpen(false);
      setNewPioneerData({ name: "", dob: "", grade: "" }); // Reset form
      setShowSuccessModal(true); // Triggers your existing green success modal
    } catch (err: any) {
      console.error(err);
      alert("Failed to add pioneer: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isCoGuardian = !!(selectedProfile?.linked_parent_id || selectedProfile?.metadata?.household_lead_id);
  const isPrimaryGuardian = !isCoGuardian;
  const householdLeadId = isCoGuardian ? (selectedProfile.linked_parent_id || selectedProfile.metadata?.household_lead_id) : selectedProfile?.id;
  const myStudents = householdLeadId ? childrenMap[householdLeadId] || [] : [];
  const billingSchedule = selectedProfile?.metadata?.billing_schedule;
  const billingDisplay = billingSchedule?.preferred_date ? `${billingSchedule.preferred_date}${billingSchedule.frequency ? ` (${billingSchedule.frequency})` : ''}` : "Not Set";

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        <AnimatePresence mode="wait">
        {!selectedProfile ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="table" className="space-y-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
              <div className="space-y-4">
                <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl transition-all w-fit hover:border-purple-500/50">
                  <ArrowLeft size={16} className="text-slate-500 group-hover:text-purple-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
                </Link>
                <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Guardian_<span className="text-purple-500">Directory</span></h1>
              </div>
              <div className="flex gap-3">
                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl text-center min-w-[120px]">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Total Guardians</p>
                  <p className="text-2xl font-black italic">{profiles.filter(p => p.role === 'guardian' && p.status === 'active').length}</p>
                </div>
              </div>
            </header>

            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white/[0.02] p-4 rounded-3xl border border-white/5">
              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar max-w-full shrink-0">
                {(["all", "review"] as const).map(role => (
                  <button key={role} onClick={() => setRoleFilter(role)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${roleFilter === role ? "bg-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>
                    {role === 'all' ? 'All Guardians' : 'Review Queue'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="text" placeholder="Search guardians..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-purple-500 transition-all font-black italic uppercase tracking-tighter" />
                </div>
                <button onClick={startRapidReview} className="px-5 py-3 bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-colors whitespace-nowrap">Review ({profiles.filter(p => p.role === 'guardian' && p.requires_review).length})</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-[9px] uppercase tracking-widest font-bold text-slate-500 border-b border-white/5 pb-4">
               <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"/> &lt; 2hrs (Critical)</span>
               <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"/> &lt; 4hrs (Urgent)</span>
               <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"/> &lt; 12hrs (Warning)</span>
               <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"/> &lt; 24hrs (Recent)</span>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[48px] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
                  <tr><th className="px-8 py-5">Guardian Name</th><th className="px-8 py-5">Funnel Stage</th><th className="px-8 py-5">Contact Details</th><th className="px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProfiles.map(p => {
                    const highlight = getHighlightLevel(p);
                    const isCoGuardian = !!(p.linked_parent_id || p.metadata?.household_lead_id);
                    return (
                      <tr key={p.id} className={`transition-colors group border-white/5 bg-white/[0.01] ${highlight ? highlight.color.replace('border-','border-l-4 border-y-0 border-r-0 ') : 'hover:bg-white/[0.02] border-l-4 border-transparent'}`}>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20 shrink-0">
                               <Globe size={14}/>
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{p.display_name}</p>
                              {highlight && <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-white/10 mt-1 inline-block ${highlight.text}`}>{highlight.label}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">{isCoGuardian ? 'Co-Guardian' : 'Primary Guardian'}</p>
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${getFunnelBadgeStyle(p.funnel_stage)}`}>
                            {p.funnel_stage || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-xs text-slate-300 space-y-1">
                          {p.metadata?.email && <p className="flex items-center gap-2"><Mail size={12} className="text-slate-500"/> {p.metadata.email}</p>}
                          {p.metadata?.phone && <p className="flex items-center gap-2"><Phone size={12} className="text-slate-500"/> {p.metadata.phone}</p>}
                        </td>
                        <td className="px-8 py-6 text-right flex items-center justify-end gap-2 h-full">
                          {highlight && (
                            <button onClick={(e) => handleMarkReviewed(e, p.id)} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-2 rounded-xl text-[9px] font-black uppercase border border-emerald-500/20 transition-colors flex items-center gap-1" title="Mark as Reviewed">
                              <CheckCircle2 size={14}/> Clear
                            </button>
                          )}
                          <button onClick={() => handleInspectProfile(p)} className="bg-white/5 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-white/10 hover:bg-white/10 transition-colors">Inspect</button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredProfiles.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-16 text-slate-500 font-black uppercase tracking-widest text-xs">No guardians found matching your criteria.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key="workspace" className="space-y-8 pb-20">
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/5 pb-8">
              <div className="space-y-4">
                <button onClick={handleCloseWorkspace} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-purple-400 transition-colors"><ArrowLeft size={16}/> Back to Directory</button>
                <div className="flex items-center gap-4">
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter">{workspaceEditData?.display_name}</h2>
                  {getHighlightLevel(selectedProfile) && (
                    <div className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                      <Clock size={12}/> Recently Updated
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                {selectedProfile.requires_review ? (
                  <button onClick={handleAcceptReview} disabled={isProcessing} className="bg-yellow-500 text-black px-8 py-4 rounded-2xl font-black uppercase italic shadow-lg shadow-yellow-500/20 disabled:opacity-50">Approve Changes</button>
                ) : (
                  <button onClick={() => handleUpdateProfile()} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-2xl font-black uppercase italic shadow-lg shadow-purple-600/20 disabled:opacity-50 transition-all flex items-center gap-2">
                    {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Save Changes
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                
                <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-10 space-y-6">
                  <h3 className="text-xl font-black uppercase text-white border-b border-white/5 pb-4">Profile Identity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DiffLabel label="Full Name" value={workspaceEditData?.display_name} onChange={(v:any) => setWorkspaceEditData({...workspaceEditData, display_name: v})} />
                    <DiffLabel label="Email" value={workspaceEditData?.metadata.email} onChange={(v:any) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, email: v}})} />
                    <DiffLabel label="Phone" value={workspaceEditData?.metadata.phone} onChange={(v:any) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, phone: v}})} />
                    <DiffLabel label="Relationship" value={workspaceEditData?.metadata.relationship} onChange={(v:any) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, relationship: v}})} />
                  </div>
                </div>

                {isCoGuardian && selectedProfileLeadGuardian && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-10 space-y-6">
                    <h3 className="text-xl font-black uppercase text-white border-b border-white/5 pb-4 flex items-center gap-3">
                       <Star size={20} className="text-amber-500"/> Primary Guardian
                    </h3>
                    <div className="p-5 bg-[#0f172a] rounded-2xl border border-white/10 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"/>
                       <p className="font-black text-white text-lg italic uppercase">{selectedProfileLeadGuardian.display_name}</p>
                       <div className="flex flex-col gap-1 mt-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email: <span className="text-slate-200 lowercase">{selectedProfileLeadGuardian.metadata?.email || 'N/A'}</span></p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone: <span className="text-slate-200">{selectedProfileLeadGuardian.phone || selectedProfileLeadGuardian.metadata?.phone || 'N/A'}</span></p>
                       </div>
                    </div>
                  </div>
                )}

                <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-10 space-y-6">
                  {/* --- UPDATED HEADER WITH BUTTON --- */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <h3 className="text-xl font-black uppercase text-white flex items-center gap-3">
                       <GraduationCap size={20} className="text-blue-500"/> Linked Pioneers
                    </h3>
                    <button 
                      onClick={() => setIsAddPioneerModalOpen(true)} 
                      className="px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 w-fit"
                    >
                      <Plus size={14} /> Add Pioneer
                    </button>
                  </div>
                  {/* ---------------------------------- */}
                  
                  {myStudents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {myStudents.map(student => (
                          <div key={student.id} className="p-5 bg-[#0f172a] rounded-2xl border border-white/10 relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"/>
                             <p className="font-black text-white text-lg italic uppercase">{student.display_name}</p>
                             <div className="flex gap-4 mt-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grade: <span className="text-slate-200">{student.metadata?.grade || 'N/A'}</span></p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DOB: <span className="text-slate-200">{student.metadata?.dob || student.metadata?.date_of_birth || 'N/A'}</span></p>
                             </div>
                             {student.metadata?.removal_requested && (
                               <span className="mt-3 inline-block px-2 py-1 bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-widest rounded">Removal Requested</span>
                             )}
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div className="p-6 border border-dashed border-white/10 rounded-2xl text-center">
                       <p className="text-sm text-slate-500 font-bold italic">No pioneers linked to this household yet.</p>
                    </div>
                  )}
                </div>

                {isPrimaryGuardian && workspaceEditData?.supportCrew?.length > 0 && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-10 space-y-6">
                    <h3 className="text-xl font-black uppercase text-white border-b border-white/5 pb-4 flex items-center gap-3">
                       <Users size={20} className="text-emerald-500"/> Co-Guardians
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {workspaceEditData.supportCrew.map((cg: any) => (
                          <div key={cg.id} className="p-5 bg-[#0f172a] rounded-2xl border border-white/10 relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"/>
                             <p className="font-black text-white text-lg italic uppercase">{cg.name}</p>
                             <div className="flex flex-col gap-1 mt-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email: <span className="text-slate-200 lowercase">{cg.email || 'N/A'}</span></p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone: <span className="text-slate-200">{cg.phone || 'N/A'}</span></p>
                             </div>
                          </div>
                       ))}
                    </div>
                  </div>
                )}

                {isPrimaryGuardian && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-10 space-y-6">
                    <h3 className="text-xl font-black uppercase text-white border-b border-white/5 pb-4 flex items-center gap-3">
                       <Shield size={20} className="text-amber-500"/> System & Agreements
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Funnel Stage</label>
                          <select
                            value={workspaceEditData?.funnel_stage || ""}
                            onChange={(e) => setWorkspaceEditData({ ...workspaceEditData, funnel_stage: e.target.value })}
                            className="w-full bg-[#0f172a] rounded-xl px-4 py-3 text-sm font-bold text-white border border-white/10 outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                          >
                            <option value="">Unassigned</option>
                            {FUNNEL_STAGES.map(stage => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                       </div>
                       
                       <DiffLabel label="Lead Source" value={workspaceEditData?.lead_source} onChange={(v:any) => setWorkspaceEditData({...workspaceEditData, lead_source: v})} />
                       
                       <div className="space-y-1 md:col-span-2 mt-4">
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Agreements Signed</label>
                          <div className="bg-[#0f172a] rounded-xl p-4 border border-white/10 flex flex-wrap gap-2">
                             {workspaceEditData?.metadata?.agreements && Object.keys(workspaceEditData.metadata.agreements).length > 0 ? (
                               Object.entries(workspaceEditData.metadata.agreements).map(([k, v]) => {
                                  const isTruthy = v === true || v === 'true' || v === 'Yes';
                                  const isFalsy = v === false || v === 'false' || v === 'No';
                                  
                                  return (
                                    <div key={k} className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-lg border ${isTruthy ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : isFalsy ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                                      <span className="text-slate-300 mr-2">{k}:</span> 
                                      {isTruthy ? '✓ YES' : isFalsy ? '✗ NO' : v ? `"${v}"` : 'Skipped'}
                                    </div>
                                  )
                               })
                             ) : (
                               <span className="text-xs font-bold text-slate-500 italic">No agreements on file.</span>
                             )}
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {isPrimaryGuardian && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-10 space-y-6">
                    <h3 className="text-xl font-black uppercase text-white border-b border-white/5 pb-4 flex items-center gap-3">
                      <CreditCard size={20} className="text-purple-500" /> Account & Plan Configuration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Access Tier (Permissions)</label>
                        <select
                          value={workspaceEditData?.account_tier || "none"}
                          onChange={(e) => setWorkspaceEditData({ ...workspaceEditData, account_tier: e.target.value })}
                          className="w-full bg-[#0f172a] rounded-xl px-4 py-3 text-sm font-bold text-white border border-white/10 outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="none">None / Pending</option>
                          <option value="lms_trial">LMS Trial (14 Days)</option>
                          <option value="lms_access">LMS Access (Paid)</option>
                          <option value="bootcamp">Bootcamp Only</option>
                          <option value="full">Full Access (LMS + Classes)</option>
                          <option value="rad_alumni">RAD Alumni</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Lesson Delivery Format</label>
                        <select
                          value={workspaceEditData?.metadata?.lesson_delivery_format || ""}
                          onChange={(e) => setWorkspaceEditData({ ...workspaceEditData, metadata: { ...workspaceEditData.metadata, lesson_delivery_format: e.target.value } })}
                          className="w-full bg-[#0f172a] rounded-xl px-4 py-3 text-sm font-bold text-white border border-white/10 outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          <option value="Self-paced">Self-paced</option>
                          <option value="Online">Online</option>
                          <option value="In-Person">In-Person</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Preferred Payment Date</label>
                        <input 
                          type="text" 
                          value={billingDisplay} 
                          disabled 
                          className="w-full bg-[#0f172a]/50 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 border border-white/5 outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
              
              <div className="space-y-8">
                
                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[40px] space-y-6">
                  <h3 className="text-sm font-black uppercase text-white flex items-center gap-2"><Link2 size={16} className="text-blue-500"/> Magic Onboarding Link</h3>
                  
                  {!workspaceEditData?.onboarding_token ? (
                    <button onClick={handleGenerateToken} disabled={isProcessing} className="w-full py-4 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 font-black uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 border border-blue-500/20">
                      {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>} Generate Secure Link
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 bg-[#0f172a] p-3 rounded-xl border border-white/10">
                        <input 
                          readOnly 
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome?t=${workspaceEditData.onboarding_token}`} 
                          className="bg-transparent text-slate-400 text-xs w-full outline-none font-medium" 
                        />
                        <button 
                          onClick={() => { 
                            navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome?t=${workspaceEditData.onboarding_token}`); 
                            alert("Copied to clipboard!"); 
                          }} 
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-all"
                          title="Copy Link"
                        >
                          <Copy size={14}/>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { setCommsMode('whatsapp'); setCustomMessage(getTemplateMessage('whatsapp')); }} 
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${commsMode === 'whatsapp' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                        >
                          <MessageCircle size={14}/> WhatsApp
                        </button>
                        <button 
                          onClick={() => { setCommsMode('email'); setCustomMessage(getTemplateMessage('email')); }} 
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${commsMode === 'email' ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20'}`}
                        >
                          <Mail size={14}/> Email
                        </button>
                      </div>

                      <AnimatePresence>
                        {commsMode !== 'none' && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3 pt-2">
                            <textarea 
                              value={customMessage} 
                              onChange={e => setCustomMessage(e.target.value)}
                              className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 text-xs text-white outline-none focus:border-purple-500 resize-none h-40 leading-relaxed"
                            />
                            <button onClick={handleSendComms} className="w-full py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-lg">
                              <Send size={14}/> Launch {commsMode === 'whatsapp' ? 'WhatsApp' : 'Email App'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[40px]">
                  <h3 className="text-sm font-black uppercase mb-6 text-white flex items-center gap-2"><PowerOff size={16}/> System Protocol</h3>
                  <select value={workspaceEditData?.status} onChange={e => setWorkspaceEditData({...workspaceEditData, status: e.target.value})} className="w-full bg-[#020617] border border-white/10 p-4 rounded-xl font-bold uppercase tracking-widest text-xs outline-none focus:border-purple-500 appearance-none cursor-pointer">
                    <option value="active">Active Sector</option>
                    <option value="inactive">Inactive Hold</option>
                  </select>
                </div>

                <div className="bg-red-500/5 border border-red-500/20 p-10 rounded-[40px]">
                  <button onClick={handleDeleteProfile} className="w-full py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl font-black uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2">
                    <Trash2 size={16}/> Delete Record
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* =========================================
          ADD PIONEER MODAL
          ========================================= */}
      <AnimatePresence>
        {isAddPioneerModalOpen && (
          <div className="fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-[#0f172a] border border-blue-500/30 rounded-[40px] p-8 max-w-md w-full shadow-2xl flex flex-col pointer-events-auto"
             >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black uppercase italic text-white flex items-center gap-3">
                    <UserPlus className="text-blue-500"/> Add Pioneer
                  </h2>
                  <button onClick={() => setIsAddPioneerModalOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                    <X size={16}/>
                  </button>
               </div>
               
               <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Pioneer Full Name *</label>
                    <input 
                      autoFocus
                      value={newPioneerData.name} onChange={e => setNewPioneerData({...newPioneerData, name: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-colors"
                      placeholder="e.g. Leo"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Date of Birth</label>
                    <input 
                      type="date"
                      value={newPioneerData.dob} onChange={e => setNewPioneerData({...newPioneerData, dob: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 text-sm font-bold text-slate-300 outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:filter-[invert(1)] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Grade</label>
                    <select 
                      value={newPioneerData.grade} onChange={e => setNewPioneerData({...newPioneerData, grade: e.target.value})}
                      className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none"
                    >
                      <option value="" disabled>Select Grade...</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
               </div>

               <div className="mt-8 pt-6 border-t border-white/5 flex gap-3">
                 <button onClick={() => setIsAddPioneerModalOpen(false)} className="flex-1 py-4 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                   Cancel
                 </button>
                 <button onClick={handleAddPioneer} disabled={isProcessing || !newPioneerData.name} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50">
                   {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} Create Pioneer
                 </button>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GREEN SUCCESS MODAL */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} 
              className="bg-[#0f172a] border border-emerald-500/30 rounded-[32px] w-full max-w-md flex flex-col shadow-2xl shadow-emerald-500/10 overflow-hidden text-center py-10 px-6"
            >
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">Update Successful</h3>
              <p className="text-sm text-slate-400 mb-8 font-medium">The profile has been securely saved and the directory has been updated.</p>
              <button 
                onClick={() => setShowSuccessModal(false)} 
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-lg"
              >
                Close & Return to Directory
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}