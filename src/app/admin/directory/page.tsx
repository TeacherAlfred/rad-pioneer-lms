"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Users, Search, ShieldAlert, ArrowRight, X, Mail, Phone, 
  Calendar, BookOpen, User, Key, Copy, RotateCcw, Save, 
  Loader2, ArrowLeft, ListTree, CheckCircle2, AlertCircle, UserPlus, PowerOff, Shield, BellRing, Plus, Trash2, ChevronDown, CreditCard, ChevronRight, ChevronLeft, Send, Eye, PenTool, LayoutTemplate
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const RELATIONSHIP_OPTIONS = ["Mom", "Dad", "Guardian", "Other"];
const PAYMENT_OPTIONS = ["once", "monthly", "termly"];

interface SupportCrewMember {
  id?: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  isPrimaryContact: boolean;
}

export default function DirectoryPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "guardian" | "student">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
  
  // Inspector State
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draftPin, setDraftPin] = useState<string | null>(null);
  
  // Rapid Review State
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewIndex, setReviewIndex] = useState(-1);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [hideFromReview, setHideFromReview] = useState(false);

  // Email Preview State
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<"edit" | "visual">("edit"); // Toggle State
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [emailContent, setEmailContent] = useState({
    intro: "We are thrilled to invite you to the brand-new RAD Pioneer Learning Management System (LMS)! Our objective with this custom-built platform is to create a seamless, highly engaging digital hub for all our coding and robotics bootcamps.",
    pioneerHeading: "🎮 What Your Pioneer Gets",
    pioneerText: "Your child will have their own dedicated Command Center. Here, they can access interactive course materials, track their project progress, and fully immerse themselves in the world of tech and game creation.",
    parentHeading: "👨‍👩‍👧 What You Can Expect",
    parentText: "Over time, this portal will become your primary tool for managing your household's RAD experience. You'll be able to easily view term schedules, manage payment plans, securely update your contact details, and see the incredible skills your Pioneer is building week by week."
  });

  // Edited Data State
  const [editData, setEditData] = useState<any>(null);

  // Derived lookups
  const [guardianMap, setGuardianMap] = useState<Record<string, any>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchDirectory();
  }, []);

  useEffect(() => {
    if (selectedProfile) {
       setHideFromReview(false);
       setEmailViewMode("edit"); // Reset to edit mode when opening a new profile

       const existingCrew = profiles
         .filter(p => p.role === 'guardian' && p.metadata?.household_lead_id === selectedProfile.id)
         .map(p => ({
            id: p.id,
            name: p.display_name,
            email: p.metadata?.email || "",
            phone: p.metadata?.phone || "",
            relationship: p.metadata?.relationship || "Guardian",
            isPrimaryContact: p.metadata?.is_primary_contact ?? false
         }));

       setEditData({
         display_name: selectedProfile.display_name || "",
         status: selectedProfile.status || 'active',
         inactive_since: selectedProfile.inactive_since || '',
         payment_plan_preference: selectedProfile.payment_plan_preference || "",
         metadata: {
           email: selectedProfile.metadata?.email || "",
           phone: selectedProfile.metadata?.phone || "",
           relationship: selectedProfile.metadata?.relationship || "Guardian",
           is_primary_contact: selectedProfile.metadata?.is_primary_contact ?? true,
           admin_notes: selectedProfile.metadata?.admin_notes || ""
         },
         supportCrew: existingCrew
       });
    } else {
       setEditData(null);
    }
  }, [selectedProfile, profiles]);

  async function fetchDirectory() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const profs = data || [];
      setProfiles(profs);

      const gMap: Record<string, any> = {};
      const cMap: Record<string, any[]> = {};

      profs.forEach(p => {
        if (p.role === 'guardian' && !p.metadata?.household_lead_id) {
          gMap[p.id] = p;
          if (!cMap[p.id]) cMap[p.id] = [];
        }
      });

      profs.forEach(p => {
        if (p.role === 'student' && p.linked_parent_id) {
          if (!cMap[p.linked_parent_id]) cMap[p.linked_parent_id] = [];
          cMap[p.linked_parent_id].push(p);
        }
      });

      setGuardianMap(gMap);
      setChildrenMap(cMap);

    } catch (error) {
      console.error("Failed to fetch directory:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- HTML GENERATOR FOR LIVE PREVIEW ---
  const generateLivePreviewHTML = () => {
    // Generate dummy links for the preview
    const onboardingLink = `#`;
    const whatsappLink = `#`;
    
    return `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; text-align: left;">
        <h2 style="color: #a855f7; text-transform: uppercase; font-style: italic; letter-spacing: 1px; margin-bottom: 24px; font-size: 24px;">
          Welcome to the New RAD Portal
        </h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #e2e8f0;">
          Hi ${editData?.display_name || 'Guardian'},
        </p>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #e2e8f0; white-space: pre-wrap;">${emailContent.intro}</p>
        
        <h3 style="color: #38bdf8; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">${emailContent.pioneerHeading}</h3>
        <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; white-space: pre-wrap;">${emailContent.pioneerText}</p>
        
        <h3 style="color: #38bdf8; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">${emailContent.parentHeading}</h3>
        <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 30px; white-space: pre-wrap;">${emailContent.parentText}</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <p style="font-size: 16px; font-weight: bold; color: #ffffff; margin-bottom: 15px;">Please click below to complete your setup and activate your household:</p>
          <a href="${onboardingLink}" style="background-color: #9333ea; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
            Complete Onboarding
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #1e293b; text-align: center;">
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 15px;">Need help or have questions? Our support team is just a tap away.</p>
          <a href="${whatsappLink}" style="background-color: #25D366; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            💬 Chat with us on WhatsApp
          </a>
        </div>
        
        <p style="color: #475569; font-size: 12px; margin-top: 40px; text-align: center;">
          RAD Academy HQ | Empowering the next generation of innovators.<br/>
          <span style="font-style: italic;">Please do not reply directly to this automated transmission.</span>
        </p>
      </div>
    `;
  };

  // --- EMAIL AUTOMATION ---
  const handleSendInvite = async () => {
    if (!selectedProfile || !editData?.metadata?.email) return;
    
    setIsSendingInvite(true);
    try {
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editData.metadata.email,
          guardianName: editData.display_name,
          guardianId: selectedProfile.id,
          customContent: emailContent
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert("Onboarding invite transmitted successfully!");
        setShowEmailPreview(false);
      } else {
        throw new Error(data.error || "Failed to send API Request");
      }
    } catch (err: any) {
      alert("Transmission failed: " + err.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.metadata?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || p.role === roleFilter;
    const matchesStatus = p.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const startRapidReview = () => {
    if (filteredProfiles.length === 0) return alert("No profiles to review in current filter.");
    setReviewQueue(filteredProfiles);
    setReviewIndex(0);
    setSelectedProfile(filteredProfiles[0]);
    setIsReviewMode(true);
  };

  const nextReviewProfile = () => {
    let nextQueue = [...reviewQueue];
    if (hideFromReview) {
      nextQueue = nextQueue.filter((_, idx) => idx !== reviewIndex);
      setReviewQueue(nextQueue);
      if (nextQueue.length > 0 && reviewIndex < nextQueue.length) {
        setSelectedProfile(nextQueue[reviewIndex]);
      } else if (nextQueue.length > 0) {
        setReviewIndex(0);
        setSelectedProfile(nextQueue[0]);
      } else {
        exitReviewMode();
      }
      return;
    }
    if (reviewIndex < nextQueue.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setSelectedProfile(nextQueue[reviewIndex + 1]);
    } else {
      setReviewIndex(0);
      setSelectedProfile(nextQueue[0]);
    }
  };

  const prevReviewProfile = () => {
    if (reviewIndex > 0) {
      setReviewIndex(reviewIndex - 1);
      setSelectedProfile(reviewQueue[reviewIndex - 1]);
    } else {
      setReviewIndex(reviewQueue.length - 1);
      setSelectedProfile(reviewQueue[reviewQueue.length - 1]);
    }
  };

  const exitReviewMode = () => {
    setIsReviewMode(false);
    setReviewQueue([]);
    setReviewIndex(-1);
    setSelectedProfile(null);
  };

  const handleGenerateDraftPin = () => {
    setDraftPin(Math.floor(1000 + Math.random() * 9000).toString());
  };

  const handleSavePinToDB = async () => {
    if (!draftPin || !selectedProfile) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ temp_entry_pin: draftPin, auth_attempts: 0, is_locked: false })
        .eq('id', selectedProfile.id);

      if (error) throw error;
      
      const newProfileState = { ...selectedProfile, temp_entry_pin: draftPin };
      setSelectedProfile(newProfileState);
      setProfiles(profiles.map(p => p.id === selectedProfile.id ? newProfileState : p));
      
      if (isReviewMode) {
        setReviewQueue(reviewQueue.map(p => p.id === selectedProfile.id ? newProfileState : p));
      }
      setDraftPin(null);
    } catch (err) {
      alert("Database error saving PIN.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProfile = async (autoAdvance = false) => {
    if (!selectedProfile || !editData) return;
    setIsProcessing(true);
    try {
      const updatedInactiveSince = editData.status === 'inactive' ? editData.inactive_since : null;
      const payload = {
         display_name: editData.display_name,
         status: editData.status,
         inactive_since: updatedInactiveSince,
         payment_plan_preference: editData.payment_plan_preference,
         metadata: editData.metadata
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', selectedProfile.id);
      if (error) throw error;

      if (selectedProfile.role === 'guardian') {
         for (const member of editData.supportCrew) {
            const memberPayload = {
               role: 'guardian',
               display_name: member.name,
               status: editData.status,
               metadata: {
                  email: member.email,
                  phone: member.phone,
                  relationship: member.relationship,
                  is_primary_contact: member.isPrimaryContact,
                  household_lead_id: selectedProfile.id 
               }
            };
            if (member.id) {
               await supabase.from('profiles').update(memberPayload).eq('id', member.id);
            } else {
               await supabase.from('profiles').insert(memberPayload);
            }
         }
      }

      await fetchDirectory();

      if (isReviewMode && autoAdvance) {
        nextReviewProfile();
      } else if (!isReviewMode) {
        alert("Profile & Household updated successfully.");
      }
    } catch (err) {
      alert("Update failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addGuardian = () => {
    setEditData((prev: any) => ({
      ...prev,
      supportCrew: [...prev.supportCrew, { name: "", email: "", phone: "", relationship: "", isPrimaryContact: false }]
    }));
  };

  const setPrimary = (index: number | 'main') => {
    const nextMain = index === 'main';
    const nextAdditional = editData.supportCrew.map((g: SupportCrewMember, i: number) => ({
      ...g,
      isPrimaryContact: i === index
    }));
    
    setEditData((prev: any) => ({
      ...prev,
      metadata: { ...prev.metadata, is_primary_contact: nextMain },
      supportCrew: nextAdditional
    }));
  };

  const deleteSupportGuardian = async (index: number) => {
    const member = editData.supportCrew[index];
    if (member.id) {
       const confirmDelete = window.confirm(`Permanently delete ${member.name || 'this member'}?`);
       if (!confirmDelete) return;
       setIsProcessing(true);
       try {
         await supabase.from('profiles').delete().eq('id', member.id);
         await fetchDirectory();
       } catch (err) {
         alert("Failed to delete member.");
       } finally {
         setIsProcessing(false);
       }
    }
    const next = editData.supportCrew.filter((_: any, idx: number) => idx !== index);
    setEditData((prev:any) => ({...prev, supportCrew: next}));
  };

  const totalPioneers = profiles.filter(p => p.role === 'student' && p.status === 'active').length;
  const totalGuardians = profiles.filter(p => p.role === 'guardian' && p.status === 'active').length;

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4 text-left">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Accessing_Directory_Core...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <div className="flex gap-3">
               <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-500/50 px-4 py-2 rounded-xl transition-all w-fit">
                <ArrowLeft size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Command Center</span>
              </Link>
              <Link href="/admin/intake" className="group flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 hover:border-yellow-500 px-4 py-2 rounded-xl transition-all w-fit text-yellow-500 hover:text-yellow-400">
                <UserPlus size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Manual Intake</span>
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-500">
                <ShieldAlert size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active_Roster_Access</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Master_<span className="text-purple-500">Directory</span>
              </h1>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-blue-500/10 border border-blue-500/20 px-6 py-3 rounded-2xl text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Active Pioneers</p>
              <p className="text-2xl font-black italic">{totalPioneers}</p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 px-6 py-3 rounded-2xl text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Active Guardians</p>
              <p className="text-2xl font-black italic">{totalGuardians}</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white/[0.02] p-4 rounded-3xl border border-white/5">
          <div className="flex flex-wrap gap-4 w-full lg:w-auto">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              {(["all", "guardian", "student"] as const).map((role) => (
                <button key={role} onClick={() => setRoleFilter(role)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${roleFilter === role ? "bg-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>
                  {role === "student" ? "Pioneers" : role === "guardian" ? "Guardians" : "All Roles"}
                </button>
              ))}
            </div>
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              <button onClick={() => setStatusFilter("active")} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === "active" ? "bg-green-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>Active</button>
              <button onClick={() => setStatusFilter("inactive")} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === "inactive" ? "bg-red-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>Inactive</button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="relative group flex-1 lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" placeholder="Search names..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-purple-500 transition-all font-bold text-white placeholder:text-slate-600" />
            </div>
            <button onClick={startRapidReview} disabled={filteredProfiles.length === 0} className="px-6 py-3 bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-20 flex items-center gap-2 shrink-0 shadow-lg">
               Rapid Review <ChevronRight size={16}/>
            </button>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative min-h-[500px]">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
              <tr>
                <th className="px-8 py-5">Entity Details</th>
                <th className="px-8 py-5">Role / Status</th>
                <th className="px-8 py-5">Contact Vector</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProfiles.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 font-black uppercase tracking-widest text-sm italic">No records found.</td></tr>
              ) : (
                filteredProfiles.map((profile) => {
                  const isGuardian = profile.role === 'guardian';
                  const isSupportCrew = isGuardian && !!profile.metadata?.household_lead_id;
                  const isLeadGuardian = isGuardian && !isSupportCrew;
                  const isInactive = profile.status === 'inactive';

                  const leadGuardianForCrew = isSupportCrew ? profiles.find(p => p.id === profile.metadata.household_lead_id) : null;
                  const leadGuardianForStudent = profile.role === 'student' ? guardianMap[profile.linked_parent_id] : null;
                  const supportCrewForStudent = leadGuardianForStudent ? profiles.filter(p => p.role === 'guardian' && p.metadata?.household_lead_id === leadGuardianForStudent.id) : [];

                  return (
                    <tr key={profile.id} className={`transition-colors group ${isInactive ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/[0.03]'}`}>
                      <td className="px-8 py-6 align-top">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isInactive ? 'border-red-500/30 text-red-400' : isLeadGuardian ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : isSupportCrew ? 'border-fuchsia-500/30 text-fuchsia-400 bg-fuchsia-500/10' : 'border-blue-500/30 text-blue-400 bg-blue-500/10'}`}>
                            {isGuardian ? <UserPlus size={18}/> : <User size={18}/>}
                          </div>
                          <div>
                            <p className="font-black text-white italic uppercase text-lg leading-none">{profile.display_name}</p>
                            <p className="text-[9px] text-slate-500 font-bold mt-1">ID: {profile.id.split('-')[0]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top space-y-2">
                        <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${isInactive ? 'border-red-500/30 text-red-400' : isLeadGuardian ? 'border-purple-500/30 text-purple-400' : isSupportCrew ? 'border-fuchsia-500/30 text-fuchsia-400' : 'border-blue-500/30 text-blue-400'}`}>
                          {isLeadGuardian ? 'Lead Guardian' : isSupportCrew ? 'Support Crew' : 'Pioneer'}
                        </span>
                        <div>{isInactive ? <span className="flex items-center gap-1 text-[9px] font-bold uppercase text-red-500"><PowerOff size={10}/> Inactive ({profile.inactive_since})</span> : <span className="flex items-center gap-1 text-[9px] font-bold uppercase text-green-500"><CheckCircle2 size={10}/> Active</span>}</div>
                      </td>
                      <td className="px-8 py-6 align-top">
                        <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-400">
                          {profile.metadata?.email && <span className="flex items-center gap-2"><Mail size={12}/> {profile.metadata.email}</span>}
                          {profile.metadata?.phone && <span className="flex items-center gap-2"><Phone size={12}/> {profile.metadata.phone}</span>}
                          
                          {isSupportCrew && (
                             <span className="text-[9px] text-fuchsia-500 uppercase tracking-widest mt-2 border-t border-white/5 pt-2">
                               Linked to Lead: {leadGuardianForCrew?.display_name || 'Unknown'}
                             </span>
                          )}
                          {profile.role === 'student' && leadGuardianForStudent && (
                             <div className="mt-2 border-t border-white/5 pt-2 space-y-1">
                               <span className="text-[9px] text-purple-400 uppercase tracking-widest block">Lead: {leadGuardianForStudent.display_name}</span>
                               {supportCrewForStudent.map(sg => (
                                  <span key={sg.id} className="text-[9px] text-fuchsia-400 uppercase tracking-widest block pl-2 border-l border-white/10">Support: {sg.display_name}</span>
                               ))}
                             </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right align-top">
                        <button onClick={() => { setDraftPin(null); setIsReviewMode(false); setSelectedProfile(profile); }} className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[9px] font-black uppercase italic tracking-widest border border-white/10 text-white">
                          Inspect <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedProfile && editData && (
          <motion.div 
            key={isReviewMode ? 'review-mode' : 'inspect-mode'}
            className={`fixed inset-0 z-[50] flex ${isReviewMode ? 'items-center justify-center p-4 lg:p-12' : 'justify-end'}`}
          >
            
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => { if(!isReviewMode) setSelectedProfile(null) }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            
            {isReviewMode && (
              <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="absolute top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl z-50">
                 <button onClick={prevReviewProfile} className="hover:text-black transition-colors"><ChevronLeft size={20}/></button>
                 <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest">Rapid Review Mode</p>
                    <p className="text-xs font-bold">{reviewIndex + 1} of {reviewQueue.length}</p>
                 </div>
                 <button onClick={nextReviewProfile} className="hover:text-black transition-colors"><ChevronRight size={20}/></button>
              </motion.div>
            )}

            <motion.div 
              initial={isReviewMode ? { opacity: 0, scale: 0.95, y: 20 } : { x: "100%" }}
              animate={isReviewMode ? { opacity: 1, scale: 1, y: 0 } : { x: 0 }}
              exit={isReviewMode ? { opacity: 0, scale: 0.95, y: 20 } : { x: "100%" }}
              transition={{ type: "spring", damping: 25 }} 
              className={`relative w-full bg-[#0f172a] shadow-2xl flex flex-col p-8 space-y-8 overflow-y-auto custom-scrollbar z-10 ${
                isReviewMode 
                  ? 'max-w-4xl max-h-[85vh] border border-white/10 rounded-[40px]' 
                  : 'max-w-xl h-full border-l border-white/10 no-scrollbar'
              }`}
            >
              
              <div className="flex items-center justify-between pb-6 border-b border-white/5 shrink-0">
                <div className="space-y-1 w-full mr-4">
                  <input 
                    className="bg-transparent border-none outline-none text-3xl font-black uppercase italic w-full text-white" 
                    value={editData.display_name} 
                    onChange={e => setEditData({...editData, display_name: e.target.value})} 
                  />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">{selectedProfile.role} | ID: {selectedProfile.id.split('-')[0]}</span>
                </div>
                <button onClick={() => { isReviewMode ? exitReviewMode() : setSelectedProfile(null) }} className="p-3 rounded-full bg-white/5 hover:bg-white/10 shrink-0"><X size={24}/></button>
              </div>

              {/* --- EMAIL PREVIEW BUTTON --- */}
              {selectedProfile.role === 'guardian' && !selectedProfile.metadata?.household_lead_id && (
                <button onClick={() => setShowEmailPreview(true)} disabled={!editData.metadata.email} className="w-full p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                  <Mail size={18}/> Draft & Transmit Onboarding Invite
                </button>
              )}

              {/* --- GUARDIAN SPECIFIC DATA --- */}
              {selectedProfile.role === 'guardian' && !selectedProfile.metadata?.household_lead_id && (
                <div className="space-y-8">
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-[32px] p-6 space-y-6">
                    <div className="flex justify-between items-center border-b border-white/5 pb-4">
                      <div className="flex items-center gap-2 text-purple-400">
                        <Shield size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Lead Guardian Details</span>
                      </div>
                      <button onClick={() => setPrimary('main')} className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase transition-all ${editData.metadata.is_primary_contact ? 'bg-green-500 text-black' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>
                        <BellRing size={10}/> {editData.metadata.is_primary_contact ? 'Primary Contact' : 'Set as Primary'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Household Role</label>
                        <div className="relative">
                          <select className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 font-bold text-sm outline-none text-purple-400 appearance-none focus:border-purple-500 transition-all" value={editData.metadata.relationship} onChange={e => setEditData({...editData, metadata: {...editData.metadata, relationship: e.target.value}})}>
                            <option value="" disabled>Select Role</option>
                            {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Email</label>
                          <input className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-purple-500 transition-all" value={editData.metadata.email} onChange={e => setEditData({...editData, metadata: {...editData.metadata, email: e.target.value}})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Phone</label>
                          <input className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-purple-500 transition-all" value={editData.metadata.phone} onChange={e => setEditData({...editData, metadata: {...editData.metadata, phone: e.target.value}})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Support Crew</span>
                      <button onClick={addGuardian} className="text-[9px] font-black text-purple-400 uppercase bg-purple-500/10 px-3 py-1.5 rounded-lg hover:bg-purple-500 hover:text-white transition-all">+ Add Member</button>
                    </div>

                    {editData.supportCrew?.map((g: SupportCrewMember, i: number) => (
                      <div key={g.id || i} className="bg-white/5 border border-white/10 rounded-3xl p-6 relative group">
                        <button onClick={() => deleteSupportGuardian(i)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 transition-all hover:bg-red-500 hover:text-white"><Trash2 size={14}/></button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="col-span-1 md:col-span-2 flex justify-between items-center border-b border-white/5 pb-4 mb-2">
                              <div className="space-y-1 flex-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Household Role</label>
                                <div className="relative max-w-[200px]">
                                    <select className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2 font-bold text-xs outline-none text-purple-400 appearance-none focus:border-purple-500 transition-all" value={g.relationship} onChange={e => {
                                        const next = [...editData.supportCrew];
                                        next[i].relationship = e.target.value;
                                        setEditData((prev:any) => ({...prev, supportCrew: next}));
                                    }}>
                                        <option value="" disabled>Select Role</option>
                                        {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                                </div>
                              </div>
                              <button onClick={() => setPrimary(i)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[8px] font-black uppercase transition-all mt-4 ${g.isPrimaryContact ? 'bg-green-500 text-black' : 'text-slate-500 bg-white/5 hover:bg-white/10'}`}>
                                  <BellRing size={10}/> {g.isPrimaryContact ? 'Primary Contact' : 'Set Primary'}
                              </button>
                          </div>
                          <input placeholder="Name" className="bg-[#0f172a] border border-white/5 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-purple-500 transition-all" value={g.name} onChange={e => {
                              const next = [...editData.supportCrew];
                              next[i].name = e.target.value;
                              setEditData((prev:any) => ({...prev, supportCrew: next}));
                          }} />
                          <input placeholder="Phone" className="bg-[#0f172a] border border-white/5 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-purple-500 transition-all" value={g.phone} onChange={e => {
                              const next = [...editData.supportCrew];
                              next[i].phone = e.target.value;
                              setEditData((prev:any) => ({...prev, supportCrew: next}));
                          }} />
                          <input placeholder="Email" className="col-span-1 md:col-span-2 bg-[#0f172a] border border-white/5 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-purple-500 transition-all" value={g.email} onChange={e => {
                              const next = [...editData.supportCrew];
                              next[i].email = e.target.value;
                              setEditData((prev:any) => ({...prev, supportCrew: next}));
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><CreditCard size={14}/> Payment Plan</label>
                    <select value={editData.payment_plan_preference} onChange={e => setEditData({...editData, payment_plan_preference: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-purple-500">
                      <option value="" disabled>No Plan Selected</option>
                      {PAYMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()} PLAN</option>)}
                    </select>
                  </div>
                </div>
              )}

              {selectedProfile.role === 'guardian' && selectedProfile.metadata?.household_lead_id && (
                 <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-[32px] p-6 space-y-4 text-center">
                    <Shield size={32} className="mx-auto text-fuchsia-500"/>
                    <p className="text-sm font-bold text-slate-300">This profile is a Support Crew member.</p>
                    <p className="text-xs text-slate-500">To edit their details, relationships, or to manage the household, please inspect the <strong className="text-purple-400 uppercase">Lead Guardian</strong> profile.</p>
                 </div>
              )}

              {selectedProfile.role === 'student' && selectedProfile.status !== 'inactive' && (
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6">
                  <div className="flex items-center gap-2 text-teal-400"><Key size={16} /><span className="text-[10px] font-black uppercase">Access PIN</span></div>
                  {selectedProfile.temp_entry_pin ? (
                    <div className="text-center bg-teal-500/10 p-6 rounded-2xl border border-teal-500/20">
                      <span className="text-6xl font-black text-white italic tracking-widest">{selectedProfile.temp_entry_pin}</span>
                      <button onClick={() => navigator.clipboard.writeText(selectedProfile.temp_entry_pin)} className="block mx-auto mt-4 text-xs text-teal-400 font-bold uppercase hover:text-white transition-colors">Copy to Clipboard</button>
                      <button onClick={handleGenerateDraftPin} className="mt-4 text-[9px] font-black text-slate-500 block mx-auto pt-4 border-t border-white/5 hover:text-red-400 transition-colors">Overwrite with new PIN</button>
                    </div>
                  ) : draftPin ? (
                    <div className="space-y-4">
                      <div className="text-center py-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl"><span className="text-5xl font-black text-white italic tracking-widest">{draftPin}</span></div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDraftPin(null)} className="py-4 bg-white/5 rounded-xl text-[10px] font-black uppercase hover:bg-red-500/10 hover:text-red-400 transition-colors">Cancel</button>
                        <button onClick={handleSavePinToDB} className="py-4 bg-teal-600 rounded-xl text-[10px] font-black uppercase text-white shadow-lg hover:bg-teal-500 transition-colors">Confirm & Save</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleGenerateDraftPin} className="w-full p-5 bg-teal-600/10 rounded-2xl text-[10px] font-black uppercase text-teal-400 border border-teal-500/20 hover:bg-teal-600 hover:text-white transition-all">Generate Access PIN</button>
                  )}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><PowerOff size={14}/> Account Status</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <select value={editData.status} onChange={e => setEditData({...editData, status: e.target.value, inactive_since: e.target.value === 'active' ? null : editData.inactive_since})} className="bg-[#020617] border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-purple-500 flex-1">
                      <option value="active">Active Sector</option>
                      <option value="inactive">Inactive Break</option>
                    </select>
                    {editData.status === 'inactive' && <input type="date" value={editData.inactive_since || ''} onChange={e => setEditData({...editData, inactive_since: e.target.value})} className="bg-[#020617] border border-white/10 rounded-xl p-3 text-sm font-bold text-red-400 w-full flex-1 outline-none focus:border-red-500" />}
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><BookOpen size={14}/> Operational Notes</label>
                  <textarea id="admin_notes" value={editData.metadata.admin_notes} onChange={e => setEditData({...editData, metadata: {...editData.metadata, admin_notes: e.target.value}})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-5 text-sm font-bold text-slate-300 min-h-[120px] outline-none focus:border-purple-500" placeholder="Internal notes..." />
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 mt-auto pb-6 space-y-4">
                {isReviewMode && (
                   <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                     <input type="checkbox" id="hideReview" checked={hideFromReview} onChange={e => setHideFromReview(e.target.checked)} className="w-5 h-5 accent-blue-500 cursor-pointer" />
                     <label htmlFor="hideReview" className="text-xs font-bold text-slate-400 cursor-pointer flex-1">Remove this profile from current Rapid Review queue</label>
                   </div>
                )}
                
                <div className="flex gap-4">
                  {isReviewMode && (
                    <button onClick={nextReviewProfile} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase italic text-slate-400 hover:text-white transition-all">
                      Skip for Now
                    </button>
                  )}
                  <button onClick={() => handleUpdateProfile(isReviewMode)} disabled={isProcessing || selectedProfile.metadata?.household_lead_id} className="flex-[2] p-5 bg-purple-600 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 hover:bg-purple-500 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> Commit & {isReviewMode ? 'Next' : 'Save'}</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- EMAIL PREVIEW MODAL --- */}
      <AnimatePresence>
        {showEmailPreview && editData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEmailPreview(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-2xl bg-[#0f172a] shadow-2xl flex flex-col p-8 rounded-[40px] border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-6 border-b border-white/5 shrink-0 mb-6">
                <div>
                  <h2 className="text-3xl font-black uppercase italic text-blue-400">Draft Transmission</h2>
                  <p className="text-sm text-slate-500 mt-1">Recipient: <span className="text-white font-bold">{editData.display_name}</span> &lt;{editData.metadata.email}&gt;</p>
                </div>
                <button onClick={() => setShowEmailPreview(false)} className="p-3 rounded-full bg-white/5 hover:bg-white/10 shrink-0"><X size={24}/></button>
              </div>

              {/* View Toggle */}
              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-fit mb-6">
                 <button onClick={() => setEmailViewMode('edit')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${emailViewMode === 'edit' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                    <PenTool size={14} /> Edit Text
                 </button>
                 <button onClick={() => setEmailViewMode('visual')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${emailViewMode === 'visual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                    <Eye size={14} /> Live Preview
                 </button>
              </div>

              {emailViewMode === 'edit' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Intro Paragraph</label>
                    <textarea 
                      value={emailContent.intro} 
                      onChange={e => setEmailContent({...emailContent, intro: e.target.value})} 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-2xl p-4 text-sm font-medium text-slate-300 min-h-[100px] outline-none focus:border-blue-500 transition-colors" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Pioneer Section Heading</label>
                    <input 
                      value={emailContent.pioneerHeading} 
                      onChange={e => setEmailContent({...emailContent, pioneerHeading: e.target.value})} 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-sky-400 outline-none focus:border-blue-500 transition-colors" 
                    />
                    <textarea 
                      value={emailContent.pioneerText} 
                      onChange={e => setEmailContent({...emailContent, pioneerText: e.target.value})} 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-2xl p-4 text-sm font-medium text-slate-300 min-h-[100px] outline-none focus:border-blue-500 transition-colors mt-2" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Parent Section Heading</label>
                    <input 
                      value={emailContent.parentHeading} 
                      onChange={e => setEmailContent({...emailContent, parentHeading: e.target.value})} 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-sky-400 outline-none focus:border-blue-500 transition-colors" 
                    />
                    <textarea 
                      value={emailContent.parentText} 
                      onChange={e => setEmailContent({...emailContent, parentText: e.target.value})} 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-2xl p-4 text-sm font-medium text-slate-300 min-h-[100px] outline-none focus:border-blue-500 transition-colors mt-2" 
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-[#0f172a] rounded-3xl border border-white/10 overflow-hidden shadow-inner flex justify-center py-8">
                  <div dangerouslySetInnerHTML={{ __html: generateLivePreviewHTML() }} className="w-full" />
                </div>
              )}

              <div className="pt-6 border-t border-white/5 mt-8 flex gap-4 shrink-0">
                <button onClick={() => setShowEmailPreview(false)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase italic text-slate-400 hover:text-white transition-all">
                  Cancel
                </button>
                <button onClick={handleSendInvite} disabled={isSendingInvite} className="flex-[2] p-5 bg-blue-600 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 hover:bg-blue-500 transition-all shadow-xl disabled:opacity-50 shadow-blue-900/20">
                  {isSendingInvite ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18}/> Confirm & Transmit</>}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}