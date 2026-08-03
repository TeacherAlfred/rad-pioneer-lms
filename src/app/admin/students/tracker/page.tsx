"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Calendar, CheckCircle2, AlertCircle, Loader2, Search, Filter, UserMinus, UserCheck } from "lucide-react";

export default function StudentTrackerPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [parentsMap, setParentsMap] = useState<Record<string, string>>({});
  const [trackerData, setTrackerData] = useState<Record<string, any>>({});
  
  // Pure String Month Selection (e.g., "2026-06")
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  // Search, Filter, & View State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewUnassigned, setViewUnassigned] = useState(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({
    program: 'Term',
    tier: 'Online',
    isActive: true
  });

  useEffect(() => {
    fetchData();
    setSelectedIds(new Set()); // Clear selection on month change
  }, [selectedMonth]);

  async function fetchData() {
    setLoading(true);
    const dbTrackingDate = `${selectedMonth}-01`;

    try {
      const { data: studentData } = await supabase.from('profiles').select('id, display_name, status, account_tier, metadata, linked_parent_id').eq('role', 'student').order('display_name');
      const { data: parentData } = await supabase.from('profiles').select('id, display_name').in('role', ['guardian', 'admin']);
      const { data: trackData } = await supabase.from('monthly_student_tracker').select('*').eq('tracking_month', dbTrackingDate);

      const trackMap: Record<string, any> = {};
      if (trackData) {
        trackData.forEach(row => { trackMap[row.student_id] = row; });
      }

      const pMap: Record<string, string> = {};
      if (parentData) {
        parentData.forEach(p => pMap[p.id] = p.display_name);
      }

      setStudents(studentData || []);
      setParentsMap(pMap);
      setTrackerData(trackMap);
    } catch (err) {
      console.error("Error fetching tracker data:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- REVERTED: STRICT DB READ NO FALLBACKS ---
  const getRowData = (student: any) => {
    if (trackerData[student.id]) return trackerData[student.id];
    // Pure strict fallback: If they aren't explicitly saved in the DB for this month, they are "None/Unassigned"
    return { program: 'None', tier: 'Online', is_active: false };
  };

  // --- INDIVIDUAL ROW UPDATE ---
  const handleUpdate = async (studentId: string, field: string, value: any) => {
    const dbTrackingDate = `${selectedMonth}-01`;
    const student = students.find(s => s.id === studentId);
    const existingRow = getRowData(student);
    const updatedRow = { ...existingRow, [field]: value };

    // Cascade Logic
    if (field === 'program') {
      if (value === 'None') {
        updatedRow.is_active = false;
      } else if (existingRow.program === 'None') {
        updatedRow.is_active = true; 
      }
    }

    setTrackerData(prev => ({ ...prev, [studentId]: updatedRow }));

    try {
      await supabase.from('monthly_student_tracker').upsert({
        student_id: studentId,
        tracking_month: dbTrackingDate,
        program: updatedRow.program,
        tier: updatedRow.tier,
        is_active: updatedRow.is_active,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id, tracking_month' });
    } catch (err) {
      console.error("Failed to save tracker row:", err);
      fetchData(); 
    }
  };

  // --- BULK UPDATE LOGIC ---
  const handleBulkApply = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    const dbTrackingDate = `${selectedMonth}-01`;

    const finalProgram = bulkConfig.program;
    const finalIsActive = bulkConfig.program === 'None' ? false : bulkConfig.isActive;
    const finalTier = bulkConfig.tier;

    const payloads = Array.from(selectedIds).map(id => ({
      student_id: id,
      tracking_month: dbTrackingDate,
      program: finalProgram,
      tier: finalTier,
      is_active: finalIsActive,
      updated_at: new Date().toISOString()
    }));

    const newTrackerData = { ...trackerData };
    payloads.forEach(u => {
      newTrackerData[u.student_id] = { program: u.program, tier: u.tier, is_active: u.is_active };
    });
    setTrackerData(newTrackerData);

    try {
      await supabase.from('monthly_student_tracker').upsert(payloads, { onConflict: 'student_id, tracking_month' });
      setSelectedIds(new Set()); 
    } catch (err) {
      console.error("Failed to apply bulk update:", err);
      fetchData();
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const toggleAll = (displayedList: any[]) => {
    if (selectedIds.size === displayedList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedList.map(s => s.id)));
    }
  };

  // --- Filter Logic ---
  const displayedStudents = useMemo(() => {
    return students.filter(student => {
      const row = getRowData(student);
      
      // 0. Toggle Assigned/Unassigned View
      if (viewUnassigned) {
        if (row.program !== 'None') return false;
      } else {
        if (row.program === 'None') return false;
      }

      // 1. Check Search Query
      const studentName = student.display_name || "Unknown Student";
      const matchesSearch = studentName.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 2. Check Status Filter
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = row.is_active === true;
      if (statusFilter === 'inactive') matchesStatus = row.is_active === false;

      return matchesSearch && matchesStatus;
    });
  }, [students, trackerData, searchQuery, statusFilter, viewUnassigned]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-3">
              <Users className="text-blue-600" size={28}/> Enrollment Tracker
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Manage monthly program attendance</p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <Calendar size={16} className="text-blue-600 ml-2"/>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => {
                if(e.target.value) setSelectedMonth(e.target.value);
              }}
              className="bg-transparent border-none outline-none text-slate-700 font-black uppercase tracking-widest text-sm cursor-pointer pr-2"
            />
          </div>
        </header>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search students by name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* View Toggle Button */}
            <button 
              onClick={() => { setViewUnassigned(!viewUnassigned); setSelectedIds(new Set()); }}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border ${
                viewUnassigned 
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                  : 'bg-white text-slate-500 hover:text-slate-900 border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              {viewUnassigned ? <UserCheck size={16}/> : <UserMinus size={16}/>}
              {viewUnassigned ? 'View Assigned Roster' : 'View Unassigned Pool'}
            </button>

            {/* Status Dropdown */}
            <div className="bg-white border border-slate-200 rounded-2xl flex items-center shadow-sm w-full sm:w-auto overflow-hidden">
              <div className="pl-4 pr-2 text-slate-400">
                <Filter size={16} />
              </div>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-slate-700 font-bold text-xs uppercase tracking-widest px-4 py-3.5 outline-none cursor-pointer flex-1"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* BULK ACTION TOOLBAR */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-600 border border-blue-500 p-4 rounded-[24px] flex flex-col md:flex-row items-center gap-6 justify-between animate-in fade-in slide-in-from-top-2 shadow-xl shadow-blue-600/20">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black">{selectedIds.size}</div>
              <span className="text-xs font-black uppercase tracking-widest">Students Selected</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
              <select 
                value={bulkConfig.program} 
                onChange={e => setBulkConfig({...bulkConfig, program: e.target.value})}
                className="bg-blue-700 text-white border border-blue-500 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-white"
              >
                <option value="Term">Term Lesson</option>
                <option value="Bootcamp">Bootcamp</option>
                <option value="Trial">Trial</option>
                <option value="None">None (Unassigned)</option>
              </select>

              <select 
                value={bulkConfig.tier} 
                onChange={e => setBulkConfig({...bulkConfig, tier: e.target.value})}
                disabled={bulkConfig.program === 'None'}
                className="bg-blue-700 text-white border border-blue-500 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Online">Online</option>
                <option value="In Person">In Person</option>
              </select>

              <select 
                value={bulkConfig.isActive ? 'active' : 'inactive'} 
                onChange={e => setBulkConfig({...bulkConfig, isActive: e.target.value === 'active'})}
                disabled={bulkConfig.program === 'None'}
                className="bg-blue-700 text-white border border-blue-500 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="active">Mark Active</option>
                <option value="inactive">Mark Inactive</option>
              </select>

              <button 
                onClick={handleBulkApply}
                disabled={isBulkUpdating}
                className="bg-white text-blue-600 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center gap-2 disabled:opacity-80"
              >
                {isBulkUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Apply to All
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-5 w-12 text-center">
                      <input 
                        type="checkbox" 
                        checked={displayedStudents.length > 0 && selectedIds.size === displayedStudents.length}
                        onChange={() => toggleAll(displayedStudents)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-5">Student Profile</th>
                    <th className="px-6 py-5">Program</th>
                    <th className="px-6 py-5">Tier</th>
                    <th className="px-8 py-5 text-right">Status for Month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 font-bold italic">
                        No students match your filter criteria in this view.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map(student => {
                      const row = getRowData(student);
                      const isSelected = selectedIds.has(student.id);

                      return (
                        <tr key={student.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50' : row.is_active ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-5 text-center align-middle">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelection(student.id)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-5">
                            <p className="font-bold text-sm text-slate-900">{student.display_name || 'Unknown Student'}</p>
                            {student.linked_parent_id && parentsMap[student.linked_parent_id] && (
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                Parent: {parentsMap[student.linked_parent_id]}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <select 
                              value={row.program} 
                              onChange={(e) => handleUpdate(student.id, 'program', e.target.value)} 
                              className={`bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500 ${row.program === 'None' ? 'text-slate-400' : 'text-slate-700'}`}
                            >
                              <option value="Term">Term Lesson</option>
                              <option value="Bootcamp">Bootcamp</option>
                              <option value="Trial">Trial</option>
                              <option value="None">None (Unassigned)</option>
                            </select>
                          </td>
                          <td className="px-6 py-5">
                            <select 
                              value={row.tier} 
                              onChange={(e) => handleUpdate(student.id, 'tier', e.target.value)} 
                              disabled={row.program === 'None'}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                            >
                              <option value="Online">Online</option>
                              <option value="In Person">In Person</option>
                            </select>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button 
                              onClick={() => handleUpdate(student.id, 'is_active', !row.is_active)}
                              disabled={row.program === 'None'}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed ${
                                row.program === 'None' ? 'bg-slate-100 text-slate-300' : 
                                row.is_active ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-400' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                              }`}
                            >
                              {row.is_active ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                              {row.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}