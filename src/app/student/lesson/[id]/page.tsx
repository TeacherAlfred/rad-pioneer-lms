"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, CheckCircle2, Play, Camera, Pencil, X,
  Trophy, ArrowRight, Loader2, Zap, ShieldAlert, Terminal as TerminalIcon, 
  Search, Check, Cpu, Power, ShieldCheck, Code2, BookOpen, ChevronDown, ChevronRight, RotateCcw
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

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepVerified, setStepVerified] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [liveCode, setLiveCode] = useState<string>("");

  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [tempCaptureBlob, setTempCaptureBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // NEW: State to hold our archive history array
  const [imageHistory, setImageHistory] = useState<string[]>([]);

  const [displayedLore, setDisplayedLore] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [revealedVocab, setRevealedVocab] = useState<any[]>([]);
  const [expandedVocab, setExpandedVocab] = useState<Record<string, boolean>>({});

  const [blueprint, setBlueprint] = useState({
    goal: [] as string[],
    goal_custom: "",
    verification: [] as string[],
    verification_custom: ""
  });

  const defaultPrompts = {
    goal: { question: "What is your objective?", type: "single", options: ["Complete the level", "Other"] },
    verification: { question: "How do you know it works?", type: "multiple", options: ["Visual change", "Other"] }
  };

  const theme = mission?.mission_config?.theme || {
      briefing: "Mission_Briefing", console: "System_Console", verifyBtn: "Test Logic", successCode: "LOGIC_VERIFIED",
  };

  const steps = useMemo(() => {
    if (!mission) return [];
    if (mission.mission_config?.steps) return mission.mission_config.steps;
    
    return [{
      type: 'capture',
      media_url: mission.video_url,
      lore_text: mission.lore_text || mission.mission_config?.lore_text || "Execute the sequence.",
      vocabulary: mission.mission_config?.vocabulary || [],
      win_sequence: mission.mission_config?.win_sequence || [],
      prompts: mission.mission_config?.prompts || defaultPrompts
    }];
  }, [mission]);

  const currentStepData = useMemo(() => steps[currentStepIndex] || {}, [steps, currentStepIndex]);

  const isIntroStep = currentStepData.type === 'intro';
  const isBlueprintStep = currentStepData.type === 'blueprint';
  const isCaptureStep = currentStepData.type === 'capture';
  const isCodeStep = !isIntroStep && !isBlueprintStep && !isCaptureStep; 
  const isBlueprintValid = blueprint.goal.length > 0 && blueprint.verification.length > 0;

  const toggleOption = (promptKey: 'goal' | 'verification', option: string, isMultiple: boolean) => {
    if (isReadOnly) return;
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
    delete (Blockly.Blocks as any)['gamedev_event'];
    delete (Blockly.Blocks as any)['gamedev_action'];

    const events = config?.events || [{ label: "RIGHT ARROW", value: "RIGHT_ARROW" }];
    const actions = config?.actions || [{ label: "MOVE 10 STEPS", value: "MOVE_10" }];

    (Blockly.Blocks as any)['gamedev_event'] = {
      init: function(this: any) {
        this.appendDummyInput().appendField("WHEN").appendField(new Blockly.FieldDropdown(events.map((e:any)=>[e.label, e.value])), "EVENT_TYPE").appendField("PRESSED");
        this.setNextStatement(true, null); this.setColour("#f59e0b");
      }
    };

    (Blockly.Blocks as any)['gamedev_action'] = {
      init: function(this: any) {
        this.appendDummyInput().appendField("ACTION:").appendField(new Blockly.FieldDropdown(actions.map((a:any)=>[a.label, a.value])), "ACTION_TYPE");
        this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3b82f6");
      }
    };

    (javascriptGenerator as any).forBlock['gamedev_event'] = function(block: any) {
      const type = block.getFieldValue('EVENT_TYPE'); return `highlightBlock("${block.id}");\nonEvent("${type}");\n`;
    };
    
    (javascriptGenerator as any).forBlock['gamedev_action'] = function(block: any) {
      const action = block.getFieldValue('ACTION_TYPE'); return `highlightBlock("${block.id}");\nexecuteAction("${action}");\n`;
    };
  };

  const formatPseudocode = (rawCode: string) => {
    let code = rawCode.replace(/highlightBlock\(".*?"\);\n/g, '');
    code = code.replace(/onEvent\("(.*?)"\);\n/g, 'WHEN the $1 key is pressed:\n');
    code = code.replace(/executeAction\("(.*?)"\);\n/g, '  -> DO: $1\n');
    return code.replace(/^\s*[\r\n]/gm, '');
  };

  useEffect(() => {
    const textToType = currentStepData?.lore_text;
    if (textToType) {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      setIsTyping(true); setDisplayedLore(""); let i = 0;
      typingIntervalRef.current = setInterval(() => {
        setDisplayedLore(textToType.slice(0, i + 1)); i++;
        if (i >= textToType.length) {
          if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
          setIsTyping(false);
        }
      }, 20);
    }
    return () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); }
  }, [currentStepData?.lore_text, currentStepIndex]);

  useEffect(() => {
    if (!currentStepData?.vocabulary) return;
    const stepVocab = currentStepData.vocabulary;
    
    const newlyRevealed = stepVocab.filter((v: any) => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
        return regex.test(displayedLore);
    });

    if (newlyRevealed.length > 0) {
        setRevealedVocab(prev => {
          const existingTerms = new Set(prev.map(p => p.term));
          const uniqueNew = newlyRevealed.filter((n: any) => !existingTerms.has(n.term));
          if (uniqueNew.length === 0) return prev; 
          return [...prev, ...uniqueNew];
        });
        
        setExpandedVocab(prev => {
            let hasChanges = false;
            const newExpanded = { ...prev };
            newlyRevealed.forEach((v: any) => {
                if (newExpanded[v.term] === undefined) {
                  newExpanded[v.term] = true; 
                  hasChanges = true;
                }
            });
            return hasChanges ? newExpanded : prev;
        });
    }
  }, [displayedLore, currentStepData?.vocabulary]);

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
          setBlueprint({ 
            goal: [archiveData.description], goal_custom: "", 
            verification: [archiveData.win_condition], verification_custom: "" 
          });
          
          // Decode the comma-separated history string
          const urls = archiveData.media_url ? archiveData.media_url.split(',') : [];
          setImageHistory(urls);
          setImagePreview(urls[0] || null);
          
          setStepVerified(true); 
          setIsReadOnly(true);

          const totalSteps = missionData.mission_config?.steps?.length || 1;
          setCurrentStepIndex(totalSteps - 1);
        }
      } catch (err) { setErrorMsg("A critical system error occurred."); } finally { setLoading(false); }
    }
    initMission();
  }, [id, router]);

  useEffect(() => {
    if (!mission || mission.sandbox_type === 'none' || mission.sandbox_type === 'p5js' || !blocklyDiv.current) return;
    if (workspace.current) return;

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
      theme: pioneerTheme, 
      grid: { spacing: 20, length: 3, colour: '#1e293b', snap: true }, 
      zoom: { controls: true, wheel: true, startScale: 1.0 }, 
      trashcan: true
    });

    workspace.current.addChangeListener((e) => {
        if (e.type !== Blockly.Events.UI && e.type !== Blockly.Events.FINISHED_LOADING && workspace.current) {
            setLiveCode(formatPseudocode(javascriptGenerator.workspaceToCode(workspace.current)));
        }
    });
  }, [mission, loading]);

  useEffect(() => {
    if (isCodeStep && workspace.current) {
      setTimeout(() => {
        if (workspace.current) Blockly.svgResize(workspace.current);
      }, 50);
    }
  }, [isCodeStep]);

  // --- REPLAY MISSION LOGIC ---
  const handleReplayMission = () => {
    setIsReadOnly(false);
    setCurrentStepIndex(0);
    setStepVerified(false);
    // Setting this to null forces them to take a new snapshot to pass!
    setImagePreview(null); 
    setTempCaptureBlob(null);
    setSimLogs([]);
    setRevealedVocab([]);
    setExpandedVocab({});
    if (workspace.current) {
      workspace.current.clear();
    }
  };

  const runSimulation = async () => {
    if (!workspace.current) return;
    setIsRunning(true); setIsExecuting(true); setStepVerified(false);
    setSimLogs([`[INITIALIZING_${theme.console.toUpperCase()}]...`]);
    await new Promise(r => setTimeout(r, 1000));

    const topBlocks = workspace.current.getTopBlocks(true);
    let userStacks: string[] = [];
    
    for (const topBlock of topBlocks) {
        let currentBlock: Blockly.Block | null = topBlock;
        let currentStack: string[] = [];

        while (currentBlock) {
            if (!isRunning && isExecuting) break;
            workspace.current.highlightBlock(currentBlock.id);
            
            if (currentBlock.type === 'gamedev_event') {
                const ev = currentBlock.getFieldValue('EVENT_TYPE'); 
                currentStack.push(ev);
                setSimLogs(prev => [...prev, `[EVENT INITIALIZED]: ${ev} Key Listener.`]);
            } else if (currentBlock.type === 'gamedev_action') {
                const act = currentBlock.getFieldValue('ACTION_TYPE'); 
                currentStack.push(act);
                setSimLogs(prev => [...prev, `[ACTION BINDING]: ${act}`]);
            }
            await new Promise(r => setTimeout(r, 600)); 
            workspace.current.highlightBlock(null);

            currentBlock = currentBlock.getNextBlock();
        }
        if (currentStack.length > 0) userStacks.push(currentStack.join(','));
    }

    const winSequence = currentStepData.win_sequence || [];
    const eventValues = (mission?.mission_config?.events || [{ value: 'RIGHT_ARROW' }]).map((e: any) => e.value);
    
    let expectedStacks: string[] = [];
    let currentExpectedStack: string[] = [];
    
    for (const item of winSequence) {
         if (eventValues.includes(item)) {
             if (currentExpectedStack.length > 0) {
                 expectedStacks.push(currentExpectedStack.join(','));
             }
             currentExpectedStack = [item];
         } else {
             currentExpectedStack.push(item);
         }
    }
    if (currentExpectedStack.length > 0) {
        expectedStacks.push(currentExpectedStack.join(','));
    }

    const isSuccess = expectedStacks.length > 0 && expectedStacks.every(expected => userStacks.includes(expected));

    if (isSuccess) {
        setSimLogs(prev => [...prev, `[SUCCESS]: All Event Listeners Verified.`, `[${theme.successCode}]`]);
        setStepVerified(true);
    } else {
        setSimLogs(prev => [...prev, `[FAIL]: Logic mismatch detected. Try again.`, "[RETRY_SEQUENCE]"]);
        setStepVerified(false);
    }
    setIsExecuting(false);
  };

  const endSimulation = () => {
    setIsRunning(false); setIsExecuting(false); setSimLogs([]); workspace.current?.highlightBlock(null);
  };

  const advanceToNextStep = () => {
    setStepVerified(false);
    endSimulation();
    setCurrentStepIndex(prev => prev + 1);
  };

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
    const finalGoal = isReadOnly ? blueprint.goal[0] : [...blueprint.goal.filter(o => o !== 'Other'), blueprint.goal.includes('Other') ? blueprint.goal_custom : ""].filter(Boolean).join(", ");
    const finalVerification = isReadOnly ? blueprint.verification[0] : [...blueprint.verification.filter(o => o !== 'Other'), blueprint.verification.includes('Other') ? blueprint.verification_custom : ""].filter(Boolean).join(", ");

    if (!finalGoal || !finalVerification || !imagePreview) {
      alert("Incomplete Uplink! Ensure you have answered the Blueprint and captured a snapshot."); return;
    }
    setIsSaving(true);
    try {
      // Setup our history array payload
      let newHistoryArray = [...imageHistory];

      if (tempCaptureBlob) {
        const fileName = `${user.id}-${id}-${Date.now()}.png`;
        await supabase.storage.from('tech-archive-assets').upload(`blueprints/${fileName}`, tempCaptureBlob);
        const { data: urlData } = supabase.storage.from('tech-archive-assets').getPublicUrl(`blueprints/${fileName}`);
        
        // Prepend the brand new URL to the top of the array
        newHistoryArray = [urlData.publicUrl, ...imageHistory];
      }
      
      // Convert back to comma-separated string for Supabase TEXT field
      const newHistoryString = newHistoryArray.filter(Boolean).join(',');

      const { error: archiveError } = await supabase.from('tech_archive').upsert({
        student_id: user.id, mission_id: mission.id, title: mission.title,
        description: finalGoal, win_condition: finalVerification,
        media_url: newHistoryString, status: 'completed', xp_earned: mission.xp_reward || 50,
        type: 'blueprint'
      }, { onConflict: 'student_id,mission_id' });

      if (archiveError) {
        console.error("TECH ARCHIVE ERROR:", archiveError);
        alert(`Database Error: ${archiveError.message}`);
        setIsSaving(false);
        return; 
      }

      if (!isReadOnly) {
        const newXP = (user.xp || 0) + (mission.xp_reward || 50);
        await supabase.from('profiles').update({ xp: newXP }).eq('id', user.id);
        await supabase.from('enrollments').update({ active_task: null }).eq('student_id', user.id);
        localStorage.setItem("pioneer_session", JSON.stringify({ ...user, xp: newXP }));
      }
      
      // Immediately lock in the new state so the gallery updates
      setImageHistory(newHistoryArray);
      setImagePreview(newHistoryArray[0]);
      setIsReadOnly(true);
      setIsCompleted(true);
      confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    } catch (err) { 
      console.error(err); 
      alert("An unexpected error occurred during the uplink.");
    } finally { 
      setIsSaving(false); 
    }
  };

  const renderMediaContent = (url: string | undefined) => {
    if (!url) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
          <div className="text-center opacity-30">
            <Play size={48} className="mx-auto mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual_Data_Offline</p>
          </div>
        </div>
      );
    }
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return <iframe src={url} className="w-full h-full object-cover" allowFullScreen />;
    }
    return <video src={url} className="w-full h-full object-cover" controls autoPlay loop muted playsInline />;
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (errorMsg) return ( <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-white space-y-6"><ShieldAlert size={64} className="text-red-500" /><h1 className="text-2xl font-black uppercase tracking-widest">{errorMsg}</h1><Link href="/student/dashboard" className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase text-xs">Return to Dashboard</Link></div> );

  return (
    <main className="h-screen text-white flex flex-col overflow-hidden bg-[#020617] font-sans">
      <style>{` 
        .blocklyToolboxContents { padding-top: 48px !important; } 
        .blocklyTreeRow { margin-bottom: 12px !important; } 
        .blocklyFlyoutScrollbar { display: none !important; } 
      `}</style>

      <nav className="h-20 border-b border-white/5 px-8 flex items-center justify-between z-30 bg-[#020617] shrink-0">
        <div className="flex items-center gap-6 text-left">
          <button onClick={() => window.location.href = '/student/courses'} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"><ArrowLeft size={18} /></button>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 leading-none">
              {mission.modules?.title} // Task {currentStepIndex + 1} of {steps.length}
            </p>
            <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none mt-1">
              Milestone_{mission.order_index}: {mission.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          
          {isReadOnly && (
            <button onClick={handleReplayMission} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all border border-purple-500/20">
              <RotateCcw size={14} /> Replay Mission
            </button>
          )}

          {isIntroStep && (
            <button onClick={advanceToNextStep} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-500 text-black text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-blue-500/20">
              Commence Setup <ArrowRight size={14} />
            </button>
          )}

          {isCodeStep && (
            <>
              <button onClick={runSimulation} disabled={isExecuting || isReadOnly} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-black text-[10px] font-black uppercase tracking-widest transition-all ${isExecuting || isReadOnly ? 'bg-slate-700' : 'bg-blue-500 hover:scale-105 shadow-lg shadow-blue-500/20'}`}>
                {isExecuting ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} fill="currentColor" />} {stepVerified ? "Re-Verify" : theme.verifyBtn}
              </button>
              <button onClick={advanceToNextStep} disabled={!stepVerified && !isReadOnly} className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${stepVerified || isReadOnly ? 'bg-white text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}>
                Next Task <ArrowRight size={14} />
              </button>
            </>
          )}

          {isBlueprintStep && (
            <button onClick={advanceToNextStep} disabled={!isBlueprintValid && !isReadOnly} className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${isBlueprintValid || isReadOnly ? 'bg-blue-500 text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}>
              Confirm Blueprint <ArrowRight size={14} />
            </button>
          )}

          {isCaptureStep && (
            <button onClick={handleComplete} disabled={!imagePreview || isSaving} className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${imagePreview && !isReadOnly ? 'bg-white text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}>
              {isSaving ? <Loader2 className="animate-spin" size={14} /> : (isReadOnly ? "Archived" : "Lock Milestone")}
            </button>
          )}
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[420px] border-r border-white/5 bg-black/20 overflow-y-auto p-8 space-y-8 no-scrollbar text-left font-mono flex flex-col shrink-0">
           <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className={`text-blue-500`} fill="currentColor" />
              <span className={`text-[10px] font-black uppercase tracking-widest leading-none text-blue-500`}>{theme.briefing}</span>
            </div>
            <div key={currentStepIndex} className={`bg-blue-500/5 border border-blue-500/10 rounded-[32px] p-6`}>
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

        <section className="flex-1 p-8 overflow-y-auto no-scrollbar space-y-10 relative bg-[#020617]">
          <div className="max-w-5xl mx-auto space-y-10">
            
            {!isCaptureStep && (
              <div className="relative aspect-video rounded-[48px] overflow-hidden border border-white/10 bg-black shadow-2xl">
                  {renderMediaContent(currentStepData.media_url)}
              </div>
            )}

            <div className={`space-y-4 ${isCodeStep ? 'block' : 'hidden'}`}>
               <div className="flex items-center justify-between px-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Workspace // Logic_Check</h3>
                  </div>
               </div>

               <div className="flex gap-6 h-[550px]">
                  <div className="flex-1 rounded-b-[32px] rounded-t-lg overflow-hidden border border-white/10 relative bg-[#020617] shadow-xl">
                    <div ref={blocklyDiv} className="absolute inset-0" />
                  </div>
                  <div className="w-[340px] flex flex-col rounded-[32px] overflow-hidden border border-white/10 bg-[#0f172a] shadow-2xl shrink-0">
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
            
            {(isBlueprintStep || (isCaptureStep && isReadOnly)) && currentStepData.prompts && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[32px] p-8 shadow-xl">
                   <label className="text-xs font-black uppercase text-slate-400 tracking-widest">{currentStepData.prompts.goal.question}</label>
                   <div className="space-y-4 pt-2">
                      <div className="flex flex-wrap gap-3">
                         {currentStepData.prompts.goal.options.map((opt: string) => {
                             const isSelected = blueprint.goal.includes(opt);
                             return (
                               <button key={opt} onClick={() => toggleOption('goal', opt, currentStepData.prompts.goal.type === 'multiple')}
                                 className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${isSelected ? 'bg-blue-500 text-black border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                               >
                                 {opt}
                               </button>
                             )
                         })}
                      </div>
                   </div>
                </div>

                <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[32px] p-8 shadow-xl">
                   <label className="text-xs font-black uppercase text-slate-400 tracking-widest">{currentStepData.prompts.verification.question}</label>
                   <div className="space-y-4 pt-2">
                      <div className="flex flex-wrap gap-3">
                         {currentStepData.prompts.verification.options.map((opt: string) => {
                             const isSelected = blueprint.verification.includes(opt);
                             return (
                               <button key={opt} onClick={() => toggleOption('verification', opt, currentStepData.prompts.verification.type === 'multiple')}
                                 className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${isSelected ? 'bg-green-500 text-black border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                               >
                                 {opt}
                               </button>
                             )
                         })}
                      </div>
                   </div>
                </div>
              </div>
            )}

            {isCaptureStep && (
               <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-[48px] space-y-8 shadow-2xl relative overflow-hidden">
                 
                 {isReadOnly && (
                    <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur-md rounded-2xl border border-green-500/30 z-10">
                        <CheckCircle2 size={14} className="text-green-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Archive_Saved</span>
                    </div>
                  )}
                  
                  {/* THE NEW HISTORY GALLERY DISPLAY */}
                  {isReadOnly && imageHistory.length > 0 ? (
                     <div className="space-y-6 w-full max-w-3xl mx-auto relative z-10 pt-8">
                        <div className="rounded-[32px] overflow-hidden border-2 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.2)] relative bg-black">
                           <div className="absolute top-4 left-4 bg-green-500 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest z-10">Latest Archive</div>
                           <img src={imageHistory[0]} alt="Latest Blueprint" className="w-full h-auto object-cover" />
                        </div>

                        {imageHistory.length > 1 && (
                           <div className="space-y-4 pt-8 border-t border-white/10">
                              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Previous Versions</h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                 {imageHistory.slice(1).map((url, idx) => (
                                    <div key={idx} className="rounded-2xl overflow-hidden border border-white/10 opacity-70 hover:opacity-100 transition-opacity relative group cursor-pointer bg-black"
                                         onClick={() => window.open(url, '_blank')}>
                                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <Search className="text-white" />
                                       </div>
                                       <img src={url} alt={`Archive ${idx + 1}`} className="w-full h-auto object-cover" />
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  ) : imagePreview ? (
                     <div className="w-full max-w-3xl rounded-[32px] overflow-hidden border border-white/10 shadow-2xl relative z-10">
                        <img src={imagePreview} alt="Saved Blueprint" className="w-full h-auto object-cover" />
                     </div>
                  ) : (
                     <>
                        <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                           <Camera size={40} className="text-blue-400" />
                        </div>
                        <div className="text-center space-y-3 z-10 relative">
                          <h3 className="text-3xl font-black italic uppercase tracking-tighter">Capture Final Logic</h3>
                          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                            Open your Scratch studio, assemble your logic blocks exactly as planned, and submit a screenshot to clear this sector.
                          </p>
                        </div>
                        <button onClick={startCapture} className="px-10 py-5 bg-blue-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)] relative z-10">
                           Launch System Capture
                        </button>
                     </>
                  )}
               </div>
            )}
          </div>

          <AnimatePresence>
            {isRunning && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-12 right-12 w-96 bg-[#0f172a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden z-50">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
                   <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest"><Cpu size={14} /> {theme.console}</div>
                   <button onClick={endSimulation} className="p-1 text-red-500 hover:bg-red-500/10 rounded-md"><Power size={16} /></button>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
            <div className="max-w-4xl w-full bg-[#020617] border border-white/10 rounded-[48px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Review_Snapshot</h3>
                <button onClick={() => setShowCapturePreview(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
              </div>
              <div className="p-8 bg-black/40 text-center">
                {tempCaptureBlob && <img src={URL.createObjectURL(tempCaptureBlob)} className="w-full h-auto rounded-3xl border border-white/10 mx-auto" alt="Preview" /> }
              </div>
              <div className="p-8 border-t border-white/5 flex gap-4">
                <button onClick={() => setShowCapturePreview(false)} className="flex-1 py-4 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400">Discard</button>
                <button onClick={confirmCapture} className="flex-1 py-4 rounded-2xl bg-blue-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">Confirm Snapshot</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCompleted && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-6">
            <div className="max-w-md w-full bg-white/[0.03] border border-white/10 rounded-[56px] p-12 text-center space-y-8">
              <div className="w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto border bg-green-500/20 border-green-500/30"><Trophy size={40} className="text-green-400" /></div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Mission <br /><span className="text-green-400">Accomplished</span></h2>
              <button onClick={() => window.location.href = '/student/dashboard'} className="flex items-center justify-center gap-3 w-full py-6 rounded-3xl font-black uppercase italic bg-white text-black hover:scale-105 transition-all shadow-2xl">Return to Command <ArrowRight size={18} /></button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}