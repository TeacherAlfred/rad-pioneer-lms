"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Cpu, Gamepad2, Sparkles, CheckCircle2, AlertTriangle, Lock, TrendingUp,
  ChevronRight, ShieldCheck, Clock, Loader2, Target, Users, Minus, Plus, X, UserPlus,
  ChevronDown, ChevronUp, Star, MessageSquareHeart, ChevronLeft, Edit2, ArrowRight, Share2, Check,
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
  const [isCompleting, setIsCompleting] = useState(false);
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
  
  // Scroll States
  const [isAtBottomStep1, setIsAtBottomStep1] = useState(false);
  const [step3ScrollPos, setStep3ScrollPos] = useState({ isTop: true, isBottom: false });
  const step3ScrollRef = useRef<HTMLDivElement>(null);

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

  const handleNextStep1 = async () => {
    if (!parentName || !email || !phone || numKids < 1) return alert("Please complete all guardian details.");

    try {
      const updatedMeta = { ...prospectData.metadata, form_progress: 'Guardian Details Completed', last_active: new Date().toISOString() };
      await supabase.from('prospects').update({ 
        name: parentName, 
        email: email, 
        phone: phone,
        metadata: updatedMeta
      }).eq('id', inviteId);
      
      setProspectData({ ...prospectData, name: parentName, email: email, phone: phone, metadata: updatedMeta });
    } catch (e) {
      console.error("Auto-save failed", e);
    }

    const newChildren = [...children];
    if (numKids > children.length) {
      for (let i = children.length; i < numKids; i++) newChildren.push({ id: Date.now().toString() + i, name: '', dob: '', codingAtSchool: 'No' });
    } else if (numKids < children.length) newChildren.splice(numKids);
    setChildren(newChildren);
    setActiveChildTab(newChildren[0].id);
    setWizardStep(2);
  };

  const handleNextStep2 = () => {
    const validChildren = children.filter(c => c.name.trim() !== "");
    if (validChildren.length !== numKids) return alert("Please provide the names for all your children.");
    
    // Reset scroll state for Step 3
    setStep3ScrollPos({ isTop: true, isBottom: false });
    setWizardStep(3); 
    trackProgress('Student Details Completed');
  };

  const updateChild = (id: string, field: 'name' | 'dob' | 'codingAtSchool', value: string) => {
    setChildren(children.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const generateToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length: 24}).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const scrollStep3Down = () => {
    if (step3ScrollRef.current) {
      step3ScrollRef.current.scrollBy({ top: 180, behavior: 'smooth' });
    }
  };

  const scrollStep3Up = () => {
    if (step3ScrollRef.current) {
      step3ScrollRef.current.scrollBy({ top: -180, behavior: 'smooth' });
    }
  };

  // --- THE MASTER SUBMISSION ENGINE (Handles both paths & creates user profiles!) ---
  const handleComplete = async (path: 'fast-track' | 'trial') => {
    setIsCompleting(true);
    const validChildren = children.filter(c => c.name.trim() !== "");

    try {
      const today = new Date();
      
      // Calculate Trial Dates for BOTH paths now
      const launchDate = new Date('2026-05-01T00:00:00');
      const trialStart = today > launchDate ? today : launchDate;
      let trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 14);
      if (prospectData?.metadata?.custom_trial_end) trialEnd = new Date(prospectData.metadata.custom_trial_end);

      const guardianId = crypto.randomUUID();
      const onboardingToken = generateToken();

      if (path === 'fast-track') {
        // ==========================================
        // PATH A: UPGRADE & FAST-TRACK (PLG Conversion)
        // ==========================================
        setChosenPath('fast-track');
        
        // 1. Create Guardian Profile (ACCOUNT_TIER: TRIAL - Wait for Payment to Upgrade)
        const guardianProfile = {
          id: guardianId, role: 'guardian', display_name: parentName, onboarding_token: onboardingToken,
          status: 'active', funnel_stage: 'Trial Active', payment_plan_preference: 'LMS Access',
          account_tier: 'trial', // <--- STILL TRIAL. Grants immediate Walled Garden access.
          metadata: JSON.stringify({ 
            email: email, 
            phone: phone, 
            booking_credits: 0,
            trial_start: trialStart.toISOString(), 
            trial_end: trialEnd.toISOString(),
            fast_track_pending: true // Tag them so admin knows to process upgrade upon payment
          })
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
          line_items: [{
            qty: numKids.toString(), desc: `LMS Access - ${activePricingTier.name}`, disc: 0, 
            note: "Self-paced LMS Access License", price: activePricingTier.price.toString(), item_id: activePricingTier.id
          }],
          metadata: {
            global_note: "Fast-Track Upgrade. Please pay this quote to officially secure your child's spot.", 
            prospect_name: parentName, 
            prospect_email: email 
          }
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
        
        const updatedMeta = { ...prospectData.metadata, children_data: children, converted_profile_id: guardianId, conversion_date: today.toISOString(), form_progress: 'Fast-Tracked' };
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
        
        // 1. Create Guardian Profile (ACCOUNT_TIER: TRIAL)
        const guardianProfile = {
          id: guardianId, 
          role: 'guardian', 
          display_name: parentName, 
          onboarding_token: onboardingToken,
          status: 'active', 
          funnel_stage: 'Trial Active', 
          account_tier: 'trial', // <--- GRANTS WALLED GARDEN ACCESS
          metadata: JSON.stringify({ email: email, phone: phone, trial_start: trialStart.toISOString(), trial_end: trialEnd.toISOString() })
        };

        // 2. Create Student Profiles
        const studentProfiles = validChildren.map((c: any) => ({
          id: crypto.randomUUID(), 
          role: 'student', 
          display_name: c.name, 
          linked_parent_id: guardianId,
          status: 'active', 
          metadata: JSON.stringify({ date_of_birth: c.dob, school_coding: c.codingAtSchool === 'Yes' })
        }));

        // 3. Save Trial Profiles to DB
        await supabase.from('profiles').insert([guardianProfile, ...studentProfiles]);

        const updatedMeta = { 
          ...prospectData.metadata, 
          children_data: children, 
          children: validChildren, 
          trial_start: trialStart.toISOString(),
          trial_end: trialEnd.toISOString(), 
          accepted_date: today.toISOString(), 
          form_progress: 'Completed Trial',
          converted_profile_id: guardianId // Link prospect to the new profile
        };

        await supabase.from('prospects').update({ name: parentName, email: email, phone: phone, status: 'Trial Active', metadata: updatedMeta }).eq('id', inviteId);
        
        fetch('/api/emails/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: 'trial',
            name: parentName,
            email: email,
            token: onboardingToken, // Pass the token so they can set a password!
            quoteId: inviteId 
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
      setIsCompleting(false);
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
            <span>Invest In Your</span>
            <span>Child's Future</span>
            <span className="text-[4vw] sm:text-3xl lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-900 mt-1 pb-1">
              At a Fraction of the Cost.
            </span>
          </h1>
            <p className="text-[15px] sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
              Stop worrying about expensive tutoring or passive screen time. We give your child the tools to become a creator in the digital economy through a fun, self-paced journey they actually enjoy.
            </p>
            <button onClick={handleOpenWizard} className="w-full sm:w-auto mt-4 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 group hover:-translate-y-1">
              Unlock Full Access <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
  {/* CARD 1: MENTAL EDGE / ACADEMIC IMPACT */}
  <div className="bg-white p-3 sm:p-4 rounded-3xl border border-blue-100 shadow-[0_10px_40px_-10px_rgba(37,99,235,0.2)] hover:shadow-[0_10px_40px_-10px_rgba(37,99,235,0.35)] hover:-translate-y-1 transition-all duration-300 flex items-stretch gap-4 sm:gap-5">
    <div className="bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 w-[28%] max-w-[100px] min-h-[90px]">
      <Cpu className="w-[65%] h-[65%] opacity-90 drop-shadow-sm" strokeWidth={1.5} />
    </div>
    <div className="text-left flex flex-col justify-center flex-1 py-2 pr-2">
      <h3 className="font-black text-slate-900 tracking-tight leading-tight mb-1 sm:mb-1.5 text-base sm:text-lg">Give Them a Mental Edge</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
        Coding teaches your child to handle frustration and think logically - transferable skills that improve their focus and performance in <strong>STEM subjects</strong>.
      </p>
    </div>
  </div>
  
  {/* CARD 2: PRODUCTIVE HOBBY / SCREEN TIME TRANSFORMATION */}
  <div className="bg-white p-3 sm:p-4 rounded-3xl border border-emerald-100 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.2)] hover:shadow-[0_10px_40px_-10px_rgba(16,185,129,0.35)] hover:-translate-y-1 transition-all duration-300 flex items-stretch gap-4 sm:gap-5">
    <div className="bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 w-[28%] max-w-[100px] min-h-[90px]">
      <Gamepad2 className="w-[65%] h-[65%] opacity-90 drop-shadow-sm" strokeWidth={1.5} />
    </div>
    <div className="text-left flex flex-col justify-center flex-1 py-2 pr-2">
      <h3 className="font-black text-slate-900 tracking-tight leading-tight mb-1 sm:mb-1.5 text-base sm:text-lg">Productive Screen Time</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
        Transform <strong>"mindless scrolling"</strong> into a high-value hobby. Watch them build their own robotic solutions, digital worlds and games instead of being passive consumers.
      </p>
    </div>
  </div>

  {/* CARD 3: FUTURE CAREER / GLOBAL SKILLS */}
  <div className="bg-white p-3 sm:p-4 rounded-3xl border border-indigo-100 shadow-[0_10px_40px_-10px_rgba(79,70,229,0.2)] hover:shadow-[0_10px_40px_-10px_rgba(79,70,229,0.35)] hover:-translate-y-1 transition-all duration-300 flex items-stretch gap-4 sm:gap-5">
    <div className="bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 w-[28%] max-w-[100px] min-h-[90px]">
      <TrendingUp className="w-[65%] h-[65%] opacity-90 drop-shadow-sm" strokeWidth={1.5} />
    </div>
    <div className="text-left flex flex-col justify-center flex-1 py-2 pr-2">
      <h3 className="font-black text-slate-900 tracking-tight leading-tight mb-1 sm:mb-1.5 text-base sm:text-lg">Future-Proof Their Career</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
        Equip them with the most in-demand skill on the planet. Whether they become engineers or entrepreneurs, <strong>digital skills</strong> are the "new literacy" they need to succeed in the 21st Century.
      </p>
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
                    Unlock Full Access <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <div className="text-center flex items-center justify-center gap-1.5 text-slate-400">
                    <ShieldCheck size={12}/> <span className="text-[9px] font-bold uppercase tracking-widest">No Credit Card Required</span>
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
                          <p className="text-[10px] text-slate-500 leading-relaxed">A secure link to set your parent password and unlock the Trial Portal while we process your upgrade.</p>
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              key={`step${wizardStep}`}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="flex flex-col relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden max-h-[85vh]"
            >
              
              {/* =========================================
                  STEP 1: GUARDIAN DETAILS
                  ========================================= */}
              {wizardStep === 1 && (
                <>
                  <div className="shrink-0 pt-8 px-8 pb-4 bg-white z-20">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-3">
                          <Lock size={10} /> VIP Spot Temporarily Reserved
                        </div>
                        <h2 className="text-2xl font-black italic tracking-tighter text-slate-900 leading-none uppercase">
                          Identity Verification
                        </h2>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">Step 1/3</span>
                      </div>
                    </div>
                  </div>

                  <div 
                    className="flex-1 overflow-y-auto no-scrollbar px-8 pb-24 relative"
                    onScroll={(e) => {
                      const target = e.target as HTMLElement;
                      setIsAtBottomStep1(target.scrollHeight - target.scrollTop <= target.clientHeight + 20);
                    }}
                  >
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-5">
                      <div className="relative group focus-within:bg-blue-50/30 transition-colors border-b border-slate-100 p-3 pl-4">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-blue-600 mb-0.5 block transition-colors">
                          Legal Guardian Name
                        </label>
                        <input 
                          type="text" 
                          value={parentName} 
                          onChange={e => setParentName(e.target.value)}
                          className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-300 placeholder:font-medium"
                          placeholder="As it appears on official documents"
                        />
                      </div>
                      <div className="relative group focus-within:bg-blue-50/30 transition-colors border-b border-slate-100 p-3 pl-4">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-blue-600 mb-0.5 block transition-colors">
                          Your Email Address
                        </label>
                        <input 
                          type="email" 
                          value={email} 
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-300 placeholder:font-medium"
                          placeholder="For billing & portal access"
                        />
                      </div>
                      <div className="relative group focus-within:bg-blue-50/30 transition-colors p-3 pl-4">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-blue-600 mb-0.5 block transition-colors">
                          Mobile Number
                        </label>
                        <input 
                          type="tel" 
                          value={phone} 
                          onChange={e => setPhone(e.target.value)}
                          className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-300 placeholder:font-medium"
                          placeholder="For urgent portal SMS updates"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between mb-8">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Student Profiles</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">Licenses required?</p>
                        <p className="text-[9px] font-bold text-blue-500 mt-1 bg-blue-500/10 w-fit px-1.5 py-0.5 rounded">1 License = 1 Child</p>
                      </div>
                      <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0">
                        <button 
                          type="button" 
                          onClick={() => setNumKids(Math.max(1, numKids - 1))}
                          disabled={numKids <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-3 text-center font-black text-slate-900 text-sm">{numKids}</span>
                        <button 
                          type="button" 
                          onClick={() => setNumKids(Math.min(5, numKids + 1))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`absolute bottom-[100px] left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none flex items-end justify-center pb-2 transition-opacity duration-300 z-10 ${isAtBottomStep1 ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm border border-slate-100 animate-bounce text-slate-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-6 pt-4 bg-gradient-to-t from-white via-white to-white/90 backdrop-blur-sm z-20 flex gap-3">
                    <button 
                      onClick={() => setWizardStep(0)}
                      className="w-14 h-[52px] bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                    >
                      <X size={20} />
                    </button>
                    <button 
                      onClick={handleNextStep1}
                      className="flex-1 bg-slate-900 text-white rounded-2xl h-[52px] text-xs font-black uppercase tracking-widest hover:bg-slate-800 flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
                    >
                      Confirm Identity & Continue <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="absolute bottom-1 left-0 right-0 flex justify-center items-center gap-1.5 pb-2 text-slate-400 z-20 pointer-events-none">
                    <ShieldCheck size={12} />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em]">Secure 256-Bit SSL Encryption</span>
                  </div>
                </>
              )}

              {/* =========================================
                  STEP 2: STUDENT DETAILS
                  ========================================= */}
              {wizardStep === 2 && (
                <>
                  <div className="shrink-0 pt-8 px-8 pb-4 bg-white z-20">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-3">
                          <Sparkles size={10} /> Personalize Experience
                        </div>
                        <h2 className="text-2xl font-black italic tracking-tighter text-slate-900 leading-none uppercase">
                          Student Details
                        </h2>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">Step 2/3</span>
                      </div>
                    </div>

                    {children.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {children.map((c, i) => (
                          <button
                            key={c.id}
                            onClick={() => setActiveChildTab(c.id)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeChildTab === c.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                            Student {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-24 relative">
                    {children.map((child, index) => child.id === activeChildTab && (
                      <div key={child.id} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="relative group focus-within:bg-blue-50/30 transition-colors border-b border-slate-100 p-3 pl-4">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-blue-600 mb-0.5 block transition-colors">
                              First Name *
                            </label>
                            <input 
                              type="text" 
                              value={child.name} 
                              onChange={e => {
                                const newChildren = [...children];
                                newChildren[index].name = e.target.value;
                                setChildren(newChildren);
                              }}
                              className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-300 placeholder:font-medium"
                              placeholder="e.g. Leo"
                            />
                          </div>
                          <div className="relative group focus-within:bg-blue-50/30 transition-colors p-3 pl-4">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-blue-600 mb-0.5 block transition-colors">
                              Date of Birth (Optional)
                            </label>
                            <input 
                              type="date" 
                              value={child.dob} 
                              onChange={e => {
                                const newChildren = [...children];
                                newChildren[index].dob = e.target.value;
                                setChildren(newChildren);
                              }}
                              className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-300 [color-scheme:light]"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">Does this student do coding at school?</p>
                          <div className="flex bg-slate-200/60 p-1 rounded-xl">
                            <button
                              onClick={() => {
                                const newChildren = [...children];
                                newChildren[index].codingAtSchool = 'Yes';
                                setChildren(newChildren);
                              }}
                              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${child.codingAtSchool === 'Yes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => {
                                const newChildren = [...children];
                                newChildren[index].codingAtSchool = 'No';
                                setChildren(newChildren);
                              }}
                              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${child.codingAtSchool === 'No' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-6 pt-4 bg-gradient-to-t from-white via-white to-white/90 backdrop-blur-sm z-20 flex gap-3">
                    <button 
                      onClick={() => setWizardStep(1)}
                      className="w-14 h-[52px] bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={handleNextStep2}
                      className="flex-1 bg-slate-900 text-white rounded-2xl h-[52px] text-xs font-black uppercase tracking-widest hover:bg-slate-800 flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
                    >
                      Save & Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}

              {/* =========================================
                  STEP 3: FINAL SELECTION (RE-ENGINEERED)
                  ========================================= */}
              {wizardStep === 3 && (
                <>
                  <div className="shrink-0 pt-8 px-8 pb-4 bg-white z-20">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-3">
                          <CheckCircle2 size={10} /> Final Step
                        </div>
                        <h2 className="text-2xl font-black italic tracking-tighter text-slate-900 leading-none uppercase">
                          Select Access Path
                        </h2>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">Step 3/3</span>
                      </div>
                    </div>
                  </div>

                  {/* Scroll Up Button Indicator */}
                  <div className={`absolute top-28 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent pointer-events-none flex items-start justify-center pt-2 transition-opacity duration-300 z-30 ${step3ScrollPos.isTop ? 'opacity-0' : 'opacity-100'}`}>
                    <button onClick={scrollStep3Up} className="pointer-events-auto bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 text-slate-500 hover:text-blue-600 transition-colors">
                      <ChevronUp size={16} />
                    </button>
                  </div>

                  {/* Scrollable Form Content */}
                  <div 
                    ref={step3ScrollRef}
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      setStep3ScrollPos({
                        isTop: target.scrollTop <= 10,
                        isBottom: target.scrollHeight - target.scrollTop <= target.clientHeight + 20
                      });
                    }}
                    className="flex-1 overflow-y-auto no-scrollbar px-8 pb-10 relative space-y-4"
                  >
                    
                    {/* FAST TRACK CARD (The "Pro" Tier) */}
                    <div className="bg-slate-900 rounded-3xl p-1 relative overflow-hidden shadow-2xl shadow-slate-900/20 mt-2">
                      <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-xl z-10 shadow-sm">
                        Most Popular
                      </div>
                      <div className="bg-slate-800/60 rounded-[28px] p-6 border border-slate-700">
                         <h3 className="text-white font-black italic text-xl uppercase tracking-tighter">Secure Your Status</h3>
                         <p className="text-slate-400 text-[11px] font-medium mt-1 leading-relaxed">Lock in your lifetime discount today and skip the administrative queue. Perfect for parents ready to start the transformation immediately.</p>
                         
                         <ul className="mt-5 space-y-2.5 mb-6">
                           <li className="flex items-start gap-2.5 text-[11px] font-bold text-slate-300">
                             <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5"/> Priority Platform Access
                           </li>
                           <li className="flex items-start gap-2.5 text-[11px] font-bold text-slate-300">
                             <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5"/> Permanent LMS Access Discount*
                           </li>
                           <li className="flex items-start gap-2.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20"><Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5"/>EXCLUSIVE: Free 1-on-1 Online "Kickstart" session to ensure your child hits the ground running!</li>
                         </ul>

                         {/* Upgraded CTA */}
                         <button 
                           onClick={() => handleComplete('fast-track')} 
                           disabled={isCompleting} 
                           className="w-full bg-amber-500 text-slate-900 rounded-xl py-4 text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-colors flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-[0.98]"
                         >
                           {isCompleting ? <Loader2 className="animate-spin" size={18}/> : 'Unlock Fast-Track & Claim Bonuses'}
                         </button>
                      </div>
                    </div>

                    {/* STANDARD TRIAL CARD (Repositioned as the downgrade option) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 mt-4">
                       <h3 className="text-slate-600 font-black italic text-sm uppercase tracking-tighter">14-Day Full Access Trial</h3>
                       <p className="text-slate-500 text-[10px] font-medium mt-1 mb-4 leading-relaxed">Get 14 days of full access to one of our courses to test the waters before deciding. Standard rates apply post-trial.</p>
                       
                       <button 
                         onClick={() => handleComplete('trial')} 
                         disabled={isCompleting} 
                         className="w-full bg-white border border-slate-300 text-slate-600 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex justify-center items-center gap-2 active:scale-[0.98]"
                       >
                         {isCompleting ? <Loader2 className="animate-spin" size={14}/> : 'Start Free Trial Instead'}
                       </button>
                    </div>

                    {/* Simple text back button */}
                    <div className="pt-2 pb-6 text-center">
                      <button 
                        onClick={() => setWizardStep(2)} 
                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto transition-colors"
                      >
                        <ChevronLeft size={12}/> Back to Student Details
                      </button>
                    </div>

                  </div>

                  {/* Scroll Down Button Indicator */}
                  <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white to-transparent pointer-events-none flex items-end justify-center pb-6 transition-opacity duration-300 z-30 ${step3ScrollPos.isBottom ? 'opacity-0' : 'opacity-100'}`}>
                    <button onClick={scrollStep3Down} className="pointer-events-auto bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 animate-bounce text-slate-500 hover:text-blue-600 transition-colors">
                      <ChevronDown size={16} />
                    </button>
                  </div>

                </>
              )}

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
              <span className="text-sm font-black text-slate-900 tracking-tight">Click here to read some reviews from our parents.</span>
              <MessageSquareHeart size={18} className="text-rose-500" />
            </div>
          </button>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-6 sm:p-8 md:p-10 rounded-[32px] md:rounded-[40px] text-white shadow-2xl relative overflow-hidden mb-12">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Target size={120}/></div>
          <div className="relative z-10">
            <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-300 mb-4 inline-block">Action-Taker's Pricing</span>
            <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight mb-4">Why is this subsidized?</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Our mission is to make digital skills education accessible to every African home. We've dropped the price to make this a "no-brainer" for you, provided you help us keep your child <strong className="text-white">engaged and consistent.</strong>
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5"/><span className="text-sm font-medium text-slate-300">Start with a completely free <strong className="text-white">14-Day Full Course Access Trial</strong>.</span></li>
              <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5"/><span className="text-sm font-medium text-slate-300">Upgrade anytime during the trial. Your paid months only begin <strong className="text-white">after your trial ends</strong>.</span></li>
              <li className="flex items-start gap-3"><AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5"/><span className="text-sm font-medium text-slate-300">To keep the discount, ensure your child completes at least <strong className="text-white">one lesson per week</strong>. We reward consistency, not just sign-ups.</span></li>
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