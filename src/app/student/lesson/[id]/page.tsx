"use client";
"use no memo";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, CheckCircle2, Play, Camera, X,
  Trophy, ArrowRight, Loader2, Zap, ShieldAlert, ArrowUpRight,
  Search, Cpu, Power, Code2, BookOpen, ChevronDown, ChevronRight, RotateCcw, ChevronUp, Brain
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import * as Blockly from "blockly";
import MakeCodeRenderer from "@/components/lms/MakeCodeRenderer";
import { javascriptGenerator } from "blockly/javascript";
import SequenceViewer from "@/components/lms/SequenceViewer";
import PioneerCoach from "@/components/ui/PioneerCoach";
import { calculateDiminishingXP, calculateEventXp } from "@/lib/xp-engine";

// --- CUSTOM SCROLL MANAGER HOOK ---
function useScrollManager() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const stopScrolling = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const checkScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setCanScrollUp(scrollTop > 10);
      setCanScrollDown(Math.ceil(scrollTop + clientHeight) < scrollHeight - 10);
    }
  }, []);

  const startScrolling = (direction: 'up' | 'down') => {
    if (!containerRef.current) return;
    stopScrolling();
    const nudge = direction === 'up' ? -60 : 60;
    containerRef.current.scrollBy({ top: nudge, behavior: 'smooth' });
    scrollIntervalRef.current = setInterval(() => {
      if (containerRef.current) {
        containerRef.current.scrollBy({ top: direction === 'up' ? -6 : 6, behavior: 'auto' });
        checkScroll();
      }
    }, 16);
  };

  useEffect(() => {
    window.addEventListener('mouseup', stopScrolling);
    window.addEventListener('touchend', stopScrolling);
    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('mouseup', stopScrolling);
      window.removeEventListener('touchend', stopScrolling);
      window.removeEventListener('resize', checkScroll);
      stopScrolling();
    };
  }, [stopScrolling, checkScroll]);

  return { containerRef, canScrollUp, canScrollDown, startScrolling, checkScroll };
}

