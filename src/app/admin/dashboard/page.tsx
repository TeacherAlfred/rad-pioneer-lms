"use client";

import { useEffect, useState } from "react";
import { 
  Users, UserPlus, BookOpen, Activity, AlertCircle, 
  CheckCircle2, CreditCard, ChevronRight, Loader2, 
  Search, Filter, MoreHorizontal, ExternalLink, ShieldAlert,
  ArrowRight, X, Mail, Phone, Calendar, Info, MessageSquare, Save, User, LayoutGrid, ListTree, Link as LinkIcon, Key, Copy, RotateCcw, Send, Clock, ChevronDown, PenTool, Eye, Target, Database
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- GLOBAL FORMATTER FOR PROGRAM NAMES ---
const formatProgramName = (rawName: string) => {
  if (!rawName) return "";
  const lower = rawName.toLowerCase();
  const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  if (lower.includes('(online)')) return `OL: ${cleanName}`;
  if (lower.includes('in-person') || lower.includes('(plk)')) return `IP: ${cleanName}`;
  return rawName;
};

// --- HELPER TO CALCULATE REQUEST AGE ---
const getRequestAge = (dateString: string) => {
  const createdDate = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - createdDate.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  
  // Transition State for newly approved profiles
  const [postApprovalProfile, setPostApprovalProfile] = useState<any>(null);

  // --- NEW: Admin Profile State ---
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ name: "", email: "", phone: "" });

  // Email Preview State
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<"edit" | "visual">("edit");
  const [emailContent, setEmailContent] = useState({
    intro: "We are thrilled to invite you to the brand-new RAD Pioneer Learning Management System (LMS)! Our objective with this custom-built platform is to create a seamless, highly engaging digital hub for all our coding and robotics bootcamps.",
    pioneerHeading: "🎮 What Your Pioneer Gets",
    pioneerText: "Your child will have their own dedicated Command Center. Here, they can access interactive course materials, track their project progress, and fully immerse themselves in the world of tech and game creation.",
    parentHeading: "👨‍👩‍👧 What You Can Expect",
    parentText: "Over time, this portal will become your primary tool for managing your household's RAD experience. You'll be able to easily view term schedules, manage payment plans, securely update your contact details, and see the incredible skills your Pioneer is building week by week."
  });
  
  // PIN states (Strictly for PROFILES)
  const [draftPin, setDraftPin] = useState<string | null>(null);
  const [confirmedPin, setConfirmedPin] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"pioneer" | "guardian">("pioneer");
  const [searchQuery, setSearchQuery] = useState("");
  const [dynamicTabs, setDynamicTabs] = useState<{id: string, label: string}[]>([{ id: "all", label: "All Programs" }]);

  const [stats, setStats] = useState({
    totalStudents: 0,
    orphans: 0,
    pendingRequests: 0,
    liveCourses: 0,
    monthlyRevenue: 0,
    activeProspects: 0,
    wonProspects: 0,
    // Add these two lines to satisfy TypeScript
    plannedFeatures: 0,
    plannedCourses: 0
  });

  const [requests, setRequests] = useState<any[]>([]);
  const [orphansList, setOrphansList] = useState<any[]>([]);

  // ADDED COMMUNICATIONS HUB & MASTER CONTACTS TO QUICK LINKS
  const quickLinks = [
    { title: "Manage Courses", path: "/admin/courses", icon: BookOpen, active: true },
    { title: "Growth Blueprint", path: "/admin/blueprint", icon: ListTree, active: true }, 
    { title: "Leads Database", path: "/admin/leads", icon: Users, active: true },
    { title: "Prospects CRM", path: "/admin/prospects", icon: Target, active: true },
    { title: "Manual Intake", path: "/admin/intake", icon: UserPlus, active: true },
    { title: "RAD Community CRM", path: "/admin/directory", icon: Users, active: true },
    { title: "Master Contacts", path: "/admin/contacts", icon: Database, active: true }, // <-- ADDED
    { title: "Comms Hub", path: "/admin/communications", icon: Mail, active: true },
    { title: "Finance Portal", path: "/admin/finance", icon: CreditCard, active: true }
  ];

  useEffect(() => {
    fetchAdminData();

    // Listen to changes across all relevant tables for the dashboard
    const dashboardSubscription = supabase
      .channel('dashboard-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' }, // Leaving 'table' blank listens to the whole schema!
        (payload) => {
          fetchAdminData(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dashboardSubscription);
    };
  }, []);

  async function fetchAdminData() {
    setLoading(true);
    try {
      // --- FETCH LOGGED-IN ADMIN PROFILE ---
      const { data: authData } = await supabase.auth.getUser();
      
      if (authData?.user) {
        let { data: adminProf } = await supabase.from('profiles').select('*').eq('auth_user_id', authData.user.id).maybeSingle();
        
        if (!adminProf) {
           const { data: fallbackProf } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
           adminProf = fallbackProf;
        }
        
        // FIX: If no profile exists in the DB yet, create a placeholder so the UI still opens!
        if (!adminProf) {
          adminProf = {
            id: authData.user.id, // Use auth ID as profile ID for admins
            auth_user_id: authData.user.id,
            display_name: "System Admin",
            role: "admin",
            metadata: { email: authData.user.email || "" }
          };
        }
        
        setAdminProfile(adminProf);
        setAdminEditForm({
          name: adminProf.display_name || "",
          email: adminProf.metadata?.email || authData.user.email || "",
          phone: adminProf.metadata?.phone || ""
        });
      }

      const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const { count: requestCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'new');
      const { data: courses } = await supabase.from('courses').select('is_published');
      const { data: payments } = await supabase.from('payments').select('amount').eq('status', 'paid');
      const totalRevenue = payments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      const { data: prospectsData } = await supabase.from('prospects').select('status');
      const activeProspects = prospectsData?.filter(p => !['Lost', 'Converted (Won)'].includes(p.status)).length || 0;
      const wonProspects = prospectsData?.filter(p => p.status === 'Converted (Won)').length || 0;

      const { count: featureCount } = await supabase.from('roadmap_features').select('*', { count: 'exact', head: true }).eq('status', 'planned');
      const { count: plannedCourseCount } = await supabase.from('roadmap_courses').select('*', { count: 'exact', head: true }).eq('status', 'ideation');
      
      const { data: regData } = await supabase.from('registrations')
        .select('*')
        .in('status', ['new', 'in_progress', 'waitlist'])
        .order('created_at', { ascending: false });
        
      const { data: orphans } = await supabase.from('profiles').select('*').is('linked_parent_id', null).eq('role', 'student');

      if (regData) {
        const allPrograms = regData.flatMap(lead => lead.interested_programs || []);
        const formattedPrograms = allPrograms.map(prog => formatProgramName(prog as string));
        const uniquePrograms = Array.from(new Set(formattedPrograms)).filter(Boolean);
        setDynamicTabs([{ id: "all", label: "All Programs" }, ...uniquePrograms.map(prog => ({ id: prog, label: prog }))]);
      }

      setStats({
        totalStudents: studentCount || 0,
        orphans: orphans?.length || 0,
        pendingRequests: requestCount || 0,
        liveCourses: courses?.filter(c => c.is_published).length || 0,
        monthlyRevenue: totalRevenue,
        activeProspects: activeProspects || 0,
        wonProspects: wonProspects || 0,
        // Assign the new counts here
        plannedFeatures: featureCount || 0,
        plannedCourses: plannedCourseCount || 0
      });

      setRequests(regData || []);
      setOrphansList(orphans || []);
    } catch (err) {
      console.error("DASHBOARD_FETCH_ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- HANDLE ADMIN PROFILE UPDATE ---
  const handleUpdateAdminProfile = async () => {
    if (!adminProfile) return;
    setIsProcessing(true);
    try {
      // FIX: Use UPSERT instead of UPDATE. If the row doesn't exist yet, it creates it.
      const { error } = await supabase.from('profiles').upsert({
        id: adminProfile.id,
        auth_user_id: adminProfile.auth_user_id,
        role: adminProfile.role || 'admin',
        display_name: adminEditForm.name,
        status: 'active',
        metadata: {
          ...adminProfile.metadata,
          email: adminEditForm.email,
          phone: adminEditForm.phone
        }
      });

      if (error) throw error;
      
      alert("Admin profile successfully updated!");
      setAdminProfile({
        ...adminProfile, 
        display_name: adminEditForm.name, 
        metadata: { ...adminProfile.metadata, email: adminEditForm.email, phone: adminEditForm.phone }
      });
      setShowAdminProfile(false);
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- HTML GENERATOR FOR LIVE PREVIEW ---
  const generateLivePreviewHTML = () => {
    const onboardingLink = `#`;
    const whatsappLink = `#`;
    
    return `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; text-align: left;">
        <h2 style="color: #a855f7; text-transform: uppercase; font-style: italic; letter-spacing: 1px; margin-bottom: 24px; font-size: 24px;">
          Welcome to the New RAD Portal
        </h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #e2e8f0;">
          Hi ${postApprovalProfile?.display_name || 'Guardian'},
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

  // --- MANUAL REGISTRATION STATUS UPDATER ---
  const handleChangeRegistrationStatus = async (newStatus: string) => {
    setIsProcessing(true);
    try {
      if (selectedLead.isHousehold) {
        const childIds = selectedLead.children.map((c: any) => c.id);
        
        const { data, error } = await supabase.from('registrations')
          .update({ status: newStatus })
          .in('id', childIds)
          .select();
          
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Database blocked the update (0 rows modified). Check your RLS UPDATE policies for the registrations table.");

        const updatedChildren = selectedLead.children.map((c: any) => ({...c, status: newStatus}));
        setSelectedLead({ ...selectedLead, children: updatedChildren, status: newStatus });
      } else {
        const { data, error } = await supabase.from('registrations')
          .update({ status: newStatus })
          .eq('id', selectedLead.id)
          .select();
          
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Database blocked the update (0 rows modified). Check your RLS UPDATE policies for the registrations table.");

        setSelectedLead({ ...selectedLead, status: newStatus });
      }
      
      alert(`Registration status formally updated to: ${newStatus}`);
      await fetchAdminData();
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- REGISTRATION -> PROFILE CONVERSION ---
  const handleApproveAndConvert = async (target: any) => {
    setIsProcessing(true);
    const now = new Date().toISOString();

    try {
      const notes = (document.getElementById('admin_notes') as HTMLTextAreaElement)?.value || "";
      let newLeadGuardian = null;
      let newPioneers = [];

      const guardianPayload = {
        role: 'guardian',
        display_name: target.parent_name || 'Individual',
        status: 'active',
        created_at: now,
        updated_at: now,
        metadata: {
          email: target.email || '',
          phone: target.phone || '',
          relationship: 'Guardian',
          is_primary_contact: true,
          admin_notes: notes,
          onboarding_status: 'pending',
          account_tier: target.interested_programs?.some((p: string) => p.includes('Demo')) ? 'demo' : 'full',
          funnel_stage: "Contacted / In Review", 
          funnel_stage_updated_at: now
        }
      };

      const { data: guardianData, error: guardErr } = await supabase
        .from('profiles')
        .insert(guardianPayload)
        .select()
        .single();
        
      if (guardErr) {
        console.error("GUARDIAN_INSERT_ERROR:", guardErr);
        throw new Error(`Guardian creation failed: ${guardErr.message}`);
      }
      newLeadGuardian = guardianData;

      if (target.isHousehold) {
        const profilesToInsert = target.children.map((c: any) => ({
          display_name: c.student_name,
          role: 'student',
          linked_parent_id: newLeadGuardian.id,
          status: 'active',
          temp_entry_pin: Math.floor(1000 + Math.random() * 9000).toString(),
          date_of_birth: null, 
          student_identifier: null, 
          created_at: now,
          updated_at: now,
          metadata: { 
            age: c.student_age,
            selected_program: c.interested_programs?.[0] || ""
          }
        }));
        
        const { data: pData, error: pErr } = await supabase.from('profiles').insert(profilesToInsert).select();
        if (pErr) throw pErr;
        newPioneers = pData;

        const childIds = target.children.map((c: any) => c.id);
        const { error: regErr } = await supabase.from('registrations').update({ 
            status: 'approved', 
            admin_notes: notes, 
            parent_approved_at: now,
            metadata: { ...target.metadata, funnel_stage: "Contacted / In Review", funnel_stage_updated_at: now } 
        }).in('id', childIds);
        
        if (regErr) throw regErr;

      } else {
        const { data: pData, error: pErr } = await supabase.from('profiles').insert({
          display_name: target.student_name,
          role: 'student',
          linked_parent_id: newLeadGuardian.id,
          status: 'active',
          temp_entry_pin: Math.floor(1000 + Math.random() * 9000).toString(),
          date_of_birth: null, 
          student_identifier: null, 
          created_at: now,
          updated_at: now,
          metadata: { 
            age: target.student_age,
            selected_program: target.interested_programs?.[0] || ""
          }
        }).select().single();
        
        if (pErr) throw pErr;
        newPioneers = [pData];

        const { error: regErr } = await supabase.from('registrations').update({ 
            status: 'approved', 
            admin_notes: notes, 
            parent_approved_at: now,
            metadata: { ...target.metadata, funnel_stage: "Contacted / In Review", funnel_stage_updated_at: now } 
        }).eq('id', target.id);
        
        if (regErr) throw regErr;
      }

      await fetchAdminData();
      setPostApprovalProfile(newLeadGuardian);
      
    } catch (err: any) {
      alert("Approval & Conversion failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- AUTOMATED EMAIL DISPATCH ---
  const handleSendInvite = async () => {
    if (!postApprovalProfile || !postApprovalProfile?.metadata?.email) {
      alert("No email address found for this guardian.");
      return;
    }
    
    setIsSendingInvite(true);
    try {
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: postApprovalProfile.metadata.email,
          guardianName: postApprovalProfile.display_name,
          guardianId: postApprovalProfile.id,
          customContent: emailContent
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert("Onboarding invite transmitted successfully!");
        setShowEmailPreview(false);
        setSelectedLead(null);
        setPostApprovalProfile(null);
      } else {
        throw new Error(data.error || "Failed to send API Request");
      }
    } catch (err: any) {
      alert("Transmission failed: " + err.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  // --- STRICTLY PROFILES: PIN LOGIC ---
  const handleGenerateDraftPin = () => {
    setDraftPin(Math.floor(1000 + Math.random() * 9000).toString());
    setConfirmedPin(null);
  };

  const handleSavePinToDB = async () => {
    if (!draftPin || !selectedLead) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          temp_entry_pin: draftPin,
          auth_attempts: 0,
          is_locked: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedLead.id);

      if (error) throw error;
      setConfirmedPin(draftPin);
      setDraftPin(null);
    } catch (err) {
      alert("Database error saving PIN.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateNotes = async () => {
    if (!selectedLead) return;
    setIsProcessing(true);
    const now = new Date().toISOString();

    try {
      const notes = (document.getElementById('admin_notes') as HTMLTextAreaElement).value;
      if (selectedLead.role === 'student') {
         await supabase.from('profiles').update({ admin_notes: notes, updated_at: now }).eq('id', selectedLead.id);
      } else if (selectedLead.isHousehold) {
         const childIds = selectedLead.children.map((c: any) => c.id);
         await supabase.from('registrations').update({ admin_notes: notes }).in('id', childIds);
      } else {
         await supabase.from('registrations').update({ admin_notes: notes }).eq('id', selectedLead.id);
      }
      
      alert("Draft notes saved.");
      await fetchAdminData();
    } catch (err) {
      alert("Update failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- FILTERING (Registrations Only) ---
  const filteredRequests = requests.filter(req => {
    const name = req.student_name || "";
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || (req.email && req.email.toLowerCase().includes(searchQuery.toLowerCase()));
    if (activeTab !== "all") {
      return matchesSearch && req.interested_programs?.some((p: string) => formatProgramName(p) === activeTab);
    }
    return matchesSearch;
  });

  const groupedByGuardian = filteredRequests.reduce((acc: any, req) => {
    const key = req.email || 'unlinked';
    if (!acc[key]) {
      acc[key] = { isHousehold: true, parent_name: req.parent_name || 'Individual', email: req.email, phone: req.phone, children: [], admin_notes: req.admin_notes, created_at: req.created_at };
    }
    acc[key].children.push(req);
    if (new Date(req.created_at) < new Date(acc[key].created_at)) {
        acc[key].created_at = req.created_at;
    }
    return acc;
  }, {});
  
  const guardianList = Object.values(groupedByGuardian);

  if (loading) return (
    <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Accessing_RAD_Sectors...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans relative overflow-hidden text-left">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-500">
              <ShieldAlert size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure_Admin_Shell</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
              Control_<span className="text-blue-500">Center</span>
            </h1>
          </div>
          
          {/* HIGH PRIORITY QUICK ACTIONS - ADDED "MY PROFILE" BUTTON */}
          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4 shrink-0">
            <button 
              onClick={() => setShowAdminProfile(true)} 
              className="w-full sm:w-auto px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl border border-white/10 transition-all"
            >
              <User size={16}/> My Profile
            </button>
            <Link 
              href="/admin/directory" 
              className="w-full sm:w-auto px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20 transition-all"
            >
              <Users size={16}/> RAD Community CRM
            </Link>
            <Link 
              href="/admin/prospects" 
              className="w-full sm:w-auto px-6 py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl shadow-fuchsia-900/20 transition-all"
            >
              <Target size={16}/> Open Prospects CRM
            </Link>
          </div>
        </header>

        {/* --- STATS DASHBOARDS --- */}
        <div className="space-y-8">
          {/* PIPELINE & INTAKE */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Target size={14}/> Pipeline & Intake</h3>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Registration Requests", value: stats.pendingRequests, icon: UserPlus, color: "text-yellow-500" },
                { label: "Active Prospects", value: stats.activeProspects, icon: Target, color: "text-fuchsia-400" },
                { label: "Won Prospects", value: stats.wonProspects, icon: CheckCircle2, color: "text-green-400" },
              ].map((card, i) => (
                <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-[32px] relative overflow-hidden group">
                  <card.icon className={`absolute -right-4 -bottom-4 size-24 opacity-5 ${card.color}`} />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{card.label}</p>
                  <h4 className={`text-4xl font-black italic mt-2 ${card.color}`}>{card.value}</h4>
                </div>
              ))}
            </section>
          </div>

          {/* ACADEMY OVERVIEW */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Activity size={14}/> Academy Overview</h3>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Active Pioneers", value: stats.totalStudents, icon: Users, color: "text-blue-400" },
                { label: "Total Revenue", value: `R${stats.monthlyRevenue}`, icon: CreditCard, color: "text-emerald-400" },
                { label: "Live Courses", value: stats.liveCourses, icon: BookOpen, color: "text-purple-400" },
              ].map((card, i) => (
                <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-[32px] relative overflow-hidden group">
                  <card.icon className={`absolute -right-4 -bottom-4 size-24 opacity-5 ${card.color}`} />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{card.label}</p>
                  <h4 className={`text-4xl font-black italic mt-2 ${card.color}`}>{card.value}</h4>
                </div>
              ))}
            </section>
          </div>

          {/* GROWTH & BACKLOG */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><ListTree size={14}/> Strategy Backlog</h3>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] group">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Planned Features</p>
                <h4 className="text-4xl font-black italic mt-2 text-fuchsia-400">{stats.plannedFeatures}</h4>
              </div>
              <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] group">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Course Pipeline</p>
                <h4 className="text-4xl font-black italic mt-2 text-emerald-400">{stats.plannedCourses}</h4>
              </div>
            </section>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 space-y-6">
            
            {/* --- LIST CONTROLS --- */}
            <div className="flex flex-col space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Activity size={14} /> Intake_Registrations
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                  <div className="relative group w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input type="text" placeholder="Search entries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-2xl py-2.5 pl-11 text-xs outline-none focus:border-blue-500 transition-all" />
                  </div>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                    <button onClick={() => setViewMode("pioneer")} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === "pioneer" ? "bg-blue-600 text-white" : "text-slate-500"}`}>Pioneer View</button>
                    <button onClick={() => setViewMode("guardian")} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === "guardian" ? "bg-purple-600 text-white" : "text-slate-500"}`}>Guardian View</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-inner">
                {dynamicTabs.map((tab) => {
                  let colorClass = "bg-white/5 text-slate-400 hover:text-white";
                  
                  if (activeTab === tab.id) {
                    if (tab.id.startsWith("OL:")) colorClass = "bg-blue-600 text-white shadow-lg border border-blue-500/50";
                    else if (tab.id.startsWith("IP:")) colorClass = "bg-purple-600 text-white shadow-lg border border-purple-500/50";
                    else colorClass = "bg-slate-700 text-white shadow-lg";
                  } else {
                    if (tab.id.startsWith("OL:")) colorClass = "bg-blue-900/20 text-blue-400 hover:bg-blue-800/40 hover:text-blue-300 border border-blue-900/30";
                    else if (tab.id.startsWith("IP:")) colorClass = "bg-purple-900/20 text-purple-400 hover:bg-purple-800/40 hover:text-purple-300 border border-purple-900/30";
                  }

                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${colorClass}`}>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative min-h-[400px]">
              {viewMode === "pioneer" ? (
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-8 py-5">Pioneer Name</th>
                      <th className="px-8 py-5">Guardian</th>
                      <th className="px-8 py-5">Program(s)</th>
                      <th className="px-8 py-5">Received</th>
                      <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRequests.map((req) => {
                      const requestAgeText = getRequestAge(req.created_at);
                      const isOldRequest = requestAgeText.includes('d') || (requestAgeText.includes('h') && parseInt(requestAgeText) > 23);
                      
                      return (
                        <tr key={req.id} className="hover:bg-white/[0.03] transition-colors group">
                          <td className="px-8 py-6 align-top">
                            <p className="font-black text-white italic uppercase text-lg">{req.student_name}</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Age: {req.student_age}</p>
                          </td>
                          <td className="px-8 py-6 align-top">
                            <p className="text-sm font-bold text-slate-300 uppercase">{req.parent_name}</p>
                            <div className="flex flex-col gap-1 mt-1 text-[10px] text-slate-500">
                              <span>{req.phone || "No phone"}</span>
                              <span>{req.email || "No email"}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 align-top">
                            <div className="flex flex-col gap-1 mt-1">
                              {(req.interested_programs || []).map((p: string, i: number) => (
                                <span key={i} className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md w-fit border border-blue-500/20">{p}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-8 py-6 align-top">
                            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isOldRequest ? 'text-red-400' : 'text-slate-400'}`}>
                              <Clock size={12} /> {requestAgeText}
                            </div>
                            {req.status !== 'new' && (
                              <span className="text-[8px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full mt-1 inline-block uppercase tracking-widest font-black">
                                {req.status.replace('_', ' ')}
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right align-top">
                            <button onClick={() => { setDraftPin(null); setConfirmedPin(null); setPostApprovalProfile(null); setSelectedLead(req); }} className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-black uppercase italic tracking-widest border border-blue-500/20">
                              Inspect <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="divide-y divide-white/5">
                  {guardianList.map((household: any, idx) => {
                     const requestAgeText = getRequestAge(household.created_at);
                     const isOldRequest = requestAgeText.includes('d') || (requestAgeText.includes('h') && parseInt(requestAgeText) > 23);
                     
                     return (
                        <div key={idx} className="p-8 hover:bg-white/[0.01] transition-colors flex flex-col md:flex-row justify-between gap-6">
                           <div className="space-y-4">
                              <div>
                                <h4 className="text-2xl font-black uppercase italic text-purple-400 leading-none">{household.parent_name}</h4>
                                <div className="flex items-center gap-3 text-slate-500 text-xs mt-2">
                                  <span>{household.phone}</span>
                                  <span>•</span>
                                  <span>{household.email}</span>
                                  <span>•</span>
                                  <span className={`flex items-center gap-1 font-bold ${isOldRequest ? 'text-red-400' : 'text-slate-400'}`}><Clock size={12} /> {requestAgeText}</span>
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-3 pl-4 border-l-2 border-white/10">
                                {household.children.map((child: any) => (
                                  <div key={child.id} className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-black text-white uppercase italic">{child.student_name}</span>
                                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">Age: {child.student_age}</span>
                                      {child.status !== 'new' && (
                                        <span className="text-[8px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">
                                          {child.status.replace('_', ' ')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {(child.interested_programs || []).map((p: string, i: number) => (
                                        <span key={i} className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{p}</span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                           </div>

                           <div className="shrink-0">
                             <button onClick={() => { setDraftPin(null); setConfirmedPin(null); setPostApprovalProfile(null); setSelectedLead(household); }} className="px-6 py-3 rounded-xl bg-purple-600 text-white font-black uppercase italic text-[9px] whitespace-nowrap shadow-lg hover:bg-purple-500 transition-all">
                               Inspect Household
                             </button>
                           </div>
                        </div>
                     )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* --- SIDEBAR --- */}
          <aside className="space-y-6">
             <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-4">
                <h4 className="text-white font-black italic uppercase text-xl">Quick_Nav</h4>
                <div className="grid grid-cols-1 gap-2">
                  {quickLinks.map((link: any, i: number) => (
                    <Link key={i} href={link.path} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${link.active ? "bg-white/5 border-transparent text-slate-400 hover:text-blue-400" : "opacity-30 pointer-events-none"}`}>
                      <div className="flex items-center gap-3"><link.icon size={16} /><span className="text-[10px] font-black uppercase">{link.title}</span></div>
                      {link.active && <ChevronRight size={14} />}
                    </Link>
                  ))}
                </div>
             </div>
             <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[40px] space-y-4">
                <h4 className="text-red-400 font-black italic uppercase text-xl">Alerts</h4>
                <p className="text-xs text-slate-500 italic">{stats.orphans} Pioneers need parent linking.</p>
                <button className="w-full py-3 bg-red-500/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-400">Fix Orphans</button>
             </div>
          </aside>
        </div>
      </div>

      {/* --- INSPECTOR SLIDE-OVER --- */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedLead(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }} className="relative w-full max-w-xl bg-[#0f172a] border-l border-white/10 h-full shadow-2xl flex flex-col p-8 space-y-8 overflow-y-auto">
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase italic">{selectedLead.role === 'student' ? 'Profile Management' : 'Registration Intake'}</h2>
                </div>
                <button onClick={() => setSelectedLead(null)} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all"><X size={24}/></button>
              </div>

              {postApprovalProfile ? (
                // --- POST APPROVAL SUCCESS SCREEN ---
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-center space-y-6 pb-20">
                  <div className="w-24 h-24 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center text-green-500">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black uppercase italic">Household Initialized</h2>
                    <p className="text-slate-400 text-sm px-4">The registration was approved and migrated to the master database. The pioneers now have secure access PINs.</p>
                  </div>

                  <div className="w-full space-y-3 pt-6 border-t border-white/5">
                    <button 
                      onClick={() => setShowEmailPreview(true)} 
                      className="w-full p-5 bg-blue-600 rounded-2xl font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 transition-all shadow-lg"
                    >
                      <PenTool size={18} /> Draft & Transmit Onboarding Invite <ArrowRight size={18} className="ml-2" />
                    </button>
                    
                    <button 
                      onClick={() => {
                        setSelectedLead(null);
                        setPostApprovalProfile(null);
                      }} 
                      className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase italic tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      Close & Return to Inbox
                    </button>
                  </div>
                </motion.div>
              ) : (
                // --- STANDARD INSPECTOR UI ---
                <div className="flex-1 overflow-y-auto space-y-8 no-scrollbar pb-10">
                  
                  {/* --- PIN UI: STRICTLY PROFILES ONLY --- */}
                  {selectedLead.role === 'student' && (
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6">
                      <div className="flex items-center gap-2 text-teal-400"><Key size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Onboarding_Security</span></div>
                      
                      {confirmedPin || selectedLead.temp_entry_pin ? (
                        <div className="text-center bg-teal-500/10 p-4 rounded-2xl border border-teal-500/20">
                          <p className="text-[9px] font-black text-teal-400 uppercase mb-2">Active Entry PIN</p>
                          <div className="flex items-center justify-center gap-4">
                            <span className="text-5xl font-black text-white italic tracking-widest">{confirmedPin || selectedLead.temp_entry_pin}</span>
                            <button onClick={() => navigator.clipboard.writeText(confirmedPin || selectedLead.temp_entry_pin)} className="p-2 bg-white/10 rounded-lg text-teal-400 hover:bg-white/20"><Copy size={18}/></button>
                          </div>
                        </div>
                      ) : draftPin ? (
                        <div className="space-y-4">
                          <div className="text-center py-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 animate-pulse" />
                            <p className="text-[10px] font-black text-yellow-500 uppercase mb-2 tracking-widest">Draft PIN (Not Saved)</p>
                            <span className="text-5xl font-black text-white tracking-[0.4em] italic">{draftPin}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setDraftPin(null)} className="py-4 bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-500 flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-400"><RotateCcw size={14}/> Cancel</button>
                            <button onClick={handleSavePinToDB} className="py-4 bg-teal-600 rounded-xl text-[10px] font-black uppercase hover:bg-teal-500 shadow-lg flex items-center justify-center gap-2"><Save size={14}/> Confirm & Save</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={handleGenerateDraftPin} className="w-full p-6 bg-blue-600/10 rounded-2xl text-[10px] font-black uppercase text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all">Generate New Access PIN</button>
                      )}
                    </div>
                  )}

                  {/* REGISTRATION/PROFILE DETAILS */}
                  {selectedLead.isHousehold ? (
                    <div className="space-y-6">
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-6">
                        <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-2"><ListTree size={14}/> Guardian Profile</label>
                        <p className="text-3xl font-black text-white italic uppercase leading-none">{selectedLead.parent_name}</p>
                        <div className="flex flex-col gap-1 mt-4">
                           <span className="text-sm font-bold text-slate-300 flex items-center gap-2"><Mail size={14}/> {selectedLead.email || 'No email provided'}</span>
                           <span className="text-sm font-bold text-slate-300 flex items-center gap-2"><Phone size={14}/> {selectedLead.phone || 'No phone provided'}</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14}/> Linked Pioneers ({selectedLead.children.length})</label>
                        {selectedLead.children.map((child: any) => {
                          const programsWithBonus = Array.from(new Set([...(child.interested_programs || []), "Demo LMS Access"]));
                          return (
                            <div key={child.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <p className="text-lg font-black text-white italic uppercase">{child.student_name}</p>
                                <span className="text-[10px] font-bold px-2 py-1 bg-white/10 text-slate-300 rounded-md">Age: {child.student_age}</span>
                              </div>
                              <div className="space-y-1.5 pt-2 border-t border-white/5">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Selected Programs:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {programsWithBonus.map((p: string, i: number) => (
                                    <span key={i} className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">{p}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div><label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Entity Name</label><p className="text-sm font-bold uppercase mt-1 text-white">{selectedLead.student_name || selectedLead.display_name}</p></div>
                        <div><label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Parent/Origin</label><p className="text-sm font-bold uppercase text-slate-400 mt-1">{selectedLead.parent_name || selectedLead.metadata?.parent_name || 'Individual'}</p></div>
                        <div><label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label><p className="text-sm font-bold mt-1 break-all text-slate-300">{selectedLead.email || selectedLead.metadata?.email || 'N/A'}</p></div>
                        <div><label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Contact Number</label><p className="text-sm font-bold mt-1 text-slate-300">{selectedLead.phone || selectedLead.metadata?.phone || 'N/A'}</p></div>
                      </div>
                      
                      {selectedLead.role !== 'student' && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Selected Programs:</label>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(new Set([...(selectedLead.interested_programs || []), "Demo LMS Access"])).map((p: string, i: number) => (
                              <span key={i} className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STATUS DROPDOWN FOR REGISTRATIONS */}
                  {selectedLead.role !== 'student' && (
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                        <Activity size={14}/> Registration Status
                      </label>
                      <div className="relative">
                        <select 
                          value={selectedLead.isHousehold ? selectedLead.children[0].status : selectedLead.status}
                          onChange={(e) => handleChangeRegistrationStatus(e.target.value)}
                          className="w-full bg-[#020617] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                        >
                          <option value="new">New Request</option>
                          <option value="in_progress">Reviewing / In Progress</option>
                          <option value="waitlist">Waitlisted</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected / Cancelled</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><MessageSquare size={14}/> Internal Notes</label>
                    <textarea id="admin_notes" defaultValue={selectedLead.admin_notes || ""} className="w-full bg-[#020617] border border-white/10 rounded-2xl p-4 text-sm text-slate-300 min-h-[120px] outline-none focus:border-blue-500" placeholder="Add operational notes..." />
                  </div>

                  {/* ACTION BUTTONS: Convert for Registrations, Update for Profiles */}
                  {selectedLead.role !== 'student' ? (
                    <div className="pt-4 border-t border-white/5">
                      <button 
                        onClick={() => handleApproveAndConvert(selectedLead)} 
                        className="w-full p-5 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl font-black uppercase italic tracking-widest hover:bg-green-500 hover:text-black transition-all flex items-center justify-center gap-2 shadow-lg"
                      >
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <>Approve & Convert to Profile <LinkIcon size={18} /></>}
                      </button>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-white/5">
                       <button 
                         onClick={handleUpdateNotes} 
                         className="w-full p-5 bg-blue-600 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 hover:bg-blue-500 transition-all shadow-xl"
                       >
                         {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> Update Profile Data</>}
                       </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADDED: ADMIN PROFILE SLIDE-OVER --- */}
      <AnimatePresence>
        {showAdminProfile && adminProfile && (
          <div className="fixed inset-0 z-[150] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdminProfile(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }} className="relative w-full max-w-md bg-[#0f172a] border-l border-white/10 h-full shadow-2xl flex flex-col p-8 space-y-8 overflow-y-auto">
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase italic text-blue-400">Admin Settings</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Update your profile data</p>
                </div>
                <button onClick={() => setShowAdminProfile(false)} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all"><X size={24}/></button>
              </div>
              
              <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Display Name</label>
                   <input value={adminEditForm.name} onChange={e => setAdminEditForm({...adminEditForm, name: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-colors" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                   <input type="email" value={adminEditForm.email} onChange={e => setAdminEditForm({...adminEditForm, email: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-colors" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone Number</label>
                   <input type="tel" value={adminEditForm.phone} onChange={e => setAdminEditForm({...adminEditForm, phone: e.target.value})} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-colors" />
                 </div>
                 
                 <div className="pt-6 border-t border-white/5">
                   <button onClick={handleUpdateAdminProfile} disabled={isProcessing} className="w-full p-5 bg-blue-600 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 hover:bg-blue-500 transition-all shadow-xl disabled:opacity-50 shadow-blue-900/20">
                      {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> Save Profile</>}
                   </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EMAIL PREVIEW MODAL --- */}
      <AnimatePresence>
        {showEmailPreview && postApprovalProfile && (
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
                  <p className="text-sm text-slate-500 mt-1">Recipient: <span className="text-white font-bold">{postApprovalProfile.display_name}</span> &lt;{postApprovalProfile.metadata?.email}&gt;</p>
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