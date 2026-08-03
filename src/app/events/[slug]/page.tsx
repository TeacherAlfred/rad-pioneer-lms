"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEventBySlug, captureEventSignup } from "../../actions/events";
import { 
  CalendarDays, MapPin, Clock, Cpu, Zap, CheckCircle2,
  ShieldCheck, Loader2, AlertCircle, Sparkles, User, Phone, Rocket, Check, Gift, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ICON_MAP: any = { 1: Cpu, 2: Zap, 3: ShieldCheck, default: Cpu };

export default function EventLandingPage() {
  const params = useParams();
  const eventSlug = params?.slug as string;
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Simplified Form State (Removed kidsCount)
  const [form, setForm] = useState({ 
    parentName: '', 
    whatsapp: '', 
    email: '',
    locationPref: 'In-Person (Menlyn Maine)',
    onlineSlotPref: '', 
    needsCall: false,
  });
  
  // Track explicit selections to power the "Buy 2 Get 3rd Free" logic
  const [explicitWeeks, setExplicitWeeks] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      if (!eventSlug) return;
      try {
        const res = await getEventBySlug(eventSlug); 
        if (res.success && res.data) {
          setEvent(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [eventSlug]);

  const pricing = event?.pricingConfig || { basePrice: 650, bundleTrigger: 2, options: ['Week 1', 'Week 2', 'Week 3'] };

  const toggleWeek = (week: string) => {
    setExplicitWeeks(prev => {
      if (prev.includes(week)) return prev.filter(w => w !== week);
      if (prev.length >= pricing.bundleTrigger) return prev;
      return [...prev, week];
    });
  };

  // Dynamic Pricing Logic
  const calculateTotal = () => {
    return explicitWeeks.length * pricing.basePrice;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (explicitWeeks.length === 0) {
      alert("Please select at least one program week.");
      return;
    }
    if (form.locationPref === 'Online Stream' && !form.onlineSlotPref) {
      alert("Please select your preferred online time slot.");
      return;
    }

    setIsSubmitting(true);
    const safeTitle = event?.title || 'Unknown Event';
    const totalCost = calculateTotal();
    
    // Determine the free week for admin notes
    const freeWeek = explicitWeeks.length >= pricing.bundleTrigger 
      ? pricing.options.find((w: string) => !explicitWeeks.includes(w)) 
      : 'None';
    
    const notes = `Captured from Event Page: ${safeTitle}
Format: ${form.locationPref} ${form.locationPref === 'Online Stream' ? `(${form.onlineSlotPref})` : ''}
Paid Choices: ${explicitWeeks.join(', ')}
Free Bonus Allocated: ${freeWeek}
Estimated Value: R${totalCost}
Call Requested: ${form.needsCall ? 'YES - Please call' : 'No'}`;

    const res = await captureEventSignup({ 
      ...form, 
      eventId: event.id, 
      eventTitle: safeTitle,
      notes
    });
    
    if (res.success) {
      setIsSuccess(true);
    } else {
      alert("Something went wrong. Please try again or WhatsApp us directly.");
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-blue-600 font-black uppercase tracking-widest text-xs">Loading Details...</p>
      </div>
    );
  }

  if (!event) return null;

  const displayDate = event.startTime === 'Flexible' ? 'Flexible Schedule' : 'Dates TBA';
  const expCards = Array.isArray(event?.experienceCards) ? event.experienceCards : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* --- HERO SECTION --- */}
      <section className="relative min-h-[80vh] flex flex-col justify-center px-6 lg:px-12 pt-24 pb-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-100/50 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
              <Sparkles size={14} /> Open for Enrollment
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600">
                {event?.title || 'RAD Program'}
              </span>
            </h1>
            
            <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
              {event?.description || "Transform screen time into skill-building. Secure your child's spot for our upcoming immersive tech program."}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a href="#enroll" className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs text-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                Begin Registration Process
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative hidden lg:block">
            <div className="relative aspect-[4/5] md:aspect-square rounded-[40px] overflow-hidden border border-slate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] bg-white">
              {event?.coverImageUrl ? (
                <img src={event.coverImageUrl} alt={event?.title || 'Event Cover'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                   <Rocket size={120} className="text-slate-200" />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- WHAT THEY WILL LEARN --- */}
      {expCards.length > 0 && (
        <section className="py-24 px-6 lg:px-12 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">What They Will Learn</h2>
              <p className="text-slate-500 mt-4 font-medium max-w-2xl mx-auto">A hands-on, practical approach to building real digital skills.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {expCards.map((card: any) => {
                const Icon = ICON_MAP[card.id] || Cpu;
                return (
                  <motion.div key={card.id} whileHover={{ y: -5 }} className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
                    <Icon className="absolute -right-4 -bottom-4 size-32 text-slate-200/50 group-hover:text-blue-100 transition-colors" />
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6 relative z-10 shadow-sm">
                      <Icon size={24} />
                    </div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight mb-3 relative z-10 text-slate-900">{card.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed relative z-10">{card.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* --- LOGISTICS STRIP --- */}
      <section id="logistics" className="py-16 border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="flex items-center gap-6 pt-4 md:pt-0">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0 shadow-sm"><CalendarDays size={28} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">The Date</p><p className="text-lg font-black text-slate-900">{displayDate}</p></div>
            </div>
            <div className="flex items-center gap-6 pt-8 md:pt-0 md:pl-8">
              <div className="w-16 h-16 rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center border border-fuchsia-200 shrink-0 shadow-sm"><Clock size={28} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">The Time</p><p className="text-lg font-black text-slate-900">{event?.startTime || '--:--'} — {event?.endTime || '--:--'}</p></div>
            </div>
            <div className="flex items-center gap-6 pt-8 md:pt-0 md:pl-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0 shadow-sm"><MapPin size={28} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">The Venue</p><p className="text-lg font-black text-slate-900">{event?.locationDetails || 'TBA'}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* --- ENROLLMENT FORM (Streamlined Premium Flow) --- */}
      <section id="enroll" className="py-24 px-6 lg:px-12 bg-white">
        <div className="max-w-3xl mx-auto">
          
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900">Secure a Spot</h2>
            <p className="text-slate-500 mt-3 text-sm md:text-base max-w-lg mx-auto">No payment required today. Build your package below and our team will reach out via WhatsApp to confirm.</p>
          </div>

          {isSuccess ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 border border-emerald-200 rounded-[32px] p-12 text-center shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={80} className="text-emerald-500 mx-auto mb-6" />
              <h3 className="text-3xl font-black uppercase tracking-widest text-emerald-900 mb-4">Request Received</h3>
              <p className="text-emerald-700 text-lg">Your selections have been securely sent. One of our instructors will WhatsApp you shortly to finalize the details.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSignup} className="bg-slate-50 border border-slate-200 rounded-[32px] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] space-y-12 relative z-10">
              
              {/* STEP 1: CHOOSE WEEKS */}
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">1. Select Your Sessions</h3>
                  <p className="text-sm text-slate-500 mt-1">Choose the weeks you'd like to attend.</p>
                </div>
                
                {/* Standard Promo Message (Hides when Upsell is active) */}
                {pricing.bundleMessage && explicitWeeks.length == 0 && (
                  <div className="bg-blue-600 text-white p-4 rounded-2xl text-sm font-medium flex gap-3 shadow-md mb-6">
                    <Gift className="shrink-0 text-blue-300" size={20} />
                    <p>{pricing.bundleMessage}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {pricing.options.map((week: string) => {
                    const isExplicit = explicitWeeks.includes(week);
                    const isBundleTriggered = explicitWeeks.length >= pricing.bundleTrigger;
                    const isFree = isBundleTriggered && !isExplicit;
                    
                    if (isFree) {
                      return (
                        <div key={week} className="text-left border-0 rounded-2xl p-5 transition-all relative overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white cursor-default flex flex-col justify-between min-h-[130px]">
                          <div className="w-full">
                            <div className="flex justify-between items-start mb-2 relative z-10">
                              <span className="text-sm font-black leading-tight">{week}</span>
                              <div className="w-5 h-5 rounded-md border-0 bg-white/20 flex items-center justify-center shrink-0">
                                <Check size={14} className="text-white" />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <p className="text-[11px] font-black uppercase tracking-widest bg-white text-emerald-600 inline-block px-3 py-1.5 rounded-lg shadow-sm relative z-10">Free Bonus</p>
                          </div>
                          <Gift size={80} className="absolute -right-4 -bottom-4 text-white/10 pointer-events-none" />
                        </div>
                      )
                    }

                    return (
                      <button 
                        key={week}
                        type="button"
                        onClick={() => toggleWeek(week)}
                        className={`text-left border rounded-2xl p-5 transition-all relative overflow-hidden flex flex-col justify-between min-h-[130px] ${isExplicit ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                      >
                        <div className="w-full">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-sm font-black pr-2 leading-tight ${isExplicit ? 'text-blue-700' : 'text-slate-700'}`}>{week}</span>
                            <div className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${isExplicit ? 'bg-blue-600 border-blue-600' : 'bg-slate-50 border-slate-300'}`}>
                              {isExplicit && <Check size={14} className="text-white" />}
                            </div>
                          </div>
                        </div>

                        {/* Made Price Much More Prominent */}
                        <p className={`text-2xl font-black mt-4 tracking-tight ${isExplicit ? 'text-blue-700' : 'text-slate-400'}`}>R{pricing.basePrice}</p>
                      </button>
                    )
                  })}
                </div>

                {/* DYNAMIC UPSALE TOOLTIP (Only shows when exactly 1 week is picked) */}
                <AnimatePresence>
                  {explicitWeeks.length === 1 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, height: 0 }} 
                      animate={{ opacity: 1, y: 0, height: 'auto' }} 
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 p-5 rounded-2xl shadow-sm flex items-start gap-4">
                        <div className="bg-amber-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <p className="text-sm md:text-base font-black uppercase tracking-wide text-amber-950">You're one session away from a freebie!</p>
                          <p className="text-xs md:text-sm font-medium mt-1 text-amber-800 leading-relaxed">Add just <strong>one more session</strong> right now and we will instantly unlock the 3rd week absolutely <strong className="text-amber-950">FREE</strong> (plus a 1-month Minecraft Education license). It's a no-brainer!</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* DYNAMIC CONGRATS TOOLTIP (Shows when bundle is triggered) */}
                <AnimatePresence>
                  {explicitWeeks.length >= pricing.bundleTrigger && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, height: 0 }} 
                      animate={{ opacity: 1, y: 0, height: 'auto' }} 
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 bg-gradient-to-r from-emerald-100 to-teal-100 border border-emerald-200 p-5 rounded-2xl shadow-sm flex items-start gap-4">
                        <div className="bg-emerald-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
                          <Gift size={20} />
                        </div>
                        <div>
                          <p className="text-sm md:text-base font-black uppercase tracking-wide text-emerald-950">Ultimate Bundle Unlocked! 🎉</p>
                          <p className="text-xs md:text-sm font-medium mt-1 text-emerald-800 leading-relaxed">You've successfully claimed your <strong>free session</strong> and 1-month Minecraft Education license! Just complete the form below to lock it in.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* STEP 2: CHOOSE FORMAT & TIME */}
              <div className="border-t border-slate-200 pt-10">
                <div className="mb-6">
                  <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">2. How will you attend?</h3>
                  <p className="text-sm text-slate-500 mt-1">Select your preferred venue and time.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`border rounded-2xl p-5 cursor-pointer transition-all flex items-start gap-4 ${form.locationPref === 'In-Person (Menlyn Maine)' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <input type="radio" name="loc" value="In-Person (Menlyn Maine)" checked={form.locationPref === 'In-Person (Menlyn Maine)'} onChange={e => setForm({...form, locationPref: e.target.value})} className="hidden" />
                    <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${form.locationPref === 'In-Person (Menlyn Maine)' ? 'border-blue-600' : 'border-slate-300 bg-slate-50'}`}>
                      {form.locationPref === 'In-Person (Menlyn Maine)' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </div>
                    <div>
                      <span className={`block text-sm font-black mb-1 ${form.locationPref === 'In-Person (Menlyn Maine)' ? 'text-blue-700' : 'text-slate-700'}`}>In-Person (Menlyn HQ)</span>
                      <span className={`text-xs ${form.locationPref === 'In-Person (Menlyn Maine)' ? 'text-blue-600' : 'text-slate-500'}`}>
                        {event?.timeslot ? `Saturdays ${event.timeslot.split(' | ')[0] || '10:00 - 12:30'}` : 'Saturdays 10:00 - 12:30'}
                      </span>
                    </div>
                  </label>
                  
                  <label className={`border rounded-2xl p-5 cursor-pointer transition-all flex items-start gap-4 ${form.locationPref === 'Online Stream' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <input type="radio" name="loc" value="Online Stream" checked={form.locationPref === 'Online Stream'} onChange={e => setForm({...form, locationPref: e.target.value})} className="hidden" />
                    <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${form.locationPref === 'Online Stream' ? 'border-blue-600' : 'border-slate-300 bg-slate-50'}`}>
                      {form.locationPref === 'Online Stream' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </div>
                    <div>
                      <span className={`block text-sm font-black mb-1 ${form.locationPref === 'Online Stream' ? 'text-blue-700' : 'text-slate-700'}`}>Online (MS Teams)</span>
                      <span className={`text-xs ${form.locationPref === 'Online Stream' ? 'text-blue-600' : 'text-slate-500'}`}>Flexible time slots available</span>
                    </div>
                  </label>
                </div>

                <AnimatePresence>
                  {form.locationPref === 'Online Stream' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mt-4">
                         <label className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-3 block">Select Your Weekly Online Slot</label>
                         <select required value={form.onlineSlotPref} onChange={e => setForm({...form, onlineSlotPref: e.target.value})} className="w-full bg-white border border-blue-200 rounded-xl px-4 py-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors cursor-pointer font-medium shadow-sm">
                          <option value="" disabled>Choose a time...</option>
                          <option value="Mondays 17:00 - 19:30">Mondays 17:00 - 19:30</option>
                          <option value="Thursdays 14:30 - 17:00">Thursdays 14:30 - 17:00</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* STEP 3: CONTACT DETAILS */}
              <div className="border-t border-slate-200 pt-10">
                <div className="mb-6">
                  <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">3. Where should we send details?</h3>
                  <p className="text-sm text-slate-500 mt-1">Provide your contact info so we can reach out.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <User size={16} />
                      </div>
                      <input required type="text" value={form.parentName} onChange={e => setForm({...form, parentName: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="Your Name" />
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Phone size={16} />
                      </div>
                      <input required type="tel" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="WhatsApp Number" />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Mail size={16} />
                    </div>
                    <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="Email Address" />
                  </div>

                  {/* NEW: CALL REQUEST CHECKBOX */}
                  <label className="flex items-center gap-3 cursor-pointer group mt-2 w-fit p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                    <div className="relative flex items-center justify-center shrink-0">
                      <input 
                        type="checkbox" 
                        checked={form.needsCall} 
                        onChange={e => setForm({...form, needsCall: e.target.checked})} 
                        className="peer sr-only" 
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form.needsCall ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                        <Check size={12} className={`text-white transition-opacity ${form.needsCall ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                    </div>
                    <span className={`text-sm font-bold transition-colors ${form.needsCall ? 'text-blue-700' : 'text-slate-600'}`}>
                      I have some questions. Please schedule a quick call with me.
                    </span>
                  </label>
                </div>
              </div>

              {/* SUMMARY & SUBMIT */}
              <div className="pt-6">
                <div className="flex items-center justify-between mb-6 px-2">
                  <span className="text-sm font-bold text-slate-500">Total Value</span>
                  <span className="text-3xl font-black italic text-slate-900">R{calculateTotal()}</span>
                </div>
                
                <button type="submit" disabled={isSubmitting || explicitWeeks.length === 0} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Complete Request"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 text-center border-t border-slate-200 bg-white">
        <p className="text-2xl font-black tracking-tighter italic uppercase text-slate-300 mb-2">RAD_Academy</p>
      </footer>

    </div>
  );
}