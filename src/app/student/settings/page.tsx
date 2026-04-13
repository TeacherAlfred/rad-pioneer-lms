"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, User, Key, Shield, 
  Palette, Save, Loader2, AlertCircle, CheckCircle2, UserCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "account" | "demographics" | "avatar";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Status states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: "error" | "success" } | null>(null);

  // Form States
  const [accountForm, setAccountForm] = useState({ username: "", pin: "" });
  const [demoForm, setDemoForm] = useState({ name: "", date_of_birth: "", grade: "" });

  useEffect(() => {
    async function loadProfile() {
      try {
        const sessionData = localStorage.getItem("pioneer_session");
        if (!sessionData) {
          router.push("/login");
          return;
        }

        const localUser = JSON.parse(sessionData);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', localUser.id)
          .single();

        if (error || !profile) throw new Error("Could not load profile");

        setUserProfile(profile);
        
        // Populate forms
        setAccountForm({ 
          username: profile.student_identifier || "", 
          pin: profile.temp_entry_pin || "" 
        });
        
        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : (profile.metadata || {});
        
        setDemoForm({ 
          name: profile.display_name || "", 
          date_of_birth: profile.date_of_birth || "", 
          grade: meta.grade || "" 
        });

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSaving(true);

    const newUsername = accountForm.username.trim();
    const newPin = accountForm.pin.trim();

    if (newUsername.length < 3) {
      setMessage({ text: "Pioneer ID must be at least 3 characters.", type: "error" });
      setIsSaving(false);
      return;
    }
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      setMessage({ text: "Secret PIN must be exactly 4 numbers.", type: "error" });
      setIsSaving(false);
      return;
    }

    try {
      // 1. Check if username is taken by someone else
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('student_identifier', newUsername)
        .neq('id', userProfile.id)
        .single();

      if (existing) {
        throw new Error("That Pioneer ID is already taken by someone else.");
      }

      // 2. Update Supabase Auth if they have an auth account (Math Users)
      if (userProfile.auth_user_id) {
        const newEmail = `${newUsername.toLowerCase().replace(/\s/g, '')}@pioneer.bot`;
        const newPassword = `PIONEER-${newPin}`;
        
        const { error: authError } = await supabase.auth.updateUser({
          email: newEmail,
          password: newPassword
        });

        if (authError) throw new Error("Failed to sync security credentials.");
      }

      // 3. Update Profiles Table
      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({
          student_identifier: newUsername,
          temp_entry_pin: newPin
        })
        .eq('id', userProfile.id)
        .select()
        .single();

      if (profileError) throw profileError;

      localStorage.setItem("pioneer_session", JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);
      setMessage({ text: "Security credentials updated successfully!", type: "success" });

    } catch (err: any) {
      setMessage({ text: err.message || "Failed to update account.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDemographics = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      const existingMeta = typeof userProfile.metadata === 'string' 
        ? JSON.parse(userProfile.metadata) 
        : (userProfile.metadata || {});

      // Keep grade in metadata
      const updatedMeta = {
        ...existingMeta,
        grade: demoForm.grade
      };

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          display_name: demoForm.name,
          date_of_birth: demoForm.date_of_birth || null, 
          metadata: updatedMeta
        })
        .eq('id', userProfile.id)
        .select()
        .single();

      if (error) throw error;

      localStorage.setItem("pioneer_session", JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);
      setMessage({ text: "Demographics updated successfully!", type: "success" });

    } catch (err: any) {
      setMessage({ text: "Failed to update profile data.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white p-4 md:p-8 flex flex-col items-center">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-4xl relative z-10">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">Command Center</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Preferences</p>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          
          {/* Sidebar Navigation - Horizontally swipeable on mobile, vertical on desktop */}
          <div className="md:col-span-4 flex flex-row md:flex-col overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory gap-3 pb-2 md:pb-0">
            <button 
              onClick={() => { setActiveTab("account"); setMessage(null); }}
              className={`flex items-center gap-3 p-3 md:p-4 rounded-2xl border transition-all text-left min-w-[180px] md:min-w-0 shrink-0 snap-start ${activeTab === 'account' ? 'bg-blue-600/20 border-blue-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'}`}
            >
              <Key size={18} className={`shrink-0 ${activeTab === 'account' ? 'text-blue-400' : ''}`} />
              <div>
                <h3 className="font-black uppercase text-xs md:text-sm">Security</h3>
                <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-60">ID & Secret Code</p>
              </div>
            </button>

            <button 
              onClick={() => { setActiveTab("demographics"); setMessage(null); }}
              className={`flex items-center gap-3 p-3 md:p-4 rounded-2xl border transition-all text-left min-w-[180px] md:min-w-0 shrink-0 snap-start ${activeTab === 'demographics' ? 'bg-purple-600/20 border-purple-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'}`}
            >
              <UserCircle size={18} className={`shrink-0 ${activeTab === 'demographics' ? 'text-purple-400' : ''}`} />
              <div>
                <h3 className="font-black uppercase text-xs md:text-sm">Demographics</h3>
                <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-60">Personal Info</p>
              </div>
            </button>

            <button 
              onClick={() => { setActiveTab("avatar"); setMessage(null); }}
              className={`flex items-center gap-3 p-3 md:p-4 rounded-2xl border transition-all text-left min-w-[180px] md:min-w-0 shrink-0 snap-start ${activeTab === 'avatar' ? 'bg-emerald-600/20 border-emerald-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'}`}
            >
              <Palette size={18} className={`shrink-0 ${activeTab === 'avatar' ? 'text-emerald-400' : ''}`} />
              <div>
                <h3 className="font-black uppercase text-xs md:text-sm">Appearance</h3>
                <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-60">Skins & Avatars</p>
              </div>
            </button>
          </div>

          {/* Content Area */}
          <div className="md:col-span-8">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 md:p-8 min-h-[400px]">
              
              <AnimatePresence mode="wait">
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${message.type === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}
                  >
                    {message.type === 'error' ? <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} /> : <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />}
                    <p className={`text-sm font-bold ${message.type === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{message.text}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {activeTab === "account" && (
                <motion.form 
                  key="account" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleSaveAccount} className="space-y-6"
                >
                  <div className="space-y-1">
                    <h2 className="text-xl font-black uppercase italic">Security Matrix</h2>
                    <p className="text-xs text-slate-400">Update how you log into the platform.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2">Pioneer ID (Username)</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="text" value={accountForm.username} onChange={e => setAccountForm({...accountForm, username: e.target.value})} className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 pl-12 pr-4 font-bold text-white focus:border-blue-500 outline-none transition-colors" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-2">4-Digit Secret Code</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="number" min="1000" max="9999" value={accountForm.pin} onChange={e => setAccountForm({...accountForm, pin: e.target.value})} className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 pl-12 pr-4 font-black tracking-[0.3em] text-white focus:border-blue-500 outline-none transition-colors" />
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors disabled:opacity-50 mt-8">
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save Credentials</>}
                  </button>
                </motion.form>
              )}

              {activeTab === "demographics" && (
                <motion.form 
                  key="demographics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleSaveDemographics} className="space-y-6"
                >
                  <div className="space-y-1">
                    <h2 className="text-xl font-black uppercase italic text-purple-400">Demographics</h2>
                    <p className="text-xs text-slate-400">Your personal training data.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Display Name</label>
                      <input type="text" value={demoForm.name} onChange={e => setDemoForm({...demoForm, name: e.target.value})} className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-4 font-bold text-white focus:border-purple-500 outline-none transition-colors" placeholder="How should we call you?" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Date of Birth</label>
                        <input 
                          type="date" 
                          value={demoForm.date_of_birth} 
                          onChange={e => setDemoForm({...demoForm, date_of_birth: e.target.value})} 
                          style={{ colorScheme: 'dark' }}
                          className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-4 font-bold text-white focus:border-purple-500 outline-none transition-colors" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">School Grade</label>
                        <input type="number" value={demoForm.grade} onChange={e => setDemoForm({...demoForm, grade: e.target.value})} className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-4 font-bold text-white focus:border-purple-500 outline-none transition-colors" placeholder="5" />
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={isSaving} className="w-full h-14 rounded-2xl bg-purple-600 text-white font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:bg-purple-500 transition-colors disabled:opacity-50 mt-8">
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Update Data</>}
                  </button>
                </motion.form>
              )}

              {activeTab === "avatar" && (
                <motion.div 
                  key="avatar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 h-full flex flex-col"
                >
                  <div className="space-y-1">
                    <h2 className="text-xl font-black uppercase italic text-emerald-400">Armory</h2>
                    <p className="text-xs text-slate-400">Customize your digital representation.</p>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.02] py-12 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
                    
                    <Palette size={48} className="text-emerald-500/50 mb-4" />
                    <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">Skin Customization</h3>
                    <p className="text-xs text-slate-400 text-center max-w-xs font-medium">
                      Unlock new character models, colors, and gear by completing modules.
                    </p>
                    
                    <div className="mt-6 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest">
                      Feature Activating Soon
                    </div>
                  </div>
                </motion.div>
              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}