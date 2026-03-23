"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, CheckCircle2, Play, Camera, Pencil, X,
  Trophy, ArrowRight, Loader2, Zap, ShieldAlert, Terminal as TerminalIcon, Search, Check, Cpu, Power, ShieldCheck, Code2, BookOpen, ChevronDown, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";

export default function LessonPlayerPage() {
  const { id } = useParams();
  const router = useRouter();
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [verificationPassed, setVerificationPassed] = useState(false);
  const [liveCode, setLiveCode] = useState<string>("");

  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [tempCaptureBlob, setTempCaptureBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [displayedLore, setDisplayedLore] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  
  const [revealedVocab, setRevealedVocab] = useState<any[]>([]);
  const [expandedVocab, setExpandedVocab] = useState<Record<string, boolean>>({});

  // NEW DYNAMIC BLUEPRINT STATE
  const [blueprint, setBlueprint] = useState({
    goal: [] as string[],
    goal_custom: "",
    verification: [] as string[],
    verification_custom: ""
  });

  const theme = mission?.mission_config?.theme || {
      briefing: "Mission_Briefing", console: "System_Console", verifyBtn: "Run Simulation", successCode: "UPLINK_AUTHORIZED",
  };

  // DYNAMIC BLUEPRINT CONFIG PARSING
  const defaultPrompts = {
      goal: { question: "What is your objective?", type: "single", options: ["Complete the level", "Other"] },
      verification: { question: "How do you know it works?", type: "multiple", options: ["Visual change", "Other"] }
  };
  const prompts = mission?.mission_config?.prompts || defaultPrompts;

  const toggleOption = (promptKey: 'goal' | 'verification', option: string, isMultiple: boolean) => {
    setBlueprint(prev => {
      const current = prev[promptKey];
      if (isMultiple) {
        return { ...prev, [promptKey]: current.includes(option) ? current.filter(o => o !== option) : [...current, option] };
      } else {
        return { ...prev, [promptKey]: current.includes(option) ? [] : [option] };
      }
    });
  };

  const defineCustomBlocks = (config: any) => {
    delete Blockly.Blocks['gamedev_event'];
    delete Blockly.Blocks['gamedev_action'];

    const events = config?.events || [{ label: "RIGHT ARROW", value: "RIGHT_ARROW" }];
    const actions = config?.actions || [{ label: "MOVE 10 STEPS", value: "MOVE_10" }];

    Blockly.Blocks['gamedev_event'] = {
      init: function() {
        this.appendDummyInput().appendField("WHEN").appendField(new Blockly.FieldDropdown(events.map((e:any)=>[e.label, e.value])), "EVENT_TYPE").appendField("PRESSED");
        this.setNextStatement(true, null); this.setColour("#f59e0b");
      }
    };

    Blockly.Blocks['gamedev_action'] = {
      init: function() {
        this.appendDummyInput().appendField("ACTION:").appendField(new Blockly.FieldDropdown(actions.map((a:any)=>[a.label, a.value])), "ACTION_TYPE");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3b82f6");
      }
    };

    javascriptGenerator.forBlock['gamedev_event'] = function(block: any) {
      const type = block.getFieldValue('EVENT_TYPE'); return `highlightBlock("${block.id}");\nonEvent("${type}");\n`;
    };
    
    javascriptGenerator.forBlock['gamedev_action'] = function(block: any) {
      const action = block.getFieldValue('ACTION_TYPE'); return `highlightBlock("${block.id}");\nexecuteAction("${action}");\n`;
    };
  };

  const formatPseudocode = (rawCode: string) => {
    let code = rawCode.replace(/highlightBlock\(".*?"\);\n/g, '');
    code = code.replace(/onEvent\("(.*?)"\);\n/g, 'WHEN the $1 key is pressed:\n');
    code = code.replace(/executeAction\("(.*?)"\);\n/g, '  -> DO: $1\n');
    return code.replace(/^\s*[\r\n]/gm, '');
  };

  const runSimulation = async () => {
    if (!workspace.current) return;
    setIsRunning(true); setIsExecuting(true); setVerificationPassed(false);
    setSimLogs([`[INITIALIZING_${theme.console.toUpperCase()}]...`]);
    await new Promise(r => setTimeout(r, 1000));

    const allBlocks = workspace.current.getAllBlocks(false);
    let sequence: string[] = [];
    
    for (const block of allBlocks) {
        if (!isRunning && isExecuting) break;
        workspace.current.highlightBlock(block.id);
        
        if (block.type === 'gamedev_event') {
            const ev = block.getFieldValue('EVENT_TYPE'); sequence.push(ev);
            setSimLogs(prev => [...prev, `[EVENT DETECTED]: ${ev} Key Pressed.`]);
        } else if (block.type === 'gamedev_action') {
            const act = block.getFieldValue('ACTION_TYPE'); sequence.push(act);
            setSimLogs(prev => [...prev, `[ACTION EXECUTED]: ${act}`]);
        }
        await new Promise(r => setTimeout(r, 1000));
        workspace.current.highlightBlock(null);
    }

    const winSequence = mission?.mission_config?.win_sequence || [];
    const isSuccess = winSequence.every((val: string, index: number) => val === sequence[index]);

    if (isSuccess && sequence.length > 0) {
        setSimLogs(prev => [...prev, `[SUCCESS]: Logic Verified.`, `[${theme.successCode}]`]);
        setVerificationPassed(true);
    } else {
        setSimLogs(prev => [...prev, `[FAIL]: Incorrect Logic Sequence. Try again.`, "[RETRY_SEQUENCE]"]);
        setVerificationPassed(false);
    }
    setIsExecuting(false);
  };

  const endSimulation = () => {
      setIsRunning(false); setIsExecuting(false); setSimLogs([]); workspace.current?.highlightBlock(null);
  };

  const triggerLoreTyping = (text: string) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    setIsTyping(true); setDisplayedLore(""); let i = 0;
    typingIntervalRef.current = setInterval(() => {
      setDisplayedLore(text.slice(0, i + 1)); i++;
      if (i >= text.length) {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setIsTyping(false);
      }
    }, 20);
  };

  useEffect(() => { return () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); } }, []);

  useEffect(() => {
    if (!mission?.mission_config?.vocabulary) return;
    const currentVocab = mission.mission_config.vocabulary;
    const newlyRevealed = currentVocab.filter((v: any) => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
        return regex.test(displayedLore);
    });

    newlyRevealed.sort((a: any, b: any) => a.term.localeCompare(b.term));

    if (newlyRevealed.length !== revealedVocab.length) {
        setRevealedVocab(newlyRevealed);
        const newExpanded = { ...expandedVocab };
        newlyRevealed.forEach((v: any) => {
            if (newExpanded[v.term] === undefined) newExpanded[v.term] = true; 
        });
        setExpandedVocab(newExpanded);
    }
  }, [displayedLore, mission]);

  const getFormattedLore = () => {
    if (!revealedVocab || revealedVocab.length === 0) return displayedLore;
    let formattedText = displayedLore;
    const sortedVocab = [...revealedVocab].sort((a, b) => b.term.length - a.term.length);
    
    sortedVocab.forEach(v => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedTerm})\\b`, 'gi');
        formattedText = formattedText.replace(regex, `<span class="text-purple-300 font-black bg-purple-500/20 px-1.5 py-0.5 mx-0.5 rounded-md border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]">$1</span>`);
    });
    return formattedText;
  };

  const toggleVocab = (term: string) => { setExpandedVocab(prev => ({ ...prev, [term]: !prev[term] })); };

  useEffect(() => {
    async function initMission() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: missionData, error: mErr } = await supabase.from('missions').select(`*, modules ( title, course_id )`).eq('id', id).maybeSingle();
        if (mErr || !missionData) { setErrorMsg("Mission not found in the Database."); setLoading(false); return; }

        setMission(missionData); setUser(localUser);

        const { data: archiveData } = await supabase.from('tech_archive').select('*').eq('mission_id', id).eq('student_id', localUser.id).maybeSingle();
        if (archiveData) {
          // IF READ ONLY: Load the final combined strings into the state
          setBlueprint({ 
            goal: [archiveData.description], goal_custom: "", 
            verification: [archiveData.win_condition], verification_custom: "" 
          });
          setImagePreview(archiveData.media_url); setVerificationPassed(true); setIsReadOnly(true);
        }
        if (missionData?.lore_text) triggerLoreTyping(missionData.lore_text);
      } catch (err) { setErrorMsg("A critical system error occurred."); } finally { setLoading(false); }
    }
    initMission();
  }, [id, router]);

  useEffect(() => {
    if (!mission || mission.sandbox_type === 'none' || mission.sandbox_type === 'p5js' || !blocklyDiv.current) return;
    defineCustomBlocks(mission.mission_config);
    const pioneerTheme = Blockly.Theme.defineTheme('pioneer_dark', {
      name: 'pioneer_dark', base: Blockly.Themes.Classic,
      componentStyles: {
        'workspaceBackgroundColour': '#020617', 'toolboxBackgroundColour': '#0f172a', 'toolboxForegroundColour': '#94a3b8',
        'flyoutBackgroundColour': '#0f172a', 'flyoutForegroundColour': '#ccc', 'insertionMarkerColour': '#fff', 'insertionMarkerOpacity': 0.3,
      }
    });

    const toolboxContents = [
      { kind: 'category', name: 'Triggers (Events)', colour: '#f59e0b', contents: [{ kind: 'block', type: 'gamedev_event' }] },
      { kind: 'category', name: 'Game Actions', colour: '#3b82f6', contents: [{ kind: 'block', type: 'gamedev_action' }] },
    ];

    workspace.current = Blockly.inject(blocklyDiv.current, {
      toolbox: { kind: 'categoryToolbox', contents: toolboxContents },
      theme: pioneerTheme, grid: { spacing: 20, length: 3, colour: '#1e293b', snap: true }, zoom: { controls: true, wheel: true, startScale: 1.0 }, trashcan: true
    });

    workspace.current.addChangeListener((e) => {
        if (e.type === Blockly.Events.BLOCK_DRAG && !(e as any).isStart) (workspace.current?.getToolbox() as Blockly.Toolbox)?.clearSelection();
        if (e.type === Blockly.Events.CLICK) (workspace.current?.getToolbox() as Blockly.Toolbox)?.clearSelection();
        if (e.type !== Blockly.Events.UI && e.type !== Blockly.Events.FINISHED_LOADING && workspace.current) {
            setLiveCode(formatPseudocode(javascriptGenerator.workspaceToCode(workspace.current)));
        }
    });
    return () => workspace.current?.dispose();
  }, [mission, loading]);

  const startCapture = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: "browser", selfBrowserSurface: "include", preferCurrentTab: true },
        audio: false,
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) { setTempCaptureBlob(blob); setShowCapturePreview(true); }
          }, "image/png");
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }, 600);
      };
    } catch (err: any) { console.error("Capture failed:", err); }
  };

  const confirmCapture = () => { if (tempCaptureBlob) { setImagePreview(URL.createObjectURL(tempCaptureBlob)); setShowCapturePreview(false); } };

  const handleComplete = async () => {
    // Combine selections and custom text into a single comma-separated string for the DB
    const finalGoal = isReadOnly ? blueprint.goal[0] : [...blueprint.goal.filter(o => o !== 'Other'), blueprint.goal.includes('Other') ? blueprint.goal_custom : ""].filter(Boolean).join(", ");
    const finalVerification = isReadOnly ? blueprint.verification[0] : [...blueprint.verification.filter(o => o !== 'Other'), blueprint.verification.includes('Other') ? blueprint.verification_custom : ""].filter(Boolean).join(", ");

    if (!finalGoal || !finalVerification || !imagePreview || !verificationPassed) {
      alert("Incomplete Uplink! Ensure you have answered the Blueprint, captured a snapshot, and passed verification."); return;
    }
    setIsSaving(true);
    try {
      let finalUrl = imagePreview;
      if (tempCaptureBlob) {
        const fileName = `${user.id}-${id}-${Date.now()}.png`;
        await supabase.storage.from('tech-archive-assets').upload(`blueprints/${fileName}`, tempCaptureBlob);
        const { data: urlData } = supabase.storage.from('tech-archive-assets').getPublicUrl(`blueprints/${fileName}`);
        finalUrl = urlData.publicUrl;
      }
      await supabase.from('tech_archive').upsert({
        student_id: user.id, mission_id: mission.id, title: mission.title,
        description: finalGoal, win_condition: finalVerification,
        media_url: finalUrl, status: 'pending', xp_earned: mission.xp_reward
      }, { onConflict: 'student_id,mission_id' });

      if (!isReadOnly) {
        const newXP = (user.xp || 0) + mission.xp_reward;
        await supabase.from('profiles').update({ xp: newXP }).eq('id', user.id);
        localStorage.setItem("pioneer_session", JSON.stringify({ ...user, xp: newXP }));
      }
      setIsCompleted(true);
      confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (errorMsg) return ( <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-white space-y-6"><ShieldAlert size={64} className="text-red-500" /><h1 className="text-2xl font-black uppercase tracking-widest">{errorMsg}</h1><Link href="/student/dashboard" className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase text-xs">Return to Dashboard</Link></div> );

  return (
    <main className="h-screen text-white flex flex-col overflow-hidden bg-[#020617] font-sans">
      <style>{` .blocklyToolboxContents { padding-top: 32px !important; } .blocklyTreeRow { margin-bottom: 4px !important; } .blocklyFlyoutScrollbar { display: none !important; } `}</style>

      <nav className="h-20 border-b border-white/5 px-8 flex items-center justify-between z-30 bg-[#020617]">
        <div className="flex items-center gap-6 text-left">
          <Link href="/student/dashboard" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 leading-none">{mission.modules?.title} // {mission.title}</p>
            <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none mt-1">Milestone_{mission.order_index}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={runSimulation} disabled={isExecuting} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-black text-[10px] font-black uppercase tracking-widest transition-all ${isExecuting ? 'bg-slate-700' : 'bg-blue-500 hover:scale-105 shadow-lg shadow-blue-500/20'}`}>
            {isExecuting ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} fill="currentColor" />} {verificationPassed ? "Re-Verify Code" : theme.verifyBtn}
          </button>
          <button onClick={handleComplete} disabled={!verificationPassed || isSaving || (isReadOnly && !tempCaptureBlob && !imagePreview)}
            className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${verificationPassed ? 'bg-white text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}>
            {isSaving ? <Loader2 className="animate-spin" size={14} /> : "Lock Milestone"}
          </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[420px] border-r border-white/5 bg-black/20 overflow-y-auto p-8 space-y-8 no-scrollbar text-left font-mono flex flex-col">
           <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className={`text-blue-500`} fill="currentColor" />
              <span className={`text-[10px] font-black uppercase tracking-widest leading-none text-blue-500`}>{theme.briefing}</span>
            </div>
            <div className={`bg-blue-500/5 border border-blue-500/10 rounded-[32px] p-6`}>
               <p className={`text-sm leading-loose text-blue-400`}>
                 <span dangerouslySetInnerHTML={{ __html: getFormattedLore() }} />
                 {isTyping && <span className={`inline-block w-2 h-4 ml-1 align-middle animate-pulse bg-blue-500`} />}
               </p>
            </div>
          </div>

          <AnimatePresence>
            {revealedVocab.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-purple-500" fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none text-purple-500">Studio_Glossary</span>
                </div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {revealedVocab.map((vocab: any) => (
                      <motion.div 
                        key={vocab.term} layout initial={{ opacity: 0, scale: 0.9, x: -20 }} animate={{ opacity: 1, scale: 1, x: 0 }} 
                        className="bg-purple-500/5 border border-purple-500/20 rounded-2xl overflow-hidden"
                      >
                         <button onClick={() => toggleVocab(vocab.term)} className="w-full flex items-center justify-between p-4 text-left hover:bg-purple-500/10 transition-colors">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-purple-400">{vocab.term}</h4>
                            {expandedVocab[vocab.term] ? <ChevronDown size={14} className="text-purple-400" /> : <ChevronRight size={14} className="text-purple-400" />}
                         </button>
                         <AnimatePresence>
                            {expandedVocab[vocab.term] && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4">
                                    <p className="text-[12px] leading-relaxed text-slate-300">{vocab.definition}</p>
                                </motion.div>
                            )}
                         </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </aside>

        <section className="flex-1 p-8 overflow-y-auto no-scrollbar space-y-10 relative">
          <div className="max-w-5xl mx-auto space-y-10">
            
            {/* VIDEO PLAYER */}
            <div className="relative aspect-video rounded-[48px] overflow-hidden border border-white/10 bg-black shadow-2xl flex items-center justify-between px-6">
                <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 z-10">
                    <Camera size={14} className="text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Capture_Required</span>
                </div>
               <iframe src={mission.video_url} className="w-full h-full absolute inset-0" allowFullScreen />
            </div>

            {/* WORKSPACE & TRANSLATOR */}
            <div className="space-y-4">
               <div className="flex items-center justify-between px-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Workspace // Logic_Check</h3>
                    <div className="flex flex-wrap gap-2">
                       {mission.mission_config?.concepts?.map((concept: string, i: number) => (
                           <span key={i} className="text-[8px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-md border border-blue-500/20">{concept}</span>
                       ))}
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button onClick={startCapture} className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-105 transition-all">
                      <Camera size={14} /> Screenshot Scratch Project
                    </button>
                  )}
               </div>

               <div className="flex gap-6 h-[550px]">
                  <div className="flex-1 rounded-[32px] overflow-hidden border border-white/10 relative bg-[#020617] shadow-xl">
                    <div ref={blocklyDiv} className="w-full h-full" />
                  </div>
                  <div className="w-[340px] flex flex-col rounded-[32px] overflow-hidden border border-white/10 bg-[#0f172a] shadow-2xl">
                     <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 size={14} className="text-purple-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plain_English_Translator</span>
                        </div>
                     </div>
                     <div className="flex-1 p-6 overflow-y-auto no-scrollbar bg-[#020617]/50">
                        {liveCode ? (
                           <pre className="text-[11px] font-mono text-purple-400 whitespace-pre-wrap leading-relaxed tracking-tight">{liveCode}</pre>
                        ) : (
                           <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                              <Code2 size={32} />
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Awaiting<br/>Logic Input</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
            
            {/* DYNAMIC BLUEPRINT SECTION */}
            <div className="grid grid-cols-2 gap-6 pb-20">
              
              {/* GOAL PROMPT */}
              <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[32px] p-6">
                 <label className="text-[10px] font-black uppercase text-slate-500">{prompts.goal.question}</label>
                 
                 {isReadOnly ? (
                    <p className="text-sm font-medium text-blue-300 bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">{blueprint.goal[0]}</p>
                 ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                         {prompts.goal.options.map((opt: string) => {
                             const isSelected = blueprint.goal.includes(opt);
                             return (
                                <button key={opt} onClick={() => toggleOption('goal', opt, prompts.goal.type === 'multiple')}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-blue-500 text-black border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/30 hover:text-white'}`}
                                >
                                  {opt}
                                </button>
                             )
                         })}
                      </div>
                      <AnimatePresence>
                        {blueprint.goal.includes("Other") && (
                            <motion.input initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                type="text" value={blueprint.goal_custom} onChange={e => setBlueprint(p => ({...p, goal_custom: e.target.value}))}
                                placeholder="Type your own answer..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors mt-2"
                            />
                        )}
                      </AnimatePresence>
                    </div>
                 )}
              </div>

              {/* VERIFICATION PROMPT */}
              <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[32px] p-6">
                 <label className="text-[10px] font-black uppercase text-slate-500">{prompts.verification.question}</label>
                 
                 {isReadOnly ? (
                    <p className="text-sm font-medium text-green-300 bg-green-500/10 p-4 rounded-2xl border border-green-500/20">{blueprint.verification[0]}</p>
                 ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                         {prompts.verification.options.map((opt: string) => {
                             const isSelected = blueprint.verification.includes(opt);
                             return (
                                <button key={opt} onClick={() => toggleOption('verification', opt, prompts.verification.type === 'multiple')}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-green-500 text-black border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/30 hover:text-white'}`}
                                >
                                  {opt}
                                </button>
                             )
                         })}
                      </div>
                      <AnimatePresence>
                        {blueprint.verification.includes("Other") && (
                            <motion.input initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                type="text" value={blueprint.verification_custom} onChange={e => setBlueprint(p => ({...p, verification_custom: e.target.value}))}
                                placeholder="Type your own answer..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-green-500 transition-colors mt-2"
                            />
                        )}
                      </AnimatePresence>
                    </div>
                 )}
              </div>

            </div>
          </div>

          <AnimatePresence>
            {isRunning && (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="absolute bottom-12 right-12 w-96 bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden z-50">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
                   <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest"><Cpu size={14} /> {theme.console}</div>
                   <div className="flex items-center gap-2">
                      <button onClick={endSimulation} className="p-1 text-red-500 hover:bg-red-500/10 rounded-md"><Power size={16} /></button>
                   </div>
                </div>
                <div className="p-6 h-64 overflow-y-auto font-mono text-[11px] space-y-2 no-scrollbar">
                   {simLogs.map((log, idx) => (
                     <div key={idx} className={`${log.includes('FAIL') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                       <span className="text-slate-600 mr-2 opacity-50">{idx.toString().padStart(3, '0')}</span>{log}
                     </div>
                   ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <AnimatePresence>
        {showCapturePreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-4xl w-full bg-[#020617] border border-white/10 rounded-[48px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Review_Snapshot</h3>
                <button onClick={() => setShowCapturePreview(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
              </div>
              <div className="p-8 bg-black/40 relative group text-center">
                {tempCaptureBlob && <img src={URL.createObjectURL(tempCaptureBlob)} className="w-full h-auto rounded-3xl border border-white/10 shadow-lg contrast-125 mx-auto" alt="Capture Preview" /> }
              </div>
              <div className="p-8 border-t border-white/5 flex gap-4">
                <button onClick={() => setShowCapturePreview(false)} className="flex-1 py-4 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-slate-400">Discard</button>
                <button onClick={confirmCapture} className="flex-1 py-4 rounded-2xl bg-blue-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"><Check size={16} /> Confirm Snapshot</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCompleted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="max-w-md w-full bg-white/[0.03] border border-white/10 rounded-[56px] p-12 text-center space-y-8">
              <div className="w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto border bg-green-500/20 border-green-500/30"><Trophy size={40} className="text-green-400" /></div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Mission <br /><span className="text-green-400">Accomplished</span></h2>
              <Link href="/student/dashboard" className="flex items-center justify-center gap-3 w-full py-6 rounded-3xl font-black uppercase italic bg-white text-black hover:scale-105 transition-all shadow-2xl">Return to Command <ArrowRight size={18} /></Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}