"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, Sparkles, Info, CalendarClock, CalendarRange, Calendar
} from "lucide-react";

const QUESTION_TOPICS = [
  "Pricing & Packages",
  "Curriculum & Coding Languages",
  "Hardware & Robot Kits",
  "Scheduling & Timeslots",
  "Other"
];

// Helper: 48 Hours from now for manual requests
const getMinCustomDate = () => {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 2);
  return minDate.toISOString().split('T')[0];
};

export default function PremiumIntroBooking() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);

  // Form State
  const [parentName, setParentName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [hasQuestions, setHasQuestions] = useState<boolean | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  
  // Advanced Scheduling State
  const [globalSlots, setGlobalSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  
  const [isCustomRequest, setIsCustomRequest] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  useEffect(() => {
    async function fetchAvailability() {
      try {
        const { data: availData } = await supabase.from('admin_calling_availability').select('*');
        const { data: bookingsData } = await supabase.from('pending_bookings').select('requested_time').neq('status', 'rejected');
        
        if (availData) {
          const globalLimit = availData[0]?.display_limit || 3;
          const bookedTimestamps = (bookingsData || []).map(b => new Date(b.requested_time).getTime());
          
          let generated: any[] = [];
          
          // START TOMORROW (No Same Day Bookings)
          let loopDate = new Date();
          loopDate.setHours(0, 0, 0, 0);
          
          // Look up to 21 days ahead to find enough open slots
          for (let i = 1; i <= 21; i++) {
            let testDate = new Date(loopDate);
            testDate.setDate(loopDate.getDate() + i);
            const dayName = testDate.toLocaleDateString('en-US', { weekday: 'long' });
            
            const windows = availData.filter(w => w.day_of_week === dayName);
            windows.forEach(w => {
              let current = new Date(testDate);
              const [sH, sM] = w.start_time.split(':');
              current.setHours(parseInt(sH), parseInt(sM), 0, 0);
              
              let end = new Date(testDate);
              const [eH, eM] = w.end_time.split(':');
              end.setHours(parseInt(eH), parseInt(eM), 0, 0);
              
              while(current < end) {
                if (!bookedTimestamps.includes(current.getTime())) {
                  generated.push({
                    timestamp: current.getTime(),
                    isoObj: new Date(current),
                    // Use a longer, clearer format for the headers
                    label: current.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
                    time: current.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                  });
                }
                current.setMinutes(current.getMinutes() + 30); // 30 Min increments
              }
            });
          }
          
          // Sort chronologically and slice by global limit
          const finalSlots = generated.sort((a,b) => a.timestamp - b.timestamp).slice(0, globalLimit);
          setGlobalSlots(finalSlots);
        }
      } catch (err) {
        console.error("Failed to load schedule", err);
      } finally {
        setIsLoadingSchedule(false);
      }
    }
    fetchAvailability();
  }, []);

  // Group slots by Date Label to make rendering much cleaner
  const groupedSlots = useMemo(() => {
    return globalSlots.reduce((acc, slot) => {
      if (!acc[slot.label]) acc[slot.label] = [];
      acc[slot.label].push(slot);
      return acc;
    }, {} as Record<string, any[]>);
  }, [globalSlots]);

  const slideVariants = {
    enter: { y: 50, opacity: 0 },
    center: { y: 0, opacity: 1, transition: { duration: 0.4 } },
    exit: { y: -50, opacity: 0, transition: { duration: 0.3 } }
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let finalTimestampStr = "";
      let notesStr = hasQuestions && selectedTopics.length > 0 ? `Questions: ${selectedTopics.join(', ')}` : `No specific questions.`;

      if (isCustomRequest) {
        const [hours, mins] = customTime.split(':');
        const d = new Date(customDate);
        d.setHours(parseInt(hours), parseInt(mins), 0, 0);
        finalTimestampStr = d.toISOString();
        notesStr += `\n\n[MANUAL REQUEST]: Parent requested this specific off-schedule time.`;
      } else {
        finalTimestampStr = selectedSlot.isoObj.toISOString();
      }

      const { error } = await supabase.from('pending_bookings').insert({
        parent_name: parentName,
        whatsapp_number: whatsapp,
        requested_time: finalTimestampStr,
        notes: notesStr,
        status: 'pending'
      });

      if (error) throw error;
      setStep(4);
    } catch (err) {
      console.error("Booking failed:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-slate-50 flex flex-col font-sans overflow-hidden text-slate-800">
      
      {/* 1. VISUAL PROGRESS BAR */}
      <div className="h-2 w-full bg-slate-200 fixed top-0 left-0 z-50">
        <div className="h-full bg-blue-600 transition-all duration-700 ease-out relative" style={{ width: `${(step / 3) * 100}%` }}>
          {step > 0 && step < 4 && (
             <div className="absolute -bottom-8 right-0 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-100 px-2 py-1 rounded shadow-sm">
               Step {step} of 3
             </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="p-6 md:p-10 flex justify-between items-center absolute top-0 w-full z-40 pointer-events-none">
        <img 
          src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png" 
          alt="RAD Academy Logo" 
          className="h-8 md:h-10 w-auto object-contain pointer-events-auto"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 w-full max-w-3xl mx-auto">
        <AnimatePresence mode="wait" custom={1}>
          
          {/* STEP 0 */}
          {step === 0 && (
            <motion.div key="step-0" variants={slideVariants} initial="enter" animate="center" exit="exit" className="text-center space-y-8 w-full">
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-[1.1]">
                Let's map out your child's <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">tech future.</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-500 max-w-xl mx-auto">
                Schedule a quick 15-minute introductory call with our engineering educators to see if RAD Academy is the right fit.
              </p>
              <button onClick={nextStep} className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-900/20">
                Begin <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <motion.div key="step-1" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full space-y-10">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">1. What are your contact details?</h2>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold text-blue-600 uppercase tracking-widest mb-2">Your Name</label>
                  <input autoFocus type="text" value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Type your full name here..." className="w-full bg-transparent border-b-2 border-slate-200 focus:border-blue-600 text-3xl md:text-4xl font-bold text-slate-900 placeholder:text-slate-300 outline-none pb-4 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-blue-600 uppercase tracking-widest mb-2">WhatsApp Number</label>
                  <input 
                    type="tel" 
                    value={whatsapp} 
                    onChange={e => setWhatsapp(e.target.value.replace(/[^0-9\s+]/g, ''))} 
                    placeholder="082 123 4567" 
                    className="w-full bg-transparent border-b-2 border-slate-200 focus:border-blue-600 text-3xl md:text-4xl font-bold text-slate-900 placeholder:text-slate-300 outline-none pb-4 transition-colors" 
                  />
                  
                  <p className="text-sm font-medium text-slate-500 mt-3 flex items-start gap-2">
                    <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
                    We require this in order to send confirmation of your booking, as well as a reminder prior to the scheduled appointment time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={prevStep} className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300 rounded-full font-black text-sm uppercase tracking-widest transition-all">
                  <ArrowLeft size={18} />
                </button>
                <button onClick={nextStep} disabled={!parentName || !whatsapp} className="flex-1 sm:flex-none inline-flex justify-center items-center gap-3 px-8 py-4 bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full font-black text-sm uppercase tracking-widest transition-all">
                  Continue <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <motion.div key="step-2" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full space-y-8">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">2. Do you have any specific questions?</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => { setHasQuestions(false); setTimeout(nextStep, 300); }} className={`p-6 rounded-3xl text-left border-2 transition-all ${hasQuestions === false ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <h3 className={`text-xl font-black mb-2 ${hasQuestions === false ? 'text-blue-700' : 'text-slate-800'}`}>No, just looking around.</h3>
                  <p className="text-slate-500 text-sm">We'll just give you a brief overview of how the academy works.</p>
                </button>
                
                <button onClick={() => setHasQuestions(true)} className={`p-6 rounded-3xl text-left border-2 transition-all ${hasQuestions === true ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <h3 className={`text-xl font-black mb-2 ${hasQuestions === true ? 'text-blue-700' : 'text-slate-800'}`}>Yes, I have questions.</h3>
                  <p className="text-slate-500 text-sm">Let us know what you want to focus on during our call.</p>
                </button>
              </div>

              <AnimatePresence>
                {hasQuestions === true && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4">Select Topics (Optional)</p>
                    <div className="flex flex-wrap gap-3">
                      {QUESTION_TOPICS.map(topic => (
                        <button key={topic} onClick={() => toggleTopic(topic)} className={`px-5 py-3 rounded-xl text-sm font-bold transition-all border-2 ${selectedTopics.includes(topic) ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                          {topic}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3 pt-4">
                <button onClick={prevStep} className="px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300 rounded-full font-black text-sm uppercase tracking-widest transition-all">
                  <ArrowLeft size={18} />
                </button>
                {hasQuestions !== null && (
                  <button onClick={nextStep} className="inline-flex justify-center items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all">
                    Continue <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <motion.div key="step-3" variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full space-y-6 flex flex-col h-full md:h-auto pb-20 md:pb-0">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 shrink-0">3. When should we call?</h2>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                {isLoadingSchedule ? (
                  <div className="flex justify-center items-center py-10 text-slate-500 gap-2"><Loader2 className="animate-spin"/> Locating next available slots...</div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2"><CalendarClock size={16}/> Next Available Slots</p>
                    
                    {/* Render Grouped Slots */}
                    {Object.entries(groupedSlots).map(([dateLabel, slotsForDay]: [string, any]) => (
                      <div key={dateLabel} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                          <Calendar size={16} className="text-blue-500"/> {dateLabel}
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {(slotsForDay as any[]).map((slot: any) => {
                            const isSelected = selectedSlot?.timestamp === slot.timestamp && !isCustomRequest;
                            return (
                              <button 
                                key={slot.timestamp}
                                onClick={() => { setIsCustomRequest(false); setSelectedSlot(slot); }}
                                className={`px-6 py-3 rounded-2xl text-center border-2 transition-all font-black text-lg ${isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700'}`}
                              >
                                {slot.time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* ESCAPE HATCH: Custom Request */}
                    <div className="pt-6 border-t border-slate-200">
                       <button 
                         onClick={() => setIsCustomRequest(true)}
                         className={`w-full p-6 rounded-3xl text-left border-2 transition-all flex items-start gap-4 ${isCustomRequest ? 'border-slate-900 bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'}`}
                       >
                         <CalendarRange className={`mt-1 shrink-0 ${isCustomRequest ? 'text-slate-400' : 'text-slate-400'}`} size={24} />
                         <div>
                           <h3 className="text-lg font-black mb-1">None of these work?</h3>
                           <p className={`text-sm ${isCustomRequest ? 'text-slate-400' : 'text-slate-500'}`}>Request a specific day and time, and we will do our best to accommodate.</p>
                         </div>
                       </button>

                       <AnimatePresence>
                         {isCustomRequest && (
                           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                             <div className="grid grid-cols-2 gap-4 pt-4">
                               <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Select Date</label>
                                 <input type="date" min={getMinCustomDate()} value={customDate} onChange={e => setCustomDate(e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-slate-800 outline-none focus:border-slate-900" />
                               </div>
                               <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Select Time</label>
                                 <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-slate-800 outline-none focus:border-slate-900" />
                               </div>
                             </div>
                             <p className="text-xs font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-4">Note: Manual requests require 48 hours notice.</p>
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>

              {/* CLEAR BACK & SUBMIT BUTTONS */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200 shrink-0">
                <button onClick={prevStep} className="px-6 py-5 bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300 rounded-2xl font-black text-sm uppercase tracking-widest transition-all">
                  <ArrowLeft size={18} />
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || (isCustomRequest ? (!customDate || !customTime) : !selectedSlot)} 
                  className="flex-1 inline-flex justify-center items-center gap-3 px-8 py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:-translate-y-1 transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirm Call Request"}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <motion.div key="step-4" variants={slideVariants} initial="enter" animate="center" exit="exit" className="text-center space-y-6 w-full">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
                Call Requested!
              </h2>
              <p className="text-lg md:text-xl text-slate-500 max-w-md mx-auto leading-relaxed">
                Thanks, {parentName.split(' ')[0]}. We have noted your request. We will confirm your slot via WhatsApp shortly.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}