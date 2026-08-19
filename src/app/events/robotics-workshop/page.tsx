"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays, MapPin, Clock, Cpu, Zap, ShieldCheck, CheckCircle2,
  Loader2, AlertCircle, Sparkles, User, Phone, Mail, Rocket,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { dateOptionsWithCombo } from "@/components/RegisterInterestModal";

type DateOption = { id: string; label: string; starts_at: string };

type Program = {
  id: string;
  title: string;
  location: string | null;
  details: string | null;
  duration: string | null;
  image_url: string;
  date_options: DateOption[];
  allow_multi_date: boolean;
};

// Standalone page for the Robotics Workshop, styled after the
// events/[slug] pattern (hero / learn cards / logistics / enrollment
// form) but deliberately NOT built on that page's system - [slug] events
// write into a separate Neon/Drizzle table (radGrowthLeads) with no
// WhatsApp notification at all. This form goes through the same
// featured_programs + /api/register-interest pipeline as the rest of the
// site, so it lands in the one leads table and fires the same immediate
// WhatsApp admin alert (see notifyAdminOfRegistration in
// src/lib/registerInterest.ts) - "one lead, one pipeline" instead of a
// fourth place lead data can end up.
const LEARN_CARDS = [
  { icon: Cpu, title: "Real Circuits & Wiring", desc: "Hands-on with actual components - not a simulation. Your child builds a working circuit from scratch." },
  { icon: Zap, title: "Logic That Sticks", desc: "The same boolean logic behind the games they already play, made concrete and physical." },
  { icon: ShieldCheck, title: "Skills They Take Home", desc: "A finished build and the confidence to explain how it works - to you, and to anyone who asks." },
];

