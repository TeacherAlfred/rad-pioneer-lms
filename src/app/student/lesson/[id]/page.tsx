"use client";
"use no memo";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, CheckCircle2, Play, Camera, X,
  Trophy, ArrowRight, Loader2, Zap, ShieldAlert, ArrowUpRight,
  Search, Cpu, Power, Code2, BookOpen, ChevronDown, ChevronRight, RotateCcw
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import * as Blockly from "blockly";
import MakeCodeRenderer from "@/components/lms/MakeCodeRenderer";
import { javascriptGenerator } from "blockly/javascript";
import SequenceViewer from "@/components/lms/SequenceViewer";

// --- FULL SCREEN BRIEFING OVERLAY COMPONENT ---
function MissionBriefingOverlay({ text, onComplete }: { text: string, onComplete: () => void }) {
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState<'cursor' | 'typing' | 'waiting' | 'done'>('cursor');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    // Phase 1: Flashing Cursor
    let blinkCount = 0;
    const blinkInterval = setInterval(() => {
      setCursorVisible(v => !v);
      blinkCount++;
      if (blinkCount > 5) {
        clearInterval(blinkInterval);
        setCursorVisible(true);
        setPhase('typing');
      }
    }, 300);

    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    // Phase 2: Typewriter Effect
    if (phase === 'typing') {
      let i = 0;
      const typeInterval = setInterval(() => {
        setDisplayedText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(typeInterval);
          setPhase('waiting'); 
        }
      }, 30); 
      return () => clearInterval(typeInterval);
    }
  }, [phase, text]);

  useEffect(() => {
    if (phase === 'done') {
       onComplete();
    }
  }, [phase, onComplete]);

  const handleInteraction = () => {
    if (phase === 'typing') {
      setDisplayedText(text); 
      setPhase('waiting');
    } else if (phase === 'waiting') {
      setPhase('done');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
      onClick={handleInteraction}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-8 cursor-pointer"
    >
      <div className="max-w-4xl w-full space-y-6">
        <div className="flex items-center gap-3 text-green-500 mb-8 opacity-80">
           <Zap size={20} fill="currentColor" />
           <span className="text-xs font-black uppercase tracking-[0.4em]">Incoming Transmission</span>
        </div>
        <p className="text-2xl md:text-4xl font-mono text-green-400 leading-relaxed min-h-[120px] whitespace-pre-wrap">
          {displayedText}
          {phase !== 'done' && <span className={`inline-block w-4 h-8 ml-2 bg-green-400 align-middle ${!cursorVisible ? 'opacity-0' : 'opacity-100'}`} />}
        </p>
        
        <AnimatePresence>
          {phase === 'waiting' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="mt-12 text-center text-green-500/70 font-bold uppercase tracking-widest text-sm animate-pulse"
            >
              [ Click anywhere to initialize ]
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// --- NEW TOAST NOTIFICATION COMPONENT ---
function ToastNotification({ message, type, onClose }: { message: string | null, type: 'error' | 'success', onClose: () => void }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-full max-w-md px-4">
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -20, scale: 0.9 }} 
            className={`pointer-events-auto rounded-[32px] p-6 shadow-2xl flex items-center gap-4 relative overflow-hidden border ${
              type === 'error' 
                ? 'bg-[#0f172a] border-red-500/30 shadow-red-900/20' 
                : 'bg-[#0f172a] border-green-500/30 shadow-green-900/20'
            }`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              type === 'error' 
                ? 'bg-red-500/20 border-red-500/30 text-red-400' 
                : 'bg-green-500/20 border-green-500/30 text-green-400'
            }`}>
              {type === 'error' ? <ShieldAlert size={24} /> : <CheckCircle2 size={24} />}
            </div>
            <div className="flex-1 pr-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none mb-1.5">
                {type === 'error' ? 'System Alert' : 'Success'}
              </h3>
              <p className="text-sm font-bold text-slate-400 leading-tight">{message}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors shrink-0">
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


export default function LessonPlayerPage() {
  const { id } = useParams();
  const router = useRouter();
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [showInitialBriefing, setShowInitialBriefing] = useState(true);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [highestReachedStep, setHighestReachedStep] = useState(0);
  const [stepVerified, setStepVerified] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [liveCode, setLiveCode] = useState<string>("");

  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [tempCaptureBlob, setTempCaptureBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<string[]>([]);

  const [displayedLore, setDisplayedLore] = useState("");
  const [scannedVocabText, setScannedVocabText] = useState(""); 
  const [isTyping, setIsTyping] = useState(true);
  const [revealedVocab, setRevealedVocab] = useState<any[]>([]);
  const [expandedVocab, setExpandedVocab] = useState<Record<string, boolean>>({});

  const [blueprint, setBlueprint] = useState({
    mvp: [] as string[],
    beyond: ""
  });

  const showToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMsg({ text, type });
  };

  const handleBriefingComplete = useCallback(() => {
    setShowInitialBriefing(false);
  }, []);

  const handleCardChange = useCallback((content: string) => {
    setScannedVocabText(prev => {
      if (prev.includes(content)) return prev; 
      return prev + " " + content;
    });
  }, []);

  // GLOBAL PARSED CONFIG
  const parsedConfig = useMemo(() => {
    if (!mission) return {};
    if (typeof mission.mission_config === 'string') {
      try {
        return JSON.parse(mission.mission_config);
      } catch (e) {
        console.error("Failed to parse mission_config string", e);
        return {};
      }
    }
    return mission.mission_config || {};
  }, [mission]);

  const theme = parsedConfig.theme || {
      briefing: "Mission_Briefing", console: "System_Console", verifyBtn: "Test Logic", successCode: "LOGIC_VERIFIED",
  };

  const steps = useMemo(() => {
    if (!mission) return [];
    let dbSteps = parsedConfig.steps || [];
    
    if (dbSteps.length === 0) {
      dbSteps = [{
        type: 'capture',
        media_url: mission.video_url,
        lore_text: mission.lore_text || "Execute the sequence.",
        vocabulary: parsedConfig.vocabulary || [],
        win_sequence: parsedConfig.win_sequence || [],
        cards: []
      }];
    } else {
      if (dbSteps[dbSteps.length - 1].type !== 'capture') {
        dbSteps = [...dbSteps, {
          type: 'capture',
          lore_text: "Logic verified! Now, let's back up your work to the RAD Cloud. Capture a system snapshot to archive this milestone.",
          cards: []
        }];
      }
    }
    return dbSteps;
  }, [mission, parsedConfig]);

  const currentStepData = useMemo(() => steps[currentStepIndex] || {}, [steps, currentStepIndex]);

  const isIntroStep = currentStepData.type === 'intro';
  const isBlueprintStep = currentStepData.type === 'blueprint';
  const isCaptureStep = currentStepData.type === 'capture';
  const isCodeStep = !isIntroStep && !isBlueprintStep && !isCaptureStep; 
  
  const isBlueprintValid = blueprint.mvp.length > 0;

  const toggleMvpOption = (option: string) => {
    if (isReadOnly) return;
    setBlueprint(prev => {
      const current = prev.mvp;
      if (current.includes(option)) return { ...prev, mvp: current.filter(o => o !== option) };
      if (current.length >= 4) return prev; 
      return { ...prev, mvp: [...current, option] };
    });
  };

  const getMakeCodeRenderString = (rawCode: string) => {
    if (!rawCode) return "";
    let code = rawCode.replace(/highlightBlock\(".*?"\);\n/g, '');
    code = code.replace(/onEvent\("ON_START"\);\n/g, 'basic.forever(() => {\n');
    code = code.replace(/executeAction\("SHOW_ICON"\);\n/g, '  basic.showIcon(IconNames.Heart)\n})\n');
    return code;
  };

  const getBlockOriginalColor = useCallback((blockType: string) => {
    const typeVal = blockType.replace('event_', '').replace('action_', '');
    const categories = parsedConfig.toolbox || [];
    for (const cat of categories) {
      for (const b of cat.blocks || []) {
        if (b.value === typeVal) return cat.color || '#4C97FF';
      }
    }
    return '#4C97FF';
  }, [parsedConfig]);

  const defineCustomBlocks = (config: any) => {
    const toolboxCategories = config?.toolbox || [];

    toolboxCategories.forEach((category: any) => {
      const catColor = category.color || "#4C97FF";

      (category.blocks || []).forEach((b: any) => {
        const isEventBlock = b.value.includes('EVENT') || b.value.includes('ON_') || b.value.includes('WHEN_') || category.category.toUpperCase().includes('EVENT');
        const blockPrefix = isEventBlock ? 'event_' : 'action_';
        const blockName = `${blockPrefix}${b.value}`;
        
        delete (Blockly.Blocks as any)[blockName]; 
        
        (Blockly.Blocks as any)[blockName] = {
          init: function(this: any) {
            this.appendDummyInput().appendField(b.label);
            
            if (isEventBlock) {
               this.appendStatementInput("DO").setCheck(null);
               if (this.setHat) this.setHat("cap"); 
            } else {
               this.setPreviousStatement(true, null); 
               this.setNextStatement(true, null); 
            }
            this.setColour(catColor);
          }
        };

        (javascriptGenerator as any).forBlock[blockName] = function(block: any) {
          if (isEventBlock) {
             const innerCode = javascriptGenerator.statementToCode(block, 'DO');
             return `highlightBlock("${block.id}");\nonEvent("${b.value}", function() {\n${innerCode}});\n`;
          } else {
             return `highlightBlock("${block.id}");\nexecuteAction("${b.value}");\n`;
          }
        };
      });
    });
  };

  const formatPseudocode = (rawCode: string) => {
    let code = rawCode.replace(/highlightBlock\(".*?"\);\n/g, '');
    code = code.replace(/onEvent\("(.*?)", function\(\) \{\n([\s\S]*?)\}\);\n/g, 'WHEN: $1 TRIGGERED\n$2');
    code = code.replace(/executeAction\("(.*?)"\);\n/g, '  -> DO: $1\n');
    return code.replace(/^\s*[\r\n]/gm, '');
  };

  useEffect(() => {
    if (showInitialBriefing) return; 

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
    } else {
      setDisplayedLore("");
      setIsTyping(false);
    }
    return () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); }
  }, [currentStepData?.lore_text, currentStepIndex, showInitialBriefing]);

  useEffect(() => {
    if (!currentStepData?.vocabulary) return;
    const stepVocab = currentStepData.vocabulary;
    
    const newlyRevealed = stepVocab.filter((v: any) => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
        return regex.test(scannedVocabText) || regex.test(displayedLore); 
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
  }, [scannedVocabText, displayedLore, currentStepData?.vocabulary]);

  const getFormattedLore = () => {
    if (!revealedVocab || revealedVocab.length === 0) return displayedLore;
    let formattedText = displayedLore;
    const sortedVocab = [...revealedVocab].sort((a, b) => b.term.length - a.term.length);
    
    sortedVocab.forEach(v => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedTerm})\\b(?![^<]*>)`, 'gi');
        const safeDef = v.definition.replace(/"/g, '&quot;');
        formattedText = formattedText.replace(regex, `<span class="inline-block relative z-10 text-purple-300 font-black bg-purple-500/20 px-2 py-0.5 mx-1 rounded-md border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-help" title="${safeDef}">$1</span>`);
    });
    return formattedText;
  };

  const formatGlossaryText = (text: string) => {
    if (!currentStepData?.vocabulary || currentStepData.vocabulary.length === 0) return text;
    let formattedText = text;
    const sortedVocab = [...currentStepData.vocabulary].sort((a, b) => b.term.length - a.term.length);
    
    sortedVocab.forEach((v: any) => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedTerm})\\b(?![^<]*>)`, 'gi');
        const safeDef = v.definition.replace(/"/g, '&quot;');
        formattedText = formattedText.replace(regex, `<span class="inline-block relative z-10 text-purple-300 font-black bg-purple-500/20 px-2 py-0.5 mx-1 rounded-md border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-help" title="${safeDef}">$1</span>`);
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
            mvp: archiveData.description ? archiveData.description.split(", ") : [], 
            beyond: archiveData.win_condition || "" 
          });
          
          const urls = archiveData.media_url ? archiveData.media_url.split(',') : [];
          setImageHistory(urls);
          setImagePreview(urls[0] || null);
          
          setStepVerified(true); 
          setIsReadOnly(true);

          // Use the parsedConfig to get the correct step length
          let configObj = missionData.mission_config || {};
          if (typeof configObj === 'string') {
            try { configObj = JSON.parse(configObj); } catch(e) { configObj = {}; }
          }
          const totalSteps = configObj.steps?.length || 1;
          
          setCurrentStepIndex(totalSteps); 
          setHighestReachedStep(totalSteps);
          
          setShowInitialBriefing(false);
        }
      } catch (err) { setErrorMsg("A critical system error occurred."); } finally { setLoading(false); }
    }
    initMission();
  }, [id, router]);

  useEffect(() => {
    if (showInitialBriefing || !mission || mission.sandbox_type === 'none' || mission.sandbox_type === 'p5js' || !blocklyDiv.current) return;
    if (workspace.current) return;

    defineCustomBlocks(parsedConfig);
    
    const pioneerTheme = Blockly.Theme.defineTheme('pioneer_dark', {
      name: 'pioneer_dark', base: Blockly.Themes.Classic,
      componentStyles: {
        'workspaceBackgroundColour': '#020617', 'toolboxBackgroundColour': '#0f172a', 'toolboxForegroundColour': '#94a3b8',
        'flyoutBackgroundColour': '#0f172a', 'flyoutForegroundColour': '#ccc', 'insertionMarkerColour': '#fff', 'insertionMarkerOpacity': 0.3,
      }
    });

    const makeCodeTheme = Blockly.Theme.defineTheme('makecode_style', {
      name: 'makecode_style',
      base: Blockly.Themes.Classic,
      blockStyles: {
        "event_blocks": { "colourPrimary": "#eab308" }, 
        "action_blocks": { "colourPrimary": "#3b82f6" },
      },
      componentStyles: {
        'workspaceBackgroundColour': '#020617',
        'toolboxBackgroundColour': '#0f172a',
        'toolboxForegroundColour': '#94a3b8',
        'flyoutBackgroundColour': '#0f172a',
        'flyoutOpacity': 1,
        'scrollbarColour': '#1e293b',
        'insertionMarkerColour': '#ffffff',
        'insertionMarkerOpacity': 0.3,
      }
    });

    const toolboxCategories = parsedConfig.toolbox || [];
    const toolboxContents = toolboxCategories.map((cat: any) => {
       const mappedBlocks = (cat.blocks || []).map((b: any) => {
          const isEventBlock = b.value.includes('EVENT') || b.value.includes('ON_') || b.value.includes('WHEN_') || cat.category.toUpperCase().includes('EVENT');
          const blockPrefix = isEventBlock ? 'event_' : 'action_';
          return { kind: 'block', type: `${blockPrefix}${b.value}` };
       });

       return {
         kind: 'category',
         name: cat.category || 'Tools',
         colour: cat.color || '#4C97FF',
         contents: mappedBlocks
       };
    });

    workspace.current = Blockly.inject(blocklyDiv.current, {
      toolbox: { kind: 'categoryToolbox', contents: toolboxContents },
      theme: mission.sandbox_type === 'makecode' ? makeCodeTheme : pioneerTheme, 
      renderer: 'zelos',  
      grid: { spacing: 25, length: 3, colour: '#1e293b', snap: true },
      zoom: { controls: false, wheel: true, startScale: 1.1 },
      trashcan: true
    });

    workspace.current.addChangeListener((e) => {
        if (e.type === Blockly.Events.BLOCK_MOVE || e.type === Blockly.Events.BLOCK_CREATE || e.type === Blockly.Events.BLOCK_DELETE) {
            setStepVerified(false);
            if (workspace.current) {
                workspace.current.getAllBlocks(false).forEach(block => {
                    block.setColour(getBlockOriginalColor(block.type));
                });
            }
        }

        if (e.type !== Blockly.Events.UI && e.type !== Blockly.Events.FINISHED_LOADING && workspace.current) {
            setLiveCode(formatPseudocode(javascriptGenerator.workspaceToCode(workspace.current)));
        }
    });
  }, [mission, loading, showInitialBriefing, getBlockOriginalColor, parsedConfig]);

  useEffect(() => {
    if (isCodeStep && workspace.current && !showInitialBriefing) {
      const timer = setTimeout(() => { if (workspace.current) Blockly.svgResize(workspace.current); }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCodeStep, showInitialBriefing]);

  const handleReplayMission = () => {
    setIsReadOnly(false); 
    setCurrentStepIndex(0); 
    setHighestReachedStep(0); 
    setStepVerified(false);
    setImagePreview(null); 
    setTempCaptureBlob(null); 
    setSimLogs([]);
    setRevealedVocab([]); 
    setExpandedVocab({});
    if (workspace.current) workspace.current.clear();
  };

  const runSimulation = async () => {
    if (!workspace.current) return;
    
    workspace.current.getAllBlocks(false).forEach(block => {
        block.setColour(getBlockOriginalColor(block.type));
    });

    setIsRunning(true); setIsExecuting(true); setStepVerified(false);
    setSimLogs([`[INITIALIZING_${theme.console.toUpperCase()}]...`]);
    await new Promise(r => setTimeout(r, 1000));

    const topBlocks = workspace.current.getTopBlocks(true);
    let userStacksData: { blocks: { value: string, block: Blockly.Block }[] }[] = [];
    
    for (const topBlock of topBlocks) {
        if (topBlock.type.startsWith('event_')) {
            let currentStack: { value: string, block: Blockly.Block }[] = [];
            const ev = topBlock.type.replace('event_', ''); 
            currentStack.push({ value: ev, block: topBlock });
            setSimLogs(prev => [...prev, `[EVENT BINDING]: ${ev} Listener Active.`]);

            workspace.current.highlightBlock(topBlock.id);
            await new Promise(r => setTimeout(r, 600));
            workspace.current.highlightBlock(null);

            let innerBlock: Blockly.Block | null = topBlock.getInputTargetBlock('DO');
            
            while (innerBlock) {
                if (!isRunning && isExecuting) break;
                workspace.current.highlightBlock(innerBlock.id);
                
                if (innerBlock.type.startsWith('action_')) {
                    const act = innerBlock.type.replace('action_', ''); 
                    currentStack.push({ value: act, block: innerBlock });
                    setSimLogs(prev => [...prev, `[ACTION EXECUTION]: ${act}`]);
                }
                await new Promise(r => setTimeout(r, 600)); 
                workspace.current.highlightBlock(null);
                innerBlock = innerBlock.getNextBlock();
            }
            if (currentStack.length > 0) userStacksData.push({ blocks: currentStack });
        }
    }

    const winSequence = currentStepData.win_sequence || [];
    
    const allEventValues: string[] = [];
    (parsedConfig.toolbox || []).forEach((cat: any) => {
       (cat.blocks || []).forEach((b: any) => {
          if (b.value.includes('EVENT') || b.value.includes('ON_') || b.value.includes('WHEN_') || cat.category.toUpperCase().includes('EVENT')) {
             allEventValues.push(b.value);
          }
       });
    });
    
    let expectedStacks: string[][] = [];
    let currentExpectedStack: string[] = [];
    
    for (const item of winSequence) {
         if (allEventValues.includes(item)) {
             if (currentExpectedStack.length > 0) expectedStacks.push(currentExpectedStack);
             currentExpectedStack = [item];
         } else {
             currentExpectedStack.push(item);
         }
    }
    if (currentExpectedStack.length > 0) expectedStacks.push(currentExpectedStack);

    let isSuccess = true;

    for (const expectedStack of expectedStacks) {
        const expectedEvent = expectedStack[0];
        const userStack = userStacksData.find(us => us.blocks[0].value === expectedEvent);
        
        if (!userStack) {
            isSuccess = false;
            continue;
        }

        for (let i = 0; i < Math.max(expectedStack.length, userStack.blocks.length); i++) {
            const uBlock = userStack.blocks[i];
            const eValue = expectedStack[i];

            if (uBlock) {
                if (uBlock.value === eValue) {
                    uBlock.block.setColour('#22c55e'); 
                } else {
                    uBlock.block.setColour('#ef4444'); 
                    isSuccess = false;
                }
            } else {
                isSuccess = false; 
            }
        }
    }

    for (const us of userStacksData) {
        const startsWithExpected = expectedStacks.some(es => es[0] === us.blocks[0].value);
        if (!startsWithExpected) {
            us.blocks.forEach(ub => ub.block.setColour('#ef4444')); 
            isSuccess = false;
        }
    }

    if (isSuccess) {
        setSimLogs(prev => [...prev, `[SUCCESS]: Logic Requirements Met.`, `[${theme.successCode}]`]);
        setStepVerified(true);
    } else {
        setSimLogs(prev => [...prev, `[FAIL]: Logic mismatch detected. Review highlighted blocks.`, "[RETRY_SEQUENCE]"]);
        setStepVerified(false);
    }
    setIsExecuting(false);
  };

  const endSimulation = () => { setIsRunning(false); setIsExecuting(false); setSimLogs([]); workspace.current?.highlightBlock(null); };
  
  const advanceToNextStep = () => { 
    if (currentStepIndex === steps.length - 1) {
      if (isCaptureStep || currentStepData.type === 'capture') {
        handleComplete();
      }
      return;
    }
    setStepVerified(false); 
    endSimulation(); 
    setCurrentStepIndex(prev => {
      const nextIdx = prev + 1;
      setHighestReachedStep(h => Math.max(h, nextIdx));
      return nextIdx;
    }); 
  };

  const startCapture = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { displaySurface: "browser", selfBrowserSurface: "include", preferCurrentTab: true }, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream; video.play();
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d"); ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => { if (blob) { setTempCaptureBlob(blob); setShowCapturePreview(true); } }, "image/png");
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }, 600);
      };
    } catch (err: any) { console.error("Capture failed:", err); }
  };

  const confirmCapture = () => { if (tempCaptureBlob) { setImagePreview(URL.createObjectURL(tempCaptureBlob)); setShowCapturePreview(false); } };

  const handleComplete = async () => {
    const hasBlueprintStep = parsedConfig.steps?.some((step: any) => step.type === 'blueprint');
    
    const finalMVP = blueprint.mvp.join(", ");
    const finalBeyond = blueprint.beyond;

    if ((hasBlueprintStep && !finalMVP) || !imagePreview) {
      showToast("Incomplete Uplink! Ensure you have captured a snapshot" + (hasBlueprintStep ? " and answered the Blueprint." : "."), "error"); 
      return;
    }

    setIsSaving(true);
    try {
      let newHistoryArray = [...imageHistory];
      if (tempCaptureBlob) {
        const fileName = `${user.id}-${id}-${Date.now()}.png`;
        await supabase.storage.from('tech-archive-assets').upload(`blueprints/${fileName}`, tempCaptureBlob);
        const { data: urlData } = supabase.storage.from('tech-archive-assets').getPublicUrl(`blueprints/${fileName}`);
        newHistoryArray = [urlData.publicUrl, ...imageHistory];
      }
      
      const newHistoryString = newHistoryArray.filter(Boolean).join(',');

      const { error: archiveError } = await supabase.from('tech_archive').upsert({
        student_id: user.id, mission_id: mission.id, title: mission.title,
        description: finalMVP || "Logic Complete", 
        win_condition: finalBeyond, 
        media_url: newHistoryString, status: 'completed', xp_earned: mission.xp_reward || 50,
        type: 'blueprint'
      }, { onConflict: 'student_id,mission_id' });

      if (archiveError) { showToast(`Database Error: ${archiveError.message}`, "error"); setIsSaving(false); return; }

      if (!isReadOnly) {
        const newXP = (user.xp || 0) + (mission.xp_reward || 50);
        await supabase.from('profiles').update({ xp: newXP }).eq('id', user.id);
        await supabase.from('enrollments').update({ active_task: null }).eq('student_id', user.id);
        localStorage.setItem("pioneer_session", JSON.stringify({ ...user, xp: newXP }));
      }
      
      setImageHistory(newHistoryArray); setImagePreview(newHistoryArray[0]);
      setIsReadOnly(true); setIsCompleted(true);
      confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    } catch (err) { showToast("An unexpected error occurred during the uplink.", "error"); } finally { setIsSaving(false); }
  };

  const renderMediaContent = (url: string | undefined) => {
    if (!url) return <div className="w-full h-full flex items-center justify-center bg-slate-900"><div className="text-center opacity-30"><Play size={48} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual_Data_Offline</p></div></div>;
    if (url.includes("youtube.com") || url.includes("youtu.be")) return <iframe src={url} className="w-full h-full object-cover" allowFullScreen />;
    return <video src={url} className="w-full h-full object-cover" controls autoPlay loop muted playsInline />;
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (errorMsg) return ( <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-white space-y-6"><ShieldAlert size={64} className="text-red-500" /><h1 className="text-2xl font-black uppercase tracking-widest">{errorMsg}</h1><Link href="/student/dashboard" className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase text-xs">Return to Dashboard</Link></div> );

  const initialBriefingText = steps[0]?.lore_text || mission?.lore_text || "Awaiting transmission...";

  return (
    <main className="h-screen text-white flex flex-col overflow-hidden bg-[#020617] font-sans relative">
      
      <ToastNotification message={toastMsg?.text || null} type={toastMsg?.type || 'error'} onClose={() => setToastMsg(null)} />

      {/* --- INITIAL IMMERSIVE BRIEFING OVERLAY --- */}
      <AnimatePresence>
        {showInitialBriefing && initialBriefingText && (
           <MissionBriefingOverlay 
              text={initialBriefingText} 
              onComplete={handleBriefingComplete} 
           />
        )}
      </AnimatePresence>

      <style>{` .blocklyToolboxContents { padding-top: 48px !important; } .blocklyTreeRow { margin-bottom: 12px !important; } .blocklyFlyoutScrollbar { display: none !important; } `}</style>

      <nav className="h-20 border-b border-white/5 px-8 flex items-center justify-between z-30 bg-[#020617] shrink-0">
        <div className="flex items-center gap-6 text-left">
          <button onClick={() => window.location.href = '/student/courses'} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"><ArrowLeft size={18} /></button>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 leading-none">
              {mission.modules?.title} // Task {currentStepIndex + 1} of {steps.length}
            </p>
            <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none mt-1">Milestone_{mission.order_index}: {mission.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          
          {isReadOnly && (
            <button onClick={handleReplayMission} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all border border-purple-500/20">
              <RotateCcw size={14} /> Replay Mission
            </button>
          )}

          {isIntroStep && (!currentStepData.cards || currentStepData.cards.length === 0) && (
            <button onClick={advanceToNextStep} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-500 text-black text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-blue-500/20">
              Commence Setup <ArrowRight size={14} />
            </button>
          )}

          {isCodeStep && (
            <>
              <button onClick={runSimulation} disabled={isExecuting || isReadOnly} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-black text-[10px] font-black uppercase tracking-widest transition-all ${isExecuting || isReadOnly ? 'bg-slate-700' : 'bg-blue-500 hover:scale-105 shadow-lg shadow-blue-500/20'}`}>
                {isExecuting ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} fill="currentColor" />} {stepVerified ? "Re-Verify" : theme.verifyBtn}
              </button>
              
              <button 
                onClick={advanceToNextStep} 
                disabled={!stepVerified && !isReadOnly} 
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${stepVerified || isReadOnly ? 'bg-white text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}
              >
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
            {currentStepData.lore_text && (
              <div key={currentStepIndex} className={`bg-blue-500/5 border border-blue-500/10 rounded-[32px] p-6`}>
                  <p className={`text-sm leading-loose text-blue-400`}>
                    <span dangerouslySetInnerHTML={{ __html: getFormattedLore() }} />
                    {isTyping && <span className={`inline-block w-2 h-4 ml-1 align-middle animate-pulse bg-blue-500`} />}
                  </p>
              </div>
            )}
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
                      <motion.div key={vocab.term} layout initial={{ opacity: 0, scale: 0.9, x: -20 }} animate={{ opacity: 1, scale: 1, x: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-2xl overflow-hidden">
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
          
          {/* --- MISSION PROGRESS TRACKER --- */}
          <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
            {steps.map((step: any, idx: number) => {
              const isActive = idx === currentStepIndex;
              const isUnlocked = idx <= highestReachedStep; 
              const isCompleted = isUnlocked && !isActive; 
              
              let label = "Activity";
              if (step.type === 'intro') label = "Briefing";
              if (step.type === 'code') label = "Coding Logic";
              if (step.type === 'blueprint') label = "MVP Blueprint";
              if (step.type === 'capture') label = "Verification";

              return (
                <div key={idx} className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                        if (isUnlocked && !isActive) {
                            setCurrentStepIndex(idx);
                            setStepVerified(false); 
                        }
                    }}
                    disabled={!isUnlocked || isActive}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                      isActive ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)] border border-purple-500 scale-105" :
                      isUnlocked ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 cursor-pointer" :
                      "bg-white/5 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {isCompleted && <CheckCircle2 size={14} />}
                    {isActive && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    {label}
                  </button>
                  {idx < steps.length - 1 && (
                    <div className={`w-6 h-px ${isUnlocked ? "bg-green-500/30" : "bg-white/10"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="max-w-5xl mx-auto space-y-10">
            
            {currentStepData.cards && currentStepData.cards.length > 0 ? (
              <SequenceViewer 
                key={`seq-${currentStepIndex}`}
                cards={currentStepData.cards} 
                formatText={formatGlossaryText}
                onCardChange={handleCardChange}
                onComplete={() => {
                  if (isIntroStep) {
                    advanceToNextStep();
                  } else if (isCodeStep) {
                    document.getElementById('blockly-workspace-container')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }} 
              />
            ) : (
              !isCaptureStep && (
                <div className="relative aspect-video rounded-[48px] overflow-hidden border border-white/10 bg-black shadow-2xl">
                    {renderMediaContent(currentStepData.media_url)}
                </div>
              )
            )}

            {/* BLOCKLY & MAKECODE WORKSPACE SELECTOR */}
            <div id="blockly-workspace-container" className={`space-y-4 ${isCodeStep ? 'block' : 'hidden'}`}>
              <div className="flex gap-6 h-[600px]">
                <div className="flex-1 rounded-[32px] overflow-hidden border border-white/10 relative shadow-xl bg-[#020617]">
                  
                  {/* HEADER BAR */}
                  <div className="absolute top-0 left-0 right-0 h-14 bg-black/40 border-b border-white/5 z-20 flex items-center justify-between px-6">
                    <div className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${stepVerified ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">
                        {stepVerified ? 'Concepts_Verified' : 'Concept_Workspace'}
                      </span>
                    </div>
                    
                    {/* GATEKEEPER BUTTON */}
                    <button 
                      disabled={!stepVerified}
                      onClick={() => window.open("https://makecode.microbit.org/", "_blank")}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${
                        stepVerified 
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' 
                        : 'bg-white/5 text-slate-700 border border-white/5 cursor-not-allowed grayscale'
                      }`}
                    >
                      Open in MakeCode <ArrowUpRight size={12} />
                    </button>
                  </div>

                  {/* DYNAMIC SANDBOX CONTENT */}
                  <div className="absolute inset-0 pt-14">
                    {/* MakeCode Renderer: Renders on top if verified */}
                    {mission.sandbox_type === 'makecode' && stepVerified && (
                      <div className="absolute inset-0 z-10 bg-[#020617]">
                        <MakeCodeRenderer code={getMakeCodeRenderString(liveCode)} />
                      </div>
                    )}
                    {/* Blockly Canvas: Always in DOM to prevent crashes, just visually hidden when MakeCode renders on top */}
                    <div ref={blocklyDiv} className="w-full h-full" />
                  </div>
                </div>

                {/* Side Panel: Only show Translator for Blockly missions */}
                <div className="w-[340px] flex flex-col rounded-[32px] overflow-hidden border border-white/10 bg-[#0f172a] shadow-2xl shrink-0">
                  <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 size={14} className="text-purple-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {mission.sandbox_type === 'makecode' && stepVerified ? 'Concept_Verified' : 'Plain_English_Translator'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto no-scrollbar bg-[#020617]/50">
                    {mission.sandbox_type === 'makecode' && stepVerified ? (
                      <div className="space-y-4 opacity-70 flex flex-col items-center justify-center h-full text-center">
                         <CheckCircle2 size={32} className="text-green-500" />
                         <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">
                           Your logic is sound.<br/> You are now cleared to build this in the full MakeCode environment.
                         </p>
                      </div>
                    ) : (
                      liveCode ? (
                        <pre className="text-[11px] font-mono text-purple-400 whitespace-pre-wrap leading-relaxed tracking-tight">{liveCode}</pre>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                          <Code2 size={32} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Awaiting<br/>Logic Input</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* BLUEPRINT / MVP SECTION */}
            {(() => {
              if (!(isBlueprintStep || (isCaptureStep && isReadOnly)) || !currentStepData.prompts) return null;
              
              const prompts = currentStepData.prompts;
              const mvpData = prompts.mvp || prompts.goal || { question: "Select your MVP Features:", options: [] };
              const beyondData = prompts.beyond || prompts.verification || { question: "Beyond MVP: What next?" };

              const displayCount = Math.max(0, Math.min(3, blueprint.mvp.length - 1));

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                  <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[32px] p-8 shadow-xl">
                     <div className="flex justify-between items-end">
                       <label className="text-xs font-black uppercase text-slate-400 tracking-widest">{mvpData.question}</label>
                       <span className={`text-[10px] font-black tracking-widest ${displayCount >= 3 ? 'text-green-400' : 'text-slate-500'}`}>
                         {displayCount}/3 SELECTED
                       </span>
                     </div>
                     <div className="space-y-4 pt-2">
                        <div className="flex flex-wrap gap-3">
                           {(mvpData.options || []).map((opt: string) => {
                               const isSelected = blueprint.mvp.includes(opt);
                               const isDisabled = !isSelected && blueprint.mvp.length >= 4;
                               return (
                                 <button key={opt} onClick={() => toggleMvpOption(opt)} disabled={isDisabled && !isReadOnly}
                                   className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${isSelected ? 'bg-blue-500 text-black border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : isDisabled ? 'bg-black/20 text-slate-600 border-white/5 cursor-not-allowed opacity-50' : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                                 >
                                   {opt}
                                 </button>
                               )
                           })}
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[32px] p-8 shadow-xl flex flex-col">
                     <label className="text-xs font-black uppercase text-slate-400 tracking-widest">
                       {beyondData.question} <span className="opacity-50 lowercase tracking-normal">(Optional)</span>
                     </label>
                     <div className="pt-2 flex-1 flex">
                        <textarea 
                          value={blueprint.beyond}
                          onChange={(e) => !isReadOnly && setBlueprint(prev => ({...prev, beyond: e.target.value}))}
                          readOnly={isReadOnly}
                          placeholder="e.g. After my MVP works, I plan to add background music and create a title screen..."
                          className="w-full flex-1 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                        />
                     </div>
                  </div>
                </div>
              );
            })()}

            {/* SCREENSHOT CAPTURE SECTION */}
            {isCaptureStep && (
               <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-[48px] space-y-8 shadow-2xl relative overflow-hidden">
                 {isReadOnly && (
                    <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur-md rounded-2xl border border-green-500/30 z-10">
                        <CheckCircle2 size={14} className="text-green-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Archive_Saved</span>
                    </div>
                 )}
                 
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
                            Open your MakeCode studio, assemble your logic blocks exactly as planned, and submit a screenshot to clear this sector.
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