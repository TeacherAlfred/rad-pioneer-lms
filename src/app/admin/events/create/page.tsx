"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, CalendarDays, Clock, MapPin, Eye,
  FileText, Users, DollarSign, Image as ImageIcon, 
  Save, Loader2, Link as LinkIcon, Sparkles, Tag, CheckCircle2, X
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateEventPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    type: "Bootcamp",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    locationType: "physical", // 'physical' or 'online'
    locationDetails: "",
    capacity: 20,
    isFree: false,
    price: "",
    coverImageUrl: "" // Placeholder for future Supabase Storage implementation
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // We are now ACTUALLY saving to Supabase!
      const { error } = await supabase.from('events').insert([{
        title: formData.title,
        type: formData.type,
        description: formData.description,
        event_date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        location_type: formData.locationType,
        location_details: formData.locationDetails,
        capacity: formData.capacity,
        is_free: formData.isFree,
        price: formData.isFree ? 0 : Number(formData.price),
        status: 'upcoming'
      }]);
      
      if (error) throw error;

      setSuccessMessage("Event successfully initialized and published to the network.");
      setTimeout(() => {
        router.push('/admin/events');
      }, 2000);

    } catch (error: any) {
      alert(`Failed to create event: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  // Live Preview Formatter
  const formattedDate = formData.date ? new Date(formData.date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long' }) : "Select a date";

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-12 font-sans selection:bg-yellow-500/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
            <Link href="/admin/events" className="group flex items-center gap-2 bg-white/5 border border-white/10 hover:border-yellow-500/50 px-4 py-2 rounded-xl transition-all w-fit">
              <ArrowLeft size={16} className="text-slate-500 group-hover:text-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Events Hub</span>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-500">
                <Sparkles size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Experience_Architect</span>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">
                Design_<span className="text-yellow-500">Event</span>
              </h1>
            </div>
          </div>
        </header>

        <div className="flex flex-col xl:flex-row gap-10 items-start">
          
          {/* LEFT: THE FORM */}
          <motion.form 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit} 
            className="flex-1 space-y-8 w-full"
          >
            {/* Section 1: Essentials */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <Tag size={16} /> Event Essentials
              </h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Event Title *</label>
                <input 
                  required type="text" placeholder="e.g. Advanced Robotics Bootcamp" 
                  value={formData.title} onChange={e => handleInputChange('title', e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Event Type</label>
                  <select 
                    value={formData.type} onChange={e => handleInputChange('type', e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                  >
                    <option value="Bootcamp">Bootcamp</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Masterclass">Masterclass</option>
                    <option value="Launch Event">Launch Event</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Capacity (Max Attendees) *</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      required type="number" min="1" placeholder="20"
                      value={formData.capacity} onChange={e => handleInputChange('capacity', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Marketing Description</label>
                <textarea 
                  required rows={4} placeholder="Describe what the pioneers will learn and experience..."
                  value={formData.description} onChange={e => handleInputChange('description', e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-sm text-slate-300 outline-none focus:border-yellow-500 resize-none custom-scrollbar"
                />
              </div>
            </div>

            {/* Section 2: Time & Space */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <Clock size={16} /> Time & Space
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Date *</label>
                  <input 
                    required type="date"
                    value={formData.date} onChange={e => handleInputChange('date', e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-yellow-500 cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Start Time *</label>
                  <input 
                    required type="time"
                    value={formData.startTime} onChange={e => handleInputChange('startTime', e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-yellow-500 cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">End Time *</label>
                  <input 
                    required type="time"
                    value={formData.endTime} onChange={e => handleInputChange('endTime', e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-yellow-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Location Format</label>
                <div className="flex bg-[#0a0f1d] p-1 rounded-2xl border border-white/10 w-fit">
                  <button type="button" onClick={() => handleInputChange('locationType', 'physical')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${formData.locationType === 'physical' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}>
                    <MapPin size={14}/> Physical Venue
                  </button>
                  <button type="button" onClick={() => handleInputChange('locationType', 'online')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${formData.locationType === 'online' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}>
                    <LinkIcon size={14}/> Online Stream
                  </button>
                </div>

                <div className="relative mt-2">
                  {formData.locationType === 'physical' ? <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} /> : <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />}
                  <input 
                    required type="text" 
                    placeholder={formData.locationType === 'physical' ? "e.g. Innovation Hub, Polokwane" : "e.g. Zoom Link or 'Link provided upon registration'"}
                    value={formData.locationDetails} onChange={e => handleInputChange('locationDetails', e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Commerce & Media */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <DollarSign size={16} /> Commerce & Media
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 border-r border-white/5 pr-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Free Event?</label>
                    <button 
                      type="button"
                      onClick={() => { handleInputChange('isFree', !formData.isFree); handleInputChange('price', ''); }}
                      className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${formData.isFree ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <motion.div layout className="w-4 h-4 bg-white rounded-full mx-1 shadow-sm" />
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {!formData.isFree && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden pt-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Ticket Price (ZAR) *</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R</span>
                          <input 
                            required={!formData.isFree} type="number" min="0" step="0.01" placeholder="0.00"
                            value={formData.price} onChange={e => handleInputChange('price', e.target.value)}
                            className="w-full bg-[#0a0f1d] border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white font-black outline-none focus:border-yellow-500 transition-colors"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-2 pl-0 md:pl-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Cover Artwork (Optional)</label>
                  <div className="w-full h-32 bg-[#0a0f1d] border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:border-yellow-500 hover:text-yellow-500 transition-colors cursor-pointer group">
                    <ImageIcon size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Upload Banner</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="p-8 border border-yellow-500/20 bg-yellow-500/5 rounded-[32px] flex justify-between items-center gap-8">
              <div>
                <p className="text-sm font-black uppercase italic tracking-tight text-white">Ready for Launch?</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">This will deploy the event to your portal immediately.</p>
              </div>
              <button 
                type="submit" disabled={isSubmitting || !formData.title || !formData.date || !formData.startTime || !formData.endTime || !formData.locationDetails}
                className="bg-yellow-500 text-[#020617] px-10 py-5 rounded-2xl font-black uppercase italic tracking-widest flex items-center gap-3 hover:bg-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Publish Event
              </button>
            </div>
          </motion.form>

          {/* RIGHT: LIVE TICKET PREVIEW */}
          <div className="w-full xl:w-[400px] xl:sticky xl:top-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 text-center xl:text-left flex items-center gap-2">
              <Eye size={14}/> Live Ticket Preview
            </p>
            
            <div className="bg-gradient-to-b from-[#0f172a] to-[#020617] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl">
              {/* Image Placeholder */}
              <div className="h-48 bg-slate-800 relative flex items-center justify-center">
                <ImageIcon size={40} className="text-white/10" />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-white">Status: Open</span>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">{formData.type}</p>
                  <h3 className="text-2xl font-black italic uppercase leading-tight line-clamp-2">
                    {formData.title || "Your Event Title Here"}
                  </h3>
                </div>

                <div className="space-y-3 py-6 border-y border-white/5">
                  <div className="flex items-center gap-3 text-slate-300">
                    <CalendarDays size={16} className="text-slate-500" />
                    <span className="text-xs font-bold">{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300">
                    <Clock size={16} className="text-slate-500" />
                    <span className="text-xs font-bold">
                      {formData.startTime || "00:00"} — {formData.endTime || "00:00"}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-300">
                    {formData.locationType === 'physical' ? <MapPin size={16} className="text-slate-500 shrink-0 mt-0.5" /> : <LinkIcon size={16} className="text-slate-500 shrink-0 mt-0.5" />}
                    <span className="text-xs font-bold line-clamp-2">{formData.locationDetails || "Venue details will appear here"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-400">{formData.capacity} Spots Total</span>
                  </div>
                  <div>
                    {formData.isFree ? (
                       <span className="text-lg font-black text-emerald-400 uppercase italic">Free Entry</span>
                    ) : (
                       <span className="text-lg font-black text-white italic">R {formData.price || "0.00"}</span>
                    )}
                  </div>
                </div>

                <button disabled className="w-full py-4 mt-4 bg-white/10 text-white/40 rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-not-allowed">
                  Secure Ticket
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SUCCESS MODAL */}
      <AnimatePresence>
        {successMessage && (
          <div className="fixed bottom-10 right-10 z-[300] flex justify-end pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 20, scale: 0.9 }} 
              className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl p-5 shadow-2xl shadow-emerald-900/20 flex items-center gap-4 max-w-sm w-full pointer-events-auto relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <CheckCircle2 className="text-emerald-400" size={20} />
              </div>
              <div className="flex-1 pr-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none mb-1">Deployment Success</h3>
                <p className="text-[10px] font-bold text-slate-400 leading-tight">{successMessage}</p>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="text-slate-500 hover:text-white transition-colors shrink-0">
                <X size={16} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}