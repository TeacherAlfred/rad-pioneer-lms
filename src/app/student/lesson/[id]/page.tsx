"use client";
"use no memo";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { getActiveEngine, getActiveTheme } from "@/lib/themeEngine";
import RadDefaultLayout from "@/components/themes/RadDefaultLayout";
import ScratchPremiumLayout from "@/components/themes/ScratchPremiumLayout";

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

// GLOBAL BLOCKLY CSS TO FIX TYPOGRAPHY AND HIDE SCROLLBARS
const GlobalBlocklyCSS = () => (
  <style>{`
    .blocklyToolboxContents { padding-top: 48px !important; } 
    .blocklyTreeRow { margin-bottom: 12px !important; height: 48px !important; line-height: 48px !important; } 
    .blocklyFlyoutScrollbar, .blocklyScrollbarVertical, .blocklyScrollbarHorizontal { display: none !important; } 
    .blocklyText, .blocklyTreeLabel, .blocklyFlyoutLabelText { font-size: 1.6rem !important; font-weight: 900 !important; font-family: inherit !important; }
    *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; background: transparent !important; }
    * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
  `}</style>
);

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

  const [blueprint, setBlueprint] = useState({ mvp: [] as string[], beyond: "" });
  const [activeTooltip, setActiveTooltip] = useState<{term: string, def: string} | null>(null);
  
  const [tutorialClicked, setTutorialClicked] = useState(false);
  const [tutorialOutcome, setTutorialOutcome] = useState<'pending' | 'success' | 'help'>('pending');

  const showToast = (text: string, type: 'error' | 'success' = 'error') => { setToastMsg({ text, type }); };
  const safeCloseToast = useCallback(() => setToastMsg(null), []);

  const handleCardChange = useCallback((content: string) => {
    setScannedVocabText(prev => {
      if (prev.includes(content)) return prev; 
      return prev + " " + content;
    });
  }, []);

  const toggleVocab = (term: string) => { setExpandedVocab(prev => ({ ...prev, [term]: !prev[term] })); };

  const parsedConfig = useMemo(() => {
    if (!mission) return {};
    if (typeof mission.mission_config === 'string') {
      try { return JSON.parse(mission.mission_config); } catch (e) { return {}; }
    }
    return mission.mission_config || {};
  }, [mission]);

  const activeEngine = useMemo(() => getActiveEngine(parsedConfig, mission?.sandbox_type), [parsedConfig, mission]);
  const activeTheme = useMemo(() => getActiveTheme(parsedConfig), [parsedConfig]);

  const theme = parsedConfig.theme || { console: "System_Console", successCode: "LOGIC_VERIFIED" };

  const steps = useMemo(() => {
    if (!mission) return [];
    let dbSteps = parsedConfig.steps || [];
    if (dbSteps.length === 0) {
      dbSteps = [{ type: 'capture', media_url: mission.video_url, lore_text: mission.lore_text || "Execute the sequence.", vocabulary: parsedConfig.vocabulary || [], win_sequence: parsedConfig.win_sequence || [], cards: [] }];
    } else if (dbSteps[dbSteps.length - 1].type !== 'capture') {
      dbSteps = [...dbSteps, { type: 'capture', lore_text: "Logic verified! Now, let's back up your work to the RAD Cloud.", cards: [] }];
    }
    return dbSteps;
  }, [mission, parsedConfig]);

  const currentStepData = useMemo(() => steps[currentStepIndex] || {}, [steps, currentStepIndex]);

  const isIntroStep = currentStepData.type === 'intro';
  const isBlueprintStep = currentStepData.type === 'blueprint';
  const isCaptureStep = currentStepData.type === 'capture';
  const isCodeStep = !isIntroStep && !isBlueprintStep && !isCaptureStep; 
  
  const isMakeCodeRenderer = (!!currentStepData.makecode_project_id || mission?.sandbox_type === 'makecode') && activeEngine.id === 'makecode';
  const showWorkspace = isCodeStep || (isCaptureStep && !!currentStepData.makecode_project_id);
  const isBlueprintValid = blueprint.mvp.length > 0;

  const toggleMvpOption = (option: string) => {
    if (isReadOnly) return;
    setBlueprint(prev => {
      const current = prev.mvp;
      if (current.includes(option)) return { ...prev, mvp: current.filter(o => o !== option) };
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
        if (b.value === typeVal) return cat.color || (activeEngine.id === 'scratch' ? '#4C97FF' : '#4C97FF');
      }
    }
    return activeEngine.id === 'scratch' ? '#4C97FF' : '#4C97FF';
  }, [parsedConfig, activeEngine.id]);

  const getFormattedLore = () => {
    let formattedText = displayedLore || "";
    formattedText = formattedText.replace(/\n/g, '<br />');
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    formattedText = formattedText.replace(linkRegex, `<a href="$2" target="_blank" rel="noopener noreferrer" data-tutorial-link="true" class="inline-flex items-center justify-center gap-2 px-5 py-3.5 mt-4 w-full ${activeTheme.ui.secondaryBtn} font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl transition-all border hover:scale-[1.02] active:scale-95 no-underline cursor-pointer pointer-events-auto">$1</a>`);

    if (!revealedVocab || revealedVocab.length === 0) return formattedText;
    const sortedVocab = [...revealedVocab].sort((a, b) => b.term.length - a.term.length);
    sortedVocab.forEach(v => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedTerm})\\b(?![^<]*>)`, 'gi');
        const safeDef = v.definition.replace(/"/g, '&quot;');
        formattedText = formattedText.replace(regex, `<span data-vocab="true" data-def="${safeDef}" class="inline-block relative z-10 ${activeTheme.ui.secondaryText} font-bold ${activeTheme.ui.panelBg} px-1.5 md:px-2 py-0.5 mx-0.5 md:mx-1 rounded md:rounded-md border ${activeTheme.ui.secondaryBorder} cursor-pointer" title="${safeDef}">$1</span>`);
    });
    return formattedText;
  };

  const formatGlossaryText = (text: string) => {
    let formattedText = text || "";
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    formattedText = formattedText.replace(linkRegex, `<a href="$2" target="_blank" rel="noopener noreferrer" data-tutorial-link="true" class="inline-flex items-center justify-center gap-2 px-5 py-3.5 mt-4 w-full ${activeTheme.ui.secondaryBtn} font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl transition-all border hover:scale-[1.02] active:scale-95 no-underline cursor-pointer pointer-events-auto">$1</a>`);

    if (!currentStepData?.vocabulary || currentStepData.vocabulary.length === 0) return formattedText;
    const sortedVocab = [...currentStepData.vocabulary].sort((a, b) => b.term.length - a.term.length);
    sortedVocab.forEach((v: any) => {
        const escapedTerm = v.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedTerm})\\b(?![^<]*>)`, 'gi');
        const safeDef = v.definition.replace(/"/g, '&quot;');
        formattedText = formattedText.replace(regex, `<span data-vocab="true" data-def="${safeDef}" class="inline-block relative z-10 ${activeTheme.ui.secondaryText} font-bold ${activeTheme.ui.panelBg} px-1.5 md:px-2 py-0.5 mx-0.5 md:mx-1 rounded md:rounded-md border ${activeTheme.ui.secondaryBorder} cursor-pointer" title="${safeDef}">$1</span>`);
    });
    return formattedText;
  };

  const handleGlobalClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const closestVocab = target.closest('[data-vocab="true"]');
    if (closestVocab) {
       const def = closestVocab.getAttribute('data-def');
       const term = closestVocab.textContent || "Definition";
       if (def) setActiveTooltip({ term, def });
    }
    const tutorialLink = target.closest('[data-tutorial-link="true"]');
    if (tutorialLink) setTutorialClicked(true);
  }, []);

  useEffect(() => { setHasMounted(true); }, []);

  useEffect(() => {
    if (hasMounted && window.innerWidth < 768 && currentStepData) {
      setIsBriefingDrawerOpen(true);
    }
  }, [currentStepIndex, currentStepData, hasMounted]);

  useEffect(() => {
    async function initMission() {
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);

      try {
        const { data: missionData, error: mErr } = await supabase.from('missions').select(`*, modules ( title, course_id )`).eq('id', id).maybeSingle();
        if (mErr || !missionData) { setErrorMsg("Mission not found."); setLoading(false); return; }

        setMission(missionData); setUser(localUser);

        const { data: archiveData } = await supabase.from('tech_archive').select('*').eq('mission_id', id).eq('student_id', localUser.id).maybeSingle();
        
        if (archiveData) {
          setBlueprint({ mvp: archiveData.description ? archiveData.description.split(", ") : [], beyond: archiveData.win_condition || "" });
          const urls = archiveData.media_url ? archiveData.media_url.split(',') : [];
          setImageHistory(urls); setImagePreview(urls[0] || null);
          setStepVerified(true); setIsReadOnly(true);

          let configObj = missionData.mission_config || {};
          if (typeof configObj === 'string') { try { configObj = JSON.parse(configObj); } catch(e) { configObj = {}; } }
          const totalSteps = configObj.steps?.length || 1;
          setCurrentStepIndex(totalSteps); setHighestReachedStep(totalSteps);
        }
      } catch (err) { setErrorMsg("Critical system error."); } finally { setLoading(false); }
    }
    initMission();
  }, [id, router]);

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
    const timer = setTimeout(() => { mainScroll.checkScroll(); sidebarScroll.checkScroll(); }, 300);
    return () => clearTimeout(timer);
  }, [currentStepIndex, displayedLore, isTyping, liveCode, simLogs, revealedVocab, mainScroll, sidebarScroll]);

  // BLOCKLY ENGINE
  useEffect(() => {
    if (!mission || mission.sandbox_type === 'none' || mission.sandbox_type === 'p5js' || !blocklyDiv.current || parsedConfig.makecode_project_id || workspace.current) return;

    const toolboxCategories = parsedConfig.toolbox || [];
    toolboxCategories.forEach((category: any) => {
      const catColor = category.color || (activeEngine.id === 'scratch' ? '#4C97FF' : '#4C97FF');
      (category.blocks || []).forEach((b: any) => {
        const isEventBlock = b.value.includes('EVENT') || b.value.includes('ON_') || b.value.includes('WHEN_') || category.category.toUpperCase().includes('EVENT');
        const blockPrefix = isEventBlock ? 'event_' : 'action_';
        const blockName = `${blockPrefix}${b.value}`;
        
        delete (Blockly.Blocks as any)[blockName]; 
        (Blockly.Blocks as any)[blockName] = {
          init: function(this: any) {
            this.appendDummyInput().appendField(b.label);
            if (isEventBlock) { this.appendStatementInput("DO").setCheck(null); if (this.setHat) this.setHat("cap"); } 
            else { this.setPreviousStatement(true, null); this.setNextStatement(true, null); }
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

    const makeCodeTheme = Blockly.Theme.defineTheme('makecode_style', {
      name: 'makecode_style', base: Blockly.Themes.Classic,
      blockStyles: { "event_blocks": { "colourPrimary": "#eab308" }, "action_blocks": { "colourPrimary": "#3b82f6" } },
      componentStyles: { 'workspaceBackgroundColour': '#020617', 'toolboxBackgroundColour': '#0f172a', 'toolboxForegroundColour': '#94a3b8', 'flyoutBackgroundColour': '#0f172a', 'flyoutOpacity': 1, 'scrollbarColour': '#1e293b', 'insertionMarkerColour': '#ffffff', 'insertionMarkerOpacity': 0.3 }
    });

    const scratchTheme = Blockly.Theme.defineTheme('scratch_style', {
      name: 'scratch_style', base: Blockly.Themes.Classic,
      blockStyles: { "event_blocks": { "colourPrimary": "#FFBF00" }, "action_blocks": { "colourPrimary": "#4C97FF" } },
      componentStyles: { 'workspaceBackgroundColour': '#020617', 'toolboxBackgroundColour': '#0f172a', 'toolboxForegroundColour': '#94a3b8', 'flyoutBackgroundColour': '#0f172a', 'flyoutOpacity': 1, 'scrollbarColour': '#1e293b', 'insertionMarkerColour': '#ffffff', 'insertionMarkerOpacity': 0.3 }
    });

    const themeToUse = activeEngine.id === 'scratch' ? scratchTheme : makeCodeTheme;

    const toolboxContents = toolboxCategories.map((cat: any) => ({
         kind: 'category', name: cat.category || 'Tools', colour: cat.color || '#4C97FF',
         contents: (cat.blocks || []).map((b: any) => ({ kind: 'block', type: `${b.value.includes('EVENT') || b.value.includes('ON_') || b.value.includes('WHEN_') || cat.category.toUpperCase().includes('EVENT') ? 'event_' : 'action_'}${b.value}` }))
    }));

    // CRITICAL FIX: move: { scrollbars: false, drag: true } completely disables the native SVG scrollbars.
    workspace.current = Blockly.inject(blocklyDiv.current, {
      toolbox: { kind: 'categoryToolbox', contents: toolboxContents }, theme: themeToUse, renderer: 'zelos',  
      grid: { spacing: 25, length: 3, colour: '#1e293b', snap: true }, 
      zoom: { controls: false, wheel: true, startScale: 1.8, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 }, 
      move: { scrollbars: false, drag: true, wheel: true },
      trashcan: true
    });

    workspace.current.addChangeListener((e) => {
        if (e.type === Blockly.Events.BLOCK_MOVE || e.type === Blockly.Events.BLOCK_CREATE || e.type === Blockly.Events.BLOCK_DELETE) {
            setStepVerified(false);
            if (workspace.current) workspace.current.getAllBlocks(false).forEach(block => block.setColour(getBlockOriginalColor(block.type)));
        }
        if (e.type !== Blockly.Events.UI && e.type !== Blockly.Events.FINISHED_LOADING && workspace.current) {
            let code = javascriptGenerator.workspaceToCode(workspace.current).replace(/highlightBlock\(".*?"\);\n/g, '');
            code = code.replace(/onEvent\("(.*?)", function\(\) \{\n([\s\S]*?)\}\);\n/g, 'WHEN: $1 TRIGGERED\n$2');
            code = code.replace(/executeAction\("(.*?)"\);\n/g, '  -> DO: $1\n');
            setLiveCode(code.replace(/^\s*[\r\n]/gm, ''));
        }
    });
  }, [mission, loading, getBlockOriginalColor, parsedConfig, activeEngine.id]);

  // CRITICAL FIX: Safe ResizeObserver implementation to perfectly position the Trashcan.
  useEffect(() => {
    const currentDiv = blocklyDiv.current;
    if (!currentDiv) return;
    
    const observer = new ResizeObserver(() => {
      const ws = workspace.current;
      if (ws) Blockly.svgResize(ws);
    });
    
    observer.observe(currentDiv);
    
    if (showWorkspace) {
      setTimeout(() => {
        const ws = workspace.current;
        if (ws) Blockly.svgResize(ws);
      }, 100);
    }
    
    return () => observer.disconnect();
  }, [showWorkspace]);

  const handleReplayMission = () => {
    setIsReadOnly(false); setCurrentStepIndex(0); setHighestReachedStep(0); setStepVerified(false);
    setImagePreview(null); setTempCaptureBlob(null); setSimLogs([]); setRevealedVocab([]); setExpandedVocab({});
    setTutorialClicked(false); setTutorialOutcome('pending');
    if (workspace.current) workspace.current.clear();
  };

  const runSimulation = async () => {
    if (!workspace.current) return;
    workspace.current.getAllBlocks(false).forEach(block => block.setColour(getBlockOriginalColor(block.type)));
    setIsRunning(true); setIsExecuting(true); setStepVerified(false); setSimLogs([`[INITIALIZING_${theme.console.toUpperCase()}]...`]);
    await new Promise(r => setTimeout(r, 1000));

    const topBlocks = workspace.current.getTopBlocks(true);
    let userStacksData: { blocks: { value: string, block: Blockly.Block }[] }[] = [];
    
    for (const topBlock of topBlocks) {
        if (topBlock.type.startsWith('event_')) {
            let currentStack: { value: string, block: Blockly.Block }[] = [];
            const ev = topBlock.type.replace('event_', ''); currentStack.push({ value: ev, block: topBlock });
            setSimLogs(prev => [...prev, `[EVENT BINDING]: ${ev} Listener Active.`]);
            workspace.current.highlightBlock(topBlock.id); await new Promise(r => setTimeout(r, 600)); workspace.current.highlightBlock(null);

            let innerBlock: Blockly.Block | null = topBlock.getInputTargetBlock('DO');
            while (innerBlock) {
                if (!isRunning && isExecuting) break;
                workspace.current.highlightBlock(innerBlock.id);
                if (innerBlock.type.startsWith('action_')) {
                    const act = innerBlock.type.replace('action_', ''); currentStack.push({ value: act, block: innerBlock });
                    setSimLogs(prev => [...prev, `[ACTION EXECUTION]: ${act}`]);
                }
                await new Promise(r => setTimeout(r, 600)); workspace.current.highlightBlock(null); innerBlock = innerBlock.getNextBlock();
            }
            if (currentStack.length > 0) userStacksData.push({ blocks: currentStack });
        }
    }

    const winSequence = currentStepData.win_sequence || [];
    const allEventValues: string[] = [];
    (parsedConfig.toolbox || []).forEach((cat: any) => (cat.blocks || []).forEach((b: any) => { if (b.value.includes('EVENT') || b.value.includes('ON_') || b.value.includes('WHEN_') || cat.category.toUpperCase().includes('EVENT')) allEventValues.push(b.value); }));
    
    let expectedStacks: string[][] = []; let currentExpectedStack: string[] = [];
    for (const item of winSequence) {
         if (allEventValues.includes(item)) { if (currentExpectedStack.length > 0) expectedStacks.push(currentExpectedStack); currentExpectedStack = [item]; } else currentExpectedStack.push(item);
    }
    if (currentExpectedStack.length > 0) expectedStacks.push(currentExpectedStack);

    let isSuccess = true;
    for (const expectedStack of expectedStacks) {
        const expectedEvent = expectedStack[0];
        const userStack = userStacksData.find(us => us.blocks[0].value === expectedEvent);
        if (!userStack) { isSuccess = false; continue; }
        for (let i = 0; i < Math.max(expectedStack.length, userStack.blocks.length); i++) {
            const uBlock = userStacksData.find(us => us.blocks[0].value === expectedEvent)?.blocks[i];
            const eValue = expectedStack[i];
            if (uBlock) { if (uBlock.value === eValue) { uBlock.block.setColour('#22c55e'); } else { uBlock.block.setColour('#ef4444'); isSuccess = false; } } else isSuccess = false; 
        }
    }
    for (const us of userStacksData) {
        if (!expectedStacks.some(es => es[0] === us.blocks[0].value)) { us.blocks.forEach(ub => ub.block.setColour('#ef4444')); isSuccess = false; }
    }

    if (isSuccess) { setSimLogs(prev => [...prev, `[SUCCESS]: Logic Requirements Met.`, `[${theme.successCode}]`]); setStepVerified(true); } 
    else { setSimLogs(prev => [...prev, `[FAIL]: Logic mismatch detected. Review highlighted blocks.`, "[RETRY_SEQUENCE]"]); setStepVerified(false); }
    setIsExecuting(false);
  };

  const endSimulation = () => { setIsRunning(false); setIsExecuting(false); setSimLogs([]); workspace.current?.highlightBlock(null); };
  
  const advanceToNextStep = () => { 
    if (currentStepIndex === steps.length - 1) { if (isCaptureStep || currentStepData.type === 'capture') handleComplete(); return; }
    setStepVerified(false); endSimulation(); 
    setCurrentStepIndex(prev => { const nextIdx = prev + 1; setHighestReachedStep(h => Math.max(h, nextIdx)); return nextIdx; }); 
  };

  const startCapture = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { displaySurface: "browser", selfBrowserSurface: "include", preferCurrentTab: true }, audio: false });
      const video = document.createElement("video"); video.srcObject = stream; video.play();
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d"); ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => { if (blob) { setTempCaptureBlob(blob); setShowCapturePreview(true); } }, "image/png");
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }, 600);
      };
    } catch (err) { console.error("Capture failed:", err); }
  };

  const confirmCapture = () => { if (tempCaptureBlob) { setImagePreview(URL.createObjectURL(tempCaptureBlob)); setShowCapturePreview(false); } };

  const handleComplete = async () => {
    const finalMVP = blueprint.mvp.join(", ");
    if (((parsedConfig.steps?.some((step: any) => step.type === 'blueprint')) && !finalMVP) || !imagePreview) { showToast("Incomplete Uplink! Ensure you have captured a snapshot.", "error"); return; }
    setIsSaving(true);
    try {
      let newHistoryArray = [...imageHistory];
      if (tempCaptureBlob) {
        const fileName = `${user.id}-${id}-${Date.now()}.png`;
        await supabase.storage.from('tech-archive-assets').upload(`blueprints/${fileName}`, tempCaptureBlob);
        const { data: urlData } = supabase.storage.from('tech-archive-assets').getPublicUrl(`blueprints/${fileName}`);
        newHistoryArray = [urlData.publicUrl, ...imageHistory];
      }
      
      const finalDesc = tutorialOutcome === 'help' ? `[SOS: STUCK ON ${activeEngine.name.toUpperCase()}] ${finalMVP || "Needs assistance"}` : (finalMVP || "Logic Complete");
      const { error: archiveError } = await supabase.from('tech_archive').upsert({
        student_id: user.id, mission_id: mission.id, title: mission.title, description: finalDesc, win_condition: blueprint.beyond, media_url: newHistoryArray.filter(Boolean).join(','), status: 'completed', xp_earned: mission.xp_reward || 50, type: 'blueprint'
      }, { onConflict: 'student_id,mission_id' });

      if (archiveError) { showToast(`Database Error: ${archiveError.message}`, "error"); setIsSaving(false); return; }

      if (!isReadOnly) {
        const newXP = (user.xp || 0) + (mission.xp_reward || 50);
        await supabase.from('profiles').update({ xp: newXP }).eq('id', user.id);
        await supabase.from('enrollments').update({ active_task: null }).eq('student_id', user.id);
        localStorage.setItem("pioneer_session", JSON.stringify({ ...user, xp: newXP }));
      }
      
      setImageHistory(newHistoryArray); setImagePreview(newHistoryArray[0]); setIsReadOnly(true); setIsCompleted(true);
      confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    } catch (err) { showToast("An unexpected error occurred.", "error"); } finally { setIsSaving(false); }
  };

  const stableFormatTextRef = useRef<any>(null);
  const stableOnCompleteRef = useRef<any>(null);

  useEffect(() => {
    stableFormatTextRef.current = formatGlossaryText;
    stableOnCompleteRef.current = () => {
      if (isIntroStep) {
        advanceToNextStep();
        const scrollContainer = document.getElementById('main-scroll-container');
        if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (isCodeStep) {
        document.getElementById('blockly-workspace-container')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
  });

  const safeFormatText = useCallback((text: string) => stableFormatTextRef.current ? stableFormatTextRef.current(text) : text, []);
  const safeOnComplete = useCallback(() => {
    const stringData = JSON.stringify(currentStepData);
    const hasTutorial = stringData.includes('makecode.microbit.org') || stringData.includes('tutorial:');
    if (hasTutorial && !tutorialClicked && !isReadOnly) { showToast(`Please launch the ${activeEngine.name} tutorial to advance.`, "error"); return; }
    if (stableOnCompleteRef.current) stableOnCompleteRef.current();
  }, [currentStepData, tutorialClicked, isReadOnly, activeEngine.name]);

  const engineProps = {
    refs: { blocklyDiv, mainScroll, sidebarScroll },
    state: {
      mission, loading, errorMsg, toastMsg, isSaving, isCompleted, user, isReadOnly,
      showCoach, currentStepIndex, highestReachedStep, stepVerified, isRunning, isExecuting,
      simLogs, liveCode, showCapturePreview, tempCaptureBlob, imagePreview, imageHistory,
      displayedLore, isTyping, revealedVocab, expandedVocab, blueprint, activeTooltip,
      tutorialOutcome, activeEngine, activeTheme, steps, currentStepData, isIntroStep,
      isBlueprintStep, isCaptureStep, isCodeStep, isMakeCodeRenderer, showWorkspace,
      isBlueprintValid, theme, tutorialClicked, isBriefingDrawerOpen
    },
    actions: {
      safeCloseToast, setShowCoach, setActiveTooltip, toggleVocab, handleGlobalClick,
      getFormattedLore, handleCardChange, safeFormatText, safeOnComplete, runSimulation,
      endSimulation, advanceToNextStep, startCapture, confirmCapture, handleComplete,
      renderMediaContent: () => null, toggleMvpOption, setBlueprint, setTutorialOutcome,
      setShowCapturePreview, handleReplayMission, setCurrentStepIndex, setStepVerified,
      getMakeCodeRenderString, setIsBriefingDrawerOpen
    }
  };

  if (activeTheme.id === 'scratch_premium') {
     return (
       <>
         <GlobalBlocklyCSS />
         <ScratchPremiumLayout engine={engineProps} />
       </>
     );
  }
  return (
     <>
       <GlobalBlocklyCSS />
       <RadDefaultLayout engine={engineProps} />
     </>
  );
}