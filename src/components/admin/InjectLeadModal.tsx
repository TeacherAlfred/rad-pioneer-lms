"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, User, Phone, Mail, Globe, MapPin, Loader2, Save, Search, ArrowDownToLine, AlertTriangle, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const INITIAL_SOURCES = ['LinkedIn', 'Meta Ad', 'Referral', 'Website', 'Cold Outreach', 'Event', 'Other'];

interface InjectLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  adminId: string;
}

export default function InjectLeadModal({ isOpen, onClose, onSuccess, adminId }: InjectLeadModalProps) {
  const router = useRouter();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // CRM Import Search
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pipeline Duplicate Warning
  const [duplicateLead, setDuplicateLead] = useState<any | null>(null);

  // Dynamic Sources
  const [availableSources, setAvailableSources] = useState<string[]>(INITIAL_SOURCES);
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [customSourceText, setCustomSourceText] = useState('');

  const [newLead, setNewLead] = useState({
    full_name: '',
    contact_number: '',
    email: '',
    lead_source: 'LinkedIn',
    location: ''
  });

  // Fetch unique sources from existing leads to populate the dropdown
  useEffect(() => {
    async function fetchUniqueSources() {
      const { data } = await supabase.from('growth_leads').select('lead_source');
      if (data) {
        const dbSources = data.map(d => d.lead_source).filter(Boolean);
        const combined = Array.from(new Set([...INITIAL_SOURCES, ...dbSources]));
        setAvailableSources(combined);
      }
    }
    if (isOpen) fetchUniqueSources();
  }, [isOpen]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Auto-Search Logic for Prospects (Import) & Growth Leads (Duplicates)
  useEffect(() => {
    const searchDatabases = async () => {
      const query = newLead.full_name.trim();
      if (query.length < 3) {
        setSearchResults([]);
        setShowDropdown(false);
        setDuplicateLead(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // 1. Search CRM Prospects (for importing data)
        const { data: prospects } = await supabase
          .from('prospects')
          .select('id, name, email, phone, source')
          .ilike('name', `%${query}%`)
          .limit(5);

        if (prospects && prospects.length > 0) {
          setSearchResults(prospects);
          setShowDropdown(true);
        } else {
          setSearchResults([]);
          setShowDropdown(false);
        }

        // 2. Search Growth Leads (to warn about pipeline duplicates)
        const { data: duplicates } = await supabase
          .from('growth_leads')
          .select('id, full_name, stage')
          .ilike('full_name', `%${query}%`)
          .eq('admin_id', adminId)
          .limit(1);

        if (duplicates && duplicates.length > 0) {
          setDuplicateLead(duplicates[0]);
        } else {
          setDuplicateLead(null);
        }

      } catch (err) {
        console.error("Error searching databases:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      searchDatabases();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [newLead.full_name, adminId]);

  const handleSelectProspect = (prospect: any) => {
    let mappedSource = 'Other';
    if (prospect.source && availableSources.includes(prospect.source)) {
      mappedSource = prospect.source;
    } else if (prospect.source?.includes('Meta') || prospect.source?.includes('Facebook')) {
      mappedSource = 'Meta Ad';
    } else if (prospect.source?.includes('Referral')) {
      mappedSource = 'Referral';
    } else if (prospect.source?.includes('Website')) {
      mappedSource = 'Website';
    }

    setNewLead({
      full_name: prospect.name || '',
      contact_number: prospect.phone || '',
      email: prospect.email || '',
      lead_source: mappedSource,
      location: '' 
    });
    
    setShowDropdown(false);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '_custom_') {
      setIsCustomSource(true);
      setNewLead({ ...newLead, lead_source: '_custom_' });
    } else {
      setIsCustomSource(false);
      setNewLead({ ...newLead, lead_source: val });
    }
  };

  const resetForm = () => {
    setNewLead({ full_name: '', contact_number: '', email: '', lead_source: availableSources[0] || 'LinkedIn', location: '' });
    setDuplicateLead(null);
    setSearchResults([]);
    setShowDropdown(false);
    setIsCustomSource(false);
    setCustomSourceText('');
    setIsRedirecting(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.full_name.trim()) return alert("Name is required");
    
    const finalSource = isCustomSource ? customSourceText.trim() : newLead.lead_source;
    if (isCustomSource && !finalSource) return alert("Please enter a custom lead source.");

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('growth_leads').insert([{
        admin_id: adminId,
        full_name: newLead.full_name,
        contact_number: newLead.contact_number,
        email: newLead.email,
        lead_source: finalSource,
        location: newLead.location,
        stage: 'Sourced',
        warmth: 'Cold'
      }]).select('id').single();

      if (error) throw error;

      setIsRedirecting(true);
      
      // Delay navigation slightly so the loading state is visible and DB settles
      setTimeout(() => {
        router.push(`/admin/acquisition/${data.id}`);
        onSuccess();
        resetForm();
      }, 1200);

    } catch (err: any) {
      alert("Failed to add lead: " + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={!isRedirecting ? handleClose : undefined} 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }} 
            className="relative w-full max-w-lg bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl overflow-visible"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 flex items-center gap-2">
                  <ArrowDownToLine className="text-fuchsia-500" size={24}/> Inject Lead
                </h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Search CRM or create new</p>
              </div>
              <button disabled={isRedirecting} onClick={handleClose} className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors border border-slate-200 disabled:opacity-50"><X size={16}/></button>
            </div>

            {/* Pipeline Duplicate Warning */}
            <AnimatePresence>
              {duplicateLead && !isRedirecting && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <AlertTriangle size={16} strokeWidth={2.5}/>
                      <span className="text-[10px] font-black uppercase tracking-widest">Pipeline Duplicate Detected</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-3">
                      <span className="text-slate-900 italic">{duplicateLead.full_name}</span> is already in your pipeline at the <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-amber-600">{duplicateLead.stage}</span> stage.
                    </p>
                    <div className="flex gap-3">
                      <Link 
                        href={`/admin/acquisition/${duplicateLead.id}`} 
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink size={14}/> View Existing
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleAddLead} className="space-y-5">
              
              {/* Auto-Complete Search Field */}
              <div className="space-y-2 relative" ref={dropdownRef}>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5 justify-between">
                  <span className="flex items-center gap-1.5"><User size={12}/> Full Name *</span>
                  {isSearching && <Loader2 size={10} className="animate-spin text-fuchsia-500" />}
                </label>
                
                <div className="relative">
                  <input 
                    required 
                    type="text" 
                    disabled={isRedirecting}
                    value={newLead.full_name} 
                    onChange={e => setNewLead({...newLead, full_name: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all disabled:opacity-50" 
                    placeholder="Search prospect or type new name..." 
                    autoComplete="off"
                  />
                  {newLead.full_name.length > 0 && <Search size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />}
                </div>

                {/* Dropdown Results for importing CRM Prospects */}
                <AnimatePresence>
                  {showDropdown && searchResults.length > 0 && !isRedirecting && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
                    >
                      <div className="p-2 bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Import Data from Prospects CRM
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {searchResults.map((prospect) => (
                          <div 
                            key={prospect.id} 
                            onClick={() => handleSelectProspect(prospect)}
                            className="p-3 hover:bg-fuchsia-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors group"
                          >
                            <p className="text-sm font-black text-slate-800 group-hover:text-fuchsia-600 transition-colors">{prospect.name}</p>
                            <div className="flex gap-3 mt-1 text-[10px] font-bold text-slate-500">
                              {prospect.email && <span>{prospect.email}</span>}
                              {prospect.phone && <span>{prospect.phone}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5"><Phone size={12}/> Phone</label>
                  <input type="tel" disabled={isRedirecting} value={newLead.contact_number} onChange={e => setNewLead({...newLead, contact_number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all disabled:opacity-50" placeholder="+27..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5"><Mail size={12}/> Email</label>
                  <input type="email" disabled={isRedirecting} value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all disabled:opacity-50" placeholder="john@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5"><Globe size={12}/> Lead Source</label>
                  <select 
                    disabled={isRedirecting}
                    value={newLead.lead_source} 
                    onChange={handleSourceChange} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="_custom_" className="text-fuchsia-600 font-black">+ Add Custom Source...</option>
                  </select>

                  {/* Dynamic Custom Source Input */}
                  {isCustomSource && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                      <input 
                        type="text" 
                        required
                        disabled={isRedirecting}
                        value={customSourceText} 
                        onChange={e => setCustomSourceText(e.target.value)} 
                        className="w-full bg-white border border-fuchsia-200 rounded-xl px-4 py-2.5 text-sm font-bold text-fuchsia-900 placeholder:text-fuchsia-300 outline-none focus:border-fuchsia-500 transition-all disabled:opacity-50" 
                        placeholder="Type new source name..." 
                      />
                    </motion.div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5"><MapPin size={12}/> Location</label>
                  <input type="text" disabled={isRedirecting} value={newLead.location} onChange={e => setNewLead({...newLead, location: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all disabled:opacity-50" placeholder="e.g., Centurion" />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" disabled={isRedirecting} onClick={handleClose} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isSubmitting || isRedirecting} className="flex-[2] py-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-600/20 transition-all disabled:opacity-50">
                  {isRedirecting ? (
                    <><Loader2 size={16} className="animate-spin" /> Routing to Workspace...</>
                  ) : isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Save size={16}/> Save Lead</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}