'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Download, Trash2, Hash, Activity, Target, Loader2, CheckCircle2, X, Edit2, Plus, Eye, ChevronLeft, ChevronRight, Check, ListChecks, Inbox, UserPlus, MapPin, Flag, AlertTriangle, Layers, FilterX } from 'lucide-react';

interface Cub {
  cub_initial: string;
  grade: string;
  class_name: string;
}

export default function IreneResponseManager() {
  const [records, setRecords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
  const [viewFilter, setViewFilter] = useState<'pending' | 'verified' | 'flagged' | 'name_review'>('pending');
  const [classFilter, setClassFilter] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const firstInputRef = useRef<HTMLInputElement>(null);

  const initialFormState = {
    cubs: [{ cub_initial: '', grade: '', class_name: '' }] as Cub[],
    parent_first_name: '',
    q_why_start: '', q_club: '', q_boss_level: '', q_longest_distance: '',
    q_shoes: '', q_weird_habit: '', q_funny_fail: '', q_proudest_moment: '',
    goal_tags: [] as string[], activity_tags: [] as string[], club_tags: [] as string[]
  };

  const [formData, setFormData] = useState(initialFormState);
  
  const [goalInput, setGoalInput] = useState('');
  const [activityInput, setActivityInput] = useState('');
  const [clubInput, setClubInput] = useState('');
  
  const [allKnownGoals, setAllKnownGoals] = useState<string[]>([]);
  const [allKnownActivities, setAllKnownActivities] = useState<string[]>([]);
  const [allKnownClubs, setAllKnownClubs] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('irene_responses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setRecords(data);
      
      const uniqueGoals = new Set<string>();
      const uniqueActivities = new Set<string>();
      const uniqueClubs = new Set<string>();
      
      data.forEach(row => {
        (row.goal_tags || []).forEach((t: string) => uniqueGoals.add(t));
        (row.activity_tags || []).forEach((t: string) => uniqueActivities.add(t));
        (row.club_tags || []).forEach((t: string) => uniqueClubs.add(t));
      });
      
      setAllKnownGoals(Array.from(uniqueGoals).sort());
      setAllKnownActivities(Array.from(uniqueActivities).sort());
      setAllKnownClubs(Array.from(uniqueClubs).sort());
    }
  };

  // Reset class filter if we leave verified mode
  useEffect(() => {
    if (viewFilter !== 'verified') setClassFilter(null);
  }, [viewFilter]);

  // --- Filtering Logic ---
  const displayedRecords = records.filter(r => {
    // 1. Status Filter
    let matchesStatus = false;
    if (viewFilter === 'verified') matchesStatus = r.is_verified;
    else if (viewFilter === 'flagged') matchesStatus = r.is_flagged;
    else if (viewFilter === 'name_review') matchesStatus = r.needs_name_review;
    else matchesStatus = !r.is_verified;

    if (!matchesStatus) return false;

    // 2. Class Filter (Optional)
    if (classFilter) {
        return r.cubs?.some((c: any) => c.class_name === classFilter);
    }

    return true;
  });

  // Calculate classes available in the current view filter (ignoring the class filter itself)
  const availableClasses = Array.from(new Set(
    records
      .filter(r => viewFilter === 'verified' ? r.is_verified : viewFilter === 'flagged' ? r.is_flagged : viewFilter === 'name_review' ? r.needs_name_review : !r.is_verified)
      .flatMap(r => r.cubs?.map((c: any) => c.class_name).filter(Boolean))
  )).sort();

  const safeIndex = Math.min(currentIndex, Math.max(0, displayedRecords.length - 1));
  const activeRecord = displayedRecords[safeIndex];

  useEffect(() => {
    if (currentIndex !== safeIndex) setCurrentIndex(safeIndex);
  }, [currentIndex, safeIndex]);

  // --- Handlers ---
  const handleSwitchToEdit = () => {
    if (!activeRecord) return;
    setFormData({
      ...activeRecord,
      parent_first_name: activeRecord.parent_first_name || '',
      q_why_start: activeRecord.q_why_start || '',
      q_club: activeRecord.q_club || '',
      q_boss_level: activeRecord.q_boss_level || '',
      q_longest_distance: activeRecord.q_longest_distance || '',
      q_weird_habit: activeRecord.q_weird_habit || '',
      q_funny_fail: activeRecord.q_funny_fail || '',
      q_proudest_moment: activeRecord.q_proudest_moment || '',
      cubs: activeRecord.cubs && activeRecord.cubs.length > 0 ? activeRecord.cubs : [{ cub_initial: '', grade: '', class_name: '' }],
      q_shoes: activeRecord.q_shoes !== null && activeRecord.q_shoes !== undefined ? String(activeRecord.q_shoes) : '',
      goal_tags: activeRecord.goal_tags || [],
      activity_tags: activeRecord.activity_tags || [],
      club_tags: activeRecord.club_tags || []
    });
    setMode('edit');
  };

  const handleSwitchToCreate = () => { setFormData(initialFormState); setMode('create'); };
  const handleSwitchToView = () => setMode('view');
  const goNext = () => setCurrentIndex(prev => Math.min(displayedRecords.length - 1, prev + 1));
  const goPrev = () => setCurrentIndex(prev => Math.max(0, prev - 1));

  const handleToggleVerify = async () => {
    if (!activeRecord) return;
    setIsSubmitting(true);
    const newValue = !activeRecord.is_verified;
    try {
      const { error } = await supabase.from('irene_responses').update({ is_verified: newValue }).eq('id', activeRecord.id);
      if (error) throw error;
      setRecords(prev => prev.map(r => r.id === activeRecord.id ? { ...r, is_verified: newValue } : r));
    } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
  };

  const handleToggleFlag = async () => {
    if (!activeRecord) return;
    setIsSubmitting(true);
    const newValue = !activeRecord.is_flagged;
    try {
      const { error } = await supabase.from('irene_responses').update({ is_flagged: newValue }).eq('id', activeRecord.id);
      if (error) throw error;
      setRecords(prev => prev.map(r => r.id === activeRecord.id ? { ...r, is_flagged: newValue } : r));
    } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
  };

  const handleToggleNameReview = async () => {
    if (!activeRecord) return;
    setIsSubmitting(true);
    const newValue = !activeRecord.needs_name_review;
    try {
      const { error } = await supabase.from('irene_responses').update({ needs_name_review: newValue }).eq('id', activeRecord.id);
      if (error) throw error;
      setRecords(prev => prev.map(r => r.id === activeRecord.id ? { ...r, needs_name_review: newValue } : r));
    } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCubChange = (index: number, field: keyof Cub, value: string) => {
    const newCubs = [...formData.cubs];
    newCubs[index][field] = value;
    setFormData(prev => ({ ...prev, cubs: newCubs }));
  };

  const handleAddCub = () => {
    setFormData(prev => ({ ...prev, cubs: [...prev.cubs, { cub_initial: '', grade: '', class_name: '' }] }));
  };

  const handleRemoveCub = (index: number) => {
    setFormData(prev => ({ ...prev, cubs: prev.cubs.filter((_, i) => i !== index) }));
  };

  const handleAddTag = (type: 'goal_tags' | 'activity_tags' | 'club_tags', value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const cleanTag = value.trim().replace(/,/g, '');
    if (cleanTag && !formData[type].includes(cleanTag)) {
      setFormData(prev => ({ ...prev, [type]: [...prev[type], cleanTag] }));
      if (type === 'goal_tags' && !allKnownGoals.includes(cleanTag)) setAllKnownGoals(prev => [...prev, cleanTag].sort());
      else if (type === 'activity_tags' && !allKnownActivities.includes(cleanTag)) setAllKnownActivities(prev => [...prev, cleanTag].sort());
      else if (type === 'club_tags' && !allKnownClubs.includes(cleanTag)) setAllKnownClubs(prev => [...prev, cleanTag].sort());
    }
    setter('');
  };

  const removeTag = (type: 'goal_tags' | 'activity_tags' | 'club_tags', tagToRemove: string) => {
    setFormData(prev => ({ ...prev, [type]: prev[type].filter(t => t !== tagToRemove) }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'goal_tags' | 'activity_tags' | 'club_tags', input: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddTag(type, input, setter); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData, q_shoes: formData.q_shoes ? parseInt(formData.q_shoes, 10) : null };
      if (mode === 'edit') {
        const activeId = activeRecord.id;
        const { error } = await supabase.from('irene_responses').update(payload).eq('id', activeId);
        if (error) throw error;
        setRecords(prev => prev.map(r => r.id === activeId ? { ...payload, id: activeId, is_verified: activeRecord.is_verified, is_flagged: activeRecord.is_flagged, needs_name_review: activeRecord.needs_name_review } : r));
        setMode('view');
      } else {
        const { data, error } = await supabase.from('irene_responses').insert([{ ...payload, is_verified: false, is_flagged: false, needs_name_review: false }]).select();
        if (error) throw error;
        if (data && data.length > 0) { setRecords(prev => [data[0], ...prev]); setViewFilter('pending'); setCurrentIndex(0); }
        setFormData(initialFormState);
        firstInputRef.current?.focus();
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (error: any) { alert(error.message); } finally { setIsSubmitting(false); }
  };

  const handleDeleteRecord = async () => { 
    if (!activeRecord) return;
    if (window.confirm(`Delete ${activeRecord.parent_first_name}?`)) {
      const { error } = await supabase.from('irene_responses').delete().eq('id', activeRecord.id);
      if (!error) setRecords(prev => prev.filter(r => r.id !== activeRecord.id));
    }
  };

  const handleExportCSV = async () => { 
    setIsExporting(true);
    try {
      if (records.length === 0) return;
      const headers = Object.keys(records[0]).join(',');
      const rows = records.map(row => Object.values(row).map(val => Array.isArray(val) || typeof val === 'object' ? `"${JSON.stringify(val).replace(/"/g, '""')}"` : `"${String(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } finally { setIsExporting(false); }
  };

  const suggestedActivities = activityInput.trim() ? allKnownActivities.filter(t => t.toLowerCase().includes(activityInput.toLowerCase()) && !formData.activity_tags.includes(t)) : [];
  const suggestedGoals = goalInput.trim() ? allKnownGoals.filter(t => t.toLowerCase().includes(goalInput.toLowerCase()) && !formData.goal_tags.includes(t)) : [];
  const suggestedClubs = clubInput.trim() ? allKnownClubs.filter(t => t.toLowerCase().includes(clubInput.toLowerCase()) && !formData.club_tags.includes(t)) : [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 pb-24 relative">
      
      {/* LEFT HOVERING ACTIONS */}
      <div className="fixed top-24 left-6 z-50 flex flex-col gap-3 opacity-30 hover:opacity-100 transition-opacity duration-300">
        <button onClick={handleSwitchToView} title="View Mode" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${mode === 'view' ? 'bg-[#0066cc] text-white shadow-[#0066cc]/30' : 'bg-white text-slate-500 hover:text-[#0066cc]'}`}><Eye size={20} /></button>
        <button onClick={handleSwitchToEdit} title="Edit Record" disabled={displayedRecords.length === 0} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'edit' ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white text-slate-500 hover:text-amber-500'}`}><Edit2 size={20} /></button>
        {mode === 'view' && displayedRecords.length > 0 && (
          <>
            <button onClick={handleToggleFlag} disabled={isSubmitting} title={activeRecord?.is_flagged ? "Unflag" : "Flag Profiling"} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 ${activeRecord?.is_flagged ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-white text-slate-500 hover:text-rose-500'}`}><Flag size={20} fill={activeRecord?.is_flagged ? "currentColor" : "none"} /></button>
            <button onClick={handleToggleNameReview} disabled={isSubmitting} title={activeRecord?.needs_name_review ? "Clear Review" : "Flag Name Review"} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 ${activeRecord?.needs_name_review ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white text-slate-500 hover:text-amber-500'}`}><AlertTriangle size={20} fill={activeRecord?.needs_name_review ? "currentColor" : "none"} /></button>
            <button onClick={handleToggleVerify} disabled={isSubmitting} title={activeRecord?.is_verified ? "Un-verify" : "Verify"} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 ${activeRecord?.is_verified ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-white text-slate-500 hover:text-emerald-500'}`}>{activeRecord?.is_verified ? <X size={24} /> : <Check size={24} />}</button>
          </>
        )}
        <div className="w-12 h-px bg-slate-200 my-2" />
        <button onClick={() => setViewFilter('pending')} title="Pending" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'pending' ? 'bg-slate-800 text-white shadow-slate-800/30' : 'bg-white text-slate-400 hover:text-slate-800'}`}><Inbox size={20} /></button>
        <button onClick={() => setViewFilter('verified')} title="Verified" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'verified' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-white text-slate-400 hover:text-emerald-500'}`}><ListChecks size={20} /></button>
        <button onClick={() => setViewFilter('flagged')} title="Flagged" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'flagged' ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-white text-slate-400 hover:text-rose-500'}`}><Flag size={20} /></button>
        <button onClick={() => setViewFilter('name_review')} title="Name Review" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'name_review' ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white text-slate-400 hover:text-amber-500'}`}><AlertTriangle size={20} /></button>
        <div className="w-12 h-px bg-slate-200 my-2" />
        <button onClick={handleSwitchToCreate} title="Create" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${mode === 'create' ? 'bg-[#0066cc] text-white shadow-[#0066cc]/30' : 'bg-white text-slate-500 hover:text-[#0066cc]'}`}><Plus size={24} /></button>
      </div>

      {/* RIGHT HOVERING CLASSES DRAWER */}
      {availableClasses.length > 0 && (
        <div className="fixed top-24 right-6 z-50 flex flex-col items-end gap-3 group opacity-40 hover:opacity-100 transition-opacity duration-300">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${classFilter ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500'}`}>
            <Layers size={20} />
          </div>
          <div className="flex-col gap-2 items-end hidden group-hover:flex">
            {classFilter && (
                <button onClick={() => setClassFilter(null)} className="px-4 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2 hover:bg-rose-600 transition-colors">
                    <FilterX size={12} /> Clear Filter
                </button>
            )}
            {availableClasses.map((className) => (
              <button 
                key={className} 
                onClick={() => setClassFilter(classFilter === className ? null : className)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg border border-slate-100 flex items-center gap-2 transition-all hover:scale-105
                  ${classFilter === className ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 hover:bg-indigo-50'}`}
              >
                <Hash size={12} className={classFilter === className ? 'text-indigo-200' : 'text-indigo-400'} />
                {className}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ml-16 md:ml-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl 
              ${viewFilter === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : 
                viewFilter === 'flagged' ? 'bg-rose-500/10 text-rose-500' : 
                viewFilter === 'name_review' ? 'bg-amber-500/10 text-amber-500' : 
                'bg-slate-800/10 text-slate-800'}`}>
              <Hash size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black italic uppercase leading-none">{displayedRecords.length}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {classFilter ? `${classFilter} (${viewFilter})` : 
                 viewFilter === 'pending' ? 'Pending QA' : 
                 viewFilter === 'verified' ? 'Verified Responses' : 
                 viewFilter === 'name_review' ? 'Needs Verification' : 
                 'Flagged Profiles'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleExportCSV} disabled={isExporting} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors">
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Backup CSV
            </button>
            <button onClick={handleDeleteRecord} disabled={!activeRecord || displayedRecords.length === 0} className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50">
              <Trash2 size={16} /> Delete Record
            </button>
          </div>
        </div>

        {/* --- VIEW MODE --- */}
        {mode === 'view' && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden relative ml-16 md:ml-0">
            {displayedRecords.length === 0 ? (
              <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">
                {classFilter ? `No ${viewFilter} records found for class ${classFilter}.` : 
                 viewFilter === 'pending' ? "Inbox Zero! No pending records." : 
                 viewFilter === 'verified' ? "No verified records yet." : 
                 viewFilter === 'name_review' ? "No names pending review." : 
                 "No flagged profiles."}
              </div>
            ) : (
              <>
                <div className="p-8 pb-0">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">
                      {viewFilter === 'pending' ? 'QA Viewer' : viewFilter === 'verified' ? 'Verified Archive' : viewFilter === 'name_review' ? 'Name Review' : 'Profile Inspector'}
                    </h3>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-400">Record {safeIndex + 1} of {displayedRecords.length}</span>
                      <div className="flex gap-1">
                        <button onClick={goPrev} disabled={safeIndex === 0} className="p-2 bg-slate-50 hover:bg-[#0066cc] hover:text-white rounded-lg transition-colors disabled:opacity-30 text-slate-600"><ChevronLeft size={16}/></button>
                        <button onClick={goNext} disabled={safeIndex === displayedRecords.length - 1} className="p-2 bg-slate-50 hover:bg-[#0066cc] hover:text-white rounded-lg transition-colors disabled:opacity-30 text-slate-600"><ChevronRight size={16}/></button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 pb-8">
                    {/* View: The Basics */}
                    <div className="flex items-start md:items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative">
                      <div className="absolute top-4 right-6 flex flex-col gap-2 items-end">
                        {activeRecord?.is_flagged && <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200"><Flag size={12} fill="currentColor" /><span className="text-[9px] font-black uppercase tracking-widest">Flagged</span></div>}
                        {activeRecord?.needs_name_review && <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200"><AlertTriangle size={12} fill="currentColor" /><span className="text-[9px] font-black uppercase tracking-widest">Verification</span></div>}
                      </div>
                      <div className="w-16 h-16 mt-2 md:mt-0 bg-[#0066cc]/10 text-[#0066cc] rounded-full flex items-center justify-center font-black text-2xl shadow-inner shrink-0 uppercase overflow-hidden">{String(activeRecord?.cubs?.[0]?.cub_initial || '').charAt(0)}</div>
                      <div className="flex-1 min-w-0 pr-40">
                        <h4 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 truncate">{activeRecord?.parent_first_name}</h4>
                        <div className="flex flex-wrap gap-2 mt-2">{activeRecord?.cubs?.map((cub: any, i: number) => (<span key={i} className="text-[9px] font-black text-slate-600 bg-slate-200 px-2 py-1 rounded uppercase tracking-widest">Parent of {cub.cub_initial} • {cub.grade} ({cub.class_name})</span>))}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2"><h5 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] flex items-center gap-1.5"><Activity size={12}/> Activity Tags</h5><div className="flex flex-wrap gap-2">{activeRecord?.activity_tags?.map((t:string) => <span key={t} className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">{t}</span>)}</div></div>
                      <div className="space-y-2"><h5 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] flex items-center gap-1.5"><Target size={12}/> Goal Tags</h5><div className="flex flex-wrap gap-2">{activeRecord?.goal_tags?.map((t:string) => <span key={t} className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">{t}</span>)}</div></div>
                      <div className="space-y-2"><h5 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] flex items-center gap-1.5"><MapPin size={12}/> Club Tags</h5><div className="flex flex-wrap gap-2">{activeRecord?.club_tags?.map((t:string) => <span key={t} className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">{t}</span>)}</div></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4 border-t border-slate-100">
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Why start exercising?</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_why_start || '-'}</p></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Superhero Team / Club?</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_club || '-'}</p></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Boss Level Race/Goal</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_boss_level || '-'}</p></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Longest Distance</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_longest_distance || '-'}</p></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Weirdest food/drink</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_weird_habit || '-'}</p></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pairs of Shoes</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_shoes ?? '-'}</p></div>
                      <div className="md:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funniest/Embarrassing Fail</p><p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{activeRecord?.q_funny_fail || '-'}"</p></div>
                      <div className="md:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Proudest Moment</p><p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{activeRecord?.q_proudest_moment || '-'}"</p></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- EDIT / CREATE MODE FORM --- */}
        {(mode === 'edit' || mode === 'create') && (
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 space-y-8 relative overflow-hidden ml-16 md:ml-0">
            {showSuccess && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse" />}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4"><h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">{mode === 'edit' ? 'Edit Response' : 'Rapid Data Entry'}</h3><div className="flex items-center gap-3">{showSuccess && <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><CheckCircle2 size={14}/> Saved</span>}<button type="button" onClick={handleSwitchToView} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">Cancel</button></div></div>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100"><div className="flex items-center justify-between mb-2"><h4 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">Part 1: Parent & Pioneer Details</h4><button type="button" onClick={handleAddCub} className="text-[9px] font-black uppercase tracking-widest text-[#0066cc] bg-[#0066cc]/10 hover:bg-[#0066cc]/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><UserPlus size={12}/> Add Sibling</button></div>
                <div className="mb-4"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parent Name(s)</label><input ref={firstInputRef} required name="parent_first_name" value={formData.parent_first_name} onChange={handleInputChange} className="w-full max-w-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-3 border-t border-slate-200 pt-4">{formData.cubs.map((cub, index) => (<div key={index} className="grid grid-cols-12 gap-3 items-end"><div className="col-span-4"><label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Name/Initial</label><input required value={cub.cub_initial} onChange={(e) => handleCubChange(index, 'cub_initial', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div><div className="col-span-4"><label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Grade</label><input required value={cub.grade} onChange={(e) => handleCubChange(index, 'grade', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div><div className="col-span-3"><label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Class</label><input value={cub.class_name} onChange={(e) => handleCubChange(index, 'class_name', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div>{formData.cubs.length > 1 && (<div className="col-span-1 pb-1"><button type="button" onClick={() => handleRemoveCub(index)} className="p-2 text-rose-400 hover:bg-rose-100 rounded-lg"><Trash2 size={16}/></button></div>)}</div>))}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative"><h4 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] flex items-center gap-1.5 mb-2"><Activity size={12}/> Activity Tags</h4><div className="bg-white border border-slate-200 rounded-lg p-2 min-h-[42px] flex flex-wrap gap-1.5 focus-within:border-[#0066cc]">{formData.activity_tags.map(tag => (<span key={tag} className="bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1">{tag} <X size={10} className="cursor-pointer" onClick={() => removeTag('activity_tags', tag)} /></span>))}<input type="text" value={activityInput} onChange={(e) => setActivityInput(e.target.value)} onKeyDown={(e) => handleTagKeyDown(e, 'activity_tags', activityInput, setActivityInput)} placeholder="Type..." className="flex-1 min-w-[80px] text-xs outline-none bg-transparent" /></div>{suggestedActivities.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border shadow-lg rounded-lg z-10 p-1 flex flex-wrap gap-1">{suggestedActivities.map(tag => (<button key={tag} type="button" onClick={() => handleAddTag('activity_tags', tag, setActivityInput)} className="text-[10px] font-bold uppercase bg-slate-50 hover:bg-blue-50 px-2 py-1 rounded-md">{tag}</button>))}</div>)}</div>
                <div className="relative"><h4 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] flex items-center gap-1.5 mb-2"><Target size={12}/> Goal Tags</h4><div className="bg-white border border-slate-200 rounded-lg p-2 min-h-[42px] flex flex-wrap gap-1.5 focus-within:border-[#0066cc]">{formData.goal_tags.map(tag => (<span key={tag} className="bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1">{tag} <X size={10} className="cursor-pointer" onClick={() => removeTag('goal_tags', tag)} /></span>))}<input type="text" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} onKeyDown={(e) => handleTagKeyDown(e, 'goal_tags', goalInput, setGoalInput)} placeholder="Type..." className="flex-1 min-w-[80px] text-xs outline-none bg-transparent" /></div>{suggestedGoals.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border shadow-lg rounded-lg z-10 p-1 flex flex-wrap gap-1">{suggestedGoals.map(tag => (<button key={tag} type="button" onClick={() => handleAddTag('goal_tags', tag, setGoalInput)} className="text-[10px] font-bold uppercase bg-slate-50 hover:bg-amber-50 px-2 py-1 rounded-md">{tag}</button>))}</div>)}</div>
                <div className="relative"><h4 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] flex items-center gap-1.5 mb-2"><MapPin size={12}/> Club Tags</h4><div className="bg-white border border-slate-200 rounded-lg p-2 min-h-[42px] flex flex-wrap gap-1.5 focus-within:border-[#0066cc]">{formData.club_tags.map(tag => (<span key={tag} className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1">{tag} <X size={10} className="cursor-pointer" onClick={() => removeTag('club_tags', tag)} /></span>))}<input type="text" value={clubInput} onChange={(e) => setClubInput(e.target.value)} onKeyDown={(e) => handleTagKeyDown(e, 'club_tags', clubInput, setClubInput)} placeholder="Type..." className="flex-1 min-w-[80px] text-xs outline-none bg-transparent" /></div>{suggestedClubs.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border shadow-lg rounded-lg z-10 p-1 flex flex-wrap gap-1">{suggestedClubs.map(tag => (<button key={tag} type="button" onClick={() => handleAddTag('club_tags', tag, setClubInput)} className="text-[10px] font-bold uppercase bg-slate-50 hover:bg-indigo-50 px-2 py-1 rounded-md">{tag}</button>))}</div>)}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Why start exercising?</label><input name="q_why_start" value={formData.q_why_start} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Superhero Team / Club?</label><input name="q_club" value={formData.q_club} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Boss Level Race/Goal</label><input name="q_boss_level" value={formData.q_boss_level} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Longest Distance</label><input name="q_longest_distance" value={formData.q_longest_distance} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Weirdest food/drink</label><input name="q_weird_habit" value={formData.q_weird_habit} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Pairs of Shoes</label><input type="number" name="q_shoes" value={formData.q_shoes} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Funniest/Embarrassing Fail</label><input name="q_funny_fail" value={formData.q_funny_fail} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
                <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Proudest Moment</label><input name="q_proudest_moment" value={formData.q_proudest_moment} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-100 flex justify-end"><button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-12 py-4 bg-[#0066cc] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 hover:bg-blue-700">{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {mode === 'edit' ? 'Update Response' : 'Save & Next'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}