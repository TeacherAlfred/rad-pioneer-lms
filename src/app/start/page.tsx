"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, ShieldCheck, Rocket, BrainCircuit, 
  CheckCircle2, Loader2, Lock, Play, Cpu, Linkedin, MessageSquare,
  Link, Mail
} from "lucide-react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";

// High-Impact Extracted Reviews
const REVIEWS = [
  {
    id: 1,
    text: "My daughter has built her digital skills to a futuristic level. She’s learned things I’ll never learn in my IT career.",
    author: "Tumelo Z.",
    role: "Chief Information Officer",
    platform: "LinkedIn",
    icon: <Linkedin size={12} className="text-[#0A66C2]" />
  },
  {
    id: 2,
    text: "It's trusting his ability for me that when it's a problem, he will find a solution. My son is participating in class and he was always shy. One lesson has made a huge difference.",
    author: "Solam Q.",
    role: "RAD Community",
    platform: "WhatsApp",
    icon: <MessageSquare size={12} className="text-[#25D366]" />
  },
  {
    id: 3,
    text: "He keeps saying today was the best day of his life. You had an amazing impact on him.",
    author: "Shaazia B",
    role: "RAD Community",
    platform: "WhatsApp",
    icon: <MessageSquare size={12} className="text-[#25D366]" />
  },
  {
    id: 4,
    text: "Creating safe spaces where learners feel seen, heard, and supported is what transforms bootcamps into life-changing experiences.",
    author: "Lizzie M.",
    role: "Educational Consultant",
    platform: "LinkedIn",
    icon: <Linkedin size={12} className="text-[#0A66C2]" />
  }
];

