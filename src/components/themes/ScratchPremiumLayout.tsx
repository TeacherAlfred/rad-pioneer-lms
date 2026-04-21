"use client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, CheckCircle2, Play, Camera, X,
  Trophy, ArrowRight, Loader2, Zap, ShieldAlert, ArrowUpRight,
  Search, Cpu, Power, Code2, BookOpen, ChevronDown, ChevronRight, RotateCcw, ChevronUp, Brain, Star
} from "lucide-react";
import Link from "next/link";
import MakeCodeRenderer from "@/components/lms/MakeCodeRenderer";
import SequenceViewer from "@/components/lms/SequenceViewer";
import PioneerCoach from "@/components/ui/PioneerCoach";

function ToastNotification({ message, type, onClose, activeTheme }: any) {
  if (!message) return null;
  return (
    <div className="fixed top-4 md:top-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-full max-w-[90%] md:max-w-md">
      <motion.div 
        initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }} 
        className={`pointer-events-auto rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] flex items-center gap-3 md:gap-4 relative overflow-hidden border ${
          type === 'error' ? `bg-white border-red-200` : `bg-white border-emerald-200`
        }`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-2 ${type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 border ${
          type === 'error' ? 'bg-red-50 border-red-100 text-red-500' : 'bg-emerald-50 border-emerald-100 text-emerald-500'
        }`}>
          {type === 'error' ? <ShieldAlert className="w-5 h-5 md:w-6 md:h-6" /> : <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />}
        </div>
        <div className="flex-1 pr-2">
          <h3 className={`text-[10px] md:text-xs font-black uppercase tracking-widest leading-none mb-1.5 ${type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
            {type === 'error' ? 'Oops!' : 'Success'}
          </h3>
          <p className="text-xs md:text-sm font-bold text-slate-600 leading-tight">{message}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors shrink-0">
          <X size={18} className="md:w-5 md:h-5" />
        </button>
      </motion.div>
    </div>
  );
}

export default function ScratchPremiumLayout({ engine }: { engine: any }) {
  const {
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
      renderMediaContent, toggleMvpOption, setBlueprint, setTutorialOutcome,
      setShowCapturePreview, handleReplayMission, setCurrentStepIndex, setStepVerified,
      getMakeCodeRenderString, setIsBriefingDrawerOpen
    }
  } = engine;

  if (loading) return <div className={`h-screen ${activeTheme.ui.background} flex items-center justify-center`}><Loader2 className={`animate-spin ${activeTheme.ui.primaryText}`} size={40} /></div>;
  if (errorMsg) return ( <div className={`h-screen ${activeTheme.ui.background} flex flex-col items-center justify-center text-slate-800 space-y-6`}><ShieldAlert size={64} className="text-red-500" /><h1 className="text-2xl font-black uppercase tracking-widest">{errorMsg}</h1><Link href="/student/dashboard" className={`${activeTheme.ui.primaryBtn} px-8 py-3 rounded-xl font-black uppercase text-xs border`}>Return to Dashboard</Link></div> );

  return (
    <main className={`h-[100dvh] text-slate-800 flex flex-col overflow-hidden ${activeTheme.ui.background} font-sans relative`} onClick={handleGlobalClick}>
      <ToastNotification message={toastMsg?.text || null} type={toastMsg?.type || 'error'} onClose={safeCloseToast} activeTheme={activeTheme} />

      <AnimatePresence>
        {showCoach && (
          <PioneerCoach lastWeekXP={0} winnerXP={0} currentXP={user?.xp || 0} userId={user?.id} onClose={() => setShowCoach(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
         {activeTooltip && (
            <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 pb-8 md:pb-4" onClick={() => setActiveTooltip(null)}>
               <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className={`w-full max-w-sm ${activeTheme.ui.panelBg} rounded-[32px] p-6 shadow-2xl border border-slate-100`} onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-2">
                        <BookOpen className={`${activeTheme.ui.secondaryText} w-5 h-5`} />
                        <h3 className="text-xl font-black italic uppercase text-slate-800">{activeTooltip.term}</h3>
                     </div>
                     <button onClick={() => setActiveTooltip(null)} className="p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={16}/></button>
                  </div>
                  <div className={`bg-orange-50 border ${activeTheme.ui.secondaryBorder} rounded-2xl p-4`}>
                     <p className="text-sm text-slate-700 leading-relaxed font-medium">{activeTooltip.def}</p>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* DYNAMIC NAVBAR - INCREASED TOP PADDING TO FIX CUTOFF */}
      <nav className={`pt-8 pb-4 md:pt-14 md:pb-6 px-4 md:px-8 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-30 bg-white shadow-sm shrink-0`}>
        <div className="flex items-center gap-3 md:gap-6 text-left w-full md:w-auto overflow-hidden">
          <button onClick={() => window.location.href = '/student/courses'} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all shrink-0"><ArrowLeft size={18} /></button>
          <div className="flex-1 overflow-hidden">
            <p className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] ${activeTheme.ui.primaryText} leading-none truncate`}>
              {mission?.modules?.title} // Step {currentStepIndex + 1} of {steps.length}
            </p>
            <h1 className="text-sm md:text-xl font-black uppercase italic tracking-tighter leading-none mt-1 truncate text-slate-800">Mission: {mission?.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 md:gap-4 w-full md:w-auto relative">
          {isReadOnly && (
            <button onClick={handleReplayMission} className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl bg-orange-50 text-orange-500 border border-orange-200 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all hover:bg-orange-100 flex-1 md:flex-none justify-center`}>
              <RotateCcw size={14} className="md:w-4 md:h-4" /> Replay <span className="hidden sm:inline">Mission</span>
            </button>
          )}

          {(() => {
            const hasTutorialLink = JSON.stringify(currentStepData).includes('scratch.mit.edu') || JSON.stringify(currentStepData).includes('tutorial:');
            const disableNextForTutorial = hasTutorialLink && !tutorialClicked && !isReadOnly;

            return (
              <>
                {isIntroStep && (!currentStepData.cards || currentStepData.cards.length === 0) && (
                  <button 
                    onClick={advanceToNextStep} disabled={disableNextForTutorial}
                    className={`flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex-1 md:flex-none ${disableNextForTutorial ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : `${activeTheme.ui.primaryBtn}`}`}
                  >
                    {disableNextForTutorial ? `Launch Tutorial First` : "Start Mission"} {!disableNextForTutorial && <ArrowRight size={14} className="md:w-4 md:h-4" />}
                  </button>
                )}

                {isCodeStep && (
                  <>
                    {!isMakeCodeRenderer && (
                      <button 
                        onClick={runSimulation} disabled={isExecuting || isReadOnly} 
                        className={`flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all flex-1 md:flex-none ${isExecuting || isReadOnly ? 'bg-slate-100 text-slate-400 border border-slate-200' : `${activeTheme.ui.primaryBtn}`}`}
                      >
                        {isExecuting ? <Loader2 className="animate-spin md:w-4 md:h-4" size={14} /> : <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center"><Play size={12} className="fill-white" /></div>} {stepVerified ? "Re-Test Blocks" : "Test Blocks"}
                      </button>
                    )}
                    
                    <button 
                      onClick={advanceToNextStep} disabled={(!isMakeCodeRenderer && !stepVerified && !isReadOnly) || disableNextForTutorial} 
                      className={`flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none border ${((isMakeCodeRenderer || stepVerified || isReadOnly) && !disableNextForTutorial) ? 'bg-white text-slate-800 hover:scale-105 shadow-md border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                    >
                      {disableNextForTutorial ? "Launch Tutorial" : "Next Step"} {!disableNextForTutorial && <ArrowRight size={14} className="md:w-4 md:h-4" />}
                    </button>
                  </>
                )}

                {isBlueprintStep && (
                  <button onClick={advanceToNextStep} disabled={!isBlueprintValid && !isReadOnly} className={`flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none ${isBlueprintValid || isReadOnly ? `${activeTheme.ui.primaryBtn}` : 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'}`}>
                    Confirm Blueprint <ArrowRight size={14} className="md:w-4 md:h-4" />
                  </button>
                )}

                {isCaptureStep && (
                  <button onClick={handleComplete} disabled={!imagePreview || isSaving || (tutorialOutcome === 'pending' && !isReadOnly)} className={`flex justify-center px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none ${(imagePreview || isReadOnly) && tutorialOutcome !== 'pending' ? 'bg-emerald-500 text-white hover:scale-105 shadow-md shadow-emerald-500/30' : 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'}`}>
                    {isSaving ? <Loader2 className="animate-spin md:w-4 md:h-4" size={14} /> : (isReadOnly ? "Saved" : activeTheme.terminology.capture)}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </nav>

      {showWorkspace && !isMakeCodeRenderer && (
        <div className="hidden md:block fixed top-5 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <motion.button 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0, boxShadow: ["0 0 10px rgba(59,130,246,0.1)","0 0 20px rgba(59,130,246,0.3)","0 0 10px rgba(59,130,246,0.1)"] }} transition={{ boxShadow: { repeat: Infinity, duration: 4, ease: "easeInOut" }, opacity: { duration: 0.5 } }}
            onClick={() => setShowCoach(true)}
            className={`pointer-events-auto flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-white/90 backdrop-blur-md border border-blue-200 text-slate-800 transition-all hover:bg-blue-50 hover:border-blue-300 group shadow-lg`}
          >
            <Brain size={16} className={`text-blue-500 transition-colors`} fill="currentColor" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeTheme.terminology.coach}</span>
            <div className={`w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse`} />
          </motion.button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        <div className="hidden md:flex w-[350px] lg:w-[420px] border-r border-slate-200 bg-white flex-col shrink-0 relative overflow-hidden">
            <aside ref={sidebarScroll.containerRef} onScroll={sidebarScroll.checkScroll} className="h-full overflow-y-auto p-8 space-y-8 no-scrollbar text-left font-sans flex-col pb-24">
               <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Star size={16} className={`${activeTheme.ui.primaryText}`} fill="currentColor" />
                  <span className={`text-[11px] font-black uppercase tracking-widest leading-none ${activeTheme.ui.primaryText}`}>{activeTheme.terminology.briefing}</span>
                </div>
                {currentStepData.lore_text && (
                  <div key={currentStepIndex} className={`bg-blue-50/50 border border-blue-100 rounded-[2rem] p-6 shadow-sm`}>
                      <p className={`text-[15px] font-medium leading-relaxed text-slate-700`}>
                        <span dangerouslySetInnerHTML={{ __html: getFormattedLore() }} />
                        {isTyping && <span className={`inline-block w-2 h-4 ml-1 align-middle animate-pulse bg-blue-500 rounded-full`} />}
                      </p>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {revealedVocab.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4 pb-8">
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className={`${activeTheme.ui.secondaryText}`} fill="currentColor" />
                      <span className={`text-[11px] font-black uppercase tracking-widest leading-none ${activeTheme.ui.secondaryText}`}>Studio Glossary</span>
                    </div>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {revealedVocab.map((vocab: any) => (
                          <motion.div key={vocab.term} layout initial={{ opacity: 0, scale: 0.9, x: -20 }} animate={{ opacity: 1, scale: 1, x: 0 }} className={`bg-orange-50 border border-orange-200 rounded-[1.5rem] overflow-hidden shadow-sm`}>
                             <button onClick={() => toggleVocab(vocab.term)} className="w-full flex items-center justify-between p-5 text-left hover:bg-orange-100/50 transition-colors">
                                <h4 className={`text-xs font-black uppercase tracking-widest ${activeTheme.ui.secondaryText}`}>{vocab.term}</h4>
                                {expandedVocab[vocab.term] ? <ChevronDown size={16} className={`${activeTheme.ui.secondaryText}`} /> : <ChevronRight size={16} className={`${activeTheme.ui.secondaryText}`} />}
                             </button>
                             <AnimatePresence>
                                {expandedVocab[vocab.term] && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-5 pb-5">
                                        <p className="text-[13px] font-medium leading-relaxed text-slate-600">{vocab.definition}</p>
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
        </div>

        <div className={`flex-1 relative overflow-hidden flex flex-col ${activeTheme.ui.background}`}>
          <section id="main-scroll-container" ref={mainScroll.containerRef} onScroll={mainScroll.checkScroll} className="flex-1 p-4 md:p-8 overflow-y-auto no-scrollbar space-y-6 md:space-y-10 pb-24 md:pb-12 scroll-smooth">
            
            <div className="flex items-stretch justify-between md:justify-center gap-1.5 md:gap-2 mb-4 md:mb-8 w-full pb-2">
              {steps.map((step: any, idx: number) => {
                const isActive = idx === currentStepIndex;
                const isUnlocked = idx <= highestReachedStep; 
                const isCompleted = isUnlocked && !isActive; 
                
                let label = "Activity";
                if (step.type === 'intro') label = activeTheme.terminology.briefing;
                if (step.type === 'code') label = "Build Logic";
                if (step.type === 'blueprint') label = "Blueprint";
                if (step.type === 'capture') label = "Verify";

                return (
                  <div key={idx} className="flex flex-1 md:flex-none items-center gap-1.5 md:gap-2 min-w-0">
                    <button
                      onClick={() => { if (isUnlocked && !isActive) { setCurrentStepIndex(idx); setStepVerified(false); } }}
                      disabled={!isUnlocked || isActive}
                      className={`w-full md:w-auto justify-center px-2 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 md:gap-2 transition-all truncate border ${
                        isActive ? `bg-blue-500 text-white shadow-lg shadow-blue-500/20 border-blue-500 md:scale-105` :
                        isUnlocked ? `bg-white text-slate-600 border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer` :
                        "bg-transparent text-slate-400 border-slate-200 border-dashed opacity-70 cursor-not-allowed"
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-emerald-500 shrink-0" />}
                      {isActive && <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />}
                      <span className="truncate">{label}</span>
                    </button>
                    {idx < steps.length - 1 && <div className={`hidden md:block w-4 md:w-8 h-1 rounded-full ${isUnlocked ? "bg-emerald-400" : "bg-slate-200"}`} />}
                  </div>
                );
              })}
            </div>

            <div className={`${!isCaptureStep ? 'mobile-sequence-wrapper' : ''} max-w-5xl mx-auto space-y-6 md:space-y-10 w-full relative`}>
              
              {currentStepData.cards && currentStepData.cards.length > 0 ? (
                isCaptureStep ? (
                  <div className="flex flex-col gap-4 w-full" style={{ height: 'auto', minHeight: 0 }}>
                    {currentStepData.cards.map((card: any, idx: number) => (
                      <div key={idx} className={`bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm`}>
                        <h3 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter ${activeTheme.ui.primaryText} mb-3`}>{card.title}</h3>
                        <p className={`text-base font-medium leading-relaxed text-slate-600`}>
                          <span dangerouslySetInnerHTML={{ __html: safeFormatText(card.content) }} />
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SequenceViewer key={`seq-${currentStepIndex}`} cards={currentStepData.cards} formatText={safeFormatText} onCardChange={handleCardChange} onComplete={safeOnComplete} />
                )
              ) : (
                !isCaptureStep && (
                  <div className={`relative aspect-video rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-slate-200 bg-slate-900 shadow-xl`}>
                      {renderMediaContent(currentStepData.media_url)}
                  </div>
                )
              )}

              {/* BLOCKLY WORKSPACE */}
              <div id="blockly-workspace-container" className={`space-y-4 ${showWorkspace ? 'block' : 'hidden'}`}>
                <div className="flex flex-col xl:flex-row gap-4 md:gap-6 h-[800px] xl:h-[600px] relative">
                  <div className={`flex-1 min-h-[400px] xl:min-h-0 rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-slate-200 relative shadow-xl bg-white`}>
                    
                    <div className="absolute top-0 left-0 right-0 h-14 md:h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-20 flex items-center justify-between px-5 md:px-8">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className={`size-2 md:size-2.5 rounded-full ${stepVerified ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className={`text-[10px] md:text-xs font-black uppercase text-slate-500 tracking-widest truncate`}>
                          {stepVerified ? 'Logic Verified' : 'Block Workspace'}
                        </span>
                      </div>
                      
                      <button 
                        disabled={!currentStepData.makecode_project_id && !stepVerified}
                        onClick={() => window.open(activeEngine.url, "_blank")}
                        className={`flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all shrink-0 border ${
                          (currentStepData.makecode_project_id || stepVerified) 
                          ? `${activeTheme.ui.primaryBtn}` 
                          : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        <span className="hidden sm:inline">Open in</span> {activeEngine.name} <ArrowUpRight size={14} className="md:w-4 md:h-4" />
                      </button>
                    </div>

                    <div className="absolute inset-0 pt-14 md:pt-16">
                      <div ref={blocklyDiv} className="w-full h-full" />
                    </div>
                  </div>

                  {!isMakeCodeRenderer && (
                    <div className={`w-full xl:w-[340px] h-64 xl:h-auto flex flex-col rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-slate-200 bg-white shadow-xl shrink-0`}>
                      <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 size={16} className={`text-slate-400`} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {stepVerified ? 'Verification Logs' : 'Code Translator'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-5 md:p-6 overflow-y-auto no-scrollbar bg-slate-50/30">
                        {stepVerified ? (
                          <div className="space-y-4 flex flex-col items-center justify-center h-full text-center">
                             <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-2">
                               <CheckCircle2 size={32} className="text-emerald-500" />
                             </div>
                             <p className="text-[11px] md:text-xs font-black text-slate-600 leading-relaxed uppercase tracking-widest">
                               {activeEngine.messages.success}
                             </p>
                          </div>
                        ) : (
                          liveCode ? (
                            <pre className={`text-[11px] md:text-xs font-mono font-bold text-blue-600 whitespace-pre-wrap leading-relaxed tracking-tight`}>{liveCode}</pre>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 text-center space-y-4">
                              <Code2 size={40} className="text-slate-400" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Awaiting<br/>Logic</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* BLUEPRINT SECTION */}
              {(() => {
                if (!(isBlueprintStep || (isCaptureStep && isReadOnly)) || !currentStepData.prompts) return null;
                const prompts = currentStepData.prompts;
                const mvpData = prompts.mvp || prompts.goal || { question: "Select your MVP Features:", options: [] };
                const beyondData = prompts.beyond || prompts.verification || { question: "Beyond MVP: What next?" };
                const selectedCount = blueprint.mvp.length;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-6 md:pb-10">
                    <div className={`space-y-4 text-left bg-white border border-slate-200 rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-sm`}>
                       <div className="flex justify-between items-end">
                         <label className="text-[10px] md:text-xs font-black uppercase text-slate-500 tracking-widest">{mvpData.question}</label>
                         <span className={`text-[10px] font-black tracking-widest ${selectedCount > 0 ? activeTheme.ui.primaryText : 'text-slate-400'}`}>
                           {selectedCount} SELECTED
                         </span>
                       </div>
                       <div className="flex flex-wrap gap-3 pt-2">
                          {(mvpData.options || []).map((opt: string) => {
                              const isSelected = blueprint.mvp.includes(opt);
                              return (
                                <button key={opt} onClick={() => toggleMvpOption(opt)} disabled={isReadOnly}
                                  className={`px-5 py-3 rounded-2xl text-xs md:text-sm font-bold transition-all border ${isSelected ? `${activeTheme.ui.primaryBtn}` : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}
                                >
                                  {opt}
                                </button>
                              )
                          })}
                       </div>
                    </div>

                    <div className={`space-y-4 text-left bg-white border border-slate-200 rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-sm flex flex-col`}>
                       <label className="text-[10px] md:text-xs font-black uppercase text-slate-500 tracking-widest">
                         {beyondData.question} <span className="opacity-60 lowercase tracking-normal">(Optional)</span>
                       </label>
                       <div className="pt-2 flex-1 flex">
                          <textarea 
                            value={blueprint.beyond} onChange={(e) => !isReadOnly && setBlueprint((prev: any) => ({...prev, beyond: e.target.value}))}
                            readOnly={isReadOnly} placeholder="e.g. Next I will add background music..."
                            className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none min-h-[100px] mt-2"
                          />
                       </div>
                    </div>
                  </div>
                );
              })()}

              {/* CAPTURE SECTION */}
              {isCaptureStep && (
                 <div className={`flex flex-col items-center justify-center p-8 md:p-16 bg-white border border-slate-200 rounded-[3rem] md:rounded-[4rem] space-y-6 md:space-y-8 shadow-xl relative overflow-hidden`}>
                   
                   {mission.sandbox_type === 'none' && tutorialOutcome === 'pending' && !isReadOnly ? (
                      <div className="text-center space-y-6 z-10 relative px-4 w-full max-w-2xl mx-auto py-8">
                         <div className={`w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 mx-auto mb-6`}>
                            <Brain className={`text-blue-500 w-12 h-12`} />
                         </div>
                         <h3 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-800">Status Report</h3>
                         <p className="text-slate-600 text-sm md:text-base font-medium max-w-md mx-auto leading-relaxed">
                            Before we save your progress, did you manage to complete the {activeEngine.name} tutorial successfully?
                         </p>
                         <div className="flex flex-col sm:flex-row gap-4 pt-6">
                            <button onClick={() => setTutorialOutcome('success')} className="flex-1 py-4 md:py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] md:text-xs transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 hover:scale-105"><CheckCircle2 size={18}/> Yes, Game Built</button>
                            <button onClick={() => setTutorialOutcome('help')} className="flex-1 py-4 md:py-5 bg-red-500 hover:bg-red-400 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] md:text-xs transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 hover:scale-105"><ShieldAlert size={18}/> No, I got stuck</button>
                         </div>
                      </div>
                   ) : (
                      <>
                        {isReadOnly && (
                          <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-200 z-10">
                              <CheckCircle2 size={16} className="text-emerald-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Saved to Cloud</span>
                          </div>
                        )}
                        
                        {isReadOnly && imageHistory.length > 0 ? (
                           <div className="space-y-6 md:space-y-8 w-full max-w-3xl mx-auto relative z-10 pt-10 md:pt-12">
                              <div className="rounded-[2rem] md:rounded-[3rem] overflow-hidden border-[4px] border-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative bg-slate-100">
                                 <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-slate-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest z-10 border border-slate-200 shadow-sm">Latest Snapshot</div>
                                 <img src={imageHistory[0]} alt="Latest Blueprint" className="w-full h-auto object-cover" />
                              </div>

                              {imageHistory.length > 1 && (
                                 <div className="space-y-4 pt-8 border-t border-slate-100">
                                    <h4 className="text-[11px] md:text-xs font-black uppercase tracking-widest text-slate-400 text-center">Previous Snapshots</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                                       {imageHistory.slice(1).map((url: string, idx: number) => (
                                          <div key={idx} className="rounded-2xl md:rounded-[2rem] overflow-hidden border-[3px] border-white shadow-md opacity-80 hover:opacity-100 hover:scale-105 transition-all relative group cursor-pointer bg-slate-100" onClick={() => window.open(url, '_blank')}>
                                             <div className="absolute inset-0 bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Search className="text-blue-600 w-6 h-6" /></div>
                                             <img src={url} alt={`Archive ${idx + 1}`} className="w-full h-auto object-cover" />
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </div>
                        ) : imagePreview ? (
                           <div className="w-full max-w-3xl rounded-[2rem] md:rounded-[3rem] overflow-hidden border-[4px] border-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative z-10">
                              <img src={imagePreview} alt="Saved Blueprint" className="w-full h-auto object-cover" />
                           </div>
                        ) : (
                           <>
                              <div className={`w-24 h-24 rounded-full ${tutorialOutcome === 'help' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'} flex items-center justify-center border mt-4 md:mt-0 shadow-inner`}>
                                 {tutorialOutcome === 'help' ? <ShieldAlert className="text-red-500 w-10 h-10" /> : <Camera className={`text-blue-500 w-10 h-10`} />}
                              </div>
                              <div className="text-center space-y-3 z-10 relative px-4">
                                <h3 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-800">{tutorialOutcome === 'help' ? 'Request Assistance' : activeTheme.terminology.capture}</h3>
                                <p className="text-slate-500 text-sm md:text-base font-medium max-w-md mx-auto leading-relaxed">
                                  {tutorialOutcome === 'help' ? activeEngine.messages.sos : isMakeCodeRenderer ? activeEngine.messages.captureIntro : activeEngine.messages.captureCode}
                                </p>
                              </div>
                              <button onClick={startCapture} className={`mt-6 px-10 py-5 ${tutorialOutcome === 'help' ? 'bg-red-500 text-white shadow-red-500/30 border-red-400' : `${activeTheme.ui.primaryBtn}`} font-black uppercase text-[11px] md:text-xs tracking-widest rounded-2xl hover:scale-105 transition-all border shadow-lg relative z-10`}>
                                  {tutorialOutcome === 'help' ? 'Launch SOS Capture' : 'Take Screenshot'}
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
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed bottom-4 right-4 md:bottom-12 md:right-12 w-[calc(100vw-32px)] md:w-96 bg-white border border-slate-200 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden z-50`}>
                  <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                     <div className={`flex items-center gap-2 text-slate-600 text-[10px] font-black uppercase tracking-widest`}><Cpu size={16} /> Console Output</div>
                     <button onClick={endSimulation} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Power size={14} /></button>
                  </div>
                  <div className="p-5 md:p-6 h-48 md:h-64 overflow-y-auto font-mono text-[11px] space-y-3 no-scrollbar bg-slate-800">
                     {simLogs.map((log: string, idx: number) => (
                       <div key={idx} className={`${log.includes('FAIL') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                         <span className="text-slate-500 mr-3 opacity-50">{idx.toString().padStart(3, '0')}</span>{log}
                       </div>
                     ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

      </div>

      {/* MOBILE HUD ELEMENTS */}
      <div className="md:hidden fixed bottom-6 left-0 right-0 z-40 flex flex-col gap-3 px-4 pointer-events-none">
          {showWorkspace && !isMakeCodeRenderer && (
             <motion.button 
               initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} onClick={() => setShowCoach(true)}
               className={`pointer-events-auto w-full max-w-sm mx-auto ${activeTheme.ui.primaryBtn} shadow-xl rounded-2xl p-4 flex items-center justify-center gap-3 text-white transition-all border`}
             >
               <Brain size={18} fill="currentColor"/>
               <span className="font-black uppercase tracking-widest text-[11px]">{activeTheme.terminology.coach}</span>
             </motion.button>
          )}

          <AnimatePresence>
            {!isBriefingDrawerOpen && (
              <motion.button 
                initial={{y: 20, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 20, opacity: 0}} onClick={() => setIsBriefingDrawerOpen(true)}
                className={`pointer-events-auto w-full max-w-sm mx-auto bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl p-4 flex items-center justify-between text-slate-700 active:scale-95 transition-all`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-xl text-blue-500"><Zap size={16} fill="currentColor"/></div>
                  <span className="font-black uppercase tracking-widest text-[11px]">{activeTheme.terminology.briefing}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center"><ChevronUp size={16} className="text-slate-400" /></div>
              </motion.button>
            )}
          </AnimatePresence>
      </div>

      {/* CAPTURE PREVIEW MODAL */}
      <AnimatePresence>
        {showCapturePreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 md:p-6">
            <div className={`max-w-4xl w-full bg-white border border-slate-200 rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl`}>
              <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-800">Review Snapshot</h3>
                <button onClick={() => setShowCapturePreview(false)} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-200 rounded-full p-2"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
              </div>
              <div className="p-6 md:p-10 bg-slate-100 text-center">
                {tempCaptureBlob && <img src={URL.createObjectURL(tempCaptureBlob)} className="w-full h-auto rounded-[1.5rem] md:rounded-[2rem] border-[4px] border-white shadow-lg mx-auto" alt="Preview" /> }
              </div>
              <div className="p-6 md:p-8 border-t border-slate-100 flex gap-3 md:gap-4 bg-white">
                <button onClick={() => setShowCapturePreview(false)} className="flex-1 py-4 rounded-xl md:rounded-2xl border border-slate-200 text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors">Discard</button>
                <button onClick={confirmCapture} className={`flex-1 py-4 rounded-xl md:rounded-2xl ${activeTheme.ui.primaryBtn} text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border shadow-md`}>Upload to Cloud</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MISSION COMPLETED MODAL */}
      <AnimatePresence>
        {isCompleted && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 md:p-6">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-[3rem] md:rounded-[4rem] p-10 md:p-12 text-center space-y-6 md:space-y-8 shadow-2xl">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center mx-auto border-[4px] bg-emerald-50 border-white shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
                <Trophy className="w-10 h-10 md:w-12 md:h-12 text-emerald-500" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-800 leading-tight">{activeTheme.terminology.success.split(' ')[0]} <br /><span className="text-emerald-500">{activeTheme.terminology.success.split(' ').slice(1).join(' ')}</span></h2>
              <button onClick={() => window.location.href = '/student/courses'} className={`${activeTheme.ui.primaryBtn} border flex items-center justify-center gap-2 md:gap-3 w-full py-5 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase italic shadow-xl text-[11px] md:text-xs tracking-widest`}>Return to Hub <ArrowRight size={18} className="md:w-5 md:h-5" /></button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}