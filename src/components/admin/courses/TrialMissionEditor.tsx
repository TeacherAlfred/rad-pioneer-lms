"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, LayoutDashboard, Save, Loader2, Link as LinkIcon, BookOpen,
  Target, FileText, Copy, CheckCircle2, Info, Settings, Plus, X, ExternalLink, Edit2, Trash2
} from "lucide-react";

export default function TrialMissionEditor({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Mission Data
  const [missions, setMissions] = useState<any[]>([]);
  const [activeMission, setActiveMission] = useState<any>(null);
  
  // Cards / Wins State
  const [cards, setCards] = useState<any[]>([]);

  // Modal State
  const [showWinsModal, setShowWinsModal] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [newFieldName, setNewFieldName] = useState("");
  const [showAddField, setShowAddField] = useState(false);

  // Edit Mode State for URLs
  const [editingUrls, setEditingUrls] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchMissions();
  }, [courseId]);

  async function fetchMissions() {
    try {
      const { data, error } = await supabase
        .from('missions')
        .select(`
          *,
          modules!inner (
            course_id
          )
        `)
        .eq('modules.course_id', courseId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMissions([]);
        setActiveMission(null);
        return;
      }

      setMissions(data);
      loadMissionIntoEditor(data[0]);

    } catch (err: any) {
      console.error("Error fetching missions:", err.message || err);
      alert(`Failed to load missions: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  const loadMissionIntoEditor = (missionData: any) => {
    setActiveMission({ ...missionData });
    
    const config = typeof missionData.mission_config === 'string' 
      ? JSON.parse(missionData.mission_config) 
      : (missionData.mission_config || { steps: [] });
      
    if (config && config.steps) {
      const introStep = config.steps.find((s: any) => s.type === 'intro');
      if (introStep && introStep.cards) {
        setCards(introStep.cards);
      } else {
        setCards([]); 
      }
    } else {
      setCards([]);
    }
  };

  // --- NEW: CREATE MISSION HANDLER ---
  const handleCreateNewMission = async () => {
    // We need a module_id. We'll inherit it from the currently active mission.
    const currentModuleId = activeMission?.module_id || missions[0]?.module_id;
    if (!currentModuleId) return alert("Error: No module reference found to attach this mission to.");

    setIsCreating(true);
    try {
      const newOrderIndex = missions.length > 0 ? Math.max(...missions.map(m => m.order_index)) + 1 : 1;
      
      const newMissionDraft = {
        module_id: currentModuleId,
        title: "New Untitled Mission",
        order_index: newOrderIndex,
        sandbox_type: "none",
        xp_reward: 500,
        secret_xp_bonus: 100,
        mission_config: { steps: [] } // Ensures JSON doesn't break the editor
      };

      const { data, error } = await supabase
        .from('missions')
        .insert([newMissionDraft])
        .select()
        .single();

      if (error) throw error;

      // Update state and load the new draft into the editor
      const updatedMissions = [...missions, data];
      setMissions(updatedMissions);
      loadMissionIntoEditor(data);

    } catch (err: any) {
      console.error("Creation error:", err);
      alert("Failed to create new mission.");
    } finally {
      setIsCreating(false);
    }
  };

  // --- TOP LEVEL MISSION FIELD HANDLERS ---
  const handleMissionFieldChange = (field: string, value: any) => {
    setActiveMission((prev: any) => ({ ...prev, [field]: value }));
  };

  // --- CARD/WIN MODAL HANDLERS ---
  const handleCardFieldChange = (index: number, field: string, value: string | number) => {
    const updatedCards = [...cards];
    updatedCards[index] = { ...updatedCards[index], [field]: value };
    setCards(updatedCards);
  };

  const handleAddNewWin = () => {
    const newOrder = cards.length > 0 ? Math.max(...cards.map(c => Number(c.order) || 0)) + 1 : 1;
    const newWin = { order: newOrder, title: `Win ${newOrder}`, content: "", tutorial_url: "", markdown_url: "" };
    setCards([...cards, newWin]);
    setActiveTab(cards.length); 
  };

  const handleRemoveWin = (index: number) => {
    const confirm = window.confirm("Are you sure you want to remove this Win?");
    if (!confirm) return;
    const updated = cards.filter((_, i) => i !== index);
    setCards(updated);
    if (activeTab >= updated.length) setActiveTab(Math.max(0, updated.length - 1));
  };

  const handleAddNewField = () => {
    if (!newFieldName.trim()) return;
    const key = newFieldName.trim().replace(/\s+/g, '_').toLowerCase();
    
    const updatedCards = cards.map(c => ({
      ...c,
      [key]: c[key] !== undefined ? c[key] : "" 
    }));
    
    setCards(updatedCards);
    setNewFieldName("");
    setShowAddField(false);
  };

  const handleSave = async () => {
    if (!activeMission) return;
    setSaving(true);

    try {
      const updatedConfig = typeof activeMission.mission_config === 'string'
        ? JSON.parse(activeMission.mission_config)
        : { ...activeMission.mission_config };

      if (!updatedConfig.steps) updatedConfig.steps = [];

      const introStepIndex = updatedConfig.steps.findIndex((s: any) => s.type === 'intro');
      
      if (introStepIndex > -1) {
        updatedConfig.steps[introStepIndex].cards = cards;
      } else {
        updatedConfig.steps.unshift({ type: 'intro', cards: cards });
      }

      const payload = {
        title: activeMission.title,
        order_index: activeMission.order_index,
        video_url: activeMission.video_url,
        lore_text: activeMission.lore_text,
        sandbox_type: activeMission.sandbox_type,
        xp_reward: activeMission.xp_reward,
        secret_code: activeMission.secret_code,
        secret_xp_bonus: activeMission.secret_xp_bonus,
        unlock_date: activeMission.unlock_date,
        mission_config: updatedConfig
      };

      const { error } = await supabase
        .from('missions')
        .update(payload)
        .eq('id', activeMission.id);

      if (error) throw error;
      
      setMissions(missions.map(m => m.id === activeMission.id ? { ...m, ...payload } : m));
      alert("Mission successfully saved to database!");
    } catch (err) {
      console.error("Error saving:", err);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20 bg-[#020617] h-screen items-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  if (missions.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-center space-y-6 p-6">
        <Target size={64} className="text-slate-700" />
        <div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">No Missions Found</h2>
          <p className="text-slate-400 mt-2 max-w-md">There are no missions linked to this Course ID. Please create a Module and a Mission for this course first.</p>
        </div>
        <Link href="/admin/courses" className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors">
          Go Back
        </Link>
      </div>
    );
  }

  const STANDARD_KEYS = ['order', 'title', 'content', 'tutorial_url', 'markdown_url', 'markdown_code'];
  const allCardKeys = Array.from(new Set(cards.flatMap(c => Object.keys(c))));
  const dynamicKeys = allCardKeys.filter(k => !STANDARD_KEYS.includes(k));

  return (
    <div className="min-h-screen bg-[#020617] p-6 lg:p-12 text-left">
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        
        {/* TOP NAVIGATION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/courses" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors text-sm font-bold uppercase tracking-widest">
              <ArrowLeft size={16} /> Back to Curriculum
            </Link>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
              <LayoutDashboard size={14} className="text-blue-400" /> Mission Control Hub
            </Link>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-4 w-full md:w-auto flex-1">
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">Mission Database</h1>
              
              {/* --- UPDATED: SELECT & ADD MISSION ROW --- */}
              <div className="flex items-center gap-3 w-full max-w-md">
                <div className="flex-1 flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/10">
                  <Target size={16} className="text-blue-400 ml-2 shrink-0" />
                  <select 
                    value={activeMission?.id || ""} 
                    onChange={(e) => {
                      const selected = missions.find(m => m.id === e.target.value);
                      if (selected) loadMissionIntoEditor(selected);
                    }}
                    className="w-full bg-transparent text-white font-bold outline-none border-none py-1 pr-4 cursor-pointer focus:ring-0 text-sm truncate"
                  >
                    {missions.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-900">
                        {m.order_index}. {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button 
                  onClick={handleCreateNewMission} 
                  disabled={isCreating}
                  title="Add New Mission"
                  className="shrink-0 p-3 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 hover:text-white border border-blue-500/50 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 mt-2 md:mt-0 shrink-0"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Commit to DB
            </button>
          </div>
        </div>

        {/* TOP LEVEL METADATA FORM */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6 shadow-2xl">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Settings size={16} className="text-blue-400"/> Core Mission Record
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mission Title</label>
              <input type="text" value={activeMission?.title || ""} onChange={(e) => handleMissionFieldChange('title', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none font-bold" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sandbox Type</label>
              <select value={activeMission?.sandbox_type || ""} onChange={(e) => handleMissionFieldChange('sandbox_type', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none">
                <option value="makecode">makecode</option>
                <option value="python">python</option>
                <option value="none">none</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Video URL</label>
              <input type="url" value={activeMission?.video_url || ""} onChange={(e) => handleMissionFieldChange('video_url', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none font-mono" placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unlock Date</label>
              <input 
                type="datetime-local" 
                value={activeMission?.unlock_date ? activeMission.unlock_date.slice(0, 16).replace(' ', 'T') : ""} 
                onChange={(e) => {
                  const val = e.target.value;
                  handleMissionFieldChange('unlock_date', val ? val.replace('T', ' ') + ':00+02' : null);
                }} 
                className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none" 
              />
            </div>

            <div className="grid grid-cols-3 gap-4 md:col-span-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Order Index</label>
                <input type="number" value={activeMission?.order_index || 0} onChange={(e) => handleMissionFieldChange('order_index', parseInt(e.target.value))} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none font-bold text-center" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-emerald-400">XP Reward</label>
                <input type="number" value={activeMission?.xp_reward || 0} onChange={(e) => handleMissionFieldChange('xp_reward', parseInt(e.target.value))} className="w-full bg-[#020617] border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 focus:border-emerald-500 outline-none font-black text-center" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-fuchsia-400">Secret Bonus XP</label>
                <input type="number" value={activeMission?.secret_xp_bonus || 0} onChange={(e) => handleMissionFieldChange('secret_xp_bonus', parseInt(e.target.value))} className="w-full bg-[#020617] border border-fuchsia-500/30 rounded-xl px-4 py-3 text-sm text-fuchsia-400 focus:border-fuchsia-500 outline-none font-black text-center" />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secret Code (Optional)</label>
              <input type="text" value={activeMission?.secret_code || ""} onChange={(e) => handleMissionFieldChange('secret_code', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none font-mono" />
            </div>

            <div className="space-y-2 md:col-span-2 pt-2 border-t border-white/5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                Mission Intro
                <div className="group relative inline-flex items-center justify-center ml-2 cursor-help">
                  <Info size={14} className="text-blue-400 hover:text-white transition-colors" />
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-blue-900 border border-blue-700 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-lg whitespace-nowrap z-10 font-mono">
                    DB Field: lore_text
                  </div>
                </div>
              </label>
              <textarea 
                rows={3}
                value={activeMission?.lore_text || ""} 
                onChange={(e) => handleMissionFieldChange('lore_text', e.target.value)} 
                className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-blue-500 outline-none resize-none leading-relaxed" 
              />
            </div>
          </div>
        </div>

        {/* WINS / JSON CONFIG LAUNCHER */}
        <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-black uppercase italic text-white flex items-center gap-3 justify-center md:justify-start">
              <FileText className="text-purple-400" size={24} /> Mission Configuration JSON
            </h3>
            <p className="text-xs text-blue-200 font-medium max-w-lg">Manage the individual roadmap steps, tutorials, and MakeCode links specifically nested within this mission's JSON configuration object.</p>
          </div>
          <button 
            onClick={() => setShowWinsModal(true)}
            className="w-full md:w-auto bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500 text-blue-300 px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-blue-900/50 whitespace-nowrap"
          >
            Open Wins Configurator
          </button>
        </div>

      </div>

      {/* =========================================
          WINS / CARDS MODAL
      ========================================= */}
      <AnimatePresence>
        {showWinsModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-[#0f172a] border border-blue-500/30 rounded-[32px] w-full max-w-5xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#020617] shrink-0">
                <h3 className="text-2xl font-black uppercase italic text-white tracking-tighter flex items-center gap-3">
                  <BookOpen className="text-blue-400" /> JSON Configuration: Wins
                </h3>
                <button onClick={() => setShowWinsModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                  <X size={18}/>
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Modal Sidebar (Tabs) */}
                <div className="w-48 md:w-64 bg-[#020617]/50 border-r border-white/10 flex flex-col shrink-0">
                  <div className="p-4 border-b border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Roadmap Items</p>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {cards.map((card, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setActiveTab(idx)}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${activeTab === idx ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-300'}`}
                      >
                        <div className="text-xs font-black uppercase tracking-widest truncate">{card.title || `Win ${idx + 1}`}</div>
                        <div className="text-[9px] font-mono opacity-50 mt-1">Order: {card.order || idx + 1}</div>
                      </button>
                    ))}
                  </div>
                  <div className="p-4 border-t border-white/5 bg-[#020617]">
                    <button onClick={handleAddNewWin} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-white/10">
                      <Plus size={12}/> Add New Win
                    </button>
                  </div>
                </div>

                {/* Modal Main Content Area */}
                <div className="flex-1 bg-[#0f172a] overflow-y-auto custom-scrollbar relative">
                  {cards.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-500 text-xs font-black uppercase tracking-widest">
                      Create a Win to configure JSON.
                    </div>
                  ) : (
                    <div className="p-6 md:p-10 space-y-8 pb-32">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-black text-white italic">{cards[activeTab]?.title || `Editing Win ${activeTab + 1}`}</h4>
                        <button onClick={() => handleRemoveWin(activeTab)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 flex items-center gap-1 transition-colors">
                          <X size={12}/> Delete Win
                        </button>
                      </div>

                      {/* --- STANDARD JSON FIELDS --- */}
                      <div className="space-y-6">
                        
                        <div className="flex gap-4">
                          <div className="space-y-2 w-24 shrink-0">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">"order"</label>
                            <input type="number" value={cards[activeTab]?.order || ""} onChange={(e) => handleCardFieldChange(activeTab, 'order', Number(e.target.value))} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none text-center" />
                          </div>
                          <div className="space-y-2 flex-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">"title"</label>
                            <input type="text" value={cards[activeTab]?.title || ""} onChange={(e) => handleCardFieldChange(activeTab, 'title', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none font-bold" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">"content"</label>
                          <textarea rows={3} value={cards[activeTab]?.content || ""} onChange={(e) => handleCardFieldChange(activeTab, 'content', e.target.value)} className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-blue-500 outline-none resize-none leading-relaxed" />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest font-mono flex items-center gap-2"><LinkIcon size={12}/> "tutorial_url"</label>
                          <input type="url" value={cards[activeTab]?.tutorial_url || ""} onChange={(e) => handleCardFieldChange(activeTab, 'tutorial_url', e.target.value)} className="w-full bg-[#020617] border border-purple-500/30 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none font-mono" placeholder="https://..." />
                        </div>

                        {/* --- NEW: MARKDOWN STORAGE URL --- */}
                        <div className="space-y-2 pt-4 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-2">
                              <FileText size={12}/> "markdown_url"
                            </label>
                            {cards[activeTab]?.markdown_url && (
                              <a 
                                href={cards[activeTab].markdown_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-white flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded transition-colors"
                              >
                                View File <ExternalLink size={10}/>
                              </a>
                            )}
                          </div>
                          
                          {(!cards[activeTab]?.markdown_url || editingUrls[activeTab]) ? (
                            <div className="relative">
                              <input 
                                type="url"
                                autoFocus={!!editingUrls[activeTab]}
                                value={cards[activeTab]?.markdown_url || ""} 
                                onChange={(e) => handleCardFieldChange(activeTab, 'markdown_url', e.target.value)} 
                                className="w-full bg-[#020617] border border-emerald-500/50 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:border-emerald-400 outline-none font-mono" placeholder="https://..."
                              />
                              {cards[activeTab]?.markdown_url && (
                                <button 
                                  onClick={() => setEditingUrls({...editingUrls, [activeTab]: false})}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 hover:bg-emerald-400 rounded-lg text-black transition-colors"
                                  title="Lock URL"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <LinkIcon size={14} className="text-emerald-500/50 shrink-0" />
                                <span className="text-sm text-white font-mono truncate">{cards[activeTab].markdown_url}</span>
                              </div>
                              <button 
                                onClick={() => setEditingUrls({...editingUrls, [activeTab]: true})} 
                                className="ml-4 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 focus:opacity-100"
                              >
                                <Edit2 size={12}/> Edit
                              </button>
                            </div>
                          )}
                          <p className="text-[9px] text-slate-500 font-bold italic mt-1 ml-1">Paste the public URL of the .md file hosted in your Supabase bucket.</p>
                        </div>
                      </div>

                      {/* Clean out old markdown_code if it exists */}
                      {cards[activeTab]?.markdown_code !== undefined && (
                        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <p className="text-xs text-amber-500 font-bold mb-2">Legacy Field Detected</p>
                          <p className="text-[10px] text-amber-400/80 mb-3">This Win still has old Markdown code stored in the database. Please clear it out to save space.</p>
                          <button 
                            onClick={() => {
                              const updatedCards = [...cards];
                              delete updatedCards[activeTab].markdown_code;
                              setCards(updatedCards);
                            }}
                            className="text-[9px] font-black uppercase tracking-widest bg-amber-500 text-black px-3 py-1.5 rounded hover:bg-amber-400"
                          >
                            Delete Legacy Data
                          </button>
                        </div>
                      )}

                      {/* --- DYNAMIC JSON FIELDS --- */}
                      {dynamicKeys.length > 0 && (
                        <div className="pt-6 mt-6 border-t border-dashed border-white/10 space-y-6">
                          <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Custom Metadata Fields</h5>
                          {dynamicKeys.map(key => (
                            <div key={key} className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">"{key}"</label>
                              <input type="text" value={cards[activeTab]?.[key] || ""} onChange={(e) => handleCardFieldChange(activeTab, key, e.target.value)} className="w-full bg-[#020617] border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-300 focus:border-blue-500 outline-none" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* --- ADD NEW FIELD BUTTON --- */}
                      <div className="pt-6">
                        {!showAddField ? (
                          <button onClick={() => setShowAddField(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors border border-white/5">
                            <Plus size={12}/> Add Custom Field to Schema
                          </button>
                        ) : (
                          <div className="bg-[#020617] p-4 rounded-xl border border-blue-500/30 flex items-end gap-3">
                            <div className="flex-1 space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">New JSON Key Name</label>
                              <input autoFocus type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="e.g. video_hint_url" className="w-full bg-transparent border-b border-slate-700 pb-2 text-sm text-white focus:border-blue-500 outline-none font-mono" />
                            </div>
                            <button onClick={handleAddNewField} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500">Add Field</button>
                            <button onClick={() => { setShowAddField(false); setNewFieldName(""); }} className="bg-white/5 text-slate-400 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10">Cancel</button>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* Absolute positioning for Apply button inside the right pane */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-transparent pointer-events-none">
                    <div className="flex justify-end pointer-events-auto">
                      <button onClick={() => setShowWinsModal(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-blue-600/20">
                        Done Editing Config
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}