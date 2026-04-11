"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Brain, Activity, Download, Filter, Search, Zap, 
  Smile, Frown, Meh, Flame, AlertTriangle, CheckCircle2, FileText,
  Users, BarChart3, TrendingUp
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// --- MOCK DATA GENERATOR FOR CIO DEMONSTRATION ---
// This blends with real data to ensure the dashboard looks fully populated for pitches.
const MOCK_STUDENTS = [
  { id: '1', name: 'Ayabonga M.', accuracy: 92, mood: 'excited', status: 'extension', topics: { numbers: 95, algebra: 88, geometry: 90, measurement: 92, data: 95 } },
  { id: '2', name: 'Olu S.', accuracy: 85, mood: 'neutral', status: 'on_track', topics: { numbers: 80, algebra: 85, geometry: 90, measurement: 75, data: 95 } },
  { id: '3', name: 'Thabo K.', accuracy: 45, mood: 'frustrated', status: 'at_risk', topics: { numbers: 50, algebra: 40, geometry: 60, measurement: 35, data: 40 } },
  { id: '4', name: 'Sarah J.', accuracy: 95, mood: 'anxious', status: 'perfectionist', topics: { numbers: 98, algebra: 92, geometry: 95, measurement: 90, data: 100 } },
  { id: '5', name: 'Liam D.', accuracy: 65, mood: 'excited', status: 'on_track', topics: { numbers: 70, algebra: 60, geometry: 65, measurement: 60, data: 70 } },
  { id: '6', name: 'Zanele N.', accuracy: 38, mood: 'anxious', status: 'at_risk', topics: { numbers: 45, algebra: 30, geometry: 40, measurement: 30, data: 45 } },
  { id: '7', name: 'Michael R.', accuracy: 88, mood: 'neutral', status: 'on_track', topics: { numbers: 85, algebra: 90, geometry: 85, measurement: 88, data: 92 } },
  { id: '8', name: 'Chloe W.', accuracy: 72, mood: 'frustrated', status: 'monitor', topics: { numbers: 75, algebra: 65, geometry: 80, measurement: 60, data: 80 } },
];