export default function RoboticsWorkshopPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string | null>(null);
  const [dateOptionId, setDateOptionId] = useState('');

  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '', numberOfChildren: '1' });
  const [botField, setBotField] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('featured_programs')
        .select('id, title, location, details, duration, image_url, date_options, allow_multi_date')
        .in('title', ['Pretoria Robotics Workshop', 'Polokwane Robotics Circuit']);
      const rows = data || [];
      setPrograms(rows);
      if (rows.length > 0) setCity(rows[0].location);
      setLoading(false);
    }
    load();
  }, []);

  const activeProgram = useMemo(() => programs.find(p => p.location === city) || null, [programs, city]);
  const dateOptions = dateOptionsWithCombo(activeProgram?.date_options || [], activeProgram?.allow_multi_date);

  useEffect(() => { setDateOptionId(''); }, [city]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!activeProgram) return;
    if (dateOptions.length > 0 && !dateOptionId) return setError('Please select a date.');

    const n = parseInt(form.numberOfChildren, 10);
    if (!n || n < 1) return setError('Please enter at least 1 child.');
    if (!form.fullName.trim()) return setError('Please enter your name.');

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register-interest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: activeProgram.id,
          date_option_id: dateOptionId || null,
          number_of_children: n,
          preferred_channel: 'whatsapp',
          email: form.email.trim(),
          full_name: form.fullName.trim(),
          whatsapp_number: form.whatsapp.trim() || undefined,
          consent: true,
          bot_field: botField,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-blue-600 font-black uppercase tracking-widest text-xs">Loading Details...</p>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-center px-6">
        <Rocket size={48} className="text-slate-300" />
        <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800">Not Currently Open</h1>
        <p className="text-slate-500 max-w-sm">The Robotics Workshop isn't accepting registrations right now - check back soon, or explore what else is on.</p>
        <Link href="/" className="mt-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all">Back to RAD Academy</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30 overflow-x-hidden">

      {/* HERO */}
      <section className="relative min-h-[75vh] flex flex-col justify-center px-6 lg:px-12 pt-24 pb-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-100/50 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
              <Sparkles size={14} /> Open for Registration
            </div>

            <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600">
                Robotics Workshop
              </span>
            </h1>

            <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
              Real hardware, small groups. Your child builds a working circuit and takes home the skills that got them there.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a href="#enroll" className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs text-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                Secure a Spot
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative hidden lg:block">
            <div className="relative aspect-[4/5] md:aspect-square rounded-[40px] overflow-hidden border border-slate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] bg-white">
              {activeProgram?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeProgram.image_url} alt="Robotics Workshop" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                  <Rocket size={120} className="text-slate-200" />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* WHAT THEY WILL LEARN */}
      <section className="py-24 px-6 lg:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">What They Will Learn</h2>
            <p className="text-slate-500 mt-4 font-medium max-w-2xl mx-auto">A hands-on, practical approach to building real digital skills.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LEARN_CARDS.map(card => (
              <motion.div key={card.title} whileHover={{ y: -5 }} className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
                <card.icon className="absolute -right-4 -bottom-4 size-32 text-slate-200/50 group-hover:text-blue-100 transition-colors" />
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6 relative z-10 shadow-sm">
                  <card.icon size={24} />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight mb-3 relative z-10 text-slate-900">{card.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed relative z-10">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CITY PICKER + LOGISTICS */}
      <section className="py-16 border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          {programs.length > 1 && (
            <div className="flex justify-center gap-3 mb-10">
              {programs.map(p => (
                <button
                  key={p.id}
                  onClick={() => setCity(p.location)}
                  className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs border transition-all ${
                    city === p.location ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {p.location}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="flex items-center gap-6 pt-4 md:pt-0">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0 shadow-sm"><CalendarDays size={28} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Available Dates</p>
                <p className="text-lg font-black text-slate-900">{dateOptions.length > 0 ? `${dateOptions.length} option${dateOptions.length === 1 ? '' : 's'}` : 'TBA'}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 pt-8 md:pt-0 md:pl-8">
              <div className="w-16 h-16 rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center border border-fuchsia-200 shrink-0 shadow-sm"><Clock size={28} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Duration</p><p className="text-lg font-black text-slate-900">{activeProgram?.duration || 'TBA'}</p></div>
            </div>
            <div className="flex items-center gap-6 pt-8 md:pt-0 md:pl-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0 shadow-sm"><MapPin size={28} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Location</p><p className="text-lg font-black text-slate-900">{activeProgram?.location || 'TBA'}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ENROLLMENT FORM */}
      <section id="enroll" className="py-24 px-6 lg:px-12 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-slate-900">Secure a Spot</h2>
            <p className="text-slate-500 mt-3 text-sm md:text-base max-w-lg mx-auto">No payment required today. Fill in your details and our team will reach out via WhatsApp to confirm.</p>
          </div>

          {isSuccess ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 border border-emerald-200 rounded-[32px] p-12 text-center shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={80} className="text-emerald-500 mx-auto mb-6" />
              <h3 className="text-3xl font-black uppercase tracking-widest text-emerald-900 mb-4">Request Received</h3>
              <p className="text-emerald-700 text-lg">Thanks! We'll follow up with pricing and next steps within 1 business day.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-[32px] p-8 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] space-y-8">
              {programs.length > 1 && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Location</label>
                  <div className="grid grid-cols-2 gap-3">
                    {programs.map(p => (
                      <button
                        key={p.id} type="button" onClick={() => setCity(p.location)}
                        className={`py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs border transition-all ${city === p.location ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        {p.location}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {dateOptions.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Preferred Date</label>
                  <select required value={dateOptionId} onChange={e => setDateOptionId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors cursor-pointer font-medium">
                    <option value="" disabled>Choose a date...</option>
                    {dateOptions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Number of Children</label>
                <input required type="number" min={1} value={form.numberOfChildren} onChange={e => setForm(f => ({ ...f, numberOfChildren: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><User size={16} /></div>
                  <input required type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="Your Name" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Phone size={16} /></div>
                  <input type="tel" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="WhatsApp Number (optional)" />
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Mail size={16} /></div>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="Email Address" />
              </div>

              <input type="text" value={botField} onChange={e => setBotField(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

              <p className="text-[11px] text-slate-400 leading-relaxed">
                By submitting, you consent to RAD Academy contacting you, and to your child's information being used to prepare a quotation, in line with our privacy policy.
              </p>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-red-700 text-xs font-bold">{error}</p>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Secure My Spot"}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="py-12 text-center border-t border-slate-200 bg-white">
        <p className="text-2xl font-black tracking-tighter italic uppercase text-slate-300 mb-2">RAD_Academy</p>
      </footer>
    </div>
  );
}