export default function PublicTrialSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeReview, setActiveReview] = useState(0);
  
  const [formData, setFormData] = useState({
    parentName: "",
    email: "",
    phone: "",
    childName: "",
    childAge: "",
  });

  // Auto-rotate reviews every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveReview((prev) => (prev + 1) % REVIEWS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const generateToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length: 24}).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const today = new Date();
      const launchDate = new Date('2026-05-01T00:00:00');
      const trialStart = today > launchDate ? today : launchDate;
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 14);

      const guardianId = crypto.randomUUID();
      const onboardingToken = generateToken();

      // 1. Create Trial Guardian Profile
      const guardianProfile = {
        id: guardianId, 
        role: 'guardian', 
        display_name: formData.parentName, 
        onboarding_token: onboardingToken,
        status: 'active', 
        funnel_stage: 'Active (LMS Access)',
        account_tier: 'lms_trial', 
        metadata: JSON.stringify({ 
          email: formData.email, 
          phone: formData.phone, 
          trial_start: trialStart.toISOString(), 
          trial_end: trialEnd.toISOString() 
        })
      };

      // 2. Create Student Profile
      const studentProfile = {
        id: crypto.randomUUID(), 
        role: 'student', 
        display_name: formData.childName, 
        linked_parent_id: guardianId,
        status: 'active', 
        metadata: JSON.stringify({ age: formData.childAge })
      };

      // 3. Save Profiles to DB
      const { error: profileError } = await supabase.from('profiles').insert([guardianProfile, studentProfile]);
      if (profileError) throw profileError;

      // 4. Create New Prospect Record
      const payload = {
        name: formData.parentName,
        email: formData.email,
        phone: formData.phone,
        status: 'Trial Active',
        source: 'Public Trial Form',
        metadata: {
          children: [{ name: formData.childName, age: formData.childAge }],
          children_data: [{ id: '1', name: formData.childName, age: formData.childAge }],
          trial_start: trialStart.toISOString(),
          trial_end: trialEnd.toISOString(),
          accepted_date: today.toISOString(),
          campaign: "Public Trial Offer",
          form_progress: 'Completed Trial',
          converted_profile_id: guardianId
        }
      };

      const { data, error: prospectError } = await supabase.from('prospects').insert([payload]).select().single();
      if (prospectError) throw prospectError;
      
      // 5. Send Welcome Email
      fetch('/api/emails/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'trial',
          name: formData.parentName,
          email: formData.email,
          token: onboardingToken,
          quoteId: data.id 
        })
      });

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setIsSuccess(true);

    } catch (error: any) {
      console.error("Submission Error:", error);
      alert(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-500/30 text-slate-900 flex flex-col relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-200/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 px-6 py-4 lg:py-6 lg:px-12 flex items-center justify-between max-w-7xl mx-auto w-full shrink-0">
        <div className="w-[100px] md:w-[130px]">
          <Image 
            src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png" 
            alt="RAD Academy" 
            width={130} height={45} 
            unoptimized 
          />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full shadow-sm">
          <Lock size={12} /> Secure Application
        </div>
      </header>

      {/* MAIN LAYOUT: Flexbox ensures Form is strictly on top for mobile */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-2 lg:py-8 flex flex-col lg:flex-row gap-10 lg:gap-16 items-start relative z-10">
        
        {/* === LEFT COLUMN: Media & Proof (Mobile: Bottom, Desktop: Left) === */}
        <div className="w-full lg:w-7/12 flex flex-col space-y-8 order-2 lg:order-1">
          
          {/* DESKTOP HOOK (Hidden on mobile to save space) */}
          <div className="hidden lg:block space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest">
              <Cpu size={14} /> Intake Now Open
            </div>
            <h1 className="text-[54px] font-black uppercase italic tracking-tighter text-slate-900 leading-[1.05]">
              Turn Their Screen Time Into A <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">Superpower.</span>
            </h1>
            <p className="text-base text-slate-600 leading-relaxed font-medium pr-8">
              Stop worrying about passive scrolling. Give your child the tools to build their own smart gadgets and develop future-proof skills—all in a safe, moderated environment.
            </p>
          </div>

          {/* Video Proof Banner */}
          <div className="relative rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] border-[6px] border-white bg-slate-900 aspect-video w-full max-w-[560px] group">
            <video 
              autoPlay loop muted playsInline 
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
            >
              <source src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/marketing/trial_access_promo_1.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Play size={14} className="text-white ml-0.5" />
              </div>
              <span className="text-white text-[11px] font-black uppercase tracking-widest drop-shadow-md">
                Preview: Mission 1 — Motion Alarm
              </span>
            </div>
          </div>

          {/* HIGH-IMPACT PREMIUM REVIEW CAROUSEL */}
          <div className="w-full max-w-[560px] relative group mt-2">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/40 via-purple-400/30 to-emerald-400/40 blur-2xl -z-10 rounded-[40px] opacity-80 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100" />
            
            <div className="relative bg-white rounded-[32px] p-8 sm:p-10 shadow-2xl shadow-blue-900/10 border border-slate-100 overflow-hidden transform transition-all duration-700 hover:-translate-y-2">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500" />
              <div className="absolute -top-6 -left-2 text-[140px] leading-none font-serif text-slate-100 select-none pointer-events-none">
                "
              </div>
              
              <div className="min-h-[120px] relative z-10 flex items-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeReview}
                    initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full"
                  >
                    <p className="text-base sm:text-lg font-medium text-slate-700 leading-relaxed italic relative z-10">
                      "{REVIEWS[activeReview].text}"
                    </p>
                    
                    <div className="mt-8 flex items-center justify-between w-full relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-slate-900/20 ring-4 ring-slate-50">
                          {REVIEWS[activeReview].author.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 leading-tight">
                            {REVIEWS[activeReview].author}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mt-1 uppercase tracking-wider">
                            {REVIEWS[activeReview].icon}
                            {REVIEWS[activeReview].platform}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="absolute bottom-8 right-8 flex items-center gap-2 z-20">
                {REVIEWS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveReview(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      activeReview === i ? 'w-6 bg-blue-600 shadow-md' : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                    aria-label={`Go to review ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* === RIGHT COLUMN: The Form (Mobile: Absolute Top, Desktop: Right) === */}
        <div className="w-full lg:w-5/12 flex flex-col justify-center lg:justify-end order-1 lg:order-2">
          
          {/* MOBILE-ONLY MICRO HOOK (Sits right above the form to establish trust instantly) */}
          <div className="block lg:hidden mb-4 text-center px-2">
            <h1 className="text-[28px] leading-[1.1] font-black uppercase italic tracking-tighter text-slate-900">
              Turn Screen Time <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">Into A Superpower.</span>
            </h1>
            <p className="text-xs text-slate-600 mt-2 font-medium">
              Secure your 14-Day Full Access Trial below.
            </p>
          </div>

          <div className="w-full max-w-[460px] mx-auto">
            <AnimatePresence mode="wait">
              {!isSuccess ? (
                <motion.div 
                  key="form"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-slate-200/50 border border-slate-200 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
                  
                  <div className="mb-6 text-center">
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-tight">
                      Create Dashboard
                    </h2>
                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                      No credit card required today.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Parent Details */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">1</span>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Your Details</h4>
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Full Name *</label>
                        <input 
                          autoFocus
                          required type="text" placeholder="e.g. Jane Doe"
                          value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Email Address *</label>
                        <input 
                          required type="email" placeholder="jane@example.com"
                          value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">WhatsApp Number *</label>
                        <input 
                          required type="tel" placeholder="082 123 4567"
                          value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                      </div>
                    </div>

                    {/* Child Details */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-black">2</span>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pioneer Details</h4>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Child's Name *</label>
                          <input 
                            required type="text" placeholder="e.g. Leo"
                            value={formData.childName} onChange={e => setFormData({...formData, childName: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1.5 block">Age *</label>
                          <input 
                            required type="number" min="5" max="18" placeholder="Age"
                            value={formData.childAge} onChange={e => setFormData({...formData, childAge: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-6">
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full bg-slate-900 text-white rounded-xl py-4 md:py-5 text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-500/30 flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-70 disabled:hover:translate-y-0"
                      >
                        {isSubmitting ? (
                          <><Loader2 className="animate-spin" size={18} /> Processing...</>
                        ) : (
                          <>Unlock Robotics Course <Rocket size={16} /></>
                        )}
                      </button>
                      <p className="text-center text-[10px] font-bold text-slate-400 mt-4 flex items-center justify-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-500" /> By continuing, you secure the discounted tier rate.
                      </p>
                    </div>
                  </form>
                </motion.div>
              ) : (
                /* Success State */
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-slate-200/50 border border-emerald-200 text-center flex flex-col items-center justify-center"
                >
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-inner border border-emerald-100 shrink-0">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="text-[24px] md:text-[28px] font-black uppercase italic tracking-tighter text-slate-900 mb-2">
                    Request Secured!
                  </h2>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 max-w-sm mx-auto">
                    Thank you, {formData.parentName.split(' ')[0]}. We have reserved {formData.childName}'s spot. Your unique setup link will arrive in your inbox shortly. 
                    <br/><br/>
                    While you wait, watch the quick start guide below to see exactly how to set up your dashboard!
                  </p>
                  
                  {/* Video Guides Area */}
                  <div className="w-full text-left bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-inner">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <Play size={14} className="text-blue-500" /> Getting Started Guide
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Part 1 Video */}
                      <div className="space-y-2.5">
                        <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
                          <video 
                            autoPlay loop muted playsInline controls
                            className="w-full h-full object-cover"
                          >
                            <source src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/support-guides/getting-started/RAD_trial_course_sign-up_p1.mp4" type="video/mp4" />
                          </video>
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center">
                          Part 1: Account Setup
                        </p>
                      </div>

                      {/* Part 2 Video */}
                      <div className="space-y-2.5">
                        <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
                          <video 
                            autoPlay loop muted playsInline controls
                            className="w-full h-full object-cover"
                          >
                            <source src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/support-guides/getting-started/RAD_trial_course_sign-up_p2.mp4" type="video/mp4" />
                          </video>
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center">
                          Part 2: Platform Login
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Premium Apple-Style Footer */}
      <footer className="relative z-20 mt-12 lg:mt-20 bg-slate-50/50 backdrop-blur-2xl">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">

            {/* Left: Brand & Copyright */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-blue-400/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <Image
                  src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png"
                  alt="RAD Academy"
                  width={100} height={35}
                  className="opacity-50 grayscale contrast-125 transition-all duration-700 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-[1.03] relative z-10"
                  unoptimized
                />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center md:text-left mt-1">
                &copy; {new Date().getFullYear()} RAD Academy. All rights reserved.
              </p>
            </div>

            {/* Center: Premium Tagline */}
            <div className="flex justify-center text-center hidden md:flex group cursor-default">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors duration-500 group-hover:text-slate-700 flex items-center gap-2">
                <Sparkles size={10} className="text-emerald-400/40 transition-all duration-500 group-hover:text-emerald-500 group-hover:scale-110" />
                Empowering Future Creators
                <Sparkles size={10} className="text-blue-400/40 transition-all duration-500 group-hover:text-blue-500 group-hover:scale-110" />
              </p>
            </div>

            {/* Right: Tactile Pill Links */}
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 sm:gap-3">
              <a href="mailto:support@radacademy.co.za" className="group flex items-center gap-2 px-3 py-2 rounded-full border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-[0_8px_16px_rgb(0,0,0,0.04)] active:scale-95 transition-all duration-300">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors duration-300 shrink-0">
                  <Mail size={12} className="text-slate-400 group-hover:text-blue-500 transition-colors duration-300" />
                </span>
                <span className="text-[9px] font-bold text-slate-500 group-hover:text-slate-900 uppercase tracking-widest pr-1 transition-colors duration-300">
                  Email
                </span>
              </a>

              <a href="https://wa.me/27769065959" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-3 py-2 rounded-full border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-[0_8px_16px_rgb(0,0,0,0.04)] active:scale-95 transition-all duration-300">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-[#25D366]/10 transition-colors duration-300 shrink-0">
                  <MessageSquare size={12} className="text-slate-400 group-hover:text-[#25D366] transition-colors duration-300" />
                </span>
                <span className="text-[9px] font-bold text-slate-500 group-hover:text-slate-900 uppercase tracking-widest pr-1 transition-colors duration-300">
                  WhatsApp
                </span>
              </a>

              <a href="https://www.linkedin.com/company/rad-academy-digital" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-3 py-2 rounded-full border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-[0_8px_16px_rgb(0,0,0,0.04)] active:scale-95 transition-all duration-300">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-[#0A66C2]/10 transition-colors duration-300 shrink-0">
                  <Linkedin size={12} className="text-slate-400 group-hover:text-[#0A66C2] transition-colors duration-300" />
                </span>
                <span className="text-[9px] font-bold text-slate-500 group-hover:text-slate-900 uppercase tracking-widest pr-1 transition-colors duration-300">
                  LinkedIn
                </span>
              </a>
            </div>

          </div>
        </div>
      </footer>

    </div>
  );
}