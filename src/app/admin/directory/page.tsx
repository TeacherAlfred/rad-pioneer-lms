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
  
  // Browsing States
  const [browseQueue, setBrowseQueue] = useState<any[]>([]);
  const [browseIndex, setBrowseIndex] = useState(-1);
  const [isBrowseMode, setIsBrowseMode] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewIndex, setReviewIndex] = useState(-1);

  // Email States
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<"edit" | "visual">("edit");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [emailTemplateData, setEmailTemplateData] = useState<any>(null);
  const [emailContent, setEmailContent] = useState(""); 

  // Workspace Edit Data State
  const [workspaceEditData, setWorkspaceEditData] = useState<any>(null);

  // Maps
  const [guardianMap, setGuardianMap] = useState<Record<string, any>>({});
  const [childrenMap, setChildrenMap] = useState<Record<string, any[]>>({});

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
          setEmailViewMode("edit");
          if (emailTemplateData) setEmailContent(emailTemplateData.body_content);

          const isGuardian = selectedProfile.role === 'guardian';
          const isSupportCrew = isGuardian && !!selectedProfile.metadata?.household_lead_id;

          let leadGuardianData = null;
          let existingCrew: any[] = [];

          if (isSupportCrew) {
             leadGuardianData = profiles.find(p => p.id === selectedProfile.metadata.household_lead_id);
             setSelectedProfileLeadGuardian(leadGuardianData);
          } else if (selectedProfile.role === 'student' && selectedProfile.linked_parent_id) {
             leadGuardianData = profiles.find(p => p.id === selectedProfile.linked_parent_id);
             setSelectedProfileLeadGuardian(leadGuardianData);
          } else if (isGuardian && !isSupportCrew) {
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
          }

          const meta = selectedProfile.metadata;
          const previousMeta = selectedProfile.previous_state?.metadata || {};

          setWorkspaceEditData({
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
              tc_accepted_version: meta?.tc_accepted_version || ""
            },
            supportCrew: existingCrew
          });
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
      const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('status', ['active', 'inactive'])
          .order('created_at', { ascending: false });
          
      if (error) throw error;

      const parsedProfiles = (data || []).map(p => ({
        ...p,
        metadata: safeParse(p.metadata),
        previous_state: safeParse(p.previous_state)
      }));

      const { data: tplData } = await supabase.from('email_templates').select('*').eq('slug', 'onboarding_invite').maybeSingle();
      if (tplData) {
        setEmailTemplateData(tplData);
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

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.metadata?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesRole = roleFilter === "all" || (roleFilter === "guardian" && p.role === "guardian") || (roleFilter === "student" && p.role === "student") || (roleFilter === "review" && p.requires_review === true);
    const matchesStatus = p.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
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
      handleCloseWorkspace();
    }
  };

  const handleUpdateProfile = async (autoAdvance = false) => {
    if (!selectedProfile || !workspaceEditData) return;
    setIsProcessing(true);
    try {
      const payload: any = {
          display_name: workspaceEditData.display_name,
          status: workspaceEditData.status,
          inactive_since: workspaceEditData.status === 'inactive' ? workspaceEditData.inactive_since : null,
          payment_plan_preference: workspaceEditData.payment_plan_preference,
          metadata: workspaceEditData.metadata
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', selectedProfile.id);
      if (error) throw error;

      if (selectedProfile.role === 'guardian' && !selectedProfile.metadata?.household_lead_id) {
         for (const member of workspaceEditData.supportCrew) {
            const memberPayload = {
               role: 'guardian',
               display_name: member.name,
               status: workspaceEditData.status,
               metadata: { ...member, household_lead_id: selectedProfile.id }
            };
            if (member.id) await supabase.from('profiles').update(memberPayload).eq('id', member.id);
            else await supabase.from('profiles').insert(memberPayload);
         }
      }
      await fetchDirectory();
      if (!isReviewMode) alert("Updated successfully.");
      if (autoAdvance && isReviewMode) nextReviewProfile();
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
      const { error } = await supabase.from('profiles').update({
          ...workspaceEditData,
          requires_review: false,
          previous_state: {},
          inactive_since: workspaceEditData.status === 'inactive' ? workspaceEditData.inactive_since : null
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

  const handleSavePinToDB = async () => {
    if (!draftPin || !selectedProfile) return;
    setIsProcessing(true);
    try {
      await supabase.from('profiles').update({ temp_entry_pin: draftPin, auth_attempts: 0, is_locked: false }).eq('id', selectedProfile.id);
      await fetchDirectory();
      setDraftPin(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateLivePreviewHTML = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const onboardingLink = `${baseUrl}/onboarding/guardian?id=${selectedProfile?.id || ''}`;
    let parsedContent = emailContent ? emailContent.replace(/{{onboardingLink}}/g, onboardingLink) : "";
    return `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; text-align: left;">
        <h2 style="color: #a855f7; text-transform: uppercase; font-style: italic; letter-spacing: 1px; margin-bottom: 24px; font-size: 24px;">${emailTemplateData?.subject || 'Welcome to RAD'}</h2>
        <p style="font-size: 16px; color: #e2e8f0;">Hi ${workspaceEditData?.display_name},</p>
        <div style="font-size: 15px; color: #e2e8f0; line-height: 1.6;">${parsedContent}</div>
        <div style="text-align: center; margin: 30px 0;"><a href="${onboardingLink}" style="background-color: #9333ea; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Activate Account</a></div>
      </div>
    `;
  };

  const handleSendInvite = async () => {
    setIsSendingInvite(true);
    try {
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: workspaceEditData.metadata.email, guardianName: workspaceEditData.display_name, guardianId: selectedProfile.id, customContent: emailContent })
      });
      if ((await res.json()).success) { alert("Invite Sent!"); setShowEmailPreview(false); }
    } catch (err) { alert("Failed to send."); } finally { setIsSendingInvite(false); }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <AnimatePresence mode="wait">
        {!selectedProfile ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="table" className="space-y-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
              <div className="space-y-4">
                <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl transition-all w-fit">
                  <ArrowLeft size={16} className="text-slate-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Command Center</span>
                </Link>
                <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Master_<span className="text-purple-500">Directory</span></h1>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRoleFilter('student')} className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl text-center min-w-[120px]">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Pioneers</p>
                  <p className="text-2xl font-black italic">{profiles.filter(p => p.role === 'student' && p.status === 'active').length}</p>
                </button>
                <button onClick={() => setRoleFilter('guardian')} className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl text-center min-w-[120px]">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Guardians</p>
                  <p className="text-2xl font-black italic">{profiles.filter(p => p.role === 'guardian' && p.status === 'active').length}</p>
                </button>
              </div>
            </header>

            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white/[0.02] p-4 rounded-3xl border border-white/5">
              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                {(["all", "guardian", "student", "review"] as const).map(role => (
                  <button key={role} onClick={() => setRoleFilter(role)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${roleFilter === role ? "bg-purple-600" : "text-slate-500"}`}>{role}</button>
                ))}
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-purple-500" />
                </div>
                <button onClick={startRapidReview} className="px-5 py-3 bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Review Queue ({profiles.filter(p => p.requires_review).length})</button>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr><th className="px-8 py-5">Entity</th><th className="px-8 py-5">Role / Status</th><th className="px-8 py-5">Contact</th><th className="px-8 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProfiles.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-8 py-6 font-black uppercase italic text-lg">{p.display_name}</td>
                      <td className="px-8 py-6 uppercase text-[10px] font-bold text-slate-400">{p.role} | {p.status}</td>
                      <td className="px-8 py-6 text-xs text-slate-400 font-bold">{p.metadata?.email}</td>
                      <td className="px-8 py-6 text-right"><button onClick={() => handleInspectProfile(p)} className="bg-white/5 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-white/10">Inspect</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key="workspace" className="space-y-8 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/5 pb-8">
              <div className="space-y-4">
                <button onClick={handleCloseWorkspace} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-purple-400"><ArrowLeft size={16}/> Back</button>
                <h2 className="text-4xl font-black uppercase italic">{workspaceEditData?.display_name}</h2>
              </div>
              <div className="flex gap-4">
                {selectedProfile.requires_review ? (
                  <button onClick={handleAcceptReview} className="bg-yellow-500 text-black px-8 py-4 rounded-2xl font-black uppercase italic">Approve Changes</button>
                ) : (
                  <button onClick={() => handleUpdateProfile()} className="bg-purple-600 px-8 py-4 rounded-2xl font-black uppercase italic">Save Changes</button>
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
              </div>
              <div className="space-y-8">
                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[40px]">
                  <h3 className="text-sm font-black uppercase mb-6 text-white">System Protocol</h3>
                  <select value={workspaceEditData?.status} onChange={e => setWorkspaceEditData({...workspaceEditData, status: e.target.value})} className="w-full bg-[#020617] border border-white/10 p-4 rounded-xl font-bold uppercase text-xs">
                    <option value="active">Active Sector</option>
                    <option value="inactive">Inactive Hold</option>
                  </select>
                </div>
                {selectedProfile.role === 'student' && (
                  <div className="bg-teal-500/5 border border-teal-500/20 p-10 rounded-[40px] text-center">
                    <h3 className="text-teal-400 font-black uppercase text-xs mb-4">Access PIN</h3>
                    <p className="text-5xl font-black italic">{selectedProfile.temp_entry_pin || '----'}</p>
                    <button onClick={() => setDraftPin(Math.floor(1000 + Math.random() * 9000).toString())} className="mt-4 text-[10px] font-black uppercase text-slate-500">Regenerate</button>
                  </div>
                )}
                <div className="bg-red-500/5 border border-red-500/20 p-10 rounded-[40px]">
                  <button onClick={handleDeleteProfile} className="w-full py-4 bg-red-600/10 text-red-500 rounded-xl font-black uppercase text-xs">Delete Record</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}