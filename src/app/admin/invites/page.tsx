"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, Users, CheckCircle2, AlertTriangle, Clock, 
  Plus, Search, Copy, MessageSquare, Mail, Linkedin, 
  Eye, X, Loader2, ArrowRight, Sparkles, TrendingUp, Calendar, UserPlus, CalendarClock,
  ArrowLeft, Share2, Activity, ShieldCheck, CheckSquare, Square, Trash2, Check,
  CreditCard, GraduationCap
} from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";

export default function InvitesCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [prospects, setProspects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<string | null>(null);
  const [selectedLeadModal, setSelectedLeadModal] = useState<any>(null);
  const [showConvertModal, setShowConvertModal] = useState<any>(null); // NEW: Conversion Modal

  // Bulk Generate Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('new');
  const [selectedProspectIds, setSelectedProspectIds] = useState<string[]>([]);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [bulkNewLeads, setBulkNewLeads] = useState([{ id: '1', name: '', email: '', phone: '' }]);

  // Global Cohort Dates
  const [plannedDate, setPlannedDate] = useState("");
  const [trialExpiry, setTrialExpiry] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("");

  // Share Form State
  const [shareTab, setShareTab] = useState<'whatsapp' | 'email' | 'linkedin'>('whatsapp');
  const [copied, setCopied] = useState(false);

  // Conversion State
  const [isConverting, setIsConverting] = useState(false);
  const [selectedTierOverride, setSelectedTierOverride] = useState<string>("auto");

  useEffect(() => {
    fetchProspects();
    
    const today = new Date();
    const launchDate = new Date('2026-05-01T00:00:00');
    
    let defaultTrialEnd = new Date();
    if (today < launchDate) {
      defaultTrialEnd = new Date('2026-05-15T00:00:00');
    } else {
      defaultTrialEnd.setDate(today.getDate() + 14);
    }
    
    let defaultInviteExpiry = new Date(today);
    defaultInviteExpiry.setDate(today.getDate() + 7);

    setPlannedDate(today.toISOString().split('T')[0]);
    setTrialExpiry(defaultTrialEnd.toISOString().split('T')[0]);
    setInviteExpiry(defaultInviteExpiry.toISOString().split('T')[0]);

    const channel = supabase.channel('prospects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, () => {
        fetchProspects(false);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchProspects(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await supabase.from('prospects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProspects(data || []);
      
      if (selectedLeadModal) {
        const updatedLead = data?.find(p => p.id === selectedLeadModal.id);
        if (updatedLead) setSelectedLeadModal(updatedLead);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // --- Metrics Engine ---
  const metrics = useMemo(() => {
    const now = new Date().getTime();
    let planned = 0, sent = 0, accepted = 0, converted = 0, expiredUnclaimed = 0, expiredTrial = 0;

    prospects.forEach(p => {
      const isCampaignLead = p.metadata?.campaign === "Commitment Pricing May 2026" || p.source === 'Referral' || p.metadata?.referred_by_id;
      if (!isCampaignLead) return;

      const isPlanned = p.status === 'Invite Planned';
      const isInviteSent = p.status === 'Invite Sent';
      const isTrialActive = p.status === 'Trial Active' || (p.source === 'Referral' && p.status === 'New Lead');
      const isConverted = p.status === 'Converted (Won)';
      
      const invExpDate = p.metadata?.invite_expiry ? new Date(p.metadata.invite_expiry).getTime() : now + 100000;
      const trialEndDate = p.metadata?.trial_end ? new Date(p.metadata.trial_end).getTime() : now + 100000;

      if (isPlanned) planned++;
      if (isConverted) converted++;
      
      if (isInviteSent) {
        if (now > invExpDate) expiredUnclaimed++;
        else sent++;
      }

      if (isTrialActive) {
        if (now > trialEndDate) expiredTrial++;
        else accepted++;
      }
    });

    return { planned, sent, accepted, converted, expiredUnclaimed, expiredTrial };
  }, [prospects]);

  // --- Utility Generators ---
  const generateToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length: 24}).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // --- Execution: Convert to Paid Student ---
  const executeConversion = async () => {
    const p = showConvertModal;
    if (!p) return;

    setIsConverting(true);
    try {
      // 1. Determine Tier Pricing
      let activeTier = selectedTierOverride;
      if (activeTier === "auto") {
        if (metrics.converted < 10) activeTier = "tier1";
        else if (metrics.converted < 20) activeTier = "tier2";
        else activeTier = "tier3";
      }

      const tiers = {
        tier1: { id: "b2aae4aa-0c84-4673-9fe1-3e61895626d1", price: 250, desc: "LMS Access - Tier 1" },
        tier2: { id: "d696d727-3e94-4325-98d9-e8a89277338a", price: 350, desc: "LMS Access - Tier 2" },
        tier3: { id: "d86b5577-a8ec-4bd8-a27d-b454e79ca742", price: 450, desc: "LMS Access - Tier 3" }
      };
      const selectedPricing = tiers[activeTier as keyof typeof tiers];

      // 2. Generate Profile Data
      const guardianId = crypto.randomUUID();
      const onboardingToken = generateToken();
      
      const guardianProfile = {
        id: guardianId,
        role: 'guardian',
        display_name: p.name,
        onboarding_token: onboardingToken,
        status: 'active',
        funnel_stage: 'Active (Paid Client)',
        payment_plan_preference: 'LMS Access',
        metadata: JSON.stringify({ email: p.email, phone: p.phone, booking_credits: 0 })
      };

      const numChildren = p.metadata?.children?.length || 1;
      const studentProfiles = (p.metadata?.children || [{name: 'Student', dob: '', codingAtSchool: 'No'}]).map((c: any) => ({
        id: crypto.randomUUID(),
        role: 'student',
        display_name: c.name,
        linked_parent_id: guardianId,
        status: 'active',
        metadata: JSON.stringify({ date_of_birth: c.dob, school_coding: c.codingAtSchool === 'Yes' })
      }));

      // 3. Generate Quote Data (Expires midnight tomorrow)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 1);
      expiryDate.setHours(23, 59, 59, 999);
      
      const invoiceNumber = Math.floor(Date.now() / 1000); // Rough timestamp for unique quote num
      
      const quotationRecord = {
        id: crypto.randomUUID(),
        invoice_number: invoiceNumber,
        payment_reference: `2026${invoiceNumber}`,
        guardian_id: guardianId,
        total_amount: (selectedPricing.price * numChildren).toString(),
        status: 'pending',
        doc_type: 'quote',
        expires_at: expiryDate.toISOString(),
        amount_paid: "0",
        line_items: [{ // <-- Removed JSON.stringify
          qty: numChildren.toString(), 
          desc: selectedPricing.desc, 
          disc: 0, 
          note: "Self-paced LMS Access License", 
          price: selectedPricing.price.toString(),
          item_id: selectedPricing.id
        }],
        metadata: { // <-- Removed JSON.stringify
          global_note: "Your VIP Access trial has concluded. Please pay this quote to officially secure your child's spot.", 
          prospect_name: p.name, 
          prospect_email: p.email 
        }
      };

      // 4. Referral Bonus Logic
      if (p.metadata?.referred_by_id) {
        // Fetch the person who referred them
        const { data: referrerProspect } = await supabase.from('prospects').select('status, metadata').eq('id', p.metadata.referred_by_id).single();
        
        // If the referrer is ALSO converted, they get a credit!
        if (referrerProspect?.status === 'Converted (Won)' && referrerProspect.metadata?.converted_profile_id) {
          const refProfileId = referrerProspect.metadata.converted_profile_id;
          const { data: refProfile } = await supabase.from('profiles').select('metadata').eq('id', refProfileId).single();
          
          if (refProfile) {
            const refMeta = typeof refProfile.metadata === 'string' ? JSON.parse(refProfile.metadata) : (refProfile.metadata || {});
            const newCredits = (refMeta.booking_credits || 0) + 1;
            refMeta.booking_credits = newCredits;
            
            // Give the referrer their credit
            await supabase.from('profiles').update({ metadata: JSON.stringify(refMeta) }).eq('id', refProfileId);
          }
        }
      }

      // 5. Execute DB Transaction (Sequential for safety)
      await supabase.from('profiles').insert([guardianProfile, ...studentProfiles]);
      await supabase.from('billing_records').insert([quotationRecord]);
      
      // Mark Prospect as Won and save the new profile ID so referrals can find them later
      const updatedMeta = { ...p.metadata, converted_profile_id: guardianId, conversion_date: new Date().toISOString() };
      await supabase.from('prospects').update({ status: 'Converted (Won)', metadata: updatedMeta }).eq('id', p.id);
      
      fetch('/api/emails/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'manual-conversion',
          name: p.name,
          email: p.email,
          token: onboardingToken,
          quoteId: quotationRecord.id
        })
      });

      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#10b981', '#3b82f6'] });
      setShowConvertModal(null);
      fetchProspects(false);

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to convert prospect.");
    } finally {
      setIsConverting(false);
    }
  };

  // --- Bulk Generation Action ---
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const todayString = new Date().toISOString().split('T')[0];
      const targetStatus = plannedDate > todayString ? 'Invite Planned' : 'Invite Sent';

      const metadataAdditions = {
        custom_trial_end: new Date(trialExpiry).toISOString(),
        invite_expiry: new Date(inviteExpiry).toISOString(),
        planned_invite_date: new Date(plannedDate).toISOString(),
        invite_generated_at: new Date().toISOString(),
        campaign: "Commitment Pricing May 2026"
      };

      if (inviteMode === 'existing') {
        if (selectedProspectIds.length === 0) throw new Error("Please select at least one prospect to invite.");
        const updatePromises = selectedProspectIds.map(id => {
          const existing = prospects.find(p => p.id === id);
          return supabase.from('prospects').update({ status: targetStatus, metadata: { ...existing.metadata, ...metadataAdditions } }).eq('id', id);
        });
        await Promise.all(updatePromises);
      } else {
        const validLeads = bulkNewLeads.filter(l => l.name.trim() !== "" && l.email.trim() !== "");
        if (validLeads.length === 0) throw new Error("Please fill out Name and Email for at least one lead.");
        const insertPayload = validLeads.map(l => ({
          name: l.name, email: l.email, phone: l.phone, status: targetStatus, source: 'Direct Invite', metadata: metadataAdditions
        }));
        const { error } = await supabase.from('prospects').insert(insertPayload);
        if (error) throw error;
      }

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setShowGenerateModal(false);
      setSelectedProspectIds([]);
      setBulkNewLeads([{ id: '1', name: '', email: '', phone: '' }]);

    } catch (err: any) {
      alert(err.message || "Failed to generate invites.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addBulkRow = () => setBulkNewLeads([...bulkNewLeads, { id: Date.now().toString(), name: '', email: '', phone: '' }]);
  const updateBulkRow = (id: string, field: 'name' | 'email' | 'phone', value: string) => setBulkNewLeads(bulkNewLeads.map(l => l.id === id ? { ...l, [field]: value } : l));
  const removeBulkRow = (id: string) => {
    if (bulkNewLeads.length === 1) return;
    setBulkNewLeads(bulkNewLeads.filter(l => l.id !== id));
  };

  const getShareCopy = (type: 'whatsapp' | 'email' | 'linkedin', p: any) => {
    if (!p) return "";
    const firstName = p.name.split(' ')[0];
    const link = `${window.location.origin}/invite/${p.id}`;
    
    const formats = {
      whatsapp: `Hi ${firstName}! 🚀\n\nAs promised, I've secured a VIP RAD LMS Access invite specifically for you.\n\nBecause we are launching our new self-paced coding curriculum, I'm giving you an exclusive Action-Taker's discount and a 14-Day Free Trial.\n\nClaim your secure license here before it expires:\n${link}\n\nLet me know if you have any issues setting it up!`,
      email: `Subject: Your VIP RAD Academy Access Invite 🚀\n\nHi ${firstName},\n\nI've officially secured your VIP access to the RAD Academy Learning Management System.\n\nWe're subsidizing licenses for parents who are serious about future-proofing their children. You get a 14-Day Full Access Trial, and if you claim it via the link below, you'll lock in our heavily discounted "Action-Taker's Pricing" forever.\n\nClaim your VIP access here:\n${link}\n\nCan't wait to see your child inside the portal.\n\nBest,\nRAD Academy Team`,
      linkedin: `Hi ${firstName}, great connecting! As discussed, I've organized a VIP invite for you to trial our new coding LMS. You can claim your 14-day free access and lock in the discounted tier right here: ${link} Let me know when you're set up!`
    };
    return formats[type];
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const campaignProspects = useMemo(() => {
    return prospects.filter(p => {
      const isPartOfCampaign = ['Invite Planned', 'Invite Sent', 'Trial Active'].includes(p.status) && p.metadata?.campaign === "Commitment Pricing May 2026";
      const isReferral = p.source === 'Referral' || p.metadata?.referred_by_id;
      const isConvertedCampaign = p.status === 'Converted (Won)' && (p.metadata?.campaign === "Commitment Pricing May 2026" || isReferral);
      return isPartOfCampaign || isReferral || isConvertedCampaign;
    }).filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.email?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [prospects, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Loading Command Center...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
          <div className="space-y-4">
            <Link href="/admin/dashboard" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-blue-400/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Command Center</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-500">
                <Sparkles size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Growth_Engine</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-white">
                Invite <span className="text-blue-500">Campaigns</span>
              </h1>
            </div>
          </div>

          <button 
            onClick={() => setShowGenerateModal(true)}
            className="w-full sm:w-auto px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
          >
            <Plus size={16} /> Generate Bulk Invites
          </button>
        </header>

        {/* METRICS DASHBOARD */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-purple-400 mb-2 flex items-center gap-1.5"><CalendarClock size={12}/> Planned</p>
            <p className="text-3xl font-black text-purple-400 italic">{metrics.planned}</p>
          </div>
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Send size={12}/> Sent</p>
            <p className="text-3xl font-black text-white italic">{metrics.sent}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-1.5"><Clock size={12}/> Trial Active</p>
            <p className="text-3xl font-black text-blue-400 italic">{metrics.accepted}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-1.5"><CheckCircle2 size={12}/> Paid</p>
            <p className="text-3xl font-black text-emerald-400 italic">{metrics.converted}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm opacity-70">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><X size={12}/> Expired Unclaimed</p>
            <p className="text-3xl font-black text-slate-300 italic">{metrics.expiredUnclaimed}</p>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-2 flex items-center gap-1.5"><AlertTriangle size={12}/> Expired Unpaid</p>
            <p className="text-3xl font-black text-rose-400 italic">{metrics.expiredTrial}</p>
          </div>
        </div>

        {/* PIPELINE TABLE */}
        <div className="bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Users size={16} className="text-blue-500"/> Campaign Ledger
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input 
                type="text" placeholder="Search leads..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#020617] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#020617] text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Prospect</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Source / Referral</th>
                  <th className="px-6 py-4">Telemetry Activity</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaignProspects.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold italic text-xs">No prospects active in this campaign.</td></tr>
                ) : (
                  campaignProspects.map(p => {
                    let statusColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
                    if (p.status === 'Invite Planned') statusColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                    if (p.status === 'Invite Sent') statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    if (p.status === 'Trial Active' || (p.source === 'Referral' && p.status === 'New Lead')) statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    if (p.status === 'Converted (Won)') statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                    const isReferred = p.source === 'Referral' || p.metadata?.referred_by_id;
                    const progress = p.metadata?.form_progress || 'Unopened';
                    const lastActive = p.metadata?.last_active;
                    
                    // Show Convert button if they are in Trial Active phase
                    const canConvert = p.status === 'Trial Active' || (p.source === 'Referral' && p.status === 'New Lead');

                    let progressColor = "text-slate-500 bg-slate-800 border-slate-700";
                    if (progress === 'Form Opened') progressColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
                    if (progress === 'Guardian Details Completed') progressColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                    if (progress === 'Completed') progressColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                    return (
                      <tr key={p.id} onClick={() => setSelectedLeadModal(p)} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                        <td className="px-6 py-4">
                          <p className="font-black text-sm text-white group-hover:text-blue-400 transition-colors">{p.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{p.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${statusColor}`}>
                            {p.status === 'New Lead' && isReferred ? 'Trial Active' : p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium">
                          {isReferred ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              <UserPlus size={12}/> {p.metadata?.referred_by_name || 'Referral'}
                            </div>
                          ) : (
                            <span className="text-slate-400">{p.source || 'Direct Invite'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className={`w-fit px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${progressColor}`}>
                              {progress}
                            </span>
                            {lastActive && (
                              <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                <Clock size={10}/> {new Date(lastActive).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {canConvert && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setShowConvertModal(p); }}
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg transition-all border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5"
                                title="Convert to Paid Profile"
                              >
                                <CheckCircle2 size={14} /> Convert
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setShowPreviewModal(`${window.location.origin}/invite/${p.id}`); }} className="p-2 bg-white/5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"><Eye size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setShowShareModal(p); }} className={`p-2 rounded-lg transition-colors border ${p.status === 'Invite Planned' ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-600 hover:text-white border-purple-500/20' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white border-blue-500/20'}`}>
                              {p.status === 'Invite Planned' ? <Send size={14} /> : <Share2 size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ==========================================
          MODALS
          ========================================== */}
      
      {/* X-RAY LEAD DETAILS MODAL */}
      <AnimatePresence>
        {selectedLeadModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedLeadModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-start justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-inner">
                    {selectedLeadModal.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{selectedLeadModal.name}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">{selectedLeadModal.email} &bull; {selectedLeadModal.phone}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedLeadModal(null)} className="p-2 bg-white/5 hover:bg-rose-500 text-slate-400 hover:text-white rounded-full transition-colors"><X size={16}/></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {(selectedLeadModal.source === 'Referral' || selectedLeadModal.metadata?.referred_by_id) && (
                  <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-fuchsia-500/20 text-fuchsia-400 rounded-xl flex items-center justify-center shrink-0"><UserPlus size={18}/></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400 mb-0.5">Referred Lead</p>
                      <p className="text-sm font-bold text-slate-300">Invited by <strong className="text-white">{selectedLeadModal.metadata?.referred_by_name || 'Unknown'}</strong></p>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Activity size={12}/> Activity X-Ray</h4>
                  <div className="bg-[#020617] border border-white/5 rounded-2xl p-5 shadow-inner space-y-4 relative before:absolute before:inset-y-5 before:left-[27px] before:w-px before:bg-white/10">
                    
                    <div className="flex gap-4 relative z-10">
                      <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-600 shrink-0 mt-1" />
                      <div>
                        <p className="text-sm font-black text-slate-300">Invite Generated</p>
                        <p className="text-xs text-slate-500">{new Date(selectedLeadModal.created_at).toLocaleString()}</p>
                      </div>
                    </div>

                    {selectedLeadModal.metadata?.form_progress && (
                      <div className="flex gap-4 relative z-10">
                        <div className="w-4 h-4 rounded-full bg-blue-900 border-2 border-blue-500 shrink-0 mt-1 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        <div>
                          <p className="text-sm font-black text-blue-400">Form Opened</p>
                          <p className="text-xs text-slate-500">Started engagement</p>
                        </div>
                      </div>
                    )}

                    {['Guardian Details Completed', 'Completed'].includes(selectedLeadModal.metadata?.form_progress) && (
                      <div className="flex gap-4 relative z-10">
                        <div className="w-4 h-4 rounded-full bg-amber-900 border-2 border-amber-500 shrink-0 mt-1 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                        <div>
                          <p className="text-sm font-black text-amber-400">Guardian Details Captured</p>
                          <p className="text-xs text-slate-500">Contact info secured</p>
                        </div>
                      </div>
                    )}

                    {selectedLeadModal.metadata?.form_progress === 'Completed' && (
                      <div className="flex gap-4 relative z-10">
                        <div className="w-4 h-4 rounded-full bg-emerald-900 border-2 border-emerald-500 shrink-0 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        <div>
                          <p className="text-sm font-black text-emerald-400">Trial Claimed & Form Completed</p>
                          <p className="text-xs text-slate-500">Successfully locked in VIP Access</p>
                        </div>
                      </div>
                    )}

                    {selectedLeadModal.status === 'Converted (Won)' && (
                      <div className="flex gap-4 relative z-10">
                        <div className="w-4 h-4 rounded-full bg-indigo-900 border-2 border-indigo-500 shrink-0 mt-1 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        <div>
                          <p className="text-sm font-black text-indigo-400">Converted to Pioneer</p>
                          <p className="text-xs text-slate-500">Official Profile & Quote Generated</p>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 pl-8">
                      <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 bg-white/5 w-fit px-2 py-1 rounded">
                        <Clock size={12}/> Last active ping: {selectedLeadModal.metadata?.last_active ? new Date(selectedLeadModal.metadata.last_active).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#020617] border border-white/5 rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Invite Expiry</p>
                    <p className="text-sm font-bold text-white">{selectedLeadModal.metadata?.invite_expiry ? new Date(selectedLeadModal.metadata.invite_expiry).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">Trial Ends</p>
                    <p className="text-sm font-black text-blue-400">{selectedLeadModal.metadata?.custom_trial_end ? new Date(selectedLeadModal.metadata.custom_trial_end).toLocaleDateString() : (selectedLeadModal.metadata?.trial_end ? new Date(selectedLeadModal.metadata.trial_end).toLocaleDateString() : 'N/A')}</p>
                  </div>
                </div>

                {selectedLeadModal.metadata?.children && selectedLeadModal.metadata.children.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Captured Student Data</h4>
                    <div className="space-y-2">
                      {selectedLeadModal.metadata.children.map((c: any, i: number) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center">
                          <p className="text-sm font-bold text-white">{c.name}</p>
                          <div className="flex gap-2">
                            {c.dob && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">{c.dob}</span>}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${c.codingAtSchool === 'Yes' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                              {c.codingAtSchool === 'Yes' ? 'Codes at School' : 'No prior coding'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONVERSION MODAL */}
      <AnimatePresence>
        {showConvertModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConvertModal(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-[#0f172a] border border-emerald-500/30 rounded-[32px] shadow-2xl p-8 flex flex-col">
              <button onClick={() => setShowConvertModal(null)} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
              
              <div className="mb-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/30"><CheckCircle2 size={24}/></div>
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Execute Conversion</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Converting: {showConvertModal.name}</p>
                </div>
              </div>

              <div className="space-y-6">
                
                {/* TIER SELECTION */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 mb-2 block">Select Access Tier</label>
                  <select 
                    value={selectedTierOverride} 
                    onChange={e => setSelectedTierOverride(e.target.value)}
                    className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="auto">Auto-Calculate (Currently {metrics.converted < 10 ? 'Tier 1' : metrics.converted < 20 ? 'Tier 2' : 'Tier 3'})</option>
                    <option value="tier1">Tier 1 - First 10 (R250/mo)</option>
                    <option value="tier2">Tier 2 - Next 10 (R350/mo)</option>
                    <option value="tier3">Tier 3 - Standard (R450/mo)</option>
                  </select>
                  <p className="text-[9px] text-slate-500 mt-2 ml-1">This generates the quotation for {showConvertModal.metadata?.children?.length || 1} student(s) expiring tomorrow at 23:59.</p>
                </div>

                <div className="bg-[#020617] border border-white/5 rounded-2xl p-5 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 border-b border-white/5 pb-2">Actions to be executed:</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-xs text-slate-300 font-medium">
                      <UserPlus size={14} className="text-emerald-500 shrink-0" /> Creates 1 Guardian profile with secure Welcome Token.
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-300 font-medium">
                      <GraduationCap size={14} className="text-emerald-500 shrink-0" /> Creates {showConvertModal.metadata?.children?.length || 1} Student profile(s) linked to Guardian.
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-300 font-medium">
                      <CreditCard size={14} className="text-emerald-500 shrink-0" /> Generates Billing Quotation for selected tier.
                    </li>
                    {showConvertModal.metadata?.referred_by_id && (
                      <li className="flex items-start gap-3 text-xs text-fuchsia-300 font-bold bg-fuchsia-500/10 p-2 rounded-lg border border-fuchsia-500/20 mt-2">
                        <Sparkles size={14} className="shrink-0" /> If referrer is active, instantly issues +1 Coaching Credit!
                      </li>
                    )}
                  </ul>
                </div>

                <button 
                  onClick={executeConversion}
                  disabled={isConverting} 
                  className="w-full bg-emerald-600 text-white rounded-xl py-4 text-xs font-black uppercase tracking-widest hover:bg-emerald-500 flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isConverting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Execute Official Conversion
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK GENERATOR MODAL */}
      <AnimatePresence>
        {showGenerateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGenerateModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl p-8 flex flex-col max-h-[90vh]">
              <button onClick={() => setShowGenerateModal(false)} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
              
              <div className="mb-6 shrink-0">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Generate Bulk Invites</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Process multiple leads in one action</p>
              </div>

              <div className="flex bg-[#020617] p-1 rounded-xl border border-white/10 mb-6 shrink-0">
                <button onClick={() => setInviteMode('new')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${inviteMode === 'new' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500'}`}>Enter New Leads</button>
                <button onClick={() => setInviteMode('existing')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${inviteMode === 'existing' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500'}`}>Select Existing Pipeline</button>
              </div>

              <form onSubmit={handleGenerate} className="flex flex-col flex-1 overflow-hidden min-h-0">
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
                  {inviteMode === 'existing' ? (
                    <div className="space-y-3">
                      <div className="sticky top-0 bg-[#0f172a] pt-1 pb-3 z-10 space-y-3 border-b border-white/5 mb-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Select prospects ({selectedProspectIds.length} chosen)
                          </p>
                          {selectedProspectIds.length > 0 && (
                            <button type="button" onClick={() => setSelectedProspectIds([])} className="text-[9px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-widest transition-colors">
                              Clear Selection
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                          <input 
                            type="text" placeholder="Search by name or email..." 
                            value={modalSearchQuery} onChange={(e) => setModalSearchQuery(e.target.value)}
                            className="w-full bg-[#020617] border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {prospects
                          .filter(p => !['Trial Active', 'Converted (Won)'].includes(p.status))
                          .filter(p => p.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) || p.email?.toLowerCase().includes(modalSearchQuery.toLowerCase()))
                          .map(p => {
                            const isSelected = selectedProspectIds.includes(p.id);
                            const hasInvite = ['Invite Sent', 'Invite Planned'].includes(p.status) || !!p.metadata?.invite_generated_at;
                            const sentDate = p.metadata?.invite_generated_at ? new Date(p.metadata.invite_generated_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : null;

                            return (
                              <div key={p.id} onClick={() => { if (isSelected) setSelectedProspectIds(prev => prev.filter(id => id !== p.id)); else setSelectedProspectIds(prev => [...prev, p.id]); }} className={`p-3 rounded-xl border cursor-pointer relative flex items-center gap-3 transition-all ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : hasInvite ? 'bg-white/5 border-transparent opacity-60 hover:opacity-100 hover:border-white/10' : 'bg-[#020617] border-white/5 hover:border-white/10'}`}>
                                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${p.status === 'New Lead' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : p.status === 'Warm (Pending Close)' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : p.status === 'Lost' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                  {p.status}
                                </div>
                                <div className={`${isSelected ? 'text-blue-500' : 'text-slate-600'} shrink-0`}>
                                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                </div>
                                <div className="overflow-hidden pr-16 flex-1">
                                  <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-100' : (hasInvite ? 'text-slate-400' : 'text-slate-300')}`}>{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-slate-500 truncate">{p.email}</p>
                                    {hasInvite && sentDate && <span className="text-[8px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">Sent: {sentDate}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 sticky top-0 bg-[#0f172a] pb-2">Batch Lead Data</p>
                      <AnimatePresence>
                        {bulkNewLeads.map((lead, idx) => (
                          <motion.div key={lead.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="flex flex-col md:flex-row gap-3 bg-[#020617] p-3 rounded-xl border border-white/5 relative group">
                            <div className="absolute -left-2 -top-2 w-5 h-5 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center text-[9px] font-black">{idx + 1}</div>
                            <input type="text" required placeholder="Lead Name *" value={lead.name} onChange={e => updateBulkRow(lead.id, 'name', e.target.value)} className="flex-1 bg-transparent border-b border-white/10 px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-blue-500" />
                            <input type="email" required placeholder="Email Address *" value={lead.email} onChange={e => updateBulkRow(lead.id, 'email', e.target.value)} className="flex-1 bg-transparent border-b border-white/10 px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-blue-500" />
                            <input type="tel" placeholder="Phone Number" value={lead.phone} onChange={e => updateBulkRow(lead.id, 'phone', e.target.value)} className="w-full md:w-32 bg-transparent border-b border-white/10 px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-blue-500" />
                            <button type="button" onClick={() => removeBulkRow(lead.id)} className={`p-2 rounded-lg transition-colors ${bulkNewLeads.length === 1 ? 'opacity-20 cursor-not-allowed text-slate-600' : 'text-slate-500 hover:bg-rose-500/10 hover:text-rose-500'}`}><Trash2 size={16} /></button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <button type="button" onClick={addBulkRow} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-slate-400 text-xs font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"><Plus size={14} /> Add Another Row</button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/10 shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Global Cohort Schedule</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-purple-400 ml-1 flex items-center gap-1"><Send size={10}/> Planned Send</label>
                      <input type="date" required value={plannedDate} onChange={e => setPlannedDate(e.target.value)} className="w-full mt-1 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 text-xs font-bold text-purple-300 focus:outline-none focus:border-purple-500 [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1"><Calendar size={10}/> Link Expiry</label>
                      <input type="date" required value={inviteExpiry} onChange={e => setInviteExpiry(e.target.value)} className="w-full mt-1 bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1 flex items-center gap-1"><Clock size={10}/> Trial Expiry (14D)</label>
                      <input type="date" required value={trialExpiry} onChange={e => setTrialExpiry(e.target.value)} className="w-full mt-1 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2 text-xs font-bold text-blue-400 focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
                    </div>
                  </div>

                  <button type="submit" disabled={isSubmitting} className="w-full mt-6 bg-blue-600 text-white rounded-xl py-4 text-xs font-black uppercase tracking-widest hover:bg-blue-500 flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} 
                    Execute Bulk Generation {inviteMode === 'existing' && selectedProspectIds.length > 0 ? `(${selectedProspectIds.length} Leads)` : ''}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHARE MODAL */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Distribute Invite</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Link generated for {showShareModal.name}</p>
                </div>
                <button onClick={() => setShowShareModal(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="p-4 bg-[#020617] border border-white/10 rounded-2xl flex items-center justify-between gap-4">
                  <p className="text-sm font-mono text-blue-400 truncate select-all">{`${window.location.origin}/invite/${showShareModal.id}`}</p>
                  <button onClick={() => copyToClipboard(`${window.location.origin}/invite/${showShareModal.id}`)} className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-md shrink-0">
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div>
                  <div className="flex gap-2 border-b border-white/5 pb-2">
                    <button onClick={() => setShareTab('whatsapp')} className={`px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${shareTab === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}><MessageSquare size={14}/> WhatsApp</button>
                    <button onClick={() => setShareTab('email')} className={`px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${shareTab === 'email' ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}><Mail size={14}/> Email</button>
                    <button onClick={() => setShareTab('linkedin')} className={`px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${shareTab === 'linkedin' ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}><Linkedin size={14}/> LinkedIn</button>
                  </div>
                  <div className="pt-4 relative group">
                    <textarea readOnly value={getShareCopy(shareTab, showShareModal)} className="w-full h-64 bg-[#020617] border border-white/10 rounded-2xl p-5 text-sm text-slate-300 font-medium resize-none focus:outline-none custom-scrollbar" />
                    <button onClick={() => copyToClipboard(getShareCopy(shareTab, showShareModal))} className="absolute bottom-6 right-6 px-4 py-2 bg-white/10 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 border border-white/10 hover:border-transparent opacity-0 group-hover:opacity-100">
                      {copied ? <><CheckCircle2 size={14}/> Copied</> : <><Copy size={14}/> Copy Text</>}
                    </button>
                  </div>

                  {/* --- NEW: DIRECT WHATSAPP LAUNCHER --- */}
                  {shareTab === 'whatsapp' && (
                    <button
                      onClick={() => {
                        const text = getShareCopy('whatsapp', showShareModal);
                        let phone = showShareModal?.phone ? showShareModal.phone.replace(/\D/g, '') : '';
                        
                        // Auto-format local ZA numbers (082... -> 2782...) for WhatsApp API reliability
                        if (phone.startsWith('0')) {
                          phone = '27' + phone.substring(1);
                        }

                        const url = phone 
                          ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` 
                          : `https://wa.me/?text=${encodeURIComponent(text)}`;
                          
                        window.open(url, '_blank');
                      }}
                      className="w-full mt-4 py-4 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.3)]"
                    >
                      <MessageSquare size={16} /> Open in WhatsApp
                    </button>
                  )}

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PREVIEW MODAL (IFRAME) */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPreviewModal(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-5xl h-[90vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
              <div className="bg-[#0f172a] p-4 flex items-center justify-between shrink-0 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-4 text-[10px] font-mono text-slate-400 bg-black/50 px-3 py-1 rounded-md border border-white/5 truncate max-w-md">{showPreviewModal}</span>
                </div>
                <button onClick={() => setShowPreviewModal(null)} className="p-2 bg-white/5 hover:bg-rose-500 text-slate-400 hover:text-white rounded-full transition-colors"><X size={16}/></button>
              </div>
              <iframe src={showPreviewModal} className="w-full flex-1 bg-white" title="Invite Preview" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}