"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Cpu, Gamepad2, Sparkles, CheckCircle2, AlertTriangle,
  ChevronRight, ShieldCheck, Clock, Loader2, Target, Users, Plus, X, UserPlus,
  ChevronDown, Star, MessageSquareHeart, ChevronLeft, Edit2, ArrowRight, Share2, Check,
  CreditCard, GraduationCap, Zap, Mail, CalendarDays
} from "lucide-react";
import confetti from "canvas-confetti";

export default function VIPInvitePage() {
  const params = useParams();
  const inviteId = params.id as string;

  const [loading, setLoading] = useState(true);
  
  // Data State
  const [prospectData, setProspectData] = useState<any>(null);
  const [isReferral, setIsReferral] = useState(false);

  // Wizard & Upsell State
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [chosenPath, setChosenPath] = useState<'trial' | 'fast-track' | null>(null);
  
  // Dynamic Pricing State
  const [activePricingTier, setActivePricingTier] = useState({ name: 'Tier 1', price: 250, id: 'b2aae4aa-0c84-4673-9fe1-3e61895626d1' });

  // Form State
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [numKids, setNumKids] = useState<number>(1);
  const [editingField, setEditingField] = useState<'name' | 'email' | 'phone' | null>(null);

  // Multi-Child State
  const [children, setChildren] = useState([{ id: '1', name: '', dob: '', codingAtSchool: 'No' }]);
  const [activeChildTab, setActiveChildTab] = useState('1');

  // FAQ & Review State
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showReviews, setShowReviews] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (inviteId) fetchInviteData();
  }, [inviteId]);

  async function fetchInviteData() {
    try {
      // 1. Fetch Invite
      const { data, error } = await supabase.from('prospects').select('*').eq('id', inviteId).single();
      if (error || !data) throw new Error("Invite not found");
      
      setProspectData(data);
      setParentName(data.name || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");

      // 2. Silently calculate active tier based on converted leads
      const { count } = await supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('status', 'Converted (Won)');
      const convertedCount = count || 0;
      
      if (convertedCount >= 10 && convertedCount < 20) {
        setActivePricingTier({ name: 'Tier 2', price: 350, id: 'd696d727-3e94-4325-98d9-e8a89277338a' });
      } else if (convertedCount >= 20) {
        setActivePricingTier({ name: 'Tier 3', price: 450, id: 'd86b5577-a8ec-4bd8-a27d-b454e79ca742' });
      }

    } catch (err) {
      console.error("Invite fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const trackProgress = async (stepName: string) => {
    if (!prospectData) return; 
    try {
      const updatedMeta = { ...prospectData.metadata, form_progress: stepName, last_active: new Date().toISOString() };
      await supabase.from('prospects').update({ metadata: updatedMeta }).eq('id', inviteId);
      setProspectData({ ...prospectData, metadata: updatedMeta });
    } catch (err) {
      console.error("Telemetry failed", err);
    }
  };

  const handleOpenWizard = () => {
    setWizardStep(1);
    trackProgress('Form Opened');
  };

  const handleNextStep1 = () => {
    if (!parentName || !email || !phone || numKids < 1) return alert("Please complete all guardian details.");
    const newChildren = [...children];
    if (numKids > children.length) {
      for (let i = children.length; i < numKids; i++) newChildren.push({ id: Date.now().toString() + i, name: '', dob: '', codingAtSchool: 'No' });
    } else if (numKids < children.length) newChildren.splice(numKids);
    setChildren(newChildren);
    setActiveChildTab(newChildren[0].id);
    setWizardStep(2);
    trackProgress('Guardian Details Completed');
  };

  const handleNextStep2 = () => {
    const validChildren = children.filter(c => c.name.trim() !== "");
    if (validChildren.length !== numKids) return alert("Please provide the names for all your children.");
    setWizardStep(3); // Go to Upsell Step
    trackProgress('Student Details Completed');
  };

  const updateChild = (id: string, field: 'name' | 'dob' | 'codingAtSchool', value: string) => {
    setChildren(children.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const generateToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length: 24}).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // --- THE MASTER SUBMISSION ENGINE (Handles both paths) ---
  const handleFinalSubmit = async (isUpsellAccepted: boolean) => {
    setIsSubmitting(true);
    const validChildren = children.filter(c => c.name.trim() !== "");

    try {
      const today = new Date();
      
      if (isUpsellAccepted) {
        // ==========================================
        // PATH A: UPGRADE & FAST-TRACK (PLG Conversion)
        // ==========================================
        setChosenPath('fast-track');

        const guardianId = crypto.randomUUID();
        const onboardingToken = generateToken();
        
        // 1. Create Guardian Profile
        const guardianProfile = {
          id: guardianId, role: 'guardian', display_name: parentName, onboarding_token: onboardingToken,
          status: 'active', funnel_stage: 'Active (Paid Client)', payment_plan_preference: 'LMS Access',
          metadata: JSON.stringify({ email: email, phone: phone, booking_credits: 0 })
        };

        // 2. Create Student Profiles
        const studentProfiles = validChildren.map((c: any) => ({
          id: crypto.randomUUID(), role: 'student', display_name: c.name, linked_parent_id: guardianId,
          status: 'active', metadata: JSON.stringify({ date_of_birth: c.dob, school_coding: c.codingAtSchool === 'Yes' })
        }));

        // 3. Generate Quote
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 1);
        expiryDate.setHours(23, 59, 59, 999);
        const invoiceNumber = Math.floor(Date.now() / 1000);
        
        const quotationRecord = {
          id: crypto.randomUUID(), invoice_number: invoiceNumber, payment_reference: `2026${invoiceNumber}`,
          guardian_id: guardianId, total_amount: (activePricingTier.price * numKids).toString(),
          status: 'pending', doc_type: 'quote', expires_at: expiryDate.toISOString(), amount_paid: "0",
          line_items: JSON.stringify([{
            qty: numKids.toString(), desc: `LMS Access - ${activePricingTier.name}`, disc: 0, 
            note: "Self-paced LMS Access License", price: activePricingTier.price.toString(), item_id: activePricingTier.id
          }]),
          metadata: JSON.stringify({ global_note: "Fast-Track Upgrade. Please pay this quote to officially secure your child's spot.", prospect_name: parentName, prospect_email: email })
        };

        // 4. Execute Referral Bonus
        if (prospectData.metadata?.referred_by_id) {
          const { data: refProspect } = await supabase.from('prospects').select('status, metadata').eq('id', prospectData.metadata.referred_by_id).single();
          if (refProspect?.status === 'Converted (Won)' && refProspect.metadata?.converted_profile_id) {
            const { data: refProfile } = await supabase.from('profiles').select('metadata').eq('id', refProspect.metadata.converted_profile_id).single();
            if (refProfile) {
              const refMeta = typeof refProfile.metadata === 'string' ? JSON.parse(refProfile.metadata) : (refProfile.metadata || {});
              refMeta.booking_credits = (refMeta.booking_credits || 0) + 1;
              await supabase.from('profiles').update({ metadata: JSON.stringify(refMeta) }).eq('id', refProspect.metadata.converted_profile_id);
            }
          }
        }

        // 5. Save to DB
        await supabase.from('profiles').insert([guardianProfile, ...studentProfiles]);
        await supabase.from('billing_records').insert([quotationRecord]);
        
        const updatedMeta = { ...prospectData.metadata, converted_profile_id: guardianId, conversion_date: today.toISOString(), form_progress: 'Fast-Tracked' };
        await supabase.from('prospects').update({ name: parentName, email: email, phone: phone, status: 'Converted (Won)', metadata: updatedMeta }).eq('id', inviteId);

        fetch('/api/emails/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: 'fast-track',
            name: parentName,
            email: email,
            token: onboardingToken,
            quoteId: quotationRecord.id
          })
        });
        
        confetti({ particleCount: 300, spread: 120, origin: { y: 0.6 }, colors: ['#f59e0b', '#10b981', '#3b82f6'] });

      } else {
        // ==========================================
        // PATH B: 14-DAY FREE TRIAL
        // ==========================================
        setChosenPath('trial');

        const launchDate = new Date('2026-05-01T00:00:00');
        const trialStart = today > launchDate ? today : launchDate;
        let trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 14);
        
        if (prospectData?.metadata?.custom_trial_end) trialEnd = new Date(prospectData.metadata.custom_trial_end);

        const updatedMeta = { 
          ...prospectData.metadata, children: validChildren, trial_start: trialStart.toISOString(),
          trial_end: trialEnd.toISOString(), accepted_date: today.toISOString(), form_progress: 'Completed Trial'
        };

        await supabase.from('prospects').update({ name: parentName, email: email, phone: phone, status: 'Trial Active', metadata: updatedMeta }).eq('id', inviteId);
        
        fetch('/api/emails/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: 'trial',
            name: parentName,
            email: email,
            quoteId: inviteId // Passing prospect ID so they can set up the trial
          })
        });

        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#3b82f6', '#6366f1'] });
      }

      setIsSuccess(true);
      setWizardStep(0);

    } catch (err: any) {
      console.error(err);
      alert("Something went wrong. Please try again or contact support.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/referral/${inviteId}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const scrollToForm = () => document.getElementById('claim-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const faqs = [
    { q: "Do I need to enter credit card details for the trial?", a: "No! The 14-day trial is completely free and requires zero payment details. You only pay if you explicitly choose to upgrade after seeing the value." },
    { q: "When does my paid month start if I upgrade early?", a: "If you upgrade during your 14-day trial, your paid access only begins after your trial ends. You don't lose any of your free days!" },
    { q: "What is the Bonus Offer mentioned?", a: "If you decide to pay upfront for 4 months, we will gift you 1 completely free 1-on-1 private coaching session, PLUS an extra 1 month of LMS Access added to your account for free." },
    { q: "How does the Refer-a-Friend 1-on-1 lesson work?", a: "Once you secure your access, you'll receive a personal invite link to share with friends. If a friend signs up using your link, and BOTH of you eventually upgrade to a paid license after your trials, you will BOTH be automatically credited with a free 1-on-1 private online coding lesson!" }
  ];

  const reviewImages = [
    "https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/reviews/Screenshot_20260129_143852.jpg",
    "https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/reviews/Screenshot_20260210_094654_edit_76061668599851.jpg",
    "https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/reviews/review_sb.jpg",
    "https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/reviews/Screenshot_20260428_141204.jpg"
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafcff] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verifying Secure Invite...</span>
      </div>
    );
  }

  if (!prospectData && !loading) {
    return (
      <div className="min-h-screen bg-[#fafcff] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <X size={48} className="text-rose-500 mx-auto" />
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Invite Expired or Invalid</h2>
        </div>
      </div>
    );
  }

  const InlineEditField = ({ label, value, field, type = "text" }: { label: string, value: string, field: 'name'|'email'|'phone', type?: string }) => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition-colors hover:bg-slate-100">
      <div className="flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        {editingField === field ? (
          <input 
            autoFocus type={type} value={value}
            onChange={(e) => {
              if(field === 'name') setParentName(e.target.value);
              if(field === 'email') setEmail(e.target.value);
              if(field === 'phone') setPhone(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
            className="w-full bg-transparent font-bold text-slate-900 focus:outline-none border-b border-blue-500 pb-0.5"
          />
        ) : (
          <p className={`font-bold ${value ? 'text-slate-900' : 'text-slate-400 italic'}`}>{value || `Tap to add ${label.toLowerCase()}`}</p>
        )}
      </div>
      <button 
        type="button" onClick={() => setEditingField(editingField === field ? null : field)}
        className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm shrink-0"
      >
        {editingField === field ? <Check size={14} className="text-emerald-500"/> : <Edit2 size={14} />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafcff] text-slate-900 font-sans selection:bg-blue-500/30 overflow-x-hidden pb-12">
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10 pointer-events-none" />
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <header className="max-w-6xl mx-auto px-5 py-6 md:px-12 flex justify-between items-center">
        <img src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png" alt="RAD Academy" className="h-7 sm:h-10 md:h-12" />
        <span className="px-3 py-1.5 sm:px-4 bg-blue-50 text-blue-600 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-blue-100 shadow-sm flex items-center gap-1.5 shrink-0">
          <Sparkles size={12}/> VIP Access
        </span>
      </header>

      <div className="max-w-6xl mx-auto px-5 md:px-12 pt-2 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
        
        <div className="lg:col-span-7 space-y-8 md:space-y-10">
          <div className="space-y-5 md:space-y-6">
            <h1 className="text-[8.5vw] sm:text-6xl font-black tracking-tighter uppercase italic leading-[0.9] text-slate-900 flex flex-col">
              <span>Future-Proof</span>
              <span>Your Child</span>
              <span className="text-[4vw] sm:text-3xl lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-800 mt-1 pb-1">
                Without Breaking The Bank.
              </span>
            </h1>
            <p className="text-[15px] sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
              With the rising cost of living, providing your child with premium education shouldn't have to suffer. We are turning screen time into skill time with our self-paced coding LMS.
            </p>
            <button onClick={handleOpenWizard} className="w-full sm:w-auto mt-4 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 group hover:-translate-y-1">
              Claim 14-Day Free Trial <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <div className="bg-white p-3 sm:p-4 rounded-3xl border border-blue-100 shadow-[0_10px_40px_-10px_rgba(37,99,235,0.2)] hover:shadow-[0_10px_40px_-10px_rgba(37,99,235,0.35)] hover:-translate-y-1 transition-all duration-300 flex items-stretch gap-4 sm:gap-5">
              <div className="bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 w-[28%] max-w-[100px] min-h-[90px]">
                <Cpu className="w-[65%] h-[65%] opacity-90 drop-shadow-sm" strokeWidth={1.5} />
              </div>
              <div className="text-left flex flex-col justify-center flex-1 py-2 pr-2">
                <h3 className="font-black text-slate-900 tracking-tight leading-tight mb-1 sm:mb-1.5 text-base sm:text-lg">Critical Problem Solving</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">Coding forces kids to break down complex problems into manageable, logical steps.</p>
              </div>
            </div>
            
            <div className="bg-white p-3 sm:p-4 rounded-3xl border border-emerald-100 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.2)] hover:shadow-[0_10px_40px_-10px_rgba(16,185,129,0.35)] hover:-translate-y-1 transition-all duration-300 flex items-stretch gap-4 sm:gap-5">
              <div className="bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 w-[28%] max-w-[100px] min-h-[90px]">
                <Gamepad2 className="w-[65%] h-[65%] opacity-90 drop-shadow-sm" strokeWidth={1.5} />
              </div>
              <div className="text-left flex flex-col justify-center flex-1 py-2 pr-2">
                <h3 className="font-black text-slate-900 tracking-tight leading-tight mb-1 sm:mb-1.5 text-base sm:text-lg">Creators, Not Consumers</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">Shift them from just playing games to understanding how to build them.</p>
              </div>
            </div>
          </div>
        </div>

        <div id="claim-section" className="lg:col-span-5 relative scroll-mt-6">
          <div className="bg-white border border-slate-200 shadow-2xl shadow-blue-900/5 rounded-[32px] p-6 sm:p-8 relative lg:sticky lg:top-10">
            
            {!isSuccess ? (
              <>
                <div className="text-center mb-6 sm:mb-8 border-b border-slate-100 pb-6">
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-100"><ShieldCheck size={20}/></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic leading-tight">VIP Access Invite<br/><span className="text-blue-600">Exclusively for {prospectData.name.split(' ')[0]}</span></h3>
                  </div>
                </div>

                <div className="mb-6 sm:mb-8 space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none"><Sparkles size={60} className="text-emerald-500" /></div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-md"><Sparkles size={16}/></div>
                    <div className="relative z-10 pt-0.5">
                      <p className="text-sm sm:text-base font-black text-emerald-700 uppercase tracking-tight leading-none mb-1">14 Days Completely Free</p>
                      <p className="text-[10px] sm:text-xs font-bold text-emerald-600/80 leading-snug">Your trial gives you full access instantly. The discounted rates below only apply <span className="underline">after</span> your 2 weeks are up.</p>
                    </div>
                  </div>

                  <button onClick={handleOpenWizard} className="w-full px-8 py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 group hover:-translate-y-1">
                    Claim 14-Day Free Trial <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <div className="text-center flex items-center justify-center gap-1.5 text-slate-400">
                    <ShieldCheck size={12}/> <span className="text-[9px] font-bold uppercase tracking-widest">No Credit Card Required</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 pt-4">
                    <Clock size={12}/> Post-Trial Rates (First Come, First Served)
                  </p>
                  <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-3">
                    <div className="text-left">
                      <p className="text-sm sm:text-base font-black text-slate-900 leading-none">Tier 1</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-500">First 10 Licenses</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-blue-600 italic tracking-tighter">R250<span className="text-xs sm:text-sm text-blue-400 not-italic tracking-normal">/mo</span></p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border border-slate-200 rounded-2xl p-4 opacity-60">
                    <div className="text-left">
                      <p className="text-sm sm:text-base font-black text-slate-900 leading-none">Tier 2</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-500">Next 10 Licenses</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900 italic tracking-tighter">R350<span className="text-[10px] sm:text-xs text-slate-500 not-italic tracking-normal">/mo</span></p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
                
                {/* DYNAMIC SUCCESS SCREEN BASED ON PATH */}
                {chosenPath === 'fast-track' ? (
                  <>
                    <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner border border-amber-200"><Zap size={48} /></div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Fast-Track Activated!</h2>
                      <p className="text-slate-500 font-medium leading-relaxed mt-2">Welcome to RAD Academy. We have successfully secured your locked-in rate and created your platform profiles.</p>
                    </div>

                    <div className="text-left bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-2">What happens next?</h4>
                      
                      <div className="flex items-start gap-3">
                        <Mail size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">(1 of 3) Your RAD Quotation</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">Your discounted quote containing banking details to finalize payment.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Mail size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">(2 of 3) Welcome to RAD Academy!</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">A secure link to set your parent password and unlock the learning portal.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Mail size={16} className="text-fuchsia-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">(3 of 3) Book Your Free 1-on-1</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">A link to schedule your child's onboarding Teams session with a coach.</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner"><CheckCircle2 size={48} /></div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Trial Access Secured!</h2>
                      <p className="text-slate-500 font-medium leading-relaxed mt-2">Welcome to RAD Academy. We've locked in your VIP Trial.</p>
                    </div>

                    <div className="text-left bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-2">What happens next?</h4>
                      
                      <div className="flex items-start gap-3">
                        <Mail size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">(1 of 1) Trial Access Instructions</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed">An email with a secure link to set up your child's username and PIN to begin their 14 days of exploration.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden mt-4 text-left">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={80}/></div>
                    <div className="relative z-10">
                      <span className="px-2 py-1 bg-white/20 rounded text-[8px] font-black uppercase tracking-widest mb-2 inline-block">Win-Win Bonus</span>
                      <h4 className="text-lg font-black tracking-tight italic leading-tight mb-2">Claim your free 1-on-1 lesson!</h4>
                      <p className="text-xs text-blue-100 leading-relaxed mb-4">Share your personal invite link. If your friend claims a trial and you both eventually upgrade, you <strong className="text-white">BOTH</strong> get a free private coding lesson.*</p>
                      <button onClick={copyReferralLink} className="w-full py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-md group">
                        {shareCopied ? <><CheckCircle2 size={14} className="text-emerald-500"/> Link Copied!</> : <><Share2 size={14} /> Copy My Invite Link</>}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </div>

      {/* =========================================================
          WIZARD MODAL (Multi-step Form with PLG Upsell)
          ========================================================= */}
      <AnimatePresence>
        {wizardStep > 0 && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWizardStep(0)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-w-lg bg-white sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">
                    {wizardStep === 1 ? "Guardian Details" : wizardStep === 2 ? "Student Details" : "Fast-Track Upgrade"}
                  </h3>
                  <button onClick={() => setWizardStep(0)} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"><X size={14}/></button>
                </div>
                <div className="flex gap-2">
                  <div className="h-1.5 flex-1 bg-blue-600 rounded-full transition-all duration-500" />
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${wizardStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${wizardStep === 3 ? 'bg-amber-400' : 'bg-slate-200'}`} />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 text-right">Step {wizardStep} of 3</p>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
                
                {/* STEP 1: PARENT DETAILS */}
                {wizardStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <p className="text-sm font-medium text-slate-500 mb-6">Review your details below. Tap the pencil icon to edit.</p>
                    <InlineEditField label="Full Name" value={parentName} field="name" />
                    <InlineEditField label="Email Address" value={email} field="email" type="email" />
                    <InlineEditField label="Phone Number" value={phone} field="phone" type="tel" />
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-6">
                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-700 block mb-2">How many children are you signing up?</label>
                      <input type="number" min="1" max="5" value={numKids} onChange={e => setNumKids(parseInt(e.target.value) || 1)} className="w-full bg-white border border-blue-200 rounded-lg px-4 py-3 text-lg font-black text-blue-900 text-center focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-sm" />
                    </div>
                    
                    <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                      <button onClick={() => setWizardStep(0)} className="px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase tracking-widest text-xs transition-all">Cancel</button>
                      <button onClick={handleNextStep1} className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-xl">
                        Next: Student Details <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: STUDENT DETAILS */}
                {wizardStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <p className="text-sm font-medium text-slate-500 mb-2">Enter the details for your {numKids > 1 ? `${numKids} children` : 'child'}.</p>
                    {numKids > 1 && (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {children.map((child, i) => (
                          <button key={child.id} onClick={() => setActiveChildTab(child.id)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeChildTab === child.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                            Child {i + 1} {child.name ? `- ${child.name.split(' ')[0]}` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                    <AnimatePresence mode="wait">
                      <motion.div key={activeChildTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">First Name *</label>
                          <input autoFocus required type="text" placeholder="e.g. Leo" value={children.find(c => c.id === activeChildTab)?.name || ''} onChange={e => updateChild(activeChildTab, 'name', e.target.value)} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Date of Birth (Optional)</label>
                          <input type="date" value={children.find(c => c.id === activeChildTab)?.dob || ''} onChange={e => updateChild(activeChildTab, 'dob', e.target.value)} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-2">Do they do coding at school?</label>
                          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                            {['Yes', 'No'].map(opt => (
                              <button key={opt} type="button" onClick={() => updateChild(activeChildTab, 'codingAtSchool', opt)} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${children.find(c => c.id === activeChildTab)?.codingAtSchool === opt ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>{opt}</button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <button onClick={() => setWizardStep(1)} className="px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase tracking-widest text-xs transition-all">Back</button>
                      <button onClick={handleNextStep2} className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-xl">
                        Continue <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: THE PLG UPSELL */}
                {wizardStep === 3 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-inner">
                        <Zap size={28} className="fill-amber-500/20" />
                      </div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Want to skip the trial limits?</h3>
                      <p className="text-sm text-slate-500 mt-2 font-medium">Fast-track your setup today to lock in your discount instantly.</p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Sparkles size={80}/></div>
                      
                      <div className="relative z-10 space-y-4">
                        <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] font-black uppercase tracking-widest">Bonus Unlocked</span>
                        <p className="font-bold text-sm leading-relaxed">Upgrade today and receive a bonus: <br/><span className="text-amber-400"> 1-on-1 Teams Session</span> to help get your child up and running.</p>
                        
                        <div className="bg-black/30 rounded-xl border border-white/10 overflow-hidden mt-4">
                          <table className="w-full text-left">
                            <thead className="bg-black/20 text-[9px] font-black uppercase tracking-widest text-slate-400">
                              <tr>
                                <th className="px-4 py-2">Item</th>
                                <th className="px-4 py-2 text-center">Qty</th>
                                <th className="px-4 py-2 text-right">Total/mo</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm font-bold">
                              <tr>
                                <td className="px-4 py-3 border-b border-white/5">LMS Access - {activePricingTier.name}<br/><span className="text-[10px] text-slate-400 font-normal">R{activePricingTier.price} per student per month</span></td>
                                <td className="px-4 py-3 border-b border-white/5 text-center">{numKids}</td>
                                <td className="px-4 py-3 border-b border-white/5 text-right text-emerald-400">R{activePricingTier.price * numKids}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <button 
                        onClick={() => handleFinalSubmit(true)}
                        disabled={isSubmitting}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <><Zap size={16} className="fill-white/20"/> Yes, Upgrade & Fast-Track</>}
                      </button>
                      
                      <button 
                        onClick={() => handleFinalSubmit(false)}
                        disabled={isSubmitting}
                        className="w-full py-4 bg-white border-2 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center disabled:opacity-50"
                      >
                        No thanks, I'll stick to the free trial
                      </button>

                      <button 
                        onClick={() => setWizardStep(2)}
                        disabled={isSubmitting}
                        className="w-full py-3 mt-2 text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <ChevronLeft size={14} /> Back to Student Details
                      </button>
                    </div>

                  </motion.div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto px-5 md:px-12 pb-24 mt-8">
        <div className="flex justify-center mb-12">
          <button onClick={() => setShowReviews(true)} className="group relative px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 flex items-center gap-3 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex -space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center shrink-0"><Star size={12} className="text-blue-600 fill-blue-600"/></div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center shrink-0"><Star size={12} className="text-emerald-600 fill-emerald-600"/></div>
              <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center shrink-0"><Star size={12} className="text-blue-600 fill-blue-600"/></div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center shrink-0"><Star size={12} className="text-emerald-600 fill-emerald-600"/></div>
              <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center shrink-0"><Star size={12} className="text-purple-600 fill-purple-600"/></div>
            </div>
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-sm font-black text-slate-900 tracking-tight">See what parents are saying</span>
              <MessageSquareHeart size={18} className="text-rose-500" />
            </div>
          </button>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-6 sm:p-8 md:p-10 rounded-[32px] md:rounded-[40px] text-white shadow-2xl relative overflow-hidden mb-12">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Target size={120}/></div>
          <div className="relative z-10">
            <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-300 mb-4 inline-block">Action-Taker's Pricing</span>
            <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight mb-4">Why is it so affordable?</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">Those who get the most out of our platform are the ones who show up regularly. We are offering massive discounts, but they come with one condition: <strong className="text-white">Accountability.</strong></p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5"/><span className="text-sm font-medium text-slate-300">Start with a completely free <strong className="text-white">14-Day Full Access Trial</strong>.</span></li>
              <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5"/><span className="text-sm font-medium text-slate-300">Upgrade anytime during the trial. Your paid months only begin <strong className="text-white">after your trial ends</strong>.</span></li>
              <li className="flex items-start gap-3"><AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5"/><span className="text-sm font-medium text-slate-300">Maintain an average of doing <strong className="text-white">1 lesson per week</strong> to avoid forfeiting the discount.</span></li>
            </ul>
            <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start sm:items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center shrink-0 mt-1 sm:mt-0"><Sparkles size={16}/></div>
              <div>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-blue-300 mb-1">Bonus Offer</p>
                <p className="text-xs sm:text-sm font-bold text-white leading-tight">Pay for 4 months and get <span className="text-emerald-400">1 free 1-on-1 coaching session</span> PLUS get a <span className="text-emerald-400">1 month LMS Access gift voucher!</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mb-8"><h2 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">Frequently Asked Questions</h2></div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${openFaq === index ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
              <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full flex items-center justify-between p-5 md:p-6 text-left">
                <span className={`font-black tracking-tight pr-4 ${openFaq === index ? 'text-blue-600' : 'text-slate-900'}`}>{faq.q}</span>
                <ChevronDown size={20} className={`shrink-0 transition-transform duration-300 ${openFaq === index ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
              </button>
              <AnimatePresence>
                {openFaq === index && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-5 md:px-6 pb-6 pt-2 text-sm text-slate-600 leading-relaxed border-t border-slate-100">{faq.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showReviews && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReviews(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div><h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Parent Reviews</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Feedback from our community</p></div>
                <button onClick={() => setShowReviews(false)} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"><X size={16}/></button>
              </div>
              <div className="relative group flex-1 bg-slate-100 p-6 flex items-center justify-center overflow-hidden">
                <button onClick={() => setCurrentReviewIndex((prev) => (prev - 1 + reviewImages.length) % reviewImages.length)} className="absolute left-4 z-10 p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-lg text-slate-600 hover:bg-white hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"><ChevronLeft size={20} /></button>
                <button onClick={() => setCurrentReviewIndex((prev) => (prev + 1) % reviewImages.length)} className="absolute right-4 z-10 p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-lg text-slate-600 hover:bg-white hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"><ChevronRight size={20} /></button>
                <AnimatePresence mode="wait">
                  <motion.img key={currentReviewIndex} src={reviewImages[currentReviewIndex]} alt={`Parent Review ${currentReviewIndex + 1}`} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="max-w-full max-h-full object-contain rounded-2xl shadow-md" />
                </AnimatePresence>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-black/10 backdrop-blur-sm rounded-full">
                  {reviewImages.map((_, index) => <div key={index} className={`w-1.5 h-1.5 rounded-full transition-all ${currentReviewIndex === index ? 'bg-blue-600 w-3' : 'bg-white'}`}/>)}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}