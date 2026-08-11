'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Download, Trash2, Hash, Activity, Target, Loader2, CheckCircle2, X, Edit2, Plus, Eye, ChevronLeft, ChevronRight, Check, ListChecks, Inbox, UserPlus, MapPin, Flag, AlertTriangle, Layers, FilterX, Search, GitMerge, PlusCircle, Settings2, EyeOff, Tags, ArrowRight } from 'lucide-react';

interface Cub {
  cub_initial: string;
  grade: string;
  class_name: string;
}

export default function IreneResponseManager() {
  const [records, setRecords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'view' | 'edit' | 'create' | 'reconcile' | 'phase' | 'aliases'>('view');
  const [viewFilter, setViewFilter] = useState<'pending' | 'verified' | 'flagged' | 'name_review'>('pending');
  const [classFilter, setClassFilter] = useState<string | null>(null);

  // --- Data Reconciliation (Phase 0) state ---
  const [reconcileTab, setReconcileTab] = useState<'search' | 'queue' | 'coverage'>('search');
  const [reconcileSearchName, setReconcileSearchName] = useState('');
  const [reconcileSearchGrade, setReconcileSearchGrade] = useState('');
  const [reconcileSearchInitial, setReconcileSearchInitial] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState<any[]>([]);
  const [resolvingCandidateId, setResolvingCandidateId] = useState<string | null>(null);

  // Set when a Coverage-tab grade card is clicked — scopes the View/Edit queue
  // to just that grade's needs_name_review records, and makes Save auto-advance.
  const [reviewQueueGrade, setReviewQueueGrade] = useState<string | null>(null);

  // --- Phase Control state ---
  const [phaseSettingsLoaded, setPhaseSettingsLoaded] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ phase: 'setup', educator_vote_weight: 10, phase_ends_hint: '', staff_access_code: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showStaffCode, setShowStaffCode] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Tracks the actually-saved phase, separate from phaseForm.phase (which is
  // an unsaved draft while editing the segmented control above) - the reset
  // lock below must gate on what's really live, not on an in-progress edit.
  const [livePhase, setLivePhase] = useState<string | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResettingVotes, setIsResettingVotes] = useState(false);

  // --- Class Aliases state ---
  const [aliases, setAliases] = useState<any[]>([]);
  const [aliasesLoaded, setAliasesLoaded] = useState(false);
  const [newAlias, setNewAlias] = useState({ raw_grade: '', raw_class_name: '', canonical_grade: '', canonical_class_name: '' });
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [editingAliasKey, setEditingAliasKey] = useState<string | null>(null);
  const [editingAliasValues, setEditingAliasValues] = useState({ canonical_grade: '', canonical_class_name: '' });
  const [aliasActionKey, setAliasActionKey] = useState<string | null>(null);

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
    fetchMergeCandidates();
    fetchPhaseSettings();
    fetchAliases();
  }, []);

  const fetchAliases = async () => {
    try {
      const res = await fetch('/admin/api/irene-class-aliases');
      const data = await res.json();
      if (res.ok) setAliases(data.aliases || []);
    } catch (err) { console.error(err); } finally { setAliasesLoaded(true); }
  };

  const handleAddAlias = async () => {
    const { raw_grade, raw_class_name, canonical_grade, canonical_class_name } = newAlias;
    if (!raw_grade.trim() || !raw_class_name.trim() || !canonical_grade.trim() || !canonical_class_name.trim()) {
      alert('All four fields are required.');
      return;
    }
    setIsAddingAlias(true);
    try {
      const res = await fetch('/admin/api/irene-class-aliases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAlias),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add alias');
      setNewAlias({ raw_grade: '', raw_class_name: '', canonical_grade: '', canonical_class_name: '' });
      await fetchAliases();
    } catch (err: any) {
      alert(err.message);
    } finally { setIsAddingAlias(false); }
  };

  const handleStartEditAlias = (alias: any) => {
    setEditingAliasKey(`${alias.raw_grade}::${alias.raw_class_name}`);
    setEditingAliasValues({ canonical_grade: alias.canonical_grade, canonical_class_name: alias.canonical_class_name });
  };

  const handleSaveEditAlias = async (alias: any) => {
    const key = `${alias.raw_grade}::${alias.raw_class_name}`;
    setAliasActionKey(key);
    try {
      const res = await fetch('/admin/api/irene-class-aliases', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_grade: alias.raw_grade, raw_class_name: alias.raw_class_name, ...editingAliasValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update alias');
      setEditingAliasKey(null);
      await fetchAliases();
    } catch (err: any) {
      alert(err.message);
    } finally { setAliasActionKey(null); }
  };

  const handleDeleteAlias = async (alias: any) => {
    if (!window.confirm(`Delete the alias mapping "${alias.raw_grade} / ${alias.raw_class_name}"?`)) return;
    const key = `${alias.raw_grade}::${alias.raw_class_name}`;
    setAliasActionKey(key);
    try {
      const res = await fetch('/admin/api/irene-class-aliases', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_grade: alias.raw_grade, raw_class_name: alias.raw_class_name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete alias');
      await fetchAliases();
    } catch (err: any) {
      alert(err.message);
    } finally { setAliasActionKey(null); }
  };

  const fetchPhaseSettings = async () => {
    try {
      const res = await fetch('/admin/api/irene-settings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load settings');
      setPhaseForm({
        phase: data.phase,
        educator_vote_weight: data.educator_vote_weight,
        phase_ends_hint: data.phase_ends_hint || '',
        staff_access_code: data.staff_access_code || '',
      });
      setLivePhase(data.phase);
      setSettingsError(null);
    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setPhaseSettingsLoaded(true);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/admin/api/irene-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phaseForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setSettingsSaved(true);
      setLivePhase(phaseForm.phase);
      setTimeout(() => setSettingsSaved(false), 1500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetVotes = async () => {
    if (resetConfirmText !== 'RESET') return;
    setIsResettingVotes(true);
    try {
      const res = await fetch('/admin/api/irene-reset-votes', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset votes');
      setResetConfirmText('');
      alert('All votes and voters have been reset to zero.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsResettingVotes(false);
    }
  };

  const fetchMergeCandidates = async () => {
    // irene_merge_candidates has zero anon RLS policies (admin-only by design) —
    // must go through the service-role route, not the plain anon client.
    try {
      const res = await fetch('/admin/api/irene-merge-candidates');
      const data = await res.json();
      if (res.ok) setMergeCandidates(data.candidates || []);
    } catch (err) { console.error(err); }
  };

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

    // 2. Grade Queue Filter (set by clicking a Coverage card) takes priority over the class filter
    if (reviewQueueGrade) {
      return r.cubs?.some((c: any) => c.grade === reviewQueueGrade);
    }

    // 3. Class Filter (Optional)
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

  // --- Reconciliation: search-first lookup across ALL records (not just the current viewFilter) ---
  // Three independent filters, combined with AND — leave any blank to widen the search.
  const reconcileHasFilter = !!(reconcileSearchName.trim() || reconcileSearchGrade || reconcileSearchInitial.trim());
  const reconcileResults = reconcileHasFilter
    ? records.filter(r => {
        if (reconcileSearchName.trim() && !(r.parent_first_name || '').toLowerCase().includes(reconcileSearchName.trim().toLowerCase())) return false;
        if (reconcileSearchGrade && !(r.cubs || []).some((c: any) => c.grade === reconcileSearchGrade)) return false;
        if (reconcileSearchInitial.trim() && !(r.cubs || []).some((c: any) => (c.cub_initial || '').toLowerCase().startsWith(reconcileSearchInitial.trim().toLowerCase()))) return false;
        return true;
      }).slice(0, 30)
    : [];

  // --- Reconciliation: coverage by grade, using needs_name_review as the "unresolved" signal ---
  const coverageByGrade = records.reduce((acc: Record<string, { total: number; pending: number }>, r) => {
    (r.cubs || []).forEach((c: any) => {
      const grade = c.grade || '(unknown)';
      if (!acc[grade]) acc[grade] = { total: 0, pending: 0 };
      acc[grade].total += 1;
      if (r.needs_name_review) acc[grade].pending += 1;
    });
    return acc;
  }, {});

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

  const handleSwitchToCreate = () => { setFormData(initialFormState); setReviewQueueGrade(null); setMode('create'); };
  const handleSwitchToView = () => setMode('view');
  const goNext = () => setCurrentIndex(prev => Math.min(displayedRecords.length - 1, prev + 1));
  const goPrev = () => setCurrentIndex(prev => Math.max(0, prev - 1));

  // Entry point from a Coverage-tab grade card: scope the queue to that grade's
  // pending records and land on the first one.
  const handleOpenGradeQueue = (grade: string) => {
    setClassFilter(null);
    setReviewQueueGrade(grade);
    setViewFilter('name_review');
    setCurrentIndex(0);
    setMode('view');
  };

  const handleExitGradeQueue = () => {
    setReviewQueueGrade(null);
    setCurrentIndex(0);
  };

  const handleToggleVerify = async () => {
    if (!activeRecord) return;
    const newValue = !activeRecord.is_verified;
    if (newValue && activeRecord.needs_name_review) {
      alert('This response is still flagged for name review. Clear the flag in the Name Review queue before verifying it — free-text answers here are shown publicly.');
      return;
    }
    setIsSubmitting(true);
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

  // Resolves a Data Reconciliation candidate:
  //  - 'rejected': name coincidence / bad match, discard.
  //  - 'merged': confirms the flagged Neon data is already represented by the
  //    existing Supabase record — no insert needed.
  //  - 'add_new': the flagged data is a genuinely distinct family/child not yet
  //    in the system — inserts it as a new response. For neon_internal candidates
  //    this inserts the "extra" duplicate as its own standalone record rather than
  //    appending it as a sibling into the "kept" response (simpler and safe; merge
  //    the two manually via Edit afterward if they really are one family).
  const handleResolveCandidate = async (candidate: any, action: 'merged' | 'rejected' | 'add_new') => {
    setResolvingCandidateId(candidate.id);
    try {
      if (action === 'add_new') {
        const rawPayload = candidate.response_b_source === 'neon_internal'
          ? candidate.response_b_payload.extra
          : candidate.response_b_payload;
        const rows = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
        const first = rows[0];
        const insertPayload = {
          parent_first_name: first.parent_first_name,
          q_why_start: first.q_why_start || null,
          q_boss_level: first.q_boss_level || null,
          q_funny_fail: first.q_funny_fail || null,
          q_weird_habit: first.q_weird_habit || null,
          q_shoes: first.q_shoes ?? null,
          media_url: null,
          is_verified: false,
          is_flagged: false,
          needs_name_review: true,
          goal_tags: [], activity_tags: [], club_tags: [],
          cubs: rows.map((r: any) => ({
            grade: r.canonical_grade || r.grade,
            class_name: r.canonical_class_name || r.class_name,
            cub_initial: r.cub_initial,
          })),
        };
        const { data, error } = await supabase.from('irene_responses').insert([insertPayload]).select();
        if (error) throw error;
        if (data?.[0]) setRecords(prev => [data[0], ...prev]);
      }

      // Same RLS reason as fetchMergeCandidates — status updates need the service-role route.
      const res = await fetch('/admin/api/irene-merge-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: candidate.id, status: action === 'add_new' ? 'merged' : action }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update candidate status');
      setMergeCandidates(prev => prev.filter(c => c.id !== candidate.id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResolvingCandidateId(null);
    }
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
        // Saving inside a grade review queue IS the review — clear the flag so this
        // record drops out of the filtered list and the next one takes its place.
        const isReviewing = !!reviewQueueGrade;
        const finalNeedsReview = isReviewing ? false : activeRecord.needs_name_review;
        const { error } = await supabase.from('irene_responses').update({ ...payload, ...(isReviewing ? { needs_name_review: false } : {}) }).eq('id', activeId);
        if (error) throw error;
        setRecords(prev => prev.map(r => r.id === activeId ? { ...payload, id: activeId, is_verified: activeRecord.is_verified, is_flagged: activeRecord.is_flagged, needs_name_review: finalNeedsReview } : r));
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
        <button onClick={() => { setReviewQueueGrade(null); setMode('reconcile'); }} title="Data Reconciliation" className={`relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${mode === 'reconcile' ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-white text-slate-500 hover:text-indigo-600'}`}>
          <GitMerge size={20} />
          {mergeCandidates.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-slate-50">{mergeCandidates.length}</span>}
        </button>
        <button onClick={() => { setReviewQueueGrade(null); setMode('phase'); }} title="Phase Control" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${mode === 'phase' ? 'bg-violet-600 text-white shadow-violet-600/30' : 'bg-white text-slate-500 hover:text-violet-600'}`}><Settings2 size={20} /></button>
        <button onClick={() => { setReviewQueueGrade(null); setMode('aliases'); }} title="Class Aliases" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${mode === 'aliases' ? 'bg-teal-600 text-white shadow-teal-600/30' : 'bg-white text-slate-500 hover:text-teal-600'}`}><Tags size={20} /></button>
        {mode === 'view' && displayedRecords.length > 0 && (
          <>
            <button onClick={handleToggleFlag} disabled={isSubmitting} title={activeRecord?.is_flagged ? "Unflag" : "Flag Profiling"} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 ${activeRecord?.is_flagged ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-white text-slate-500 hover:text-rose-500'}`}><Flag size={20} fill={activeRecord?.is_flagged ? "currentColor" : "none"} /></button>
            <button onClick={handleToggleNameReview} disabled={isSubmitting} title={activeRecord?.needs_name_review ? "Clear Review" : "Flag Name Review"} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 ${activeRecord?.needs_name_review ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white text-slate-500 hover:text-amber-500'}`}><AlertTriangle size={20} fill={activeRecord?.needs_name_review ? "currentColor" : "none"} /></button>
            <button onClick={handleToggleVerify} disabled={isSubmitting} title={activeRecord?.is_verified ? "Un-verify" : "Verify"} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 ${activeRecord?.is_verified ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-white text-slate-500 hover:text-emerald-500'}`}>{activeRecord?.is_verified ? <X size={24} /> : <Check size={24} />}</button>
          </>
        )}
        <div className="w-12 h-px bg-slate-200 my-2" />
        <button onClick={() => { setReviewQueueGrade(null); setViewFilter('pending'); }} title="Pending" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'pending' ? 'bg-slate-800 text-white shadow-slate-800/30' : 'bg-white text-slate-400 hover:text-slate-800'}`}><Inbox size={20} /></button>
        <button onClick={() => { setReviewQueueGrade(null); setViewFilter('verified'); }} title="Verified" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'verified' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-white text-slate-400 hover:text-emerald-500'}`}><ListChecks size={20} /></button>
        <button onClick={() => { setReviewQueueGrade(null); setViewFilter('flagged'); }} title="Flagged" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'flagged' ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-white text-slate-400 hover:text-rose-500'}`}><Flag size={20} /></button>
        <button onClick={() => { setReviewQueueGrade(null); setViewFilter('name_review'); }} title="Name Review" className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${viewFilter === 'name_review' ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white text-slate-400 hover:text-amber-500'}`}><AlertTriangle size={20} /></button>
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

        {/* --- PHASE CONTROL MODE --- */}
        {mode === 'phase' && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden relative ml-16 md:ml-0">
            <div className="p-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">Phase Control</h3>
                {settingsSaved && <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><CheckCircle2 size={14} /> Saved</span>}
              </div>

              {!phaseSettingsLoaded ? (
                <div className="py-16 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" size={18} /> Loading...</div>
              ) : settingsError ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-sm text-rose-700">
                  <p className="font-black uppercase tracking-widest text-xs mb-2">Couldn't load settings</p>
                  <p className="mb-2">{settingsError}</p>
                  <p className="text-xs text-rose-600/80">If this is a "table not found" error, the <code className="bg-rose-100 px-1 rounded">irene_settings</code> / <code className="bg-rose-100 px-1 rounded">irene_staff_codes</code> tables haven't been created in Supabase yet — run the Phase Control SQL from the plan first.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Phase segmented control */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Current Voting Phase</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {([
                        { value: 'setup', label: 'Setup', desc: 'Coming soon hero, no voting' },
                        { value: 'educators', label: 'Educators', desc: 'Staff-code gated voting' },
                        { value: 'parents', label: 'Parents', desc: 'Full public voting' },
                        { value: 'closed', label: 'Closed', desc: 'Final results' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPhaseForm(prev => ({ ...prev, phase: opt.value }))}
                          className={`text-left p-4 rounded-2xl border transition-all ${phaseForm.phase === opt.value ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-600/20' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-violet-300'}`}
                        >
                          <p className="font-black text-sm uppercase tracking-tight">{opt.label}</p>
                          <p className={`text-[10px] mt-1 ${phaseForm.phase === opt.value ? 'text-violet-100' : 'text-slate-400'}`}>{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Educator Vote Weight</label>
                      <input
                        type="number"
                        min={1}
                        value={phaseForm.educator_vote_weight}
                        onChange={(e) => setPhaseForm(prev => ({ ...prev, educator_vote_weight: parseInt(e.target.value, 10) || 1 }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-violet-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1.5">How many votes each tap is worth during the Educators phase.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Staff Access Code</label>
                      <div className="relative">
                        <input
                          type={showStaffCode ? 'text' : 'password'}
                          value={phaseForm.staff_access_code}
                          onChange={(e) => setPhaseForm(prev => ({ ...prev, staff_access_code: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm font-bold outline-none focus:border-violet-500"
                        />
                        <button type="button" onClick={() => setShowStaffCode(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showStaffCode ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Shared code teachers enter to unlock voting. Never shown to parents.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Closing Hint <span className="text-slate-300 normal-case">(optional, cosmetic only)</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Closes around Friday 5pm"
                      value={phaseForm.phase_ends_hint}
                      onChange={(e) => setPhaseForm(prev => ({ ...prev, phase_ends_hint: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-violet-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">Shown as a small banner on the public page. No automation is tied to it — the phase only changes when you save it above.</p>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="px-12 py-4 bg-violet-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 hover:bg-violet-700"
                    >
                      {isSavingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Settings
                    </button>
                  </div>

                  {/* --- DANGER ZONE: RESET VOTES/VOTERS --- */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-rose-500" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-rose-700">Danger Zone — Reset Votes &amp; Voters</h4>
                      </div>
                      {livePhase !== 'setup' ? (
                        <p className="text-xs text-rose-600/80">Locked — voting is live (current phase: <b className="uppercase">{livePhase}</b>). Reset is only available while the phase is Setup, so a real campaign's votes can't be wiped by accident.</p>
                      ) : (
                        <>
                          <p className="text-xs text-rose-600/80 mb-4">Permanently deletes every row in <code className="bg-rose-100 px-1 rounded">irene_votes</code> and <code className="bg-rose-100 px-1 rounded">irene_voters</code> — every vote, every tier, every consent record. This cannot be undone. Type <b>RESET</b> to confirm.</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={resetConfirmText}
                              onChange={(e) => setResetConfirmText(e.target.value)}
                              placeholder="Type RESET to confirm"
                              className="flex-1 bg-white border border-rose-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-rose-500"
                            />
                            <button
                              onClick={handleResetVotes}
                              disabled={resetConfirmText !== 'RESET' || isResettingVotes}
                              className="px-6 py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-700"
                            >
                              {isResettingVotes ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />} Reset to Zero
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CLASS ALIASES MODE --- */}
        {mode === 'aliases' && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden relative ml-16 md:ml-0">
            <div className="p-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">Class Aliases</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Maps messy/OCR'd class names to the real classroom — used by the Coverage Report and future imports</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100 shrink-0">{aliases.length} mapped</span>
              </div>

              {/* Add new alias */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Add New Alias</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Raw Grade</label>
                    <input value={newAlias.raw_grade} onChange={e => setNewAlias(p => ({ ...p, raw_grade: e.target.value }))} placeholder="e.g. Grade 10" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Raw Class</label>
                    <input value={newAlias.raw_class_name} onChange={e => setNewAlias(p => ({ ...p, raw_class_name: e.target.value }))} placeholder="e.g. 10" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-teal-500" />
                  </div>
                  <div className="hidden md:flex items-center justify-center text-slate-300"><ArrowRight size={16} /></div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Canonical Grade</label>
                    <input value={newAlias.canonical_grade} onChange={e => setNewAlias(p => ({ ...p, canonical_grade: e.target.value }))} placeholder="e.g. Grade 1" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-teal-500" />
                  </div>
                  <div className="flex gap-2">
                    <input value={newAlias.canonical_class_name} onChange={e => setNewAlias(p => ({ ...p, canonical_class_name: e.target.value }))} placeholder="e.g. 1O" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-teal-500" />
                    <button onClick={handleAddAlias} disabled={isAddingAlias} className="shrink-0 px-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center">
                      {isAddingAlias ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing aliases */}
              {!aliasesLoaded ? (
                <div className="py-16 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" size={18} /> Loading...</div>
              ) : aliases.length === 0 ? (
                <p className="text-center text-slate-400 text-xs font-bold py-12">No aliases yet — add one above.</p>
              ) : (
                <div className="space-y-2">
                  {aliases.map((alias) => {
                    const key = `${alias.raw_grade}::${alias.raw_class_name}`;
                    const isEditing = editingAliasKey === key;
                    const isActing = aliasActionKey === key;
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="min-w-0 shrink-0 w-[38%]">
                            <p className="text-xs font-bold text-slate-500 truncate">{alias.raw_grade}</p>
                            <p className="text-sm font-black text-slate-800 truncate">{alias.raw_class_name}</p>
                          </div>
                          <ArrowRight size={14} className="text-slate-300 shrink-0" />
                          {isEditing ? (
                            <div className="flex gap-2 flex-1 min-w-0">
                              <input value={editingAliasValues.canonical_grade} onChange={e => setEditingAliasValues(p => ({ ...p, canonical_grade: e.target.value }))} className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                              <input value={editingAliasValues.canonical_class_name} onChange={e => setEditingAliasValues(p => ({ ...p, canonical_class_name: e.target.value }))} className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1.5 text-xs outline-none" />
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-teal-600 truncate">{alias.canonical_grade}</p>
                              <p className="text-sm font-black text-slate-900 truncate">{alias.canonical_class_name}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEditAlias(alias)} disabled={isActing} className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">{isActing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}</button>
                              <button onClick={() => setEditingAliasKey(null)} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-slate-100"><X size={13} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleStartEditAlias(alias)} className="p-2 bg-white border border-slate-200 text-slate-500 rounded-lg hover:border-teal-300 hover:text-teal-600"><Edit2 size={13} /></button>
                              <button onClick={() => handleDeleteAlias(alias)} disabled={isActing} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:border-rose-300 hover:text-rose-500 disabled:opacity-50">{isActing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- DATA RECONCILIATION MODE --- */}
        {mode === 'reconcile' && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden relative ml-16 md:ml-0">
            <div className="p-8 pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-2">
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">Data Reconciliation</h3>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                  <button onClick={() => setReconcileTab('search')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${reconcileTab === 'search' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Search</button>
                  <button onClick={() => setReconcileTab('queue')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${reconcileTab === 'queue' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    Queue {mergeCandidates.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[9px]">{mergeCandidates.length}</span>}
                  </button>
                  <button onClick={() => setReconcileTab('coverage')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${reconcileTab === 'coverage' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Coverage</button>
                </div>
              </div>
            </div>

            {reconcileTab === 'search' && (
              <div className="p-8 pt-4 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Parent name..."
                      value={reconcileSearchName}
                      onChange={(e) => setReconcileSearchName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>
                  <select
                    value={reconcileSearchGrade}
                    onChange={(e) => setReconcileSearchGrade(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  >
                    <option value="">Child's Grade — Any</option>
                    {['Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Child's initial..."
                    value={reconcileSearchInitial}
                    onChange={(e) => setReconcileSearchInitial(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
                {!reconcileHasFilter ? (
                  <p className="text-center text-slate-400 text-xs font-bold py-12">Fill in any combination of the filters above to check whether a physical form is already in the system.</p>
                ) : reconcileResults.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs font-bold py-12">No matches — this looks genuinely new.</p>
                ) : (
                  <div className="space-y-2">
                    {reconcileResults.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <p className="font-black text-sm text-slate-900 truncate">{r.parent_first_name}</p>
                          <p className="text-[11px] text-slate-500 font-bold truncate">{(r.cubs || []).map((c: any) => `${c.cub_initial} · ${c.grade} (${c.class_name})`).join('   •   ')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.is_verified && <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">Verified</span>}
                          {r.needs_name_review && <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">Needs Review</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reconcileTab === 'queue' && (
              <div className="p-8 pt-4 pb-8 space-y-4">
                {mergeCandidates.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs font-bold py-12">Queue is clear — no pending candidates.</p>
                ) : mergeCandidates.map((candidate) => {
                  const isInternal = candidate.response_b_source === 'neon_internal';
                  const supaMatch = candidate.response_a_id ? records.find((r) => r.id === candidate.response_a_id) : null;
                  const leftLabel = isInternal ? 'Kept (already in Supabase)' : 'Existing Supabase Record';
                  const leftData = isInternal ? candidate.response_b_payload.kept : supaMatch;
                  const rightLabel = isInternal ? 'Extra (possible duplicate)' : 'Neon Data';
                  const rightRows: any[] = isInternal ? [candidate.response_b_payload.extra] : candidate.response_b_payload;
                  const isResolving = resolvingCandidateId === candidate.id;
                  return (
                    <div key={candidate.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${candidate.confidence === 'high' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : candidate.confidence === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{candidate.confidence} confidence</span>
                        <span className="text-[9px] font-bold uppercase text-slate-400">{isInternal ? 'Internal Neon duplicate' : 'Cross-database name match'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{leftLabel}</p>
                          {leftData ? (
                            <>
                              <p className="font-bold text-sm text-slate-900">{leftData.parent_first_name}</p>
                              <p className="text-[11px] text-slate-500">{(isInternal ? [leftData] : leftData.cubs || []).map((c: any) => `${c.cub_initial} · ${c.grade || c.canonical_grade} (${c.class_name || c.canonical_class_name})`).join(', ')}</p>
                            </>
                          ) : <p className="text-xs text-slate-400 italic">Not found (may have been edited/removed since)</p>}
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{rightLabel}</p>
                          {rightRows.map((r: any, i: number) => (
                            <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-slate-100' : ''}>
                              <p className="font-bold text-sm text-slate-900">{r.parent_first_name}</p>
                              <p className="text-[11px] text-slate-500">{r.cub_initial} · {r.canonical_grade || r.grade} ({r.canonical_class_name || r.class_name})</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button title="Different kids/families — not a real match. Nothing gets added, the candidate is just dismissed." disabled={isResolving} onClick={() => handleResolveCandidate(candidate, 'rejected')} className="px-4 py-2 bg-white text-slate-500 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"><X size={12} /> Reject</button>
                        <button title="Not a duplicate — this is real, distinct data. Inserts it as a new response for your normal QA queue." disabled={isResolving} onClick={() => handleResolveCandidate(candidate, 'add_new')} className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 disabled:opacity-50 flex items-center gap-1.5"><PlusCircle size={12} /> Add as New</button>
                        <button title="Actual duplicate of the same child — already in Supabase. Nothing gets added, just clears the candidate." disabled={isResolving} onClick={() => handleResolveCandidate(candidate, 'merged')} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5">{isResolving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm Duplicate</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {reconcileTab === 'coverage' && (
              <div className="p-8 pt-4 pb-8">
                <p className="text-[10px] font-bold text-slate-400 mb-4">Click a grade with pending records to jump straight into a review queue scoped to just that grade.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(coverageByGrade).sort(([a], [b]) => a.localeCompare(b)).map(([grade, stats]) => {
                    const clickable = stats.pending > 0;
                    return (
                      <button
                        key={grade}
                        onClick={() => clickable && handleOpenGradeQueue(grade)}
                        disabled={!clickable}
                        className={`text-left p-4 rounded-xl border transition-all ${clickable ? 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer' : 'bg-slate-50 border-slate-100 cursor-default'}`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{grade}</p>
                        <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                        {stats.pending > 0 ? (
                          <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">{stats.pending} need review <ArrowRight size={10} /></p>
                        ) : (
                          <p className="text-[10px] font-bold text-emerald-500 mt-1 flex items-center gap-1"><Check size={10} /> All reviewed</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW MODE --- */}
        {mode === 'view' && (
          <>
            {reviewQueueGrade && (
              <div className="mb-4 ml-16 md:ml-0 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle size={16} />
                  <span className="text-xs font-black uppercase tracking-widest">Reviewing {reviewQueueGrade} — {displayedRecords.length} remaining</span>
                </div>
                <button onClick={handleExitGradeQueue} className="text-[10px] font-black text-amber-700 uppercase tracking-widest hover:underline flex items-center gap-1"><X size={12} /> Exit Queue</button>
              </div>
            )}
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden relative ml-16 md:ml-0">
            {displayedRecords.length === 0 ? (
              <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">
                {reviewQueueGrade ? (
                  <>
                    <CheckCircle2 className="mx-auto text-emerald-400 mb-4" size={32} />
                    {reviewQueueGrade} fully reviewed! 🎉
                    <button onClick={handleExitGradeQueue} className="block mx-auto mt-4 text-xs font-black text-[#0066cc] uppercase tracking-widest hover:underline">Back to Coverage</button>
                  </>
                ) : classFilter ? `No ${viewFilter} records found for class ${classFilter}.` :
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
                      {reviewQueueGrade ? `Reviewing: ${reviewQueueGrade}` : viewFilter === 'pending' ? 'QA Viewer' : viewFilter === 'verified' ? 'Verified Archive' : viewFilter === 'name_review' ? 'Name Review' : 'Profile Inspector'}
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
          </>
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