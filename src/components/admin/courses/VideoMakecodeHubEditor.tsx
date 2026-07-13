"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, Trash2, Save, Video, Puzzle, CheckSquare, ArrowLeft, Edit, X, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Strict Categories
const VIDEO_CATEGORIES = [
  "Getting started",
  "Input & Output Sensors",
  "Coding Logic"
];

// Predefined Topics for grouping videos within a category
const VIDEO_TOPICS = [
  "Setup",
  "Motors & Servos",
  "NeoPixels & Lights",
  "M:Bit Built-in Sensors",
  "General Input/Output",
  "Variables & Math",
  "Loops & Repetition",
  "Logic & Conditionals",
  "Advanced Functions",
  "General"
];

type Task = {
  id: string;
  text: string;
  is_required: boolean;
};

type Extension = {
  name: string;
  url: string;
};

type VideoGuide = {
  id: string;
  url: string;
  title: string;
  category: string; 
  topic: string; 
  explainer_text: string; // NEW: Added explainer text
  extensions: Extension[];
  objectives: Task[]; 
};

export default function VideoMakecodeHubEditor({ courseId }: { courseId: string }) {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [missionId, setMissionId] = useState<string | null>(null);
  const [missionTitle, setMissionTitle] = useState("");
  const [loreText, setLoreText] = useState("");
  
  const [videos, setVideos] = useState<VideoGuide[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null);
  const [modalData, setModalData] = useState<VideoGuide | null>(null);

  useEffect(() => {
    async function fetchCourseData() {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select(`
            modules (
              missions (
                id,
                title,
                lore_text,
                mission_config
              )
            )
          `)
          .eq('id', courseId)
          .single();

        if (error) throw error;

        const activeMission = data.modules?.[0]?.missions?.[0];
        
        if (activeMission) {
          setMissionId(activeMission.id);
          setMissionTitle(activeMission.title || "");
          setLoreText(activeMission.lore_text || "");
          
          const config = activeMission.mission_config || {};
          
          // Data Migration & Normalization
          const loadedVideos = (config.videos || []).map((v: any) => {
            let safeCategory = VIDEO_CATEGORIES[0];
            if (typeof v.category === 'string' && VIDEO_CATEGORIES.includes(v.category)) {
              safeCategory = v.category;
            } else if (Array.isArray(v.categories) && v.categories.length > 0) {
              safeCategory = VIDEO_CATEGORIES.includes(v.categories[0]) ? v.categories[0] : VIDEO_CATEGORIES[0];
            }

            return {
              id: v.id || `vid-${Date.now()}-${Math.random()}`,
              title: v.title || "",
              url: v.url || "",
              category: safeCategory,
              topic: v.topic || "General", 
              explainer_text: v.explainer_text || "", // Migrate existing to empty string
              extensions: Array.isArray(v.extensions) ? v.extensions : [],
              objectives: Array.isArray(v.objectives) ? v.objectives : []
            };
          });
          
          setVideos(loadedVideos);
        }
      } catch (err) {
        console.error("Failed to load MakeCode Hub data", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCourseData();
  }, [courseId]);

  const handleSave = async () => {
    if (!missionId) return;
    setSaving(true);
    
    try {
      const updatedConfig = { videos: videos };

      const { error } = await supabase
        .from('missions')
        .update({
          title: missionTitle,
          lore_text: loreText,
          mission_config: updatedConfig
        })
        .eq('id', missionId);

      if (error) throw error;
      alert("Hardware Mission saved successfully!");
    } catch (err) {
      console.error("Failed to save mission", err);
      alert("Failed to save mission data.");
    } finally {
      setSaving(false);
    }
  };

  const openModalForNewVideo = () => {
    setModalData({
      id: `vid-${Date.now()}`,
      title: "",
      url: "",
      category: VIDEO_CATEGORIES[0],
      topic: VIDEO_TOPICS[0],
      explainer_text: "", // Initialize new field
      extensions: [],
      objectives: []
    });
    setEditingVideoIndex(null);
    setIsModalOpen(true);
  };

  const openModalForEdit = (index: number) => {
    setModalData(JSON.parse(JSON.stringify(videos[index]))); 
    setEditingVideoIndex(index);
    setIsModalOpen(true);
  };

  const saveModalData = () => {
    if (!modalData) return;
    if (!modalData.title.trim() || !modalData.url.trim() || !modalData.category || !modalData.topic) {
      alert("Title, Category, Topic, and URL are mandatory.");
      return;
    }

    if (editingVideoIndex !== null) {
      const updated = [...videos];
      updated[editingVideoIndex] = modalData;
      setVideos(updated);
    } else {
      setVideos([...videos, modalData]);
    }
    
    setIsModalOpen(false);
    setModalData(null);
  };

  const deleteVideo = (index: number) => {
    if (confirm("Are you sure you want to delete this video guide?")) {
      setVideos(videos.filter((_, i) => i !== index));
    }
  };

  if (loading) return <div className="flex justify-center py-20 bg-[#020617] h-screen items-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-8 font-sans pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 sticky top-4 z-10 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white">Robotics Hub Editor</h1>
              <p className="text-sm text-slate-400 font-mono mt-1">video_makecode</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button onClick={openModalForNewVideo} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-slate-700">
              <Plus size={18} /> Add New Guide
            </button>
            <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Hub'}
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Puzzle className="text-amber-500" /> General Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2">Module/Mission Title</label>
              <input type="text" value={missionTitle} onChange={(e) => setMissionTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2">Lore / Introduction Text</label>
              <textarea value={loreText} onChange={(e) => setLoreText(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none" />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {VIDEO_CATEGORIES.map((category) => {
            const categoryVideos = videos.filter(v => v.category === category);
            
            return (
              <div key={category} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-lg font-black text-white">{category}</h3>
                  <span className="bg-slate-800 text-slate-400 text-xs font-bold px-3 py-1 rounded-full">{categoryVideos.length} Guides</span>
                </div>
                
                <div className="p-6">
                  {categoryVideos.length === 0 ? (
                    <p className="text-slate-500 italic text-sm">No guides in this category. Click "Add New Guide" above to create one.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {categoryVideos.map((vid) => {
                        const globalIndex = videos.findIndex(v => v.id === vid.id);
                        return (
                          <div key={vid.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 transition-colors group">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-bold text-white leading-tight pr-4">{vid.title}</h4>
                                <p className="text-xs font-bold text-blue-400 mt-1 flex items-center gap-1"><Layers size={12}/> {vid.topic}</p>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openModalForEdit(globalIndex)} className="text-slate-400 hover:text-blue-400"><Edit size={16} /></button>
                                <button onClick={() => deleteVideo(globalIndex)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                              </div>
                            </div>
                            
                            <div className="flex gap-4 mt-4 text-xs font-bold text-slate-500">
                              <span className="flex items-center gap-1.5"><Puzzle size={14} className="text-amber-500"/> {vid.extensions.length} Extensions</span>
                              <span className="flex items-center gap-1.5"><CheckSquare size={14} className="text-emerald-500"/> {vid.objectives.length} Objectives</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- VIDEO EDITOR MODAL --- */}
      {isModalOpen && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col relative z-10 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Video className="text-blue-500" /> {editingVideoIndex !== null ? 'Edit Guide' : 'Add New Guide'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Core Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 mb-1">Title <span className="text-red-500">*</span></label>
                    <input type="text" value={modalData.title} onChange={(e) => setModalData({...modalData, title: e.target.value})} placeholder="e.g. Turning on the NeoPixel" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Category <span className="text-red-500">*</span></label>
                    <select value={modalData.category} onChange={(e) => setModalData({...modalData, category: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none appearance-none cursor-pointer">
                      {VIDEO_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Topic Grouping <span className="text-red-500">*</span></label>
                    <select value={modalData.topic} onChange={(e) => setModalData({...modalData, topic: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none appearance-none cursor-pointer">
                      {VIDEO_TOPICS.map(topic => <option key={topic} value={topic}>{topic}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 mb-1">Media URL (Video/Image) <span className="text-red-500">*</span></label>
                    <input type="text" value={modalData.url} onChange={(e) => setModalData({...modalData, url: e.target.value})} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-blue-400 font-mono text-sm focus:border-blue-500 outline-none" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 mb-1">Explainer Text / Context</label>
                    <textarea 
                      value={modalData.explainer_text} 
                      onChange={(e) => setModalData({...modalData, explainer_text: e.target.value})} 
                      placeholder="Briefly explain what the student will learn or build in this guide..." 
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none resize-none" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                    <CheckSquare size={16} /> Guide Objectives
                  </h3>
                  <button onClick={() => setModalData({...modalData, objectives: [...modalData.objectives, { id: `task-${Date.now()}`, text: "", is_required: true }]})} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                    <Plus size={14} /> Add Objective
                  </button>
                </div>
                <div className="space-y-3">
                  {modalData.objectives.length === 0 && <p className="text-xs text-slate-500 italic">No specific objectives for this guide.</p>}
                  {modalData.objectives.map((obj, oIdx) => (
                    <div key={obj.id} className="flex gap-3 items-center bg-slate-950 border border-slate-800 p-2 pl-4 rounded-lg">
                      <div className="w-4 h-4 rounded border border-slate-600 flex-shrink-0" />
                      <input type="text" value={obj.text} onChange={(e) => { const newObjs = [...modalData.objectives]; newObjs[oIdx].text = e.target.value; setModalData({...modalData, objectives: newObjs}); }} placeholder="What must the student achieve here?" className="w-full bg-transparent text-white text-sm focus:outline-none" />
                      <button onClick={() => { const newObjs = modalData.objectives.filter((_, i) => i !== oIdx); setModalData({...modalData, objectives: newObjs}); }} className="p-2 text-slate-500 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                    <Puzzle size={16} /> Required Extensions
                  </h3>
                  <button onClick={() => setModalData({...modalData, extensions: [...modalData.extensions, { name: "", url: "" }]})} className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    <Plus size={14} /> Add Extension
                  </button>
                </div>
                <div className="space-y-3">
                  {modalData.extensions.length === 0 && <p className="text-xs text-slate-500 italic">No external packages required.</p>}
                  {modalData.extensions.map((ext, eIdx) => (
                    <div key={eIdx} className="flex flex-col sm:flex-row gap-3 bg-slate-950 border border-slate-800 p-3 rounded-lg">
                      <input type="text" value={ext.name} onChange={(e) => { const newExts = [...modalData.extensions]; newExts[eIdx].name = e.target.value; setModalData({...modalData, extensions: newExts}); }} placeholder="Package Name (e.g. Servo)" className="w-full sm:w-1/3 bg-transparent text-white text-sm focus:outline-none border-b border-slate-800 pb-1" />
                      <input type="text" value={ext.url} onChange={(e) => { const newExts = [...modalData.extensions]; newExts[eIdx].url = e.target.value; setModalData({...modalData, extensions: newExts}); }} placeholder="GitHub URL" className="w-full bg-transparent text-blue-400 font-mono text-sm focus:outline-none border-b border-slate-800 pb-1" />
                      <button onClick={() => { const newExts = modalData.extensions.filter((_, i) => i !== eIdx); setModalData({...modalData, extensions: newExts}); }} className="p-1 text-slate-500 hover:text-red-500 self-end sm:self-center">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 rounded-b-3xl">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={saveModalData} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl font-bold transition-colors">Save Guide</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}