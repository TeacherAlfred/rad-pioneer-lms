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

// Custom Helper to Safely Parse DB Strings into JSON Objects
const safeParse = (val: any) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch(e) { return {}; }
  }
  return val || {};
};

// Custom UI Component to visually show changes (Diffing)
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
  const [roleFilter, setRoleFilter] = useState<"all" | "guardian" | "student" | "review">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
  
  // Workspace State
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedProfileLeadGuardian, setSelectedProfileLeadGuardian] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draftPin, setDraftPin] = useState<string | null>(null);
  
  // Rapid Review State
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewIndex, setReviewIndex] = useState(-1);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Email Preview State
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<"edit" | "visual">("edit");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [emailTemplateData, setEmailTemplateData] = useState<any>(null);
  const [emailContent, setEmailContent] = useState(""); 

  // Workspace Edit Data State
  const [workspaceEditData, setWorkspaceEditData] = useState<any>(null);

  // Derived lookups
  const [guardianMap, setGuardianMap] = useState<Record<string, any>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    // 1. Fetch the initial data when the page loads
    fetchDirectory();

    // 2. Open a real-time WebSocket connection to Supabase
    const directorySubscription = supabase
      .channel('directory-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' }, // Listen to ANY change on the profiles table
        (payload) => {
          console.log("Realtime Ping Received:", payload);
          // 3. Silently fetch the fresh data to update the UI
          fetchDirectory(); 
        }
      )
      .subscribe();

    // 4. Cleanup the connection when you leave the page so it doesn't drain memory
    return () => {
      supabase.removeChannel(directorySubscription);
    };
  }, []);

  useEffect(() => {
    async function populateWorkspaceEditData() {
      if (selectedProfile) {
         setEmailViewMode("edit");
         if (emailTemplateData) setEmailContent(emailTemplateData.body_content);

         const isGuardian = selectedProfile.role === 'guardian';
         const isLeadGuardian = isGuardian && !selectedProfile.metadata?.household_lead_id;
         const isSupportCrew = isGuardian && !!selectedProfile.metadata?.household_lead_id;

         let leadGuardianData = null;
         let existingCrew: any[] = []; // <--- Added type declaration

         if (isSupportCrew) {
            leadGuardianData = profiles.find(p => p.id === selectedProfile.metadata.household_lead_id);
            setSelectedProfileLeadGuardian(leadGuardianData);
         } else if (selectedProfile.role === 'student' && selectedProfile.linked_parent_id) {
            leadGuardianData = profiles.find(p => p.id === selectedProfile.linked_parent_id);
            setSelectedProfileLeadGuardian(leadGuardianData);
         } else if (isLeadGuardian) {
            leadGuardianData = selectedProfile;
            setSelectedProfileLeadGuardian(leadGuardianData);
            existingCrew = profiles
                .filter(p => p.role === 'guardian' && p.metadata?.household_lead_id === selectedProfile.id)
                .map(p => ({
                    id: p.id,
                    name: p.display_name,
                    email: p.metadata?.email || "",
                    phone: p.metadata?.phone || "",
                    relationship: p.metadata?.relationship || "Guardian",
                    isPrimaryContact: p.metadata?.is_primary_contact ?? false
                }));
         } else {
            setSelectedProfileLeadGuardian(null);
         }

         const meta = selectedProfile.metadata;
         const previousMeta = selectedProfile.previous_state?.metadata || {};

         const diffData = {
           display_name: selectedProfile.display_name || "",
           status: selectedProfile.status || 'active',
           inactive_since: selectedProfile.inactive_since || '',
           payment_plan_preference: selectedProfile.payment_plan_preference || "",
           metadata: {
             email: meta?.email || "",
             phone: meta?.phone || "",
             relationship: meta?.relationship || "Guardian",
             is_primary_contact: meta?.is_primary_contact ?? true,
             admin_notes: meta?.admin_notes || "",
             username: meta?.username || "",
             date_of_birth: meta?.date_of_birth || "",
           },
           supportCrew: existingCrew,
           diff: { // Store the data for diffing
             display_name: selectedProfile.display_name,
             previous_display_name: selectedProfile.previous_state?.display_name,
             metadata: {
                relationship: meta?.relationship,
                previous_relationship: previousMeta?.relationship,
                email: meta?.email,
                previous_email: previousMeta?.email,
                phone: meta?.phone,
                previous_phone: previousMeta?.phone,
                username: meta?.username,
                previous_username: previousMeta?.username,
                date_of_birth: meta?.date_of_birth,
                previous_date_of_birth: previousMeta?.date_of_birth,
             },
             payment_plan_preference: selectedProfile.payment_plan_preference,
             previous_payment_plan_preference: selectedProfile.previous_state?.payment_plan_preference,
             tc_accepted_version: meta?.tc_accepted_version,
             previous_tc_accepted_version: previousMeta?.tc_accepted_version,
           }
         };

         setWorkspaceEditData(diffData);
      } else {
         setWorkspaceEditData(null);
         setSelectedProfileLeadGuardian(null);
      }
    }
    populateWorkspaceEditData();
  }, [selectedProfile, profiles, emailTemplateData]);

  async function fetchDirectory() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      // Ensure JSON data is properly parsed!
      const parsedProfiles = (data || []).map(p => ({
        ...p,
        metadata: safeParse(p.metadata),
        previous_state: safeParse(p.previous_state)
      }));

      const { data: tplData } = await supabase.from('email_templates').select('*').eq('slug', 'onboarding_invite').single();
      if (tplData) {
        setEmailTemplateData(tplData);
        if (!emailContent) setEmailContent(tplData.body_content);
      }

      setProfiles(parsedProfiles);

      const gMap: Record<string, any> = {};
      const cMap: Record<string, any[]> = {};

      parsedProfiles.forEach(p => {
        if (p.role === 'guardian' && !p.metadata?.household_lead_id) {
          gMap[p.id] = p;
          if (!cMap[p.id]) cMap[p.id] = [];
        }
      });

      parsedProfiles.forEach(p => {
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

  const generateLivePreviewHTML = () => {
    const onboardingLink = `#`;
    const whatsappLink = `https://wa.me/27769065959`;
    let parsedContent = emailContent ? emailContent.replace(/{{onboardingLink}}/g, onboardingLink) : "";
    
    return `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; text-align: left;">
        <h2 style="color: #a855f7; text-transform: uppercase; font-style: italic; letter-spacing: 1px; margin-bottom: 24px; font-size: 24px;">
          ${emailTemplateData?.subject || 'Welcome to the New RAD Portal'}
        </h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #e2e8f0;">
          Hi ${workspaceEditData?.display_name || 'Guardian'},
        </p>
        <div style="font-size: 15px; line-height: 1.6; color: #e2e8f0;">
           ${parsedContent}
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

  const handleSendInvite = async () => {
    if (!selectedProfile || !workspaceEditData?.metadata?.email) return;
    setIsSendingInvite(true);
    try {
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: workspaceEditData.metadata.email,
          guardianName: workspaceEditData.display_name,
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

  const handleUpdateProfile = async (autoAdvance = false) => {
    if (!selectedProfile || !workspaceEditData) return;
    setIsProcessing(true);
    try {
      const updatedInactiveSince = workspaceEditData.status === 'inactive' ? workspaceEditData.inactive_since : null;
      const payload: any = {
         display_name: workspaceEditData.display_name,
         status: workspaceEditData.status,
         inactive_since: updatedInactiveSince,
         payment_plan_preference: workspaceEditData.payment_plan_preference,
         metadata: workspaceEditData.metadata
      };

      // Construct individual-specific metadata based on role
      const isLeadGuardian = selectedProfile.role === 'guardian' && !selectedProfile.metadata?.household_lead_id;
      if (!isLeadGuardian) {
          // If not lead, construct payload to *only* update individual details (and parent link for student)
          const metaPayload = { ...workspaceEditData.metadata };
          // Remove household wide info (already handled in top-level update as it applies to all linked profiles usually)
          // payment plan is also individual, but here we keep it to the lead to prevent inconsistent household data if edited on individual.
          // Support crew editing should only change their *individual* info. Student too.
          if (selectedProfile.role === 'student') {
             // keep student metadata as is but the payment plan and status should be careful.
          } else {
             // For support crew individual details. Payment plan management on lead.
          }
      }

      const { error } = await supabase.from('profiles').update(payload).eq('id', selectedProfile.id);
      if (error) throw error;

      if (selectedProfile.role === 'guardian' && isLeadGuardian) {
         for (const member of workspaceEditData.supportCrew) {
            const memberPayload = {
               role: 'guardian',
               display_name: member.name,
               status: workspaceEditData.status,
               metadata: {
                  email: member.email,
                  phone: member.phone,
                  relationship: member.relationship,
                  is_primary_contact: member.isPrimaryContact,
                  household_lead_id: selectedProfile.id 
               }
            };
            if (member.id) await supabase.from('profiles').update(memberPayload).eq('id', member.id);
            else await supabase.from('profiles').insert(memberPayload);
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

  const handleAcceptReview = async () => {
    if (!selectedProfile || !workspaceEditData) return;
    setIsProcessing(true);
    try {
      // Constructed payload as in update, but additionally clear the review flags
      const updatedInactiveSince = workspaceEditData.status === 'inactive' ? workspaceEditData.inactive_since : null;
      const payload: any = {
         display_name: workspaceEditData.display_name,
         status: workspaceEditData.status,
         inactive_since: updatedInactiveSince,
         payment_plan_preference: workspaceEditData.payment_plan_preference,
         metadata: workspaceEditData.metadata,
         requires_review: false, // CLEAR FLAG
         previous_state: {}, // CLEAR OLD STATE
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', selectedProfile.id);
      if (error) throw error;

      await fetchDirectory();

      if (isReviewMode) {
        nextReviewProfile();
      } else {
        // Automatically close the modal when not in Rapid Review mode
        alert("Review updates accepted and cleared.");
        setSelectedProfile(null); 
      }
    } catch (err) {
      alert("Database error accepting review changes.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.metadata?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesRole = false;
    if (roleFilter === "all") matchesRole = true;
    else if (roleFilter === "guardian") matchesRole = p.role === "guardian";
    else if (roleFilter === "student") matchesRole = p.role === "student";
    else if (roleFilter === "review") matchesRole = p.requires_review === true;
    const matchesStatus = p.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const startRapidReview = () => {
    if (filteredProfiles.length === 0) return alert("No profiles to review in current filter.");
    const queue = profiles.filter(p => p.requires_review === true);
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
      exitReviewMode();
    }
  };

  const prevReviewProfile = () => {
    if (reviewIndex > 0) {
      setReviewIndex(reviewIndex - 1);
      setSelectedProfile(reviewQueue[reviewIndex - 1]);
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
      const { error } = await supabase.from('profiles').update({ temp_entry_pin: draftPin, auth_attempts: 0, is_locked: false }).eq('id', selectedProfile.id);
      if (error) throw error;
      const newProfileState = { ...selectedProfile, temp_entry_pin: draftPin };
      setSelectedProfile(newProfileState);
      setProfiles(profiles.map(p => p.id === selectedProfile.id ? newProfileState : p));
      setDraftPin(null);
    } catch (err) {
      alert("Database error saving PIN.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addGuardian = () => {
    setWorkspaceEditData((prev: any) => ({
      ...prev,
      supportCrew: [...prev.supportCrew, { name: "", email: "", phone: "", relationship: "", isPrimaryContact: false }]
    }));
  };

  const setPrimary = (index: number | 'main') => {
    const nextMain = index === 'main';
    const nextAdditional = workspaceEditData.supportCrew.map((g: SupportCrewMember, i: number) => ({ ...g, isPrimaryContact: i === index }));
    setWorkspaceEditData((prev: any) => ({ ...prev, metadata: { ...prev.metadata, is_primary_contact: nextMain }, supportCrew: nextAdditional }));
  };

  const deleteSupportGuardian = async (index: number) => {
    const member = workspaceEditData.supportCrew[index];
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
    const next = workspaceEditData.supportCrew.filter((_: any, idx: number) => idx !== index);
    setWorkspaceEditData((prev:any) => ({...prev, supportCrew: next}));
  };

  const totalPioneers = profiles.filter(p => p.role === 'student' && p.status === 'active').length;
  const totalGuardians = profiles.filter(p => p.role === 'guardian' && p.status === 'active').length;
  const totalReviews = profiles.filter(p => p.requires_review).length;

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4 text-left">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Accessing_Directory_Core...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-leftSelectionSelection:bg-purple-500/30 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* ======================================================== */}
        {/* VIEW 1: THE DIRECTORY TABLE & WORKSPACE                 */}
        {/* ======================================================== */}
        <AnimatePresence mode="wait">
        {!selectedProfile && !isReviewMode ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="directory-table" className="space-y-10">
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
              
              <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <button onClick={() => setRoleFilter('student')} className={`px-6 py-3 rounded-2xl text-center border transition-all ${roleFilter === 'student' ? 'bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Pioneers</p>
                  <p className="text-2xl font-black italic">{totalPioneers}</p>
                </button>
                <button onClick={() => setRoleFilter('guardian')} className={`px-6 py-3 rounded-2xl text-center border transition-all ${roleFilter === 'guardian' ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/50'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-purple-400">Guardians</p>
                  <p className="text-2xl font-black italic">{totalGuardians}</p>
                </button>
                <button onClick={() => setRoleFilter('review')} className={`px-6 py-3 rounded-2xl text-center border transition-all ${roleFilter === 'review' ? 'bg-yellow-500/20 border-yellow-500 shadow-lg shadow-yellow-500/20' : 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/50'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-yellow-400">Pending Reviews</p>
                  <p className="text-2xl font-black italic">{totalReviews}</p>
                </button>
              </div>
            </header>

            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white/[0.02] p-4 rounded-3xl border border-white/5">
              <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                  {(["all", "guardian", "student", "review"] as const).map((role) => (
                    <button key={role} onClick={() => setRoleFilter(role)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${roleFilter === role ? "bg-purple-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>
                      {role === "student" ? "Pioneers" : role === "guardian" ? "Guardians" : role === "review" ? "Review Queue" : "All Roles"}
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
                <button onClick={startRapidReview} disabled={totalReviews === 0} className="px-6 py-3 bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-20 flex items-center gap-2 shrink-0 shadow-lg">
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
                        <tr key={profile.id} className={`transition-colors group ${isInactive ? 'bg-red-500/5 hover:bg-red-500/10' : profile.requires_review ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : 'hover:bg-white/[0.03]'}`}>
                          <td className="px-8 py-6 align-top">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isInactive ? 'border-red-500/30 text-red-400' : profile.requires_review ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/20' : isLeadGuardian ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : isSupportCrew ? 'border-fuchsia-500/30 text-fuchsia-400 bg-fuchsia-500/10' : 'border-blue-500/30 text-blue-400 bg-blue-500/10'}`}>
                                {isGuardian ? <UserPlus size={18}/> : <User size={18}/>}
                              </div>
                              <div>
                                <p className="font-black text-white italic uppercase text-lg leading-none flex items-center gap-2">
                                  {profile.display_name}
                                  {profile.requires_review && <AlertCircle size={14} className="text-yellow-500 animate-pulse" />}
                                </p>
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
                            <button onClick={() => setSelectedProfile(profile)} className={`inline-flex items-center gap-2 px-6 py-2 rounded-xl transition-all text-[9px] font-black uppercase italic tracking-widest border ${profile.requires_review ? 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-400 shadow-lg shadow-yellow-500/20' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'}`}>
                              {profile.requires_review ? 'Review Changes' : 'Inspect'} <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: THE FULL PAGE EDITOR WORKSPACE                   */
          /* ======================================================== */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} key="directory-workspace" className="space-y-8 pb-20">
            
            {/* WORKSPACE HEADER */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-white/5 pb-8">
              <div className="space-y-4 w-full md:w-auto relative">
                <button onClick={() => { setSelectedProfile(null); setIsReviewMode(false); setReviewQueue([]); }} className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-purple-400 transition-colors">
                  <ArrowLeft size={16} /> Back to Directory
                </button>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${selectedProfile.role === 'student' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-purple-500/30 text-purple-400 bg-purple-500/10'}`}>
                    {selectedProfile.role === 'student' ? <User size={24}/> : <UserPlus size={24}/>}
                  </div>
                  <div className="space-y-1">
                    <input 
                      className="bg-transparent border-none outline-none text-4xl font-black uppercase italic w-full text-white leading-none p-0" 
                      value={workspaceEditData?.display_name || ''} 
                      onChange={e => setWorkspaceEditData({...workspaceEditData, display_name: e.target.value})} 
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                       {selectedProfile.role} | ID: {selectedProfile.id.split('-')[0]}
                       {selectedProfileLeadGuardian && <span className="text-purple-400"> | Linked to Lead: {selectedProfileLeadGuardian.display_name}</span>}
                    </span>
                  </div>
                </div>
                <button onClick={() => { setSelectedProfile(null); setIsReviewMode(false); setReviewQueue([]); }} className="absolute -top-3 -right-3 md:top-2 md:-right-8 p-3 rounded-full bg-white/5 hover:bg-white/10 shrink-0 border border-white/10"><X size={20}/></button>
              </div>

              <div className="flex gap-4 w-full md:w-auto">
                {isReviewMode && (
                  <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 px-2 py-1 rounded-xl mr-4">
                     <button onClick={prevReviewProfile} disabled={reviewIndex === 0} className="p-2 hover:text-blue-400 disabled:opacity-20"><ChevronLeft size={18}/></button>
                     <span className="text-[10px] font-black uppercase text-blue-400 w-24 text-center">Review {reviewIndex + 1} of {reviewQueue.length}</span>
                     <button onClick={nextReviewProfile} disabled={reviewIndex === reviewQueue.length - 1} className="p-2 hover:text-blue-400 disabled:opacity-20"><ChevronRight size={18}/></button>
                  </div>
                )}
                {selectedProfile.requires_review ? (
                  <button onClick={handleAcceptReview} disabled={isProcessing} className="flex-1 md:flex-none px-8 py-4 bg-yellow-500 text-black rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all shadow-xl shadow-yellow-900/20 disabled:opacity-50">
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18}/> Accept & Clear Flag</>}
                  </button>
                ) : (
                  <button onClick={() => handleUpdateProfile()} disabled={isProcessing} className="flex-1 md:flex-none px-8 py-4 bg-purple-600 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/20 disabled:opacity-50">
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> Commit Changes</>}
                  </button>
                )}
              </div>
            </div>

            {/* TWO COLUMN WORKSPACE LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* LEFT COLUMN: Main Individual & Household Data Cards */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* --- LEAD GUARDIAN DETAILS & HOUSEHOLD MANAGEMENT --- */}
                {selectedProfile.role === 'guardian' && !selectedProfile.metadata?.household_lead_id && workspaceEditData && (
                  <>
                  <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl space-y-8">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                      <Shield className="text-purple-500" size={20} />
                      <h3 className="text-xl font-black uppercase tracking-widest text-white">Lead Guardian Details</h3>
                      <button onClick={() => setPrimary('main')} className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${workspaceEditData.metadata.is_primary_contact ? 'bg-green-500 text-black' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>
                        <BellRing size={12}/> {workspaceEditData.metadata.is_primary_contact ? 'Primary Contact' : 'Set as Primary'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                      <div className="md:col-span-2">
                        <DiffLabel label="Display Name" value={workspaceEditData.display_name} previousValue={selectedProfile.previous_state?.display_name} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, display_name: v})} />
                      </div>
                      <DiffLabel label="Household Role" value={workspaceEditData.metadata.relationship} previousValue={selectedProfile.previous_state?.metadata?.relationship} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, relationship: v}})} />
                      <DiffLabel label="Payment Plan" value={workspaceEditData.payment_plan_preference} previousValue={selectedProfile.previous_state?.payment_plan_preference} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, payment_plan_preference: v})} />
                      <DiffLabel label="Email Address" type="email" value={workspaceEditData.metadata.email} previousValue={selectedProfile.previous_state?.metadata?.email} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, email: v}})} />
                      <DiffLabel label="Phone Number" value={workspaceEditData.metadata.phone} previousValue={selectedProfile.previous_state?.metadata?.phone} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, phone: v}})} />
                      <DiffLabel label="TC Version Accepted" value={workspaceEditData.metadata.tc_accepted_version} previousValue={selectedProfile.previous_state?.metadata?.tc_accepted_version} disabled={true} />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between px-2 pt-4 border-t border-white/5">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><Users size={14}/> Support Crew ({workspaceEditData.supportCrew.length})</span>
                      <button onClick={addGuardian} className="text-[9px] font-black text-purple-400 uppercase bg-purple-500/10 px-3 py-1.5 rounded-lg hover:bg-purple-500 hover:text-white transition-all">+ Add Member</button>
                    </div>

                    {workspaceEditData.supportCrew?.map((g: SupportCrewMember, i: number) => (
                      <div key={g.id || i} className="bg-white/5 border border-white/10 rounded-[32px] p-8 relative group">
                        <button onClick={() => deleteSupportGuardian(i)} className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center border-4 border-[#0f172a] transition-all hover:bg-red-400"><Trash2 size={14}/></button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-1 md:col-span-2 flex justify-between items-center border-b border-white/5 pb-6 mb-2">
                              <div className="space-y-1 flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-1 block">Household Role</label>
                                <div className="relative max-w-[200px]">
                                    <select className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 font-bold text-sm outline-none text-purple-400 appearance-none focus:border-purple-500 transition-all" value={g.relationship} onChange={e => {
                                        const next = [...workspaceEditData.supportCrew];
                                        next[i].relationship = e.target.value;
                                        setWorkspaceEditData((prev:any) => ({...prev, supportCrew: next}));
                                    }}>
                                        <option value="" disabled>Select Role</option>
                                        {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
                                </div>
                              </div>
                              <button onClick={() => setPrimary(i)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all mt-4 ${g.isPrimaryContact ? 'bg-green-500 text-black' : 'text-slate-500 bg-white/5 hover:bg-white/10'}`}>
                                  <BellRing size={12}/> {g.isPrimaryContact ? 'Primary Contact' : 'Set Primary'}
                              </button>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-1 block">Name</label>
                            <input className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple-500 transition-all" value={g.name} onChange={e => {
                                const next = [...workspaceEditData.supportCrew];
                                next[i].name = e.target.value;
                                setWorkspaceEditData((prev:any) => ({...prev, supportCrew: next}));
                            }} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-1 block">Phone</label>
                            <input className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple-500 transition-all" value={g.phone} onChange={e => {
                                const next = [...workspaceEditData.supportCrew];
                                next[i].phone = e.target.value;
                                setWorkspaceEditData((prev:any) => ({...prev, supportCrew: next}));
                            }} />
                          </div>
                          <div className="col-span-1 md:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-1 block">Email</label>
                            <input className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple-500 transition-all" value={g.email} onChange={e => {
                                const next = [...workspaceEditData.supportCrew];
                                next[i].email = e.target.value;
                                setWorkspaceEditData((prev:any) => ({...prev, supportCrew: next}));
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}

                {/* --- SUPPORT CREW INDIVIDUAL DETAILS & WORKSPACE CLARIFICATION --- */}
                {selectedProfile.role === 'guardian' && selectedProfile.metadata?.household_lead_id && workspaceEditData && (
                  <>
                  <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-[32px] p-6 text-center space-y-3 shadow-xl">
                      <LayoutTemplate size={28} className="mx-auto text-fuchsia-500"/>
                      <p className="text-base font-black uppercase text-white italic tracking-wide">Support Crew Member Workspace</p>
                      <p className="text-xs text-slate-300 max-w-lg mx-auto">This profile is a <strong className="text-fuchsia-400 uppercase">Support Crew</strong> member. You can edit their individual details and role here. To manage household-wide data or pioneers, please inspect the <strong className="text-purple-400 uppercase">Lead Guardian</strong> profile instead.</p>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                          <div className="md:col-span-2">
                             <DiffLabel label="Display Name" value={workspaceEditData.display_name} previousValue={selectedProfile.previous_state?.display_name} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, display_name: v})} />
                          </div>
                          <DiffLabel label="Household Role" value={workspaceEditData.metadata.relationship} previousValue={selectedProfile.previous_state?.metadata?.relationship} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, relationship: v}})} />
                          <DiffLabel label="Payment Plan" value={workspaceEditData.payment_plan_preference} previousValue={selectedProfile.previous_state?.payment_plan_preference} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, payment_plan_preference: v})} disabled={true} />
                          <DiffLabel label="Email Address" type="email" value={workspaceEditData.metadata.email} previousValue={selectedProfile.previous_state?.metadata?.email} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, email: v}})} />
                          <DiffLabel label="Phone Number" value={workspaceEditData.metadata.phone} previousValue={selectedProfile.previous_state?.metadata?.phone} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, phone: v}})} />
                          <DiffLabel label="TC Version Accepted" value={workspaceEditData.metadata.tc_accepted_version} previousValue={selectedProfile.previous_state?.metadata?.tc_accepted_version} disabled={true} />
                      </div>
                  </div>
                  </>
                )}

                {/* --- STUDENT DETAILS --- */}
                {selectedProfile.role === 'student' && workspaceEditData && (
                   <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl space-y-8">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                           <User className="text-blue-500" size={20} />
                           <h3 className="text-xl font-black uppercase tracking-widest text-white">Pioneer Individual Details</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            <div className="md:col-span-2">
                               <DiffLabel label="Pioneer Full Name" value={workspaceEditData.display_name} previousValue={selectedProfile.previous_state?.display_name} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, display_name: v})} />
                            </div>
                            <DiffLabel label="Profile Username" value={workspaceEditData.metadata.username} previousValue={selectedProfile.previous_state?.metadata?.username} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, username: v}})} />
                            <DiffLabel label="Date of Birth" type="date" value={workspaceEditData.metadata.date_of_birth} previousValue={selectedProfile.previous_state?.metadata?.date_of_birth} onChange={(v: string) => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, date_of_birth: v}})} />
                        </div>
                   </div>
                )}

              </div>

              {/* RIGHT COLUMN: Stacked control cards */}
              <div className="lg:col-span-1 space-y-8">
                
                {/* Onboarding invite transmisión button for leads */}
                {selectedProfile.role === 'guardian' && !selectedProfile.metadata?.household_lead_id && workspaceEditData && (
                  <button onClick={() => setShowEmailPreview(true)} disabled={!workspaceEditData.metadata.email} className="w-full p-6 bg-blue-600/10 border border-blue-500/20 rounded-[32px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex flex-col items-center justify-center gap-3 shadow-xl shadow-blue-900/10">
                    <Mail size={24}/> Transmit Onboarding Invite
                  </button>
                )}

                {/* System Access Card */}
                <div className="bg-white/[0.02] border border-white/5 p-8 md:p-10 rounded-[40px] shadow-2xl space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 border-b border-white/5 pb-5"><PowerOff size={18}/> System Access</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Account Status</label>
                      <select value={workspaceEditData?.status || ''} onChange={e => setWorkspaceEditData({...workspaceEditData, status: e.target.value, inactive_since: e.target.value === 'active' ? null : workspaceEditData.inactive_since})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-purple-500 shadow-inner appearance-none">
                        <option value="active">Active Sector</option>
                        <option value="inactive">Inactive Break</option>
                      </select>
                    </div>
                    {workspaceEditData?.status === 'inactive' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-2">Inactive Since</label>
                        <input type="date" value={workspaceEditData.inactive_since || ''} onChange={e => setWorkspaceEditData({...workspaceEditData, inactive_since: e.target.value})} className="w-full bg-[#020617] border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm outline-none focus:border-red-500 shadow-inner [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Access PIN Card */}
                {selectedProfile.role === 'student' && selectedProfile.status !== 'inactive' && (
                  <div className="bg-teal-500/5 border border-teal-500/20 p-8 md:p-10 rounded-[40px] shadow-2xl space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-teal-400 flex items-center gap-2 border-b border-teal-500/20 pb-5"><Key size={18}/> Access PIN</h3>
                    {selectedProfile.temp_entry_pin ? (
                      <div className="text-center bg-[#020617] p-6 rounded-2xl border border-teal-500/20 shadow-inner">
                        <span className="text-6xl font-black text-white italic tracking-widest">{selectedProfile.temp_entry_pin}</span>
                        <button onClick={() => navigator.clipboard.writeText(selectedProfile.temp_entry_pin)} className="block mx-auto mt-4 text-[10px] text-teal-400 font-bold uppercase tracking-widest hover:text-white transition-colors"><Copy size={12} className="inline mr-1"/> Copy to Clipboard</button>
                        <button onClick={handleGenerateDraftPin} className="mt-4 text-[9px] font-black text-slate-500 uppercase tracking-widest block mx-auto pt-4 border-t border-white/5 hover:text-red-400 transition-colors">Overwrite with new PIN</button>
                      </div>
                    ) : draftPin ? (
                      <div className="space-y-4">
                        <div className="text-center py-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl shadow-inner"><span className="text-5xl font-black text-white italic tracking-widest">{draftPin}</span></div>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => setDraftPin(null)} className="py-4 bg-[#020617] rounded-xl text-[10px] font-black uppercase hover:bg-red-500/10 hover:text-red-400 transition-colors border border-white/5">Cancel</button>
                          <button onClick={handleSavePinToDB} className="py-4 bg-teal-600 rounded-xl text-[10px] font-black uppercase text-white shadow-lg hover:bg-teal-500 transition-colors">Confirm & Save</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={handleGenerateDraftPin} className="w-full p-5 bg-teal-600/10 rounded-2xl text-[10px] font-black uppercase text-teal-400 border border-teal-500/20 hover:bg-teal-600 hover:text-white transition-all">Generate Access PIN</button>
                    )}
                  </div>
                )}

                {/* Household Overview Card with pioneers */}
                {selectedProfileLeadGuardian && (
                  <div className="bg-white/[0.02] border border-white/5 p-8 md:p-10 rounded-[40px] shadow-2xl space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2 border-b border-white/5 pb-5"><ListTree size={18}/> Household Overview</h3>
                    
                    {childrenMap[selectedProfileLeadGuardian.id]?.length > 0 ? (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Linked Pioneers</label>
                        {childrenMap[selectedProfileLeadGuardian.id].map((kid: any) => (
                          <div key={kid.id} className="bg-[#020617] border border-white/5 rounded-xl p-4 flex justify-between items-center shadow-inner">
                            <span className="font-bold text-sm text-white">{kid.display_name}</span>
                            {kid.requires_review && <AlertCircle size={14} className="text-yellow-500" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic px-2">No Pioneers linked to this Guardian/Household.</p>
                    )}
                  </div>
                )}

                {/* Operational Notes Card */}
                <div className="bg-white/[0.02] border border-white/5 p-8 md:p-10 rounded-[40px] shadow-2xl space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-2"><BookOpen size={14}/> Operational Notes</label>
                  <textarea value={workspaceEditData?.metadata?.admin_notes || ''} onChange={e => setWorkspaceEditData({...workspaceEditData, metadata: {...workspaceEditData.metadata, admin_notes: e.target.value}})} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-5 text-sm font-bold text-slate-300 min-h-[160px] outline-none focus:border-purple-500 shadow-inner" placeholder="Internal private notes..." />
                </div>

              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* --- EMAIL PREVIEW MODAL --- */}
      <AnimatePresence>
        {showEmailPreview && workspaceEditData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEmailPreview(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative w-full max-w-3xl bg-[#0f172a] shadow-2xl flex flex-col p-8 rounded-[40px] border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-6 border-b border-white/5 shrink-0 mb-6">
                <div>
                  <h2 className="text-3xl font-black uppercase italic text-blue-400">Draft Transmission</h2>
                  <p className="text-sm text-slate-500 mt-1">Recipient: <span className="text-white font-bold">{workspaceEditData.display_name}</span> &lt;{workspaceEditData.metadata.email}&gt;</p>
                </div>
                <button onClick={() => setShowEmailPreview(false)} className="p-3 rounded-full bg-white/5 hover:bg-white/10 shrink-0 border border-white/10"><X size={20}/></button>
              </div>

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
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Master Communication Draft</label>
                      <span className="text-[9px] text-fuchsia-500 bg-fuchsia-500/10 px-2 py-1 rounded-md font-bold uppercase tracking-widest">Loaded from Master Protocol</span>
                    </div>
                    <textarea 
                      value={emailContent} 
                      onChange={e => setEmailContent(e.target.value)} 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-2xl p-5 text-sm font-medium text-slate-300 min-h-[400px] outline-none focus:border-blue-500 transition-colors leading-relaxed shadow-inner" 
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