// --- TOAST NOTIFICATION COMPONENT ---
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
        <div className="fixed top-4 md:top-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-full max-w-[90%] md:max-w-md">
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -20, scale: 0.9 }} 
            className={`pointer-events-auto rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-2xl flex items-center gap-3 md:gap-4 relative overflow-hidden border ${
              type === 'error' 
                ? 'bg-[#0f172a] border-red-500/30 shadow-red-900/20' 
                : 'bg-[#0f172a] border-green-500/30 shadow-green-900/20'
            }`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 border ${
              type === 'error' 
                ? 'bg-red-500/20 border-red-500/30 text-red-400' 
                : 'bg-green-500/20 border-green-500/30 text-green-400'
            }`}>
              {type === 'error' ? <ShieldAlert className="w-5 h-5 md:w-6 md:h-6" /> : <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />}
            </div>
            <div className="flex-1 pr-2">
              <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white leading-none mb-1.5">
                {type === 'error' ? 'System Alert' : 'Success'}
              </h3>
              <p className="text-xs md:text-sm font-bold text-slate-400 leading-tight">{message}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors shrink-0">
              <X size={18} className="md:w-5 md:h-5" />
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
  
  const mainScroll = useScrollManager();
  const sidebarScroll = useScrollManager();
  
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [hasMounted, setHasMounted] = useState(false);
  const [isBriefingDrawerOpen, setIsBriefingDrawerOpen] = useState(false);
  const [showCoach, setShowCoach] = useState(false);

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

  const [activeTooltip, setActiveTooltip] = useState<{term: string, def: string} | null>(null);
  
  // Tutorial Interaction States
  const [tutorialClicked, setTutorialClicked] = useState(false);
  const [tutorialOutcome, setTutorialOutcome] = useState<'pending' | 'success' | 'help'>('pending');

  const showToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMsg({ text, type });
  };

  const scrollToTop = useCallback(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCardChange = useCallback((content: string) => {
    setScannedVocabText(prev => {
      if (prev.includes(content)) return prev; 
      return prev + " " + content;
    });
    scrollToTop();
  }, [scrollToTop]);

  const parsedConfig = useMemo(() => {
    if (!mission) return {};
    if (typeof mission.mission_config === 'string') {
      try { return JSON.parse(mission.mission_config); } catch (e) { return {}; }
    }
    return mission.mission_config || {};
  }, [mission]);

  const theme = parsedConfig.theme || {
      briefing: "Mission_Briefing", console: "System_Console", verifyBtn: "Test Code", successCode: "LOGIC_VERIFIED",
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

  // --- PROGRESS TRACKING LOGIC ---
  const isIntroStep = currentStepData.type === 'intro';
  const isBlueprintStep = currentStepData.type === 'blueprint';
  const isCaptureStep = currentStepData.type === 'capture';
  const isCodeStep = !isIntroStep && !isBlueprintStep && !isCaptureStep; 
  
  const isMakeCode = !!currentStepData.makecode_project_id || mission?.sandbox_type === 'makecode';
  
  const showWorkspace = isCodeStep || (isCaptureStep && !!currentStepData.makecode_project_id);

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
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted && window.innerWidth < 768 && currentStepData) {
      setIsBriefingDrawerOpen(true);
    }
  }, [currentStepIndex, currentStepData, hasMounted]);

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
    } else {
      setDisplayedLore("");
      setIsTyping(false);
    }
    return () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); }
  }, [currentStepData?.lore_text, currentStepIndex]);

  useEffect(() => {
    if (!currentStepData?.vocabulary) return;
    const stepVocab = currentStepData.vocabulary;
    
    const newlyRevealed = stepVocab.filter((v: any) => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
        return regex.test(scannedVocabText) || regex.test(displayedLore); 
    });

    if (newlyRevealed.length > 0) {
        const hasNewTerms = newlyRevealed.some((newTerm: any) => 
          !revealedVocab.some(existingTerm => existingTerm.term === newTerm.term)
        );

        if (hasNewTerms) {
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
    }
  }, [scannedVocabText, displayedLore, currentStepData?.vocabulary, revealedVocab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      mainScroll.checkScroll();
      sidebarScroll.checkScroll();
    }, 300);
    return () => clearTimeout(timer);
  }, [currentStepIndex, displayedLore, isTyping, liveCode, simLogs, revealedVocab, mainScroll, sidebarScroll]);

  // Formatters that transform markdown links to tracked buttons
  const getFormattedLore = () => {
    let formattedText = displayedLore || "";

    // 0. Convert standard line breaks (\n) to HTML line breaks
    formattedText = formattedText.replace(/\n/g, '<br />');

    // 1. Convert Markdown Links to Big Buttons FIRST with tracking attribute
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    formattedText = formattedText.replace(linkRegex, `<a href="$2" target="_blank" rel="noopener noreferrer" data-tutorial-link="true" class="inline-flex items-center justify-center gap-2 px-5 py-3.5 mt-4 w-full bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl transition-all shadow-[0_0_25px_rgba(147,51,234,0.4)] border border-purple-400/50 hover:scale-[1.02] active:scale-95 no-underline cursor-pointer pointer-events-auto">$1</a>`);

    if (!revealedVocab || revealedVocab.length === 0) return formattedText;
    
    // 2. Process Vocabulary
    const sortedVocab = [...revealedVocab].sort((a, b) => b.term.length - a.term.length);
    sortedVocab.forEach(v => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedTerm})\\b(?![^<]*>)`, 'gi');
        const safeDef = v.definition.replace(/"/g, '&quot;');
        formattedText = formattedText.replace(regex, `<span data-vocab="true" data-def="${safeDef}" class="inline-block relative z-10 text-purple-300 font-bold bg-purple-500/20 px-1.5 md:px-2 py-0.5 mx-0.5 md:mx-1 rounded md:rounded-md border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.4)] cursor-pointer" title="${safeDef}">$1</span>`);
    });
    return formattedText;
  };

  const formatGlossaryText = (text: string) => {
    let formattedText = text || "";
    
    // 1. Convert Markdown Links to Big Buttons FIRST with tracking attribute
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    formattedText = formattedText.replace(linkRegex, `<a href="$2" target="_blank" rel="noopener noreferrer" data-tutorial-link="true" class="inline-flex items-center justify-center gap-2 px-5 py-3.5 mt-4 w-full bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl transition-all shadow-[0_0_25px_rgba(147,51,234,0.4)] border border-purple-400/50 hover:scale-[1.02] active:scale-95 no-underline cursor-pointer pointer-events-auto">$1</a>`);

    if (!currentStepData?.vocabulary || currentStepData.vocabulary.length === 0) return formattedText;
    
    // 2. Process Vocabulary
    const sortedVocab = [...currentStepData.vocabulary].sort((a, b) => b.term.length - a.term.length);
    sortedVocab.forEach((v: any) => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedTerm})\\b(?![^<]*>)`, 'gi');
        const safeDef = v.definition.replace(/"/g, '&quot;');
        formattedText = formattedText.replace(regex, `<span data-vocab="true" data-def="${safeDef}" class="inline-block relative z-10 text-purple-300 font-bold bg-purple-500/20 px-1.5 md:px-2 py-0.5 mx-0.5 md:mx-1 rounded md:rounded-md border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.4)] cursor-pointer" title="${safeDef}">$1</span>`);
    });
    return formattedText;
  };

  // Handle Tracking of Tutorial Links
  const handleGlobalClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    const closestVocab = target.closest('[data-vocab="true"]');
    if (closestVocab) {
       const def = closestVocab.getAttribute('data-def');
       const term = closestVocab.textContent || "Definition";
       if (def) setActiveTooltip({ term, def });
    }

    const tutorialLink = target.closest('[data-tutorial-link="true"]');
    if (tutorialLink) {
       setTutorialClicked(true);
    }
  }, []);

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

          let configObj = missionData.mission_config || {};
          if (typeof configObj === 'string') {
            try { configObj = JSON.parse(configObj); } catch(e) { configObj = {}; }
          }
          const totalSteps = configObj.steps?.length || 1;
          
          setCurrentStepIndex(totalSteps); 
          setHighestReachedStep(totalSteps);
        }
      } catch (err) { setErrorMsg("A critical system error occurred."); } finally { setLoading(false); }
    }
    initMission();
  }, [id, router]);

  useEffect(() => {
    if (!mission || mission.sandbox_type === 'none' || mission.sandbox_type === 'p5js' || !blocklyDiv.current) return;
    
    if (parsedConfig.makecode_project_id) return;

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
      zoom: { controls: false, wheel: true, startScale: 1.8, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
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
  }, [mission, loading, getBlockOriginalColor, parsedConfig]);

  useEffect(() => {
    if (showWorkspace && workspace.current) {
      const timer = setTimeout(() => { if (workspace.current) Blockly.svgResize(workspace.current); }, 50);
      return () => clearTimeout(timer);
    }
  }, [showWorkspace]);

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
    setTutorialClicked(false);
    setTutorialOutcome('pending');
    if (workspace.current) workspace.current.clear();
    scrollToTop();
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
            const uBlock = userStacksData.find(us => us.blocks[0].value === expectedEvent)?.blocks[i];
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
    scrollToTop();
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
      // 1. Fetch attempt history to determine the Stage Multiplier
      const { count, error: countError } = await supabase
        .from('tech_archive')
        .select('*', { count: 'exact', head: true })
        .eq('mission_id', mission.id)
        .eq('student_id', user.id);

      if (countError) throw countError;
      
      const attemptCount = count || 0;

      // 2. Calculate Diminishing XP using the central engine
      const baseReward = mission.xp_reward || 50;
      const calculatedXpEarned = await calculateDiminishingXP(baseReward, attemptCount);

      // 3. Handle Image Upload
      let newHistoryArray = [...imageHistory];
      if (tempCaptureBlob) {
        const fileName = `${user.id}-${id}-${Date.now()}.png`;
        await supabase.storage.from('tech-archive-assets').upload(`blueprints/${fileName}`, tempCaptureBlob);
        const { data: urlData } = supabase.storage.from('tech-archive-assets').getPublicUrl(`blueprints/${fileName}`);
        newHistoryArray = [urlData.publicUrl, ...imageHistory];
      }
      
      const newHistoryString = newHistoryArray.filter(Boolean).join(',');
      const finalDesc = tutorialOutcome === 'help' 
          ? `[SOS: STUCK ON MAKECODE] ${finalMVP || "Needs assistance"}` 
          : (finalMVP || "Logic Complete");

      // 4. Insert new record (preserves history for multiple records)
      const { error: archiveError } = await supabase.from('tech_archive').insert({
        student_id: user.id, 
        mission_id: mission.id, 
        title: mission.title,
        description: finalDesc, 
        win_condition: finalBeyond, 
        media_url: newHistoryString, 
        status: 'completed', 
        xp_earned: calculatedXpEarned,
        type: 'blueprint'
      });

      if (archiveError) throw archiveError;

      // 5. Update User Profile XP (Only if reward is > 0)
      if (calculatedXpEarned > 0) {
        const newTotalXP = (user.xp || 0) + calculatedXpEarned;
        await supabase.from('profiles').update({ xp: newTotalXP }).eq('id', user.id);
        
        // Update local session
        const updatedUser = { ...user, xp: newTotalXP };
        localStorage.setItem("pioneer_session", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
      
      // Clear active task
      await supabase.from('enrollments').update({ active_task: null }).eq('student_id', user.id);
      
      setImageHistory(newHistoryArray); 
      setImagePreview(newHistoryArray[0]);
      setIsReadOnly(true); 
      setIsCompleted(true);
      
      if (calculatedXpEarned > 0) {
        confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
        showToast(`Uplink Success! Stage ${attemptCount + 1} reward: ${calculatedXpEarned} XP earned.`, "success");
      } else {
        showToast("Milestone Archived. No further XP available for this mission.", "success");
      }
    } catch (err: any) { 
      showToast(err.message || "An unexpected error occurred during the uplink.", "error"); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const renderMediaContent = (url: string | undefined) => {
    if (!url) return <div className="w-full h-full flex items-center justify-center bg-slate-900"><div className="text-center opacity-30"><Play size={48} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual_Data_Offline</p></div></div>;
    if (url.includes("youtube.com") || url.includes("youtu.be")) return <iframe src={url} className="w-full h-full object-cover" allowFullScreen />;
    return <video src={url} className="w-full h-full object-cover" controls autoPlay loop muted playsInline />;
  };

  const stableFormatTextRef = useRef<any>(null);
  const stableOnCompleteRef = useRef<any>(null);

  useEffect(() => {
    stableFormatTextRef.current = formatGlossaryText;
    stableOnCompleteRef.current = () => {
      if (isIntroStep) {
        advanceToNextStep();
      } else if (isCodeStep) {
        document.getElementById('blockly-workspace-container')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
  });

  const safeFormatText = useCallback((text: string) => {
    return stableFormatTextRef.current ? stableFormatTextRef.current(text) : text;
  }, []);

  const safeOnComplete = useCallback(() => {
    const stringData = JSON.stringify(currentStepData);
    const hasTutorial = stringData.includes('makecode.microbit.org') || stringData.includes('tutorial:');
    
    if (hasTutorial && !tutorialClicked && !isReadOnly) {
        showToast("Please launch the MakeCode tutorial to advance.", "error");
        return;
    }
    if (stableOnCompleteRef.current) stableOnCompleteRef.current();
  }, [currentStepData, tutorialClicked, isReadOnly]);

  const safeCloseToast = useCallback(() => setToastMsg(null), []);

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (errorMsg) return ( <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-white space-y-6"><ShieldAlert size={64} className="text-red-500" /><h1 className="text-2xl font-black uppercase tracking-widest">{errorMsg}</h1><Link href="/student/dashboard" className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase text-xs">Return to Dashboard</Link></div> );

  return (
    <main className="h-[100dvh] text-white flex flex-col overflow-hidden bg-[#020617] font-sans relative" onClick={handleGlobalClick}>
      
      <ToastNotification message={toastMsg?.text || null} type={toastMsg?.type || 'error'} onClose={safeCloseToast} />

      <AnimatePresence>
        {showCoach && (
          <PioneerCoach 
            lastWeekXP={0} 
            winnerXP={0} 
            currentXP={user?.xp || 0}
            userId={user?.id}
            onClose={() => setShowCoach(false)} 
          />
        )}
      </AnimatePresence>

      {/* --- MOBILE GLOSSARY TOOLTIP MODAL --- */}
      <AnimatePresence>
         {activeTooltip && (
            <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-8 md:pb-4" onClick={() => setActiveTooltip(null)}>
               <motion.div 
                 initial={{ y: 50, opacity: 0 }} 
                 animate={{ y: 0, opacity: 1 }} 
                 exit={{ y: 50, opacity: 0 }} 
                 className="w-full max-w-sm bg-[#0f172a] border border-purple-500/30 rounded-[32px] p-6 shadow-2xl" 
                 onClick={e => e.stopPropagation()}
               >
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-2">
                        <BookOpen className="text-purple-500 w-5 h-5" />
                        <h3 className="text-xl font-black italic uppercase text-white drop-shadow-md">{activeTooltip.term}</h3>
                     </div>
                     <button onClick={() => setActiveTooltip(null)} className="p-1.5 bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
                     <p className="text-sm text-slate-300 leading-relaxed font-medium">{activeTooltip.def}</p>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <style>{` 
        .blocklyToolboxContents { padding-top: 48px !important; } 
        .blocklyTreeRow { margin-bottom: 12px !important; height: 48px !important; line-height: 48px !important; } 
        .blocklyFlyoutScrollbar { display: none !important; } 
        
        .blocklyText, .blocklyTreeLabel, .blocklyFlyoutLabelText {
           font-size: 1.6rem !important;
           font-weight: 900 !important;
           font-family: inherit !important;
        }

        *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        * {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }

        @media (min-width: 768px) {
          .mobile-sequence-wrapper > div:first-child {
             height: 65vh !important;
             min-height: 500px !important;
             max-height: 750px !important;
          }
          
          .mobile-sequence-wrapper .grid {
             flex: 1 !important;
             align-items: center !important;
             gap: 2rem !important;
             height: 100% !important;
          }

          .mobile-sequence-wrapper h2 {
             font-size: 2.2rem !important;
             line-height: 1.1 !important;
          }
          .mobile-sequence-wrapper p {
             font-size: 1rem !important;
             line-height: 1.6 !important;
          }

          .mobile-sequence-wrapper img {
             max-height: 35vh !important;
             width: auto !important;
             margin: 0 auto !important;
             object-fit: contain !important;
          }

          .mobile-sequence-wrapper button {
             margin-top: auto !important;
             font-size: 0.75rem !important;
             height: auto !important;
          }
        }
        
        @media (max-width: 768px) {
          .mobile-sequence-wrapper h2 {
            font-size: 1.5rem !important;
            line-height: 1.1 !important;
            padding-bottom: 0.25rem !important;
          }
          .mobile-sequence-wrapper p {
            font-size: 0.875rem !important;
            line-height: 1.4 !important;
          }
          .mobile-sequence-wrapper .grid {
            gap: 1rem !important;
            grid-template-columns: 1fr !important;
          }
          .mobile-sequence-wrapper [class*="aspect-"] {
             aspect-ratio: auto !important;
             height: auto !important;
             min-height: 200px !important;
          }
          .mobile-sequence-wrapper img {
            position: relative !important;
            height: auto !important;
            max-height: 30vh !important;
            width: 100% !important;
            object-fit: contain !important;
            padding: 0 !important;
          }
          
          .fixed img, 
          .mobile-sequence-wrapper .fixed img,
          [role="dialog"] img {
            max-height: 80vh !important;
            width: 100vw !important;
            max-width: 100vw !important;
            object-fit: contain !important;
          }
        }
      `}</style>

      {/* DYNAMIC NAVBAR (MOBILE RESPONSIVE) */}
      <nav className="h-auto md:h-20 border-b border-white/5 py-4 px-4 md:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-30 bg-[#020617] shrink-0">
        <div className="flex items-center gap-3 md:gap-6 text-left w-full md:w-auto overflow-hidden">
          <button onClick={() => window.location.href = '/student/courses'} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shrink-0"><ArrowLeft size={18} /></button>
          <div className="flex-1 overflow-hidden">
  <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 leading-none truncate">
    {mission?.modules?.title} // Task {currentStepIndex + 1} of {steps.length}
  </p>
  <h1 className="text-sm md:text-xl font-black uppercase italic tracking-tighter leading-none mt-1 truncate">
    Milestone_{mission?.order_index}: {mission?.title}
  </h1>
  
  {/* XP STAGE REWARD HUD */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <Zap size={12} className="text-yellow-500 fill-yellow-500" />
              <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">
                Reward: {isReadOnly ? 0 : (mission?.xp_reward || 50)} XP
              </span>
            </div>
            {isReadOnly && (
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                <RotateCcw size={12} className="text-blue-400" />
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest italic truncate max-w-[120px] md:max-w-none">
                  Diminishing Replay Active
                </span>
              </div>
            )}
          </div>
</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 md:gap-4 w-full md:w-auto relative">
          {isReadOnly && (
            <button onClick={handleReplayMission} className="flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl bg-purple-500/10 text-purple-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all border border-purple-500/20 flex-1 md:flex-none justify-center">
              <RotateCcw size={14} className="md:w-4 md:h-4" /> Replay <span className="hidden sm:inline">Mission</span>
            </button>
          )}

          {/* NEXT / COMPLETE ACTIONS */}
          {(() => {
            const hasTutorialLink = JSON.stringify(currentStepData).includes('makecode.microbit.org') || JSON.stringify(currentStepData).includes('tutorial:');
            const disableNextForTutorial = hasTutorialLink && !tutorialClicked && !isReadOnly;

            return (
              <>
                {isIntroStep && (!currentStepData.cards || currentStepData.cards.length === 0) && (
                  <button 
                    onClick={advanceToNextStep} 
                    disabled={disableNextForTutorial}
                    className={`flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex-1 md:flex-none ${disableNextForTutorial ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-70' : 'bg-blue-500 text-black hover:scale-105 shadow-blue-500/20'}`}
                  >
                    {disableNextForTutorial ? "Launch Tutorial to Advance" : "Commence Setup"} {!disableNextForTutorial && <ArrowRight size={14} className="md:w-4 md:h-4" />}
                  </button>
                )}

                {isCodeStep && (
                  <>
                    {!isMakeCode && (
                      <button 
                        onClick={runSimulation} 
                        disabled={isExecuting || isReadOnly} 
                        className={`flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all flex-1 md:flex-none ${isExecuting || isReadOnly ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 text-white hover:scale-105 shadow-lg shadow-blue-500/30 border border-blue-400/50'}`}
                      >
                        {isExecuting ? <Loader2 className="animate-spin md:w-4 md:h-4" size={14} /> : <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center"><Play size={12} className="fill-white" /></div>} {stepVerified ? "Re-Test Code" : "Test Code"}
                      </button>
                    )}
                    
                    <button 
                      onClick={advanceToNextStep} 
                      disabled={(!isMakeCode && !stepVerified && !isReadOnly) || disableNextForTutorial} 
                      className={`flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none ${((isMakeCode || stepVerified || isReadOnly) && !disableNextForTutorial) ? 'bg-white text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}
                    >
                      {disableNextForTutorial ? "Launch Tutorial First" : "Next Task"} {!disableNextForTutorial && <ArrowRight size={14} className="md:w-4 md:h-4" />}
                    </button>
                  </>
                )}

                {isBlueprintStep && (
                  <button onClick={advanceToNextStep} disabled={!isBlueprintValid && !isReadOnly} className={`flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none ${isBlueprintValid || isReadOnly ? 'bg-blue-500 text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}>
                    Confirm Blueprint <ArrowRight size={14} className="md:w-4 md:h-4" />
                  </button>
                )}

                {isCaptureStep && (
                  <button onClick={handleComplete} disabled={!imagePreview || isSaving || (tutorialOutcome === 'pending' && !isReadOnly)} className={`flex justify-center px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none ${(imagePreview || isReadOnly) && tutorialOutcome !== 'pending' ? 'bg-white text-black hover:scale-105 shadow-xl' : 'bg-white/5 text-slate-600'}`}>
                    {isSaving ? <Loader2 className="animate-spin md:w-4 md:h-4" size={14} /> : (isReadOnly ? "Archived" : "Lock Milestone")}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </nav>

      {/* --- FLOATING LOGIC GUIDE (TOP CENTER - DESKTOP ONLY) --- */}
      {showWorkspace && !isMakeCode && (
        <div className="hidden md:block fixed top-5 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <motion.button 
            initial={{ opacity: 0, y: -20 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              boxShadow: [
                "0 0 10px rgba(59,130,246,0.1)",
                "0 0 20px rgba(59,130,246,0.4)", 
                "0 0 10px rgba(59,130,246,0.1)"
              ]
            }}
            transition={{ 
              boxShadow: { repeat: Infinity, duration: 4, ease: "easeInOut" },
              opacity: { duration: 0.5 }
            }}
            onClick={() => setShowCoach(true)}
            className="pointer-events-auto flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#0f172a]/80 backdrop-blur-xl border border-blue-500/30 text-white transition-all hover:bg-blue-600 hover:border-blue-400 group"
          >
            <Brain size={14} className="text-blue-400 group-hover:text-white transition-colors" fill="currentColor" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] italic">Logic Guide</span>
            <div className="w-1 h-1 rounded-full bg-blue-400 group-hover:bg-white animate-pulse" />
          </motion.button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        {/* DESKTOP SIDEBAR */}
        <div className="hidden md:flex w-[350px] lg:w-[420px] border-r border-white/5 bg-black/20 flex-col shrink-0 relative overflow-hidden">
            
           <AnimatePresence>
              {sidebarScroll.canScrollUp && (
                <motion.button initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} onMouseDown={() => sidebarScroll.startScrolling('up')} onTouchStart={() => sidebarScroll.startScrolling('up')} className="absolute top-6 right-6 z-40 cursor-pointer pointer-events-auto group">
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl group-hover:bg-blue-500/20 group-hover:border-blue-500/30 group-hover:scale-110 transition-all">
                    <ChevronUp size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

            <aside ref={sidebarScroll.containerRef} onScroll={sidebarScroll.checkScroll} className="h-full overflow-y-auto p-8 space-y-8 no-scrollbar text-left font-mono flex-col pb-24">
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
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4 pb-8">
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

            <AnimatePresence>
              {sidebarScroll.canScrollDown && (
                <motion.button initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} onMouseDown={() => sidebarScroll.startScrolling('down')} onTouchStart={() => sidebarScroll.startScrolling('down')} className="absolute bottom-6 right-6 z-40 cursor-pointer pointer-events-auto group">
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl group-hover:bg-blue-500/20 group-hover:border-blue-500/30 group-hover:scale-110 transition-all">
                    <ChevronDown size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors animate-bounce" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-[#020617]">
            
           <AnimatePresence>
              {mainScroll.canScrollUp && (
                <motion.button initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} onMouseDown={() => mainScroll.startScrolling('up')} onTouchStart={() => mainScroll.startScrolling('up')} className="absolute top-6 right-6 md:right-10 z-40 cursor-pointer pointer-events-auto group">
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl group-hover:bg-blue-500/20 group-hover:border-blue-500/30 group-hover:scale-110 transition-all">
                    <ChevronUp size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

          <section id="main-scroll-container" ref={mainScroll.containerRef} onScroll={mainScroll.checkScroll} className="flex-1 p-4 md:p-8 overflow-y-auto no-scrollbar space-y-6 md:space-y-10 pb-24 md:pb-12 scroll-smooth">
            
            {/* --- MISSION PROGRESS TRACKER --- */}
            <div className="flex items-stretch justify-between md:justify-center gap-1.5 md:gap-2 mb-4 md:mb-8 w-full pb-2">
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
                  <div key={idx} className="flex flex-1 md:flex-none items-center gap-1.5 md:gap-2 min-w-0">
                    <button
                      onClick={() => {
                          if (isUnlocked && !isActive) {
                              setCurrentStepIndex(idx);
                              setStepVerified(false); 
                          }
                      }}
                      disabled={!isUnlocked || isActive}
                      className={`w-full md:w-auto justify-center px-1 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-tighter md:tracking-widest flex items-center gap-1 md:gap-2 transition-all truncate ${
                        isActive ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)] border border-purple-500 md:scale-105" :
                        isUnlocked ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 cursor-pointer" :
                        "bg-white/5 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />}
                      {isActive && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-pulse shrink-0" />}
                      <span className="truncate">{label}</span>
                    </button>
                    {idx < steps.length - 1 && (
                      <div className={`hidden md:block w-4 md:w-6 h-px ${isUnlocked ? "bg-green-500/30" : "bg-white/10"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className={`${!isCaptureStep ? 'mobile-sequence-wrapper' : ''} max-w-5xl mx-auto space-y-6 md:space-y-10 w-full relative`}>
              
              {currentStepData.cards && currentStepData.cards.length > 0 ? (
                isCaptureStep ? (
                  <div className="flex flex-col gap-4 w-full" style={{ height: 'auto', minHeight: 0 }}>
                    {currentStepData.cards.map((card: any, idx: number) => (
                      <div key={idx} className="bg-blue-500/5 border border-blue-500/10 rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-inner">
                        <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-blue-400 mb-2">{card.title}</h3>
                        <p className="text-sm md:text-base leading-relaxed text-blue-300">
                          <span dangerouslySetInnerHTML={{ __html: safeFormatText(card.content) }} />
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SequenceViewer 
                    key={`seq-${currentStepIndex}`}
                    cards={currentStepData.cards} 
                    formatText={safeFormatText} 
                    onCardChange={handleCardChange} 
                    onComplete={safeOnComplete} 
                  />
                )
              ) : (
                !isCaptureStep && (
                  <div className="relative aspect-video rounded-[24px] md:rounded-[48px] overflow-hidden border border-white/10 bg-black shadow-2xl">
                      {renderMediaContent(currentStepData.media_url)}
                  </div>
                )
              )}

              {/* BLOCKLY & MAKECODE WORKSPACE SELECTOR */}
              <div id="blockly-workspace-container" className={`space-y-4 ${showWorkspace ? 'block' : 'hidden'}`}>
                <div className="flex flex-col xl:flex-row gap-4 md:gap-6 h-[800px] xl:h-[600px] relative">
                  <div className="flex-1 min-h-[400px] xl:min-h-0 rounded-[24px] md:rounded-[32px] overflow-hidden border border-white/10 relative shadow-xl bg-[#020617]">
                    
                    <div className="absolute top-0 left-0 right-0 h-12 md:h-14 bg-black/40 border-b border-white/5 z-20 flex items-center justify-between px-4 md:px-6">
                      <div className="flex items-center gap-2">
                        <div className={`size-1.5 md:size-2 rounded-full ${stepVerified ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                        <span className="text-[8px] md:text-[10px] font-black uppercase text-blue-400 tracking-widest truncate">
                          {stepVerified ? 'Concepts_Verified' : 'Concept_Workspace'}
                        </span>
                      </div>
                      
                      <button 
                        disabled={!currentStepData.makecode_project_id && !stepVerified}
                        onClick={() => window.open(currentStepData.makecode_project_id && currentStepData.makecode_project_id !== 'empty' ? `https://makecode.microbit.org/#pub:${currentStepData.makecode_project_id}` : "https://makecode.microbit.org/", "_blank")}
                        className={`flex items-center gap-1.5 md:gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase transition-all shrink-0 ${
                          (currentStepData.makecode_project_id || stepVerified) 
                          ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' 
                          : 'bg-white/5 text-slate-700 border border-white/5 cursor-not-allowed grayscale'
                        }`}
                      >
                        <span className="hidden sm:inline">Open in</span> MakeCode <ArrowUpRight size={12} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>

                    <div className="absolute inset-0 pt-12 md:pt-14">
                      {currentStepData.makecode_project_id && currentStepData.makecode_project_id !== 'empty' ? (
                        <iframe 
                          className="w-full h-full border-none"
                          src={`https://makecode.microbit.org/#pub:${currentStepData.makecode_project_id}`}
                          sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
                        />
                      ) : mission.sandbox_type === 'makecode' && stepVerified ? (
                        <div className="absolute inset-0 z-10 bg-[#020617]">
                          <MakeCodeRenderer code={getMakeCodeRenderString(liveCode)} />
                        </div>
                      ) : (
                        <div ref={blocklyDiv} className="w-full h-full" />
                      )}
                    </div>
                  </div>

                  {!isMakeCode && (
                    <div className="w-full xl:w-[340px] h-64 xl:h-auto flex flex-col rounded-[24px] md:rounded-[32px] overflow-hidden border border-white/10 bg-[#0f172a] shadow-2xl shrink-0">
                      <div className="p-3 md:p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 size={14} className="text-purple-400" />
                          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {mission.sandbox_type === 'makecode' && stepVerified ? 'Concept_Verified' : 'Plain_English_Translator'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-4 md:p-6 overflow-y-auto no-scrollbar bg-[#020617]/50">
                        {mission.sandbox_type === 'makecode' && stepVerified ? (
                          <div className="space-y-4 opacity-70 flex flex-col items-center justify-center h-full text-center">
                             <CheckCircle2 size={32} className="text-green-500" />
                             <p className="text-[9px] md:text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">
                               Your logic is sound.<br/> You are now cleared to build this in the full MakeCode environment.
                             </p>
                          </div>
                        ) : (
                          liveCode ? (
                            <pre className="text-[10px] md:text-[11px] font-mono text-purple-400 whitespace-pre-wrap leading-relaxed tracking-tight">{liveCode}</pre>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                              <Code2 size={32} className="md:w-10 md:h-10" />
                              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Awaiting<br/>Logic Input</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-6 md:pb-10">
                    <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-xl">
                       <div className="flex justify-between items-end">
                         <label className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">{mvpData.question}</label>
                         <span className={`text-[9px] md:text-[10px] font-black tracking-widest ${displayCount >= 3 ? 'text-green-400' : 'text-slate-500'}`}>
                           {displayCount}/3 SELECTED
                         </span>
                       </div>
                       <div className="flex flex-wrap gap-2.5 md:gap-3 pt-2">
                          {(mvpData.options || []).map((opt: string) => {
                              const isSelected = blueprint.mvp.includes(opt);
                              const isDisabled = !isSelected && blueprint.mvp.length >= 4;
                              return (
                                <button key={opt} onClick={() => toggleMvpOption(opt)} disabled={isDisabled && !isReadOnly}
                                  className={`px-4 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all border ${isSelected ? 'bg-blue-500 text-black border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : isDisabled ? 'bg-black/20 text-slate-600 border-white/5 cursor-not-allowed opacity-50' : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                                >
                                  {opt}
                                </button>
                              )
                          })}
                       </div>
                    </div>

                    <div className="space-y-4 text-left bg-white/5 border border-white/10 rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-xl flex flex-col">
                       <label className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">
                         {beyondData.question} <span className="opacity-50 lowercase tracking-normal">(Optional)</span>
                       </label>
                       <div className="pt-2 flex-1 flex">
                          <textarea 
                            value={blueprint.beyond}
                            onChange={(e) => !isReadOnly && setBlueprint(prev => ({...prev, beyond: e.target.value}))}
                            readOnly={isReadOnly}
                            placeholder="e.g. Next I will add background music..."
                            className="w-full flex-1 bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 text-xs md:text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none min-h-[100px] mt-2"
                          />
                       </div>
                    </div>
                  </div>
                );
              })()}

              {/* SCREENSHOT CAPTURE SECTION (YES/NO GATE OR ARCHIVE) */}
              {isCaptureStep && (
                 <div className="flex flex-col items-center justify-center p-6 md:p-12 bg-white/5 border border-white/10 rounded-[32px] md:rounded-[48px] space-y-6 md:space-y-8 shadow-2xl relative overflow-hidden">
                   
                   {mission.sandbox_type === 'none' && tutorialOutcome === 'pending' && !isReadOnly ? (
                      <div className="text-center space-y-6 z-10 relative px-4 w-full max-w-2xl mx-auto py-8">
                         <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mx-auto mb-6">
                            <Brain className="text-purple-400 w-8 h-8 md:w-10 md:h-10" />
                         </div>
                         <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Status Report</h3>
                         <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                            Before we archive your progress, did you manage to complete the MakeCode tutorial successfully?
                         </p>
                         <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button onClick={() => setTutorialOutcome('success')} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 hover:scale-105">
                               <CheckCircle2 size={16}/> Yes, Logic Built
                            </button>
                            <button onClick={() => setTutorialOutcome('help')} className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2 hover:scale-105">
                               <ShieldAlert size={16}/> No, I got stuck
                            </button>
                         </div>
                      </div>
                   ) : (
                     <>
                       {isReadOnly && (
                          <div className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-green-500/20 backdrop-blur-md rounded-xl md:rounded-2xl border border-green-500/30 z-10">
                              <CheckCircle2 size={14} className="text-green-400 md:w-4 md:h-4" />
                              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-green-400">Archive_Saved</span>
                          </div>
                       )}
                       
                       {isReadOnly && imageHistory.length > 0 ? (
                           <div className="space-y-4 md:space-y-6 w-full max-w-3xl mx-auto relative z-10 pt-8 md:pt-8">
                              <div className="rounded-[24px] md:rounded-[32px] overflow-hidden border-2 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.2)] relative bg-black">
                                 <div className="absolute top-3 left-3 md:top-4 md:left-4 bg-green-500 text-black px-3 py-1 md:px-4 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest z-10">Latest Archive</div>
                                 <img src={imageHistory[0]} alt="Latest Blueprint" className="w-full h-auto object-cover" />
                              </div>

                              {imageHistory.length > 1 && (
                                 <div className="space-y-3 md:space-y-4 pt-6 md:pt-8 border-t border-white/10">
                                    <h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500">Previous Versions</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                                       {imageHistory.slice(1).map((url, idx) => (
                                          <div key={idx} className="rounded-xl md:rounded-2xl overflow-hidden border border-white/10 opacity-70 hover:opacity-100 transition-opacity relative group cursor-pointer bg-black"
                                               onClick={() => window.open(url, '_blank')}>
                                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Search className="text-white w-5 h-5 md:w-6 md:h-6" />
                                             </div>
                                             <img src={url} alt={`Archive ${idx + 1}`} className="w-full h-auto object-cover" />
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </div>
                       ) : imagePreview ? (
                           <div className="w-full max-w-3xl rounded-[24px] md:rounded-[32px] overflow-hidden border border-white/10 shadow-2xl relative z-10">
                              <img src={imagePreview} alt="Saved Blueprint" className="w-full h-auto object-cover" />
                           </div>
                       ) : (
                           <>
                              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${tutorialOutcome === 'help' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-blue-500/10 border-blue-500/20'} flex items-center justify-center border mt-4 md:mt-0`}>
                                 {tutorialOutcome === 'help' ? <ShieldAlert className="text-rose-400 w-8 h-8 md:w-10 md:h-10" /> : <Camera className="text-blue-400 w-8 h-8 md:w-10 md:h-10" />}
                              </div>
                              <div className="text-center space-y-2 md:space-y-3 z-10 relative px-4">
                                <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
                                  {tutorialOutcome === 'help' ? 'Request Assistance' : 'Capture Final Logic'}
                                </h3>
                                <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                                  {tutorialOutcome === 'help' 
                                    ? "Don't worry, Pioneer! Take a screenshot of the MakeCode step where you got stuck and upload it here. Your coach will review your code and help you troubleshoot."
                                    : isMakeCode 
                                      ? "Make sure you have tested your MakeCode logic in the simulator. Once you are ready, submit a screenshot to clear this sector." 
                                      : "Open your MakeCode studio, assemble your logic blocks exactly as planned, and submit a screenshot to clear this sector."
                                  }
                                </p>
                              </div>
                              <button onClick={startCapture} className={`mt-4 px-8 py-4 md:px-10 md:py-5 ${tutorialOutcome === 'help' ? 'bg-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.3)]' : 'bg-blue-500 text-black shadow-[0_0_30px_rgba(59,130,246,0.3)]'} font-black uppercase text-[10px] md:text-xs tracking-widest rounded-xl md:rounded-2xl hover:scale-105 transition-all relative z-10`}>
                                  {tutorialOutcome === 'help' ? 'Launch SOS Capture' : 'Launch System Capture'}
                              </button>
                           </>
                       )}
                     </>
                   )}
                 </div>
              )}
            </div>

            <AnimatePresence>
              {isRunning && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-4 right-4 md:bottom-12 md:right-12 w-[calc(100vw-32px)] md:w-96 bg-[#0f172a] border border-white/10 rounded-[24px] md:rounded-[32px] shadow-2xl overflow-hidden z-50">
                  <div className="p-3 md:p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
                     <div className="flex items-center gap-2 text-blue-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest"><Cpu size={14} className="md:w-4 md:h-4" /> {theme.console}</div>
                     <button onClick={endSimulation} className="p-1.5 md:p-1 text-red-500 hover:bg-red-500/10 rounded-md"><Power size={16} className="md:w-4 md:h-4" /></button>
                  </div>
                  <div className="p-4 md:p-6 h-48 md:h-64 overflow-y-auto font-mono text-[10px] md:text-[11px] space-y-2 no-scrollbar">
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

          <AnimatePresence>
              {mainScroll.canScrollDown && (
                <motion.button initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} onMouseDown={() => mainScroll.startScrolling('down')} onTouchStart={() => mainScroll.startScrolling('down')} className="absolute bottom-6 right-6 md:right-10 z-40 cursor-pointer pointer-events-auto group">
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl group-hover:bg-blue-500/20 group-hover:border-blue-500/30 group-hover:scale-110 transition-all">
                    <ChevronDown size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors animate-bounce" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
        </div>

      </div>

      {/* MOBILE HUD ELEMENTS */}
      <div className="md:hidden fixed bottom-6 left-0 right-0 z-40 flex flex-col gap-3 px-4 pointer-events-none">
          {showWorkspace && !isMakeCode && (
             <motion.button 
               initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}}
               onClick={() => setShowCoach(true)}
               className="pointer-events-auto w-full max-w-sm mx-auto bg-blue-600 border border-blue-400/50 shadow-2xl rounded-2xl p-3 flex items-center justify-center gap-3 text-white active:scale-95 transition-all"
             >
               <Brain size={16} fill="currentColor"/>
               <span className="font-black uppercase tracking-widest text-[10px]">Logic Guide</span>
             </motion.button>
          )}

          <AnimatePresence>
            {!isBriefingDrawerOpen && (
              <motion.button 
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 20, opacity: 0}} 
                onClick={() => setIsBriefingDrawerOpen(true)}
                className="pointer-events-auto w-full max-w-sm mx-auto bg-[#0f172a]/90 backdrop-blur-xl border border-blue-500/30 shadow-2xl rounded-2xl p-4 flex items-center justify-between text-blue-400 active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-xl"><Zap size={16} fill="currentColor"/></div>
                  <span className="font-black uppercase tracking-widest text-[10px]">Mission Briefing</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <ChevronUp size={16} className="text-blue-400" />
                </div>
              </motion.button>
            )}
          </AnimatePresence>
      </div>

      {/* MOBILE MISSION BRIEFING DRAWER (Bottom Sheet Modal) */}
      <AnimatePresence>
        {isBriefingDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (!isTyping) setIsBriefingDrawerOpen(false); }}
              className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-blue-500/30 rounded-t-[32px] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] max-h-[85vh] flex flex-col font-mono"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-2 text-blue-500">
                  <Zap size={16} fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Mission Briefing</span>
                </div>
                <button 
                  onClick={() => setIsBriefingDrawerOpen(false)} 
                  disabled={isTyping}
                  className={`p-2 rounded-full transition-all ${isTyping ? 'bg-white/5 text-slate-600 cursor-not-allowed opacity-50' : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20'}`}
                >
                  <X size={16}/>
                </button>
              </div>
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-[24px] p-5 overflow-y-auto no-scrollbar">
                <p className="text-sm leading-loose text-blue-400">
                  <span dangerouslySetInnerHTML={{ __html: getFormattedLore() }} />
                  {isTyping && <span className="inline-block w-1.5 h-3 ml-1 align-middle animate-pulse bg-blue-500" />}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCapturePreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-6">
            <div className="max-w-4xl w-full bg-[#020617] border border-white/10 rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl">
              <div className="p-5 md:p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tighter text-white">Review_Snapshot</h3>
                <button onClick={() => setShowCapturePreview(false)} className="text-slate-500 hover:text-white p-2"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
              </div>
              <div className="p-4 md:p-8 bg-black/40 text-center">
                {tempCaptureBlob && <img src={URL.createObjectURL(tempCaptureBlob)} className="w-full h-auto rounded-2xl md:rounded-3xl border border-white/10 mx-auto" alt="Preview" /> }
              </div>
              <div className="p-4 md:p-8 border-t border-white/5 flex gap-3 md:gap-4">
                <button onClick={() => setShowCapturePreview(false)} className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl border border-white/10 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Discard</button>
                <button onClick={confirmCapture} className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl bg-blue-500 text-black text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">Confirm Snapshot</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCompleted && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-4 md:p-6">
            <div className="max-w-md w-full bg-white/[0.03] border border-white/10 rounded-[40px] md:rounded-[56px] p-8 md:p-12 text-center space-y-6 md:space-y-8">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-[32px] flex items-center justify-center mx-auto border bg-green-500/20 border-green-500/30"><Trophy className="w-8 h-8 md:w-10 md:h-10 text-green-400" /></div>
              <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-white leading-tight">Mission <br /><span className="text-green-400">Accomplished</span></h2>
              <button onClick={() => window.location.href = '/student/courses'} className="flex items-center justify-center gap-2 md:gap-3 w-full py-4 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase italic bg-white text-black hover:scale-105 transition-all shadow-2xl text-[10px] md:text-base tracking-widest">Return to Roadmap <ArrowRight size={16} className="md:w-[18px] md:h-[18px]" /></button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}