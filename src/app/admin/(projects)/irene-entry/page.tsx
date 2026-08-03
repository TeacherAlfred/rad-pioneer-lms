'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Save, Download, Trash2, Hash, Activity, Target, Loader2, CheckCircle2, X, Edit2, Plus, Eye, ChevronLeft, ChevronRight, Check, ListChecks, Inbox, UserPlus, MapPin, Flag, AlertTriangle, Layers, FilterX, Users, CopyX } from 'lucide-react';

// Import the new Server Actions
import { getIreneAdminRecords, toggleIreneStatus, deleteIreneRecord, saveIreneRecord } from '@/app/actions/irene-admin';

interface Cub {
  cub_full_name?: string;
  cub_initial: string;
  grade: string;
  class_name: string;
}

export default function IreneResponseManager() {
  const [records, setRecords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
  
  // Navigation & Filtering State
  const [viewFilter, setViewFilter] = useState<'pending' | 'verified' | 'flagged' | 'name_review'>('pending');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [sidebarMode, setSidebarMode] = useState<'parent' | 'child'>('parent');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const firstInputRef = useRef<HTMLInputElement>(null);

  const initialFormState = {
    cubs: [{ cub_full_name: '', cub_initial: '', grade: '', class_name: '' }] as Cub[],
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
    const res = await getIreneAdminRecords();
    
    if (res.success && res.data) {
      setRecords(res.data);
      
      const uniqueGoals = new Set<string>();
      const uniqueActivities = new Set<string>();
      const uniqueClubs = new Set<string>();
      
      res.data.forEach((row: any) => {
        (row.goal_tags || []).forEach((t: string) => uniqueGoals.add(t));
        (row.activity_tags || []).forEach((t: string) => uniqueActivities.add(t));
        (row.club_tags || []).forEach((t: string) => uniqueClubs.add(t));
      });
      
      setAllKnownGoals(Array.from(uniqueGoals).sort());
      setAllKnownActivities(Array.from(uniqueActivities).sort());
      setAllKnownClubs(Array.from(uniqueClubs).sort());
    } else {
      console.error("Failed to fetch records:", res.error);
    }
  };

  // Safe Extractors to bridge flat SQL rows and nested arrays
  const getGrade = (r: any) => r.cubs?.[0]?.grade || r.grade || 'Unknown';
  const getClass = (r: any) => r.cubs?.[0]?.class_name || r.class_name || 'Unknown';
  const getChild = (r: any) => r.cubs?.[0]?.cub_full_name || r.cubs?.[0]?.cub_initial || r.cub_full_name || r.cub_initial || 'Unknown';
  const getParent = (r: any) => r.parent_first_name || 'Unknown';

  // --- Reset class filter if grade changes ---
  useEffect(() => {
    setClassFilter('');
  }, [gradeFilter]);

  // --- Filtering & Grouping Logic ---
  const filteredRecords = records.filter(r => {
    // Hide deleted/duplicate records from the main pipeline
    if (r.is_duplicate) return false;

    // View Status
    if (viewFilter === 'verified' && !r.is_verified) return false;
    if (viewFilter === 'pending' && r.is_verified) return false;
    if (viewFilter === 'flagged' && !r.is_flagged) return false;
    if (viewFilter === 'name_review' && !r.needs_name_review) return false;

    // Dropdown Filters
    if (gradeFilter && getGrade(r) !== gradeFilter) return false;
    if (classFilter && getClass(r) !== classFilter) return false;

    return true;
  });

  // Group by Parent + Grade to identify potential duplicates
  const groups = new Map<string, any[]>();
  filteredRecords.forEach(r => {
    const pName = getParent(r).trim().toLowerCase();
    const gr = getGrade(r).trim().toLowerCase();
    const key = `${pName}||${gr}`;
    
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  const groupList = Array.from(groups.entries()).map(([key, recs]) => {
    const first = recs[0];
    const displayName = sidebarMode === 'parent' ? getParent(first) : getChild(first);
    return { key, displayName, records: recs };
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));

  // --- Cascading Dropdown Options ---
  const availableGrades = Array.from(new Set(records.map(getGrade))).filter(Boolean).sort();
  
  // Only show classes that belong to the currently selected grade
  const availableClasses = gradeFilter 
    ? Array.from(new Set(
        records
          .filter(r => getGrade(r) === gradeFilter)
          .map(getClass)
      )).filter(Boolean).sort()
    : [];

  // Selected Group Data
  const activeGroup = groupList.find(g => g.key === selectedGroupKey);
  const displayedGroupRecords = activeGroup ? activeGroup.records : [];
  
  const safeIndex = Math.min(currentIndex, Math.max(0, displayedGroupRecords.length - 1));
  const activeRecord = displayedGroupRecords[safeIndex];

  useEffect(() => {
    if (currentIndex !== safeIndex) setCurrentIndex(safeIndex);
  }, [currentIndex, safeIndex]);

  // Helper to auto-advance to next group
  const autoAdvance = () => {
    if (!selectedGroupKey) return;
    const currentIdx = groupList.findIndex(g => g.key === selectedGroupKey);
    if (currentIdx !== -1 && currentIdx < groupList.length - 1) {
      setSelectedGroupKey(groupList[currentIdx + 1].key);
      setCurrentIndex(0);
    } else {
      setSelectedGroupKey(null);
    }
  };

  // --- Handlers ---
  const handleSwitchToEdit = () => {
    if (!activeRecord) return;
    
    const defaultCubs = activeRecord.cubs && activeRecord.cubs.length > 0 
      ? activeRecord.cubs 
      : [{ 
          cub_full_name: activeRecord.cub_full_name || '',
          cub_initial: activeRecord.cub_initial || '', 
          grade: activeRecord.grade || '', 
          class_name: activeRecord.class_name || '' 
        }];

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
      cubs: defaultCubs,
      q_shoes: activeRecord.q_shoes !== null && activeRecord.q_shoes !== undefined ? String(activeRecord.q_shoes) : '',
      goal_tags: activeRecord.goal_tags || [],
      activity_tags: activeRecord.activity_tags || [],
      club_tags: activeRecord.club_tags || []
    });
    setMode('edit');
  };

  const handleSwitchToCreate = () => { 
    setSelectedGroupKey(null); 
    setFormData(initialFormState); 
    setMode('create'); 
  };
  
  const handleSwitchToView = () => setMode('view');
  const goNext = () => setCurrentIndex(prev => Math.min(displayedGroupRecords.length - 1, prev + 1));
  const goPrev = () => setCurrentIndex(prev => Math.max(0, prev - 1));

  const handleToggleVerify = async () => {
    if (!activeRecord) return;
    setIsSubmitting(true);
    const newValue = !activeRecord.is_verified;
    const res = await toggleIreneStatus(activeRecord.id, 'is_verified', newValue);
    
    if (res.success) {
      setRecords(prev => prev.map(r => r.id === activeRecord.id ? { ...r, is_verified: newValue } : r));
      // Auto-advance if we just verified a pending record
      if (newValue && viewFilter === 'pending') {
        if (displayedGroupRecords.length <= 1) autoAdvance();
      }
    } else {
      alert("Failed to verify: " + res.error);
    }
    setIsSubmitting(false);
  };

  const handleMarkDuplicate = async () => {
    if (!activeRecord) return;
    if (!window.confirm("Tag this record as a duplicate? It will be removed from the main view.")) return;
    
    setIsSubmitting(true);
    const res = await toggleIreneStatus(activeRecord.id, 'is_duplicate', true);
    if (res.success) {
      setRecords(prev => prev.map(r => r.id === activeRecord.id ? { ...r, is_duplicate: true } : r));
      if (displayedGroupRecords.length <= 1) autoAdvance();
      else setCurrentIndex(0);
    } else {
      alert("Failed to flag duplicate: " + res.error);
    }
    setIsSubmitting(false);
  };

  const handleToggleFlag = async () => {
    if (!activeRecord) return;
    setIsSubmitting(true);
    const newValue = !activeRecord.is_flagged;
    const res = await toggleIreneStatus(activeRecord.id, 'is_flagged', newValue);
    if (res.success) setRecords(prev => prev.map(r => r.id === activeRecord.id ? { ...r, is_flagged: newValue } : r));
    else alert("Failed to flag: " + res.error);
    setIsSubmitting(false);
  };

  const handleToggleNameReview = async () => {
    if (!activeRecord) return;
    setIsSubmitting(true);
    const newValue = !activeRecord.needs_name_review;
    const res = await toggleIreneStatus(activeRecord.id, 'needs_name_review', newValue);
    if (res.success) setRecords(prev => prev.map(r => r.id === activeRecord.id ? { ...r, needs_name_review: newValue } : r));
    else alert("Failed to update review status: " + res.error);
    setIsSubmitting(false);
  };

  const handleDeleteRecord = async () => { 
    if (!activeRecord) return;
    if (window.confirm(`Permanently Delete ${activeRecord.parent_first_name}?`)) {
      const res = await deleteIreneRecord(activeRecord.id);
      if (res.success) {
        setRecords(prev => prev.filter(r => r.id !== activeRecord.id));
        if (displayedGroupRecords.length <= 1) autoAdvance();
      } else alert("Failed to delete: " + res.error);
    }
  };

  // --- Form & Input Logic ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCubChange = (index: number, field: keyof Cub, value: string) => {
    const newCubs = [...formData.cubs];
    newCubs[index][field] = value;
    setFormData(prev => ({ ...prev, cubs: newCubs }));
  };

  const handleAddCub = () => setFormData(prev => ({ ...prev, cubs: [...prev.cubs, { cub_full_name: '', cub_initial: '', grade: '', class_name: '' }] }));
  const handleRemoveCub = (index: number) => setFormData(prev => ({ ...prev, cubs: prev.cubs.filter((_, i) => i !== index) }));

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
    
    const payload = { ...formData, q_shoes: formData.q_shoes ? parseInt(formData.q_shoes, 10) : null };
    const targetId = mode === 'edit' ? activeRecord.id : null;
    
    const res = await saveIreneRecord(targetId, payload);
    
    if (res.success) {
      if (mode === 'edit') {
        setRecords(prev => prev.map(r => r.id === targetId ? { 
          ...res.data, 
          is_verified: activeRecord.is_verified, 
          is_flagged: activeRecord.is_flagged, 
          needs_name_review: activeRecord.needs_name_review 
        } : r));
        setMode('view');
      } else {
        setRecords(prev => [{ ...res.data, is_verified: false, is_flagged: false, needs_name_review: false }, ...prev]); 
        setViewFilter('pending'); 
        setCurrentIndex(0);
        setFormData(initialFormState);
        firstInputRef.current?.focus();
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } else {
      alert("Failed to save: " + res.error);
    }
    setIsSubmitting(false);
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

  const renderCubsList = (record: any) => {
    if (record?.cubs && record.cubs.length > 0) {
      return record.cubs.map((cub: any, i: number) => {
        const displayName = cub.cub_full_name ? `${cub.cub_full_name} (${cub.cub_initial})` : cub.cub_initial;
        return (
          <span key={i} className="text-[9px] font-black text-slate-600 bg-slate-200 px-2 py-1 rounded uppercase tracking-widest">
            {displayName} • {cub.grade} ({cub.class_name})
          </span>
        );
      });
    }
    
    const fallbackName = record?.cub_full_name ? `${record?.cub_full_name} (${record?.cub_initial})` : record?.cub_initial;
    return (
      <span className="text-[9px] font-black text-slate-600 bg-slate-200 px-2 py-1 rounded uppercase tracking-widest">
        {fallbackName} • {record?.grade} ({record?.class_name})
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex overflow-hidden">
      
      {/* --- LEFT SIDEBAR (List & Filtering) --- */}
      <div className="w-80 bg-white border-r border-slate-200 h-screen flex flex-col shrink-0">
        
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-4">
          <div className="flex gap-2 p-1 bg-slate-200 rounded-lg">
            <button onClick={() => setSidebarMode('parent')} className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${sidebarMode === 'parent' ? 'bg-white shadow text-[#0066cc]' : 'text-slate-500 hover:text-slate-800'}`}>Parent</button>
            <button onClick={() => setSidebarMode('child')} className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${sidebarMode === 'child' ? 'bg-white shadow text-[#0066cc]' : 'text-slate-500 hover:text-slate-800'}`}>Child</button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-[#0066cc]">
              <option value="">All Grades</option>
              {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select 
              value={classFilter} 
              onChange={e => setClassFilter(e.target.value)} 
              disabled={!gradeFilter}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-[#0066cc] disabled:opacity-50 disabled:bg-slate-50"
            >
              <option value="">{gradeFilter ? 'All Classes' : 'Select Grade 1st'}</option>
              {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {groupList.length === 0 ? (
            <p className="text-center text-xs font-bold text-slate-400 mt-10 uppercase tracking-widest">No names found</p>
          ) : (
            groupList.map(group => (
              <button
                key={group.key}
                onClick={() => { setSelectedGroupKey(group.key); setMode('view'); setCurrentIndex(0); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group
                  ${selectedGroupKey === group.key ? 'bg-[#0066cc] text-white shadow-md' : 'hover:bg-slate-100 text-slate-700'}`}
              >
                <div className="truncate pr-3">
                  <p className="font-bold text-sm truncate">{group.displayName || 'Unknown'}</p>
                  <p className={`text-[10px] uppercase tracking-widest mt-0.5 truncate ${selectedGroupKey === group.key ? 'text-blue-200' : 'text-slate-400'}`}>
                    {sidebarMode === 'parent' ? `Child: ${getChild(group.records[0])}` : `Parent: ${getParent(group.records[0])}`}
                  </p>
                </div>
                {group.records.length > 1 && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${selectedGroupKey === group.key ? 'bg-white text-[#0066cc]' : 'bg-amber-100 text-amber-700'}`}>
                    {group.records.length}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* --- RIGHT HOVERING ACTIONS --- */}
      <div className="fixed top-24 right-6 z-50 flex flex-col items-end gap-3 opacity-30 hover:opacity-100 transition-opacity duration-300">
        <button onClick={handleSwitchToView} title="View Mode" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${mode === 'view' ? 'bg-[#0066cc] text-white shadow-[#0066cc]/30' : 'bg-white text-slate-500 hover:text-[#0066cc]'}`}><Eye size={20} /></button>
        <button onClick={handleSwitchToEdit} title="Edit Record" disabled={!selectedGroupKey} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'edit' ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white text-slate-500 hover:text-amber-500'}`}><Edit2 size={20} /></button>
        {mode === 'view' && selectedGroupKey && (
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

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 h-screen overflow-y-auto p-8 pb-24">
        
        <div className="max-w-4xl mx-auto space-y-6 relative pr-16">
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl 
                ${viewFilter === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : 
                  viewFilter === 'flagged' ? 'bg-rose-500/10 text-rose-500' : 
                  viewFilter === 'name_review' ? 'bg-amber-500/10 text-amber-500' : 
                  'bg-slate-800/10 text-slate-800'}`}>
                <Hash size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black italic uppercase leading-none">{filteredRecords.length} Total</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {viewFilter === 'pending' ? 'Pending QA' : 
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
            </div>
          </div>

          {!selectedGroupKey && mode !== 'create' ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <Users size={64} className="mb-6 opacity-20" />
              <h3 className="text-lg font-black uppercase tracking-widest text-slate-300">No Record Selected</h3>
              <p className="text-sm font-medium mt-2">Select a name from the left panel to begin verification.</p>
            </div>
          ) : mode === 'view' && activeRecord ? (
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="p-8 pb-0">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">
                    Response Explorer
                  </h3>
                  {displayedGroupRecords.length > 1 && (
                    <div className="flex items-center gap-4 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-200">
                      <span className="text-xs font-black uppercase tracking-widest">
                        Duplicate Match {safeIndex + 1} of {displayedGroupRecords.length}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={goPrev} disabled={safeIndex === 0} className="p-1.5 bg-white hover:bg-amber-500 hover:text-white rounded-lg transition-colors disabled:opacity-30 shadow-sm"><ChevronLeft size={16}/></button>
                        <button onClick={goNext} disabled={safeIndex === displayedGroupRecords.length - 1} className="p-1.5 bg-white hover:bg-amber-500 hover:text-white rounded-lg transition-colors disabled:opacity-30 shadow-sm"><ChevronRight size={16}/></button>
                      </div>
                    </div>
                  )}
                </div>

                {displayedGroupRecords.length > 1 && (
                  <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-rose-700 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={16}/> Possible Duplicates</h4>
                      <p className="text-xs text-rose-600 mt-1 font-medium">Multiple records found for this parent/grade. Review each using the arrows above. Keep one and flag the rest, or edit them to decouple.</p>
                    </div>
                    <button onClick={handleMarkDuplicate} disabled={isSubmitting} className="shrink-0 px-4 py-2 bg-white text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-600 hover:text-white transition-colors">
                      <CopyX size={14}/> Mark as Duplicate
                    </button>
                  </div>
                )}

                <div className="space-y-8 pb-8">
                  {/* View: The Basics */}
                  <div className="flex items-start md:items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative">
                    <div className="absolute top-4 right-6 flex flex-col gap-2 items-end">
                      {activeRecord?.is_flagged && <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200"><Flag size={12} fill="currentColor" /><span className="text-[9px] font-black uppercase tracking-widest">Flagged</span></div>}
                      {activeRecord?.needs_name_review && <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200"><AlertTriangle size={12} fill="currentColor" /><span className="text-[9px] font-black uppercase tracking-widest">Verification</span></div>}
                    </div>
                    <div className="w-16 h-16 mt-2 md:mt-0 bg-[#0066cc]/10 text-[#0066cc] rounded-full flex items-center justify-center font-black text-2xl shadow-inner shrink-0 uppercase overflow-hidden">
                      {String(activeRecord?.cubs?.[0]?.cub_initial || activeRecord?.cub_initial || '').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 pr-40">
                      <h4 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 truncate">{activeRecord?.parent_first_name}</h4>
                      <div className="flex flex-wrap gap-2 mt-2">{renderCubsList(activeRecord)}</div>
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
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Toughest Exercise/Longest Distance</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_longest_distance || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Weirdest food/drink</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_weird_habit || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pairs of Shoes</p><p className="text-sm font-medium text-slate-800">{activeRecord?.q_shoes ?? '-'}</p></div>
                    <div className="md:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funniest/Embarrassing Fail</p><p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{activeRecord?.q_funny_fail || '-'}"</p></div>
                    <div className="md:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Proudest Moment</p><p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{activeRecord?.q_proudest_moment || '-'}"</p></div>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button onClick={handleDeleteRecord} disabled={!activeRecord} className="px-5 py-2.5 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                      <Trash2 size={14} /> Hard Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* --- EDIT / CREATE MODE FORM --- */}
          {(mode === 'edit' || mode === 'create') && (
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 space-y-8 relative overflow-hidden">
              {showSuccess && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse" />}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">{mode === 'edit' ? 'Edit Response' : 'Rapid Data Entry'}</h3>
                <div className="flex items-center gap-3">
                  {showSuccess && <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><CheckCircle2 size={14}/> Saved</span>}
                  <button type="button" onClick={handleSwitchToView} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">Cancel</button>
                </div>
              </div>
              
              {mode === 'edit' && displayedGroupRecords.length > 1 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                  <p className="text-xs font-bold text-blue-800">Editing this record will decouple it from the duplicate group if you change the Parent Name or Grade.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">Part 1: Parent & Pioneer Details</h4>
                    <button type="button" onClick={handleAddCub} className="text-[9px] font-black uppercase tracking-widest text-[#0066cc] bg-[#0066cc]/10 hover:bg-[#0066cc]/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><UserPlus size={12}/> Add Sibling</button>
                  </div>
                  <div className="mb-4"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parent Name(s)</label><input ref={firstInputRef} required name="parent_first_name" value={formData.parent_first_name} onChange={handleInputChange} className="w-full max-w-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div>
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    {formData.cubs.map((cub, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-3"><label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Full Name</label><input value={cub.cub_full_name || ''} onChange={(e) => handleCubChange(index, 'cub_full_name', e.target.value)} placeholder="Optional" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div>
                        <div className="col-span-2"><label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Initial</label><input required value={cub.cub_initial} onChange={(e) => handleCubChange(index, 'cub_initial', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div>
                        <div className="col-span-3"><label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Grade</label><input required value={cub.grade} onChange={(e) => handleCubChange(index, 'grade', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div>
                        <div className="col-span-3"><label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Class</label><input value={cub.class_name} onChange={(e) => handleCubChange(index, 'class_name', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0066cc]" /></div>
                        {formData.cubs.length > 1 && (<div className="col-span-1 pb-1"><button type="button" onClick={() => handleRemoveCub(index)} className="p-2 text-rose-400 hover:bg-rose-100 rounded-lg flex justify-center items-center w-full h-full"><Trash2 size={16}/></button></div>)}
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Toughest Exercise/Longest Distance</label><input name="q_longest_distance" value={formData.q_longest_distance} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#0066cc]" /></div>
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
    </div>
  );
}