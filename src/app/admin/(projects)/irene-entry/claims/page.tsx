'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Gift, Phone, Mail, UserPlus, ChevronRight, ArrowLeft, Loader2, CheckCircle2, Users, Trash2, PlusCircle, Ticket } from 'lucide-react';
import Link from 'next/link';

// Import your Drizzle Server Action for Irene records
import { getIreneAdminRecords } from '@/app/actions/irene-admin';
// Import your Drizzle Server Action for Injecting leads into RAD records
import { injectGrowthLead } from '@/app/actions/rad-admin';

const MY_ADMIN_ID = 'adfefd6c-954c-4e13-9423-5519aa89980a';

export default function VoucherClaimsPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  
  // Advanced Search State
  const [parentSearch, setParentSearch] = useState('');
  const [childSearch, setChildSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  
  // Lead Injection State
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [leadForm, setLeadForm] = useState({
    email: '',
    phone: '',
    warmth: 'Hot',
    stage: 'Sourced',
    lead_source: 'Irene Voucher Claim',
    ips_voucher: true, 
    children: [{ name: '', grade: '' }]
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchIreneRecords();
  }, []);

  async function fetchIreneRecords() {
    setLoading(true);
    // Fetch directly from Neon via Drizzle Server Action
    const res = await getIreneAdminRecords();
    
    if (res.success && res.data) {
      setRecords(res.data);
    } else {
      console.error("Failed to fetch Irene records from Neon:", res.error);
    }
    setLoading(false);
  }

  // --- Dynamic Extractors (Handling Drizzle schema mapping) ---
  const availableGrades = Array.from(new Set(
    records.flatMap(r => r.cubs?.map((c: any) => c.grade || c.Grade).filter(Boolean))
  )).sort();

  const getChildDisplay = (r: any) => {
    // If the record has the JSONB cubs array
    if (r.cubs && r.cubs.length > 0) {
      return r.cubs.map((c: any) => {
        const name = c.cub_full_name || c.cubFullName || c.cub_initial || c.cubInitial || 'Unknown';
        const grade = c.grade || c.Grade || '';
        const className = c.class_name || c.className || '';
        const suffix = [grade, className].filter(Boolean).join(' ');
        
        return suffix ? `${name} [${suffix}]` : name;
      }).join(', ');
    }
    
    // Fallback to top-level Drizzle columns if cubs array is empty
    const name = r.cubInitial || r.cub_initial || 'Unknown';
    const grade = r.grade || r.Grade || '';
    const className = r.className || r.class_name || '';
    const suffix = [grade, className].filter(Boolean).join(' ');
    
    return suffix ? `${name} [${suffix}]` : name;
  };

  // --- Search Logic & Alphabetical Sort ---
  const filteredRecords = records.filter(r => {
    let match = true;
    
    const parentName = (r.parentFirstName || r.parent_first_name || '').toLowerCase();
    if (parentSearch && !parentName.includes(parentSearch.toLowerCase())) {
      match = false;
    }
    
    // Broadened child search to look for full name or initial inclusion
    if (childSearch) {
      const query = childSearch.toLowerCase();
      const hasChildMatch = r.cubs?.some((c: any) => {
        const childName = (c.cub_full_name || c.cubFullName || c.cub_initial || c.cubInitial || '').toLowerCase();
        return childName.includes(query);
      });
      
      // Also check top-level initial if cubs array is missing
      const topLevelInitial = (r.cubInitial || r.cub_initial || '').toLowerCase();
      if (!hasChildMatch && !topLevelInitial.includes(query)) {
        match = false;
      }
    }

    if (gradeFilter) {
      const hasGradeMatch = r.cubs?.some((c: any) => c.grade === gradeFilter || c.Grade === gradeFilter);
      const topLevelGradeMatch = (r.grade === gradeFilter || r.Grade === gradeFilter);
      if (!hasGradeMatch && !topLevelGradeMatch) match = false;
    }
    
    return match;
  }).sort((a, b) => {
    // Sort alphabetically by parent name
    const nameA = (a.parentFirstName || a.parent_first_name || '').toLowerCase();
    const nameB = (b.parentFirstName || b.parent_first_name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const handleSelectRecord = (record: any) => {
    setSelectedRecord(record);
    
    // Extract children to prepopulate the form (Handling JSONB structure)
    const prepopulatedChildren = record.cubs && record.cubs.length > 0 
      ? record.cubs.map((c: any) => ({ 
          name: c.cub_full_name || c.cubFullName || c.cub_initial || c.cubInitial || '', 
          grade: c.grade || c.Grade || '' 
        }))
      : [{ 
          name: record.cubInitial || record.cub_initial || '', 
          grade: record.grade || '' 
        }];

    setLeadForm({
      email: '',
      phone: '',
      warmth: 'Hot',
      stage: 'Sourced',
      lead_source: 'Irene Voucher Claim',
      ips_voucher: true,
      children: prepopulatedChildren
    });
    setShowSuccess(false);
  };

  // --- Child Form Handlers ---
  const handleAddChild = () => {
    setLeadForm(prev => ({ ...prev, children: [...prev.children, { name: '', grade: '' }] }));
  };

  const handleRemoveChild = (index: number) => {
    setLeadForm(prev => ({ ...prev, children: prev.children.filter((_, i) => i !== index) }));
  };

  const handleChildChange = (index: number, field: 'name' | 'grade', value: string) => {
    const newChildren = [...leadForm.children];
    newChildren[index][field] = value;
    setLeadForm(prev => ({ ...prev, children: newChildren }));
  };

  // --- Injection Logic (Sending to Supabase) ---
  const handleInjectLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    
    setIsSubmitting(true);
    try {
      // Compile Irene Form answers into a clean text block using Drizzle properties
      const formNotes = `IRENE FORM RESPONSES:
- Why Start: ${selectedRecord.qWhyStart || 'N/A'}
- Superhero Club: ${selectedRecord.qClub || 'N/A'}
- Boss Level Goal: ${selectedRecord.qBossLevel || 'N/A'}
- Longest Distance: ${selectedRecord.qLongestDistance || 'N/A'}
- Shoe Pairs: ${selectedRecord.qShoes || 'N/A'}
- Weird Habit: ${selectedRecord.qWeirdHabit || 'N/A'}
- Funniest Fail: ${selectedRecord.qFunnyFail || 'N/A'}
- Proudest Moment: ${selectedRecord.qProudestMoment || 'N/A'}
- Tags: ${[...(selectedRecord.activityTags || []), ...(selectedRecord.goalTags || [])].join(', ') || 'None'}`;

      const payload = {
        admin_id: MY_ADMIN_ID,
        full_name: selectedRecord.parentFirstName || selectedRecord.parent_first_name,
        email: leadForm.email,
        contact_number: leadForm.phone,
        lead_source: leadForm.lead_source,
        stage: leadForm.stage,
        warmth: leadForm.warmth,
        kids_count: leadForm.children.length,
        notes: formNotes, 
        metadata: {
          ips_voucher_claimed: leadForm.ips_voucher,
          children: leadForm.children,
          irene_record_id: selectedRecord.id
        }
      };

      // USE NEON SERVER ACTION
      const res = await injectGrowthLead(payload);
      if (!res.success) throw new Error(res.error);
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedRecord(null);
        setParentSearch('');
        setChildSearch('');
      }, 2000);

    } catch (err: any) {
      alert("Failed to inject lead: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-12 font-sans selection:bg-fuchsia-500/30">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-4">
            <Link href="/admin/irene-entry" className="group flex items-center gap-2 bg-white border border-slate-200 hover:border-emerald-500/50 px-4 py-2 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Back to QA</span>
            </Link>
            <div>
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Gift size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Campaign_Bridge_v1</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none text-slate-900">
                Voucher <span className="text-emerald-500">Claims</span>
              </h1>
            </div>
          </div>
          
          <Link href="/admin/acquisition" className="px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-fuchsia-600/20 flex items-center gap-2">
            View Pipeline <ChevronRight size={14}/>
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANEL: ADVANCED SEARCH & SELECT */}
          <div className="lg:col-span-6 xl:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6 flex flex-col h-[calc(100vh-250px)]">
              
              {/* Filter Controls */}
              <div className="space-y-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by Parent Name (Main)..." 
                    value={parentSearch}
                    onChange={(e) => setParentSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Child Name / Initial..." 
                      value={childSearch}
                      onChange={(e) => setChildSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <select 
                    value={gradeFilter} 
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">All Grades</option>
                    {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Results: {filteredRecords.length}</span>
                  {(parentSearch || childSearch || gradeFilter) && (
                    <button onClick={() => { setParentSearch(''); setChildSearch(''); setGradeFilter(''); }} className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600">Clear Filters</button>
                  )}
                </div>
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 border-t border-slate-100 pt-4">
                {loading ? (
                  <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={32}/></div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-xs font-black uppercase tracking-widest">No matching records found</p>
                  </div>
                ) : (
                  filteredRecords.map(record => (
                    <button
                      key={record.id}
                      onClick={() => handleSelectRecord(record)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                        selectedRecord?.id === record.id 
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-[1.02]' 
                          : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      <div>
                        <p className={`font-bold ${selectedRecord?.id === record.id ? 'text-white' : 'text-slate-900'}`}>
                          {record.parentFirstName || record.parent_first_name || 'Unknown Parent'}
                        </p>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${selectedRecord?.id === record.id ? 'text-emerald-100' : 'text-slate-500'}`}>
                          Child: {getChildDisplay(record)}
                        </p>
                      </div>
                      <div className={`p-2 rounded-xl transition-colors ${selectedRecord?.id === record.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                        <ChevronRight size={18} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: INJECT LEAD */}
          <div className="lg:col-span-6 xl:col-span-7 relative">
            {!selectedRecord ? (
              <div className="sticky top-8 bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-[32px] p-12 flex flex-col items-center justify-center text-center h-[calc(100vh-250px)]">
                <Users size={48} className="text-slate-300 mb-4" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Select a Profile</h3>
                <p className="text-xs font-medium text-slate-500 mt-2 max-w-sm">Use the filters on the left to locate the parent who just messaged you, then inject their details directly into the pipeline.</p>
              </div>
            ) : (
              <div className="sticky top-8 bg-white border border-slate-200 rounded-[32px] shadow-xl overflow-hidden animate-in slide-in-from-right-8 duration-300 h-[calc(100vh-250px)] flex flex-col">
                {showSuccess && (
                  <div className="absolute inset-0 z-50 bg-emerald-500 flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
                    <CheckCircle2 size={64} className="mb-4" />
                    <h3 className="text-2xl font-black uppercase tracking-widest">Lead Injected!</h3>
                    <p className="text-sm font-bold text-emerald-100 mt-2">Form data & notes sent to Pipeline</p>
                  </div>
                )}
                
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xl border border-emerald-200">
                      {(selectedRecord.parentFirstName || selectedRecord.parent_first_name || 'U').charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">{selectedRecord.parentFirstName || selectedRecord.parent_first_name}</h2>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={10}/> Verified Irene Respondent
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  <form id="injection-form" onSubmit={handleInjectLead} className="space-y-8">
                    
                    {/* Contact Info */}
                    <div className="space-y-4 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Lead Contact Info</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 ml-1"><Phone size={12}/> WhatsApp Number</label>
                          <input 
                            required
                            type="tel" 
                            value={leadForm.phone} 
                            onChange={(e) => setLeadForm({...leadForm, phone: e.target.value})} 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" 
                            placeholder="e.g. 076 906 5959" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 ml-1"><Mail size={12}/> Email Address</label>
                          <input 
                            type="email" 
                            value={leadForm.email} 
                            onChange={(e) => setLeadForm({...leadForm, email: e.target.value})} 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" 
                            placeholder="Optional" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* IPS Voucher & Pipeline Setup */}
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 p-4 border border-emerald-200 bg-emerald-50 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={leadForm.ips_voucher} 
                          onChange={(e) => setLeadForm({...leadForm, ips_voucher: e.target.checked})}
                          className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-black text-emerald-800 flex items-center gap-2"><Ticket size={16}/> Claiming R250 IPS Voucher</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-1">Check this to flag the lead as a voucher redemption.</p>
                        </div>
                      </label>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Initial Warmth</label>
                          <select 
                            value={leadForm.warmth} 
                            onChange={(e) => setLeadForm({...leadForm, warmth: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-900 outline-none focus:border-fuchsia-500"
                          >
                            <option value="Hot">🔥 Hot</option>
                            <option value="Warm">📊 Warm</option>
                            <option value="Cold">❄️ Cold</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Pipeline Stage</label>
                          <select 
                            value={leadForm.stage} 
                            onChange={(e) => setLeadForm({...leadForm, stage: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-900 outline-none focus:border-fuchsia-500"
                          >
                            <option value="Sourced">Sourced</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Engaged">Engaged</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Children List */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Child Details</h4>
                        <button type="button" onClick={handleAddChild} className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1">
                          <PlusCircle size={12}/> Add Child
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {leadForm.children.map((child, index) => (
                          <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                            <div className="flex-1">
                              <input 
                                required
                                type="text" 
                                value={child.name} 
                                onChange={(e) => handleChildChange(index, 'name', e.target.value)} 
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" 
                                placeholder="Child Name/Initial" 
                              />
                            </div>
                            <div className="w-1/3">
                              <input 
                                required
                                type="text" 
                                value={child.grade} 
                                onChange={(e) => handleChildChange(index, 'grade', e.target.value)} 
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-fuchsia-500" 
                                placeholder="Grade" 
                              />
                            </div>
                            {leadForm.children.length > 1 && (
                              <button type="button" onClick={() => handleRemoveChild(index)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                <Trash2 size={16}/>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </form>
                </div>

                <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                  <button 
                    form="injection-form"
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full py-4 bg-slate-900 hover:bg-fuchsia-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} 
                    Inject to Pipeline with Irene Notes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}