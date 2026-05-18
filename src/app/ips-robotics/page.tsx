"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, Sparkles, User, Mail, Phone, GraduationCap, ArrowRight, HelpCircle, Zap } from "lucide-react";

export default function ClaimOfferPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Lead State
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState("");
  
  // Offer & Preference State
  const [isWinner, setIsWinner] = useState(false);
  const [needsCall, setNeedsCall] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Insert lead directly into the prospects CRM table
      const { error } = await supabase.from('prospects').insert({
        name: parentName,
        email: email,
        phone: phone,
        source: 'Irene Primary WhatsApp Flyer',
        status: 'New Lead',
        metadata: {
          student_grade: grade,
          is_prize_winner: isWinner,
          needs_qna_call: needsCall,
          signup_intent: isWinner ? 'Claiming Prize' : 'Claiming Free Trial'
        }
      });

      if (error) throw error;
      
      setIsSuccess(true);
    } catch (error: any) {
      console.error("Submission error:", error);
      alert("Something went wrong. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[url('https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/robotic-kits/smart_home_assembled-1.jpg')] bg-cover bg-center flex items-center justify-center p-4">
        {/* SUCCESS STATE - Frosted Glass Dark Theme */}
        <div className="max-w-md w-full bg-slate-900/70 backdrop-blur-2xl rounded-3xl p-8 text-center space-y-6 border border-slate-700">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Offer Claimed!</h2>
          <p className="text-slate-400 leading-relaxed">
            Thank you, {parentName.split(' ')[0]}! We have received your details. 
          </p>
          <div className="bg-blue-950/50 text-blue-100 p-4 rounded-xl text-sm font-medium border border-blue-700">
            Keep an eye on your WhatsApp! We will reach out shortly to {needsCall ? "answer your questions and get you set up." : "send you your child's exclusive login details."}
          </div>
        </div>
      </div>
    );
  }

  return (
    // MAIN PAGE CONTAINER - Background Image Applied Here
    <div className="min-h-screen bg-[url('https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/robotic-kits/smart_home_assembled-1.jpg')] bg-cover bg-center text-slate-300 font-sans selection:bg-blue-900 selection:text-blue-100 pb-12 relative overflow-hidden flex flex-col">
      
      {/* Subtle Dark Overlay to ensure text readability */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm pointer-events-none" />

      {/* Premium Header - Transparent in Dark Mode */}
      <div className="border-b border-slate-700 px-6 py-8 md:py-12 text-center shadow-sm relative z-10 shrink-0 mt-2 mb-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm font-bold tracking-wide uppercase">
            <Sparkles size={16} /> Special Offer: Irene Primary School
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
            From Gaming to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Engineering.</span>
          </h1>
          <p className="text-slate-400 md:text-lg max-w-xl mx-auto">
            Claim your child's free coding trial or tournament prize today. 
          </p>
        </div>
      </div>

      {/* Main Form Container - FROSTED GLASS EFFECT */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-4 pr-2 max-w-xl mx-auto px-4 sm:px-6 relative z-10 w-full">
        <form onSubmit={handleSubmit} className="bg-slate-900/70 backdrop-blur-2xl rounded-[2rem] shadow-[0_0_50px_rgba(30,58,138,0.1)] p-6 md:p-8 border border-slate-700 space-y-8 h-full max-h-full">
          
          {/* SECTION 1: Contact Details */}
          <div className="space-y-6">
            <div className="border-b border-slate-700 pb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User size={18} className="text-blue-500"/> Parent Details
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1.5">Full Name</label>
                <input required type="text" value={parentName} onChange={e => setParentName(e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" placeholder="Jane Doe" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" placeholder="jane@example.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1.5">WhatsApp Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" placeholder="082 123 4567" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Student Details & Prizes */}
          <div className="space-y-6">
            <div className="border-b border-slate-700 pb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <GraduationCap size={18} className="text-indigo-500"/> Student Details
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1.5">Child's Grade</label>
                <select required value={grade} onChange={e => setGrade(e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer placeholder:text-slate-600">
                  <option value="" disabled>Select Grade</option>
                  <option value="Grade 4">Grade 4</option>
                  <option value="Grade 5">Grade 5</option>
                  <option value="Grade 6">Grade 6</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Prize Claim Box */}
              <div className={`border-2 rounded-2xl p-4 transition-all cursor-pointer ${isWinner ? 'bg-amber-950/50 border-amber-500 shadow-sm' : 'bg-slate-800/80 border-slate-700 hover:border-amber-600/50'}`} onClick={() => setIsWinner(!isWinner)}>
                <label className="flex items-start gap-4 cursor-pointer pointer-events-none">
                  <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                    <input type="checkbox" checked={isWinner} readOnly className="peer appearance-none w-5 h-5 border-2 border-slate-500 rounded-md checked:bg-amber-500 checked:border-amber-500 transition-colors" />
                    <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <span className={`block text-sm font-bold transition-colors ${isWinner ? 'text-amber-100' : 'text-slate-300'}`}>
                      My child was a Robotics Challenge Winner! 🏆
                    </span>
                    <span className={`block text-xs mt-1 leading-relaxed ${isWinner ? 'text-amber-200' : 'text-slate-500'}`}>
                      Check this box if your child was one of the 8 finalists. We will contact you to arrange your VIP prizes.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 3: Next Steps Preference */}
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <label className="block text-sm font-bold text-white mb-3">How would you like to proceed?</label>
            
            <div className="grid grid-cols-1 gap-3">
              <div onClick={() => setNeedsCall(false)} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${!needsCall ? 'border-blue-500 bg-blue-950/50' : 'border-slate-700 hover:border-blue-600/50'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${!needsCall ? 'border-blue-500' : 'border-slate-500'}`}>
                  {!needsCall && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                </div>
                <div>
                  <span className={`block text-sm font-bold flex items-center gap-2 ${!needsCall ? 'text-blue-100' : 'text-slate-300'}`}><Zap size={14} className="text-blue-500"/> I'm ready to start!</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Generate my child's profile and WhatsApp me the details.</span>
                </div>
              </div>

              <div onClick={() => setNeedsCall(true)} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${needsCall ? 'border-blue-500 bg-blue-950/50' : 'border-slate-700 hover:border-blue-600/50'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${needsCall ? 'border-blue-500' : 'border-slate-500'}`}>
                  {needsCall && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                </div>
                <div>
                  <span className={`block text-sm font-bold flex items-center gap-2 ${needsCall ? 'text-blue-100' : 'text-slate-300'}`}><HelpCircle size={14} className="text-slate-500"/> I have a few questions.</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Send me a link to book a quick Q&A call first.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-lg py-3.5 rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0 shrink-0"
          >
            {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (
              <>Claim Access Now <ArrowRight size={18} /></>
            )}
          </button>
          
        </form>
      </div>

    </div>
  );
}