export default function MathDiagnosticsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeGrade, setActiveGrade] = useState(5);
  const [activeTab, setActiveTab] = useState<'heatmap' | 'emotional' | 'sba'>('emotional');
  const [searchQuery, setSearchQuery] = useState("");

  // We would normally fetch this entirely from Supabase, but we use the rich mock array for the demo.
  const [classData, setClassData] = useState(MOCK_STUDENTS);

  useEffect(() => {
    // Simulate network load for realistic feel
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredData = classData.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getHeatmapColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700 font-black'; // Code 7 (Outstanding)
    if (score >= 60) return 'bg-blue-100 text-blue-700 font-bold';       // Code 5-6 (Substantial/Meritorious)
    if (score >= 40) return 'bg-amber-100 text-amber-700 font-bold';     // Code 3-4 (Moderate/Adequate)
    return 'bg-rose-100 text-rose-700 font-bold';                        // Code 1-2 (Not Achieved/Elementary)
  };

  const getMoodIcon = (mood: string) => {
    switch(mood) {
      case 'excited': return <Smile className="text-emerald-500" size={20} />;
      case 'anxious': return <Frown className="text-amber-500" size={20} />;
      case 'frustrated': return <Flame className="text-rose-500" size={20} />;
      default: return <Meh className="text-blue-500" size={20} />;
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
      <Activity className="animate-pulse text-indigo-600" size={48} />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Aggregating Diagnostic Intelligence...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-500/30 pb-20">
      
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/dashboard" className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                <Brain size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-tighter italic text-slate-800 leading-none">Diagnostic_Engine</h1>
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mt-1">Educator Telemetry View</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select 
              value={activeGrade}
              onChange={(e) => setActiveGrade(Number(e.target.value))}
              className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-xl px-4 py-3 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value={4}>Grade 4 Dataset</option>
              <option value={5}>Grade 5 Dataset</option>
              <option value={6}>Grade 6 Dataset</option>
            </select>
            <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
              <Download size={16} /> Export SBA Report
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 mt-8 space-y-8">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Enrolled</span>
            </div>
            <p className="text-3xl font-black text-slate-800">{classData.length}</p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Average</span>
            </div>
            <p className="text-3xl font-black text-slate-800">76%</p>
            <p className="text-xs font-bold text-emerald-500 mt-2 flex items-center gap-1">+4% from last week</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">High Anxiety</span>
            </div>
            <p className="text-3xl font-black text-slate-800">2</p>
            <p className="text-xs font-bold text-amber-500 mt-2">Require reassurance</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><Activity size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical Risk</span>
            </div>
            <p className="text-3xl font-black text-rose-600">2</p>
            <p className="text-xs font-bold text-rose-500 mt-2">Intervention required</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('emotional')}
            className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'emotional' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Socio-Emotional Analytics
          </button>
          <button 
            onClick={() => setActiveTab('heatmap')}
            className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'heatmap' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            CAPS Subject Heatmap
          </button>
        </div>

        {/* --- EMOTIONAL DIAGNOSTICS VIEW --- */}
        <AnimatePresence mode="wait">
          {activeTab === 'emotional' && (
            <motion.div 
              key="emotional"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Left: Explanation & Quadrant Overview */}
              <div className="space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8">
                  <h2 className="text-xl font-black italic tracking-tighter text-indigo-900 mb-4">Why track emotional data?</h2>
                  <p className="text-indigo-800/70 text-sm leading-relaxed">
                    CAPS requires Diagnostic Assessment to identify both cognitive and socio-emotional barriers to learning. 
                    By combining the student's 10-Minute Sprint accuracy with their self-reported mood, this engine automatically categorizes students into actionable intervention groups.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Smile className="text-emerald-500" size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">High Accuracy + Good Mood</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">Ready for Extension</p>
                    <p className="text-xs text-slate-500 mt-1">Prime candidates for Robotics & Coding logic puzzles.</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Frown className="text-amber-500" size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">High Accuracy + Anxious</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">The Perfectionists</p>
                    <p className="text-xs text-slate-500 mt-1">Capable, but suffer from math anxiety. Require confidence building.</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="text-rose-500" size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">Low Accuracy + Frustrated</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">Critical Intervention Group</p>
                    <p className="text-xs text-slate-500 mt-1">Hitting cognitive walls. Need immediate one-on-one remediation using concrete apparatus before moving to abstract rules.</p>
                  </div>
                </div>
              </div>

              {/* Right: The Actual Student List */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-black uppercase tracking-widest text-xs text-slate-700">Student Triage List</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredData.map(student => (
                    <div key={student.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          {getMoodIcon(student.mood)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800">{student.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Accuracy: <span className={student.accuracy < 50 ? 'text-rose-500' : 'text-emerald-500'}>{student.accuracy}%</span></span>
                            <span>•</span>
                            <span>Mood: {student.mood}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Automated Status Triage */}
                      {student.status === 'at_risk' && <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[9px] font-black uppercase tracking-widest">Intervene</span>}
                      {student.status === 'perfectionist' && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest">Reassure</span>}
                      {student.status === 'extension' && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-1"><Zap size={10}/> Robotics Lead</span>}
                      {student.status === 'on_track' && <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest">On Track</span>}
                      {student.status === 'monitor' && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-widest">Monitor</span>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* --- CAPS HEATMAP VIEW --- */}
          {activeTab === 'heatmap' && (
            <motion.div 
              key="heatmap"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-r border-slate-200 w-48">Pioneer Name</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 text-center">Numbers & Ops (50%)</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 text-center">Algebra (10%)</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 text-center">Geometry (15%)</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 text-center">Measurement (15%)</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 text-center">Data (10%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="p-6 font-bold text-slate-800 border-r border-slate-100 bg-white sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                          {student.name}
                        </td>
                        <td className="p-2">
                          <div className={`w-full h-full p-3 rounded-xl text-center text-sm ${getHeatmapColor(student.topics.numbers)}`}>{student.topics.numbers}%</div>
                        </td>
                        <td className="p-2">
                          <div className={`w-full h-full p-3 rounded-xl text-center text-sm ${getHeatmapColor(student.topics.algebra)}`}>{student.topics.algebra}%</div>
                        </td>
                        <td className="p-2">
                          <div className={`w-full h-full p-3 rounded-xl text-center text-sm ${getHeatmapColor(student.topics.geometry)}`}>{student.topics.geometry}%</div>
                        </td>
                        <td className="p-2">
                          <div className={`w-full h-full p-3 rounded-xl text-center text-sm ${getHeatmapColor(student.topics.measurement)}`}>{student.topics.measurement}%</div>
                        </td>
                        <td className="p-2">
                          <div className={`w-full h-full p-3 rounded-xl text-center text-sm ${getHeatmapColor(student.topics.data)}`}>{student.topics.data}%</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-center items-center gap-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Legend:</span>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200"/> Code 7 (80-100%)</div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"/> Code 5-6 (60-79%)</div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-4 h-4 rounded bg-amber-100 border border-amber-200"/> Code 3-4 (40-59%)</div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-4 h-4 rounded bg-rose-100 border border-rose-200"/> Code 1-2 (0-39%)</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}