"use client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, CheckCircle2, Play, Camera, X,
  Trophy, ArrowRight, Loader2, Zap, ShieldAlert, ArrowUpRight,
  Search, Cpu, Power, Code2, BookOpen, ChevronDown, ChevronRight, RotateCcw, ChevronUp, Brain
} from "lucide-react";
import Link from "next/link";
import MakeCodeRenderer from "../lms/MakeCodeRenderer";
import SequenceViewer from "../lms/SequenceViewer";
import PioneerCoach from "../ui/PioneerCoach";

function ToastNotification({ message, type, onClose, activeTheme }: any) {
  if (!message) return null;
  return (
    <div className="fixed top-4 md:top-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-full max-w-[90%] md:max-w-md">
      <motion.div 
        initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }} 
        className={`pointer-events-auto rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-2xl flex items-center gap-3 md:gap-4 relative overflow-hidden border ${
          type === 'error' ? `${activeTheme.ui.panelBg} border-red-500/30 shadow-red-900/20` : `${activeTheme.ui.panelBg} border-green-500/30 shadow-green-900/20`
        }`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 border ${
          type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-green-500/20 border-green-500/30 text-green-400'
        }`}>
          {type === 'error' ? <ShieldAlert className="w-5 h-5 md:w-6 md:h-6" /> : <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />}
        </div>
        <div className="flex-1 pr-2">
          <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white leading-none mb-1.5">
            {type === 'error' ? 'System Alert' : 'Success'}
          </h3>
          <p className="text-xs md:text-sm font-bold text-slate-300 leading-tight">{message}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors shrink-0">
          <X size={18} className="md:w-5 md:h-5" />
        </button>
      </motion.div>
    </div>
  );
}

export default function RadDefaultLayout({ engine }: { engine: any }) {
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
  if (errorMsg) return ( <div className={`h-screen ${activeTheme.ui.background} flex flex-col items-center justify-center text-white space-y-6`}><ShieldAlert size={64} className="text-red-500" /><h1 className="text-2xl font-black uppercase tracking-widest">{errorMsg}</h1><Link href="/student/dashboard" className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase text-xs">Return to Dashboard</Link></div> );

  return (
    <main className={`h-[100dvh] text-white flex flex-col overflow-hidden ${activeTheme.ui.background} font-sans relative`} onClick={handleGlobalClick}>
      <ToastNotification message={toastMsg?.text || null} type={toastMsg?.type || 'error'} onClose={safeCloseToast} activeTheme={activeTheme} />

      <AnimatePresence>
        {showCoach && (
          <PioneerCoach lastWeekXP={0} winnerXP={0} currentXP={user?.xp || 0} userId={user?.id} onClose={() => setShowCoach(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
         {activeTooltip && (
            <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-8 md:pb-4" onClick={() => setActiveTooltip(null)}>
               <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className={`w-full max-w-sm ${activeTheme.ui.panelBg} border border-purple-500/30 rounded-[32px] p-6 shadow-2xl`} onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-2">
                        <BookOpen className={`${activeTheme.ui.secondaryText} w-5 h-5`} />
                        <h3 className="text-xl font-black italic uppercase text-white drop-shadow-md">{activeTooltip.term}</h3>
                     </div>
                     <button onClick={() => setActiveTooltip(null)} className="p-1.5 bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
                  </div>
                  <div className={`${activeTheme.ui.secondaryBorder} bg-purple-500/10 border rounded-2xl p-4`}>
                     <p className="text-sm text-slate-300 leading-relaxed font-medium">{activeTooltip.def}</p>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* DYNAMIC NAVBAR (MOBILE RESPONSIVE - FIXED TOP PADDING) */}
      <nav className={`pt-8 pb-4 md:pt-14 md:pb-6 px-4 md:px-8 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-30 ${activeTheme.ui.background} shrink-0`}>
        <div className="flex items-center gap-3 md:gap-6 text-left w-full md:w-auto overflow-hidden">
          <button onClick={() => window.location.href = '/student/courses'} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shrink-0"><ArrowLeft size={18} /></button>
          <div className="flex-1 overflow-hidden">
            <p className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] ${activeTheme.ui.primaryText} leading-none truncate`}>
              {mission?.modules?.title} // Task {currentStepIndex + 1} of {steps.length}
            </p>
            <h1 className="text-sm md:text-xl font-black uppercase italic tracking-tighter leading-none mt-1 truncate">Milestone_{mission?.order_index}: {mission?.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 md:gap-4 w-full md:w-auto relative">
          {isReadOnly && (
            <button onClick={handleReplayMission} className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl ${activeTheme.ui.secondaryBg || 'bg-purple-500/10'} ${activeTheme.ui.secondaryText} text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border flex-1 md:flex-none justify-center`}>
              <RotateCcw size={14} className="md:w-4 md:h-4" /> Replay <span className="hidden sm:inline">Mission</span>
            </button>
          )}

          {(() => {
            const hasTutorialLink = JSON.stringify(currentStepData).includes('makecode.microbit.org') || JSON.stringify(currentStepData).includes('tutorial:');
            const disableNextForTutorial = hasTutorialLink && !tutorialClicked && !isReadOnly;

            return (
              <>
                {isIntroStep && (!currentStepData.cards || currentStepData.cards.length === 0) && (
                  <button 
                    onClick={advanceToNextStep} disabled={disableNextForTutorial}
                    className={`flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border flex-1 md:flex-none ${disableNextForTutorial ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-70 border-slate-600' : `${activeTheme.ui.primaryBtn}`}`}
                  >
                    {disableNextForTutorial ? `Launch Tutorial to Advance` : "Commence Setup"} {!disableNextForTutorial && <ArrowRight size={14} className="md:w-4 md:h-4" />}
                  </button>
                )}

                {isCodeStep && (
                  <>
                    {!isMakeCodeRenderer && (
                      <button 
                        onClick={runSimulation} disabled={isExecuting || isReadOnly} 
                        className={`flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all border flex-1 md:flex-none ${isExecuting || isReadOnly ? 'bg-slate-700 text-slate-400 border-slate-600' : `${activeTheme.ui.primaryBtn}`}`}
                      >
                        {isExecuting ? <Loader2 className="animate-spin md:w-4 md:h-4" size={14} /> : <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center"><Play size={12} className="fill-white" /></div>} {stepVerified ? "Re-Test Code" : "Test Code"}
                      </button>
                    )}
                    
                    <button 
                      onClick={advanceToNextStep} disabled={(!isMakeCodeRenderer && !stepVerified && !isReadOnly) || disableNextForTutorial} 
                      className={`flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none border ${((isMakeCodeRenderer || stepVerified || isReadOnly) && !disableNextForTutorial) ? 'bg-white text-black hover:scale-105 shadow-xl border-white' : 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed'}`}
                    >
                      {disableNextForTutorial ? "Launch Tutorial First" : "Next Task"} {!disableNextForTutorial && <ArrowRight size={14} className="md:w-4 md:h-4" />}
                    </button>
                  </>
                )}

                {isBlueprintStep && (
                  <button onClick={advanceToNextStep} disabled={!isBlueprintValid && !isReadOnly} className={`flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all border flex-1 md:flex-none ${isBlueprintValid || isReadOnly ? `${activeTheme.ui.primaryBtn}` : 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed'}`}>
                    Confirm Blueprint <ArrowRight size={14} className="md:w-4 md:h-4" />
                  </button>
                )}

                {isCaptureStep && (
                  <button onClick={handleComplete} disabled={!imagePreview || isSaving || (tutorialOutcome === 'pending' && !isReadOnly)} className={`flex justify-center px-6 md:px-8 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex-1 md:flex-none ${(imagePreview || isReadOnly) && tutorialOutcome !== 'pending' ? 'bg-white text-black hover:scale-105 shadow-xl border-white' : 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed'}`}>
                    {isSaving ? <Loader2 className="animate-spin md:w-4 md:h-4" size={14} /> : (isReadOnly ? "Archived" : "Lock Milestone")}
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
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0, boxShadow: ["0 0 10px rgba(59,130,246,0.1)","0 0 20px rgba(59,130,246,0.4)","0 0 10px rgba(59,130,246,0.1)"] }} transition={{ boxShadow: { repeat: Infinity, duration: 4, ease: "easeInOut" }, opacity: { duration: 0.5 } }}
            onClick={() => setShowCoach(true)}
            className={`pointer-events-auto flex items-center gap-2.5 px-5 py-2 rounded-full ${activeTheme.ui.panelBg} backdrop-blur-xl border ${activeTheme.ui.primaryBorder} text-white transition-all hover:bg-white/10 group`}
          >
            <Brain size={14} className={`${activeTheme.ui.primaryText} group-hover:text-white transition-colors`} fill="currentColor" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] italic">{activeTheme.terminology.coach}</span>
            <div className={`w-1 h-1 rounded-full bg-white group-hover:bg-white animate-pulse`} />
          </motion.button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

        <div className="hidden md:flex w-[350px] lg:w-[420px] border-r border-white/5 bg-black/20 flex-col shrink-0 relative overflow-hidden">
           <AnimatePresence>
              {sidebarScroll.canScrollUp && (
                <motion.button initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} onMouseDown={() => sidebarScroll.startScrolling('up')} onTouchStart={() => sidebarScroll.startScrolling('up')} className="absolute top-6 right-6 z-40 cursor-pointer pointer-events-auto group">
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 hover:scale-110 transition-all">
                    <ChevronUp size={16} className={`${activeTheme.ui.primaryText} transition-colors`} />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

            <aside ref={sidebarScroll.containerRef} onScroll={sidebarScroll.checkScroll} className="h-full overflow-y-auto p-8 space-y-8 no-scrollbar text-left font-mono flex-col pb-24">
               <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Zap size={14} className={`${activeTheme.ui.primaryText}`} fill="currentColor" />
                  <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${activeTheme.ui.primaryText}`}>{activeTheme.terminology.briefing}</span>
                </div>
                {currentStepData.lore_text && (
                  <div key={currentStepIndex} className={`bg-white/5 border border-white/10 rounded-[32px] p-6`}>
                      <p className={`text-sm leading-loose ${activeTheme.ui.primaryText}`}>
                        <span dangerouslySetInnerHTML={{ __html: getFormattedLore() }} />
                        {isTyping && <span className={`inline-block w-2 h-4 ml-1 align-middle animate-pulse bg-white`} />}
                      </p>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {revealedVocab.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4 pb-8">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className={`${activeTheme.ui.secondaryText}`} fill="currentColor" />
                      <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${activeTheme.ui.secondaryText}`}>Studio Glossary</span>
                    </div>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {revealedVocab.map((vocab: any) => (
                          <motion.div key={vocab.term} layout initial={{ opacity: 0, scale: 0.9, x: -20 }} animate={{ opacity: 1, scale: 1, x: 0 }} className={`${activeTheme.ui.panelBg} border ${activeTheme.ui.secondaryBorder} rounded-2xl overflow-hidden`}>
                             <button onClick={() => toggleVocab(vocab.term)} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
                                <h4 className={`text-[11px] font-black uppercase tracking-widest ${activeTheme.ui.secondaryText}`}>{vocab.term}</h4>
                                {expandedVocab[vocab.term] ? <ChevronDown size={14} className={`${activeTheme.ui.secondaryText}`} /> : <ChevronRight size={14} className={`${activeTheme.ui.secondaryText}`} />}
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
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 hover:scale-110 transition-all">
                    <ChevronDown size={16} className={`${activeTheme.ui.primaryText} transition-colors animate-bounce`} />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
        </div>

        <div className={`flex-1 relative overflow-hidden flex flex-col ${activeTheme.ui.background}`}>
            
           <AnimatePresence>
              {mainScroll.canScrollUp && (
                <motion.button initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} onMouseDown={() => mainScroll.startScrolling('up')} onTouchStart={() => mainScroll.startScrolling('up')} className="absolute top-6 right-6 md:right-10 z-40 cursor-pointer pointer-events-auto group">
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 hover:scale-110 transition-all">
                    <ChevronUp size={16} className={`${activeTheme.ui.primaryText} transition-colors`} />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

          <section id="main-scroll-container" ref={mainScroll.containerRef} onScroll={mainScroll.checkScroll} className="flex-1 p-4 md:p-8 overflow-y-auto no-scrollbar space-y-6 md:space-y-10 pb-24 md:pb-12 scroll-smooth">
            
            <div className="flex items-stretch justify-between md:justify-center gap-1.5 md:gap-2 mb-4 md:mb-8 w-full pb-2">
              {steps.map((step: any, idx: number) => {
                const isActive = idx === currentStepIndex;
                const isUnlocked = idx <= highestReachedStep; 
                const isCompleted = isUnlocked && !isActive; 
                
                let label = "Activity";
                if (step.type === 'intro') label = activeTheme.terminology.briefing;
                if (step.type === 'code') label = "Coding Logic";
                if (step.type === 'blueprint') label = "MVP Blueprint";
                if (step.type === 'capture') label = "Verification";

                return (
                  <div key={idx} className="flex flex-1 md:flex-none items-center gap-1.5 md:gap-2 min-w-0">
                    <button
                      onClick={() => { if (isUnlocked && !isActive) { setCurrentStepIndex(idx); setStepVerified(false); } }}
                      disabled={!isUnlocked || isActive}
                      className={`w-full md:w-auto justify-center px-1 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-tighter md:tracking-widest flex items-center gap-1 md:gap-2 transition-all truncate border ${
                        isActive ? `${activeTheme.ui.secondaryBtn} md:scale-105` :
                        isUnlocked ? `${activeTheme.ui.accentBg} ${activeTheme.ui.accent} hover:bg-white/5 cursor-pointer` :
                        "bg-white/5 text-slate-500 border-white/5 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />}
                      {isActive && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-pulse shrink-0" />}
                      <span className="truncate">{label}</span>
                    </button>
                    {idx < steps.length - 1 && <div className={`hidden md:block w-4 md:w-6 h-px ${isUnlocked ? "bg-green-500/30" : "bg-white/10"}`} />}
                  </div>
                );
              })}
            </div>

            <div className={`${!isCaptureStep ? 'mobile-sequence-wrapper' : ''} max-w-5xl mx-auto space-y-6 md:space-y-10 w-full relative`}>
              
              {currentStepData.cards && currentStepData.cards.length > 0 ? (
                isCaptureStep ? (
                  <div className="flex flex-col gap-4 w-full" style={{ height: 'auto', minHeight: 0 }}>
                    {currentStepData.cards.map((card: any, idx: number) => (
                      <div key={idx} className={`${activeTheme.ui.panelBg} border ${activeTheme.ui.primaryBorder} rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-inner`}>
                        <h3 className={`text-lg md:text-xl font-black uppercase italic tracking-tighter ${activeTheme.ui.primaryText} mb-2`}>{card.title}</h3>
                        <p className={`text-sm md:text-base leading-relaxed text-slate-300`}>
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
                  <div className={`relative aspect-video rounded-[24px] md:rounded-[48px] overflow-hidden border ${activeTheme.ui.primaryBorder} bg-black shadow-2xl`}>
                      {renderMediaContent(currentStepData.media_url)}
                  </div>
                )
              )}

              {/* BLOCKLY WORKSPACE */}
              <div id="blockly-workspace-container" className={`space-y-4 ${showWorkspace ? 'block' : 'hidden'}`}>
                <div className="flex flex-col xl:flex-row gap-4 md:gap-6 h-[800px] xl:h-[600px] relative">
                  <div className={`flex-1 min-h-[400px] xl:min-h-0 rounded-[24px] md:rounded-[32px] overflow-hidden border ${activeTheme.ui.primaryBorder} relative shadow-xl bg-[#020617]`}>
                    
                    <div className="absolute top-0 left-0 right-0 h-12 md:h-14 bg-black/40 border-b border-white/5 z-20 flex items-center justify-between px-4 md:px-6">
                      <div className="flex items-center gap-2">
                        <div className={`size-1.5 md:size-2 rounded-full ${stepVerified ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                        <span className={`text-[8px] md:text-[10px] font-black uppercase ${activeTheme.ui.primaryText} tracking-widest truncate`}>
                          {stepVerified ? 'Concepts_Verified' : 'Concept_Workspace'}
                        </span>
                      </div>
                      
                      <button 
                        disabled={!currentStepData.makecode_project_id && !stepVerified}
                        onClick={() => {
                          if (currentStepData.makecode_project_id && currentStepData.makecode_project_id !== 'empty') {
                             window.open(`https://makecode.microbit.org/#pub:${currentStepData.makecode_project_id}`, "_blank");
                          } else {
                             window.open(activeEngine.url, "_blank");
                          }
                        }}
                        className={`flex items-center gap-1.5 md:gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase transition-all shrink-0 border ${
                          (currentStepData.makecode_project_id || stepVerified) 
                          ? `${activeTheme.ui.primaryBtn}` 
                          : 'bg-white/5 text-slate-700 border-white/5 cursor-not-allowed grayscale'
                        }`}
                      >
                        <span className="hidden sm:inline">Open in</span> {activeEngine.name} <ArrowUpRight size={12} className="md:w-3.5 md:h-3.5" />
                      </button>
                    </div>

                    <div className="absolute inset-0 pt-12 md:pt-14">
                      {currentStepData.makecode_project_id && currentStepData.makecode_project_id !== 'empty' ? (
                        <iframe 
                          className="w-full h-full border-none"
                          src={`https://makecode.microbit.org/#pub:${currentStepData.makecode_project_id}`}
                          sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
                        />
                      ) : isMakeCodeRenderer && stepVerified ? (
                        <div className="absolute inset-0 z-10 bg-[#020617]">
                          <MakeCodeRenderer code={getMakeCodeRenderString(liveCode)} />
                        </div>
                      ) : (
                        <div ref={blocklyDiv} className="w-full h-full" />
                      )}
                    </div>
                  </div>

                  {!isMakeCodeRenderer && (
                    <div className={`w-full xl:w-[340px] h-64 xl:h-auto flex flex-col rounded-[24px] md:rounded-[32px] overflow-hidden border ${activeTheme.ui.primaryBorder} ${activeTheme.ui.panelBg} shadow-2xl shrink-0`}>
                      <div className="p-3 md:p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 size={14} className={`${activeTheme.ui.secondaryText}`} />
                          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {stepVerified ? 'Concept_Verified' : 'Plain_English_Translator'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-4 md:p-6 overflow-y-auto no-scrollbar bg-black/20">
                        {stepVerified ? (
                          <div className="space-y-4 opacity-70 flex flex-col items-center justify-center h-full text-center">
                             <CheckCircle2 size={32} className="text-green-500" />
                             <p className="text-[9px] md:text-[10px] font-bold text-slate-300 leading-relaxed uppercase tracking-widest">
                               {activeEngine.messages.success}
                             </p>
                          </div>
                        ) : (
                          liveCode ? (
                            <pre className={`text-[10px] md:text-[11px] font-mono ${activeTheme.ui.secondaryText} whitespace-pre-wrap leading-relaxed tracking-tight`}>{liveCode}</pre>
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
              
              {/* BLUEPRINT SECTION */}
              {(() => {
                if (!(isBlueprintStep || (isCaptureStep && isReadOnly)) || !currentStepData.prompts) return null;
                const prompts = currentStepData.prompts;
                const mvpData = prompts.mvp || prompts.goal || { question: "Select your MVP Features:", options: [] };
                const beyondData = prompts.beyond || prompts.verification || { question: "Beyond MVP: What next?" };
                const selectedCount = blueprint.mvp.length;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-6 md:pb-10">
                    <div className={`space-y-4 text-left ${activeTheme.ui.panelBg} border ${activeTheme.ui.primaryBorder} rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-xl`}>
                       <div className="flex justify-between items-end">
                         <label className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">{mvpData.question}</label>
                         <span className={`text-[9px] md:text-[10px] font-black tracking-widest ${selectedCount > 0 ? activeTheme.ui.primaryText : 'text-slate-500'}`}>
                           {selectedCount} SELECTED
                         </span>
                       </div>
                       <div className="flex flex-wrap gap-2.5 md:gap-3 pt-2">
                          {(mvpData.options || []).map((opt: string) => {
                              const isSelected = blueprint.mvp.includes(opt);
                              return (
                                <button key={opt} onClick={() => toggleMvpOption(opt)} disabled={isReadOnly}
                                  className={`px-4 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all border ${isSelected ? `${activeTheme.ui.primaryBtn}` : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                                >
                                  {opt}
                                </button>
                              )
                          })}
                       </div>
                    </div>

                    <div className={`space-y-4 text-left ${activeTheme.ui.panelBg} border ${activeTheme.ui.primaryBorder} rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-xl flex flex-col`}>
                       <label className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">
                         {beyondData.question} <span className="opacity-50 lowercase tracking-normal">(Optional)</span>
                       </label>
                       <div className="pt-2 flex-1 flex">
                          <textarea 
                            value={blueprint.beyond} onChange={(e) => !isReadOnly && setBlueprint((prev: any) => ({...prev, beyond: e.target.value}))}
                            readOnly={isReadOnly} placeholder="e.g. Next I will add background music..."
                            className="w-full flex-1 bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 text-xs md:text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none min-h-[100px] mt-2"
                          />
                       </div>
                    </div>
                  </div>
                );
              })()}

              {/* CAPTURE SECTION */}
              {isCaptureStep && (
                 <div className={`flex flex-col items-center justify-center p-6 md:p-12 ${activeTheme.ui.panelBg} border ${activeTheme.ui.primaryBorder} rounded-[32px] md:rounded-[48px] space-y-6 md:space-y-8 shadow-2xl relative overflow-hidden`}>
                   
                   {mission.sandbox_type === 'none' && tutorialOutcome === 'pending' && !isReadOnly ? (
                      <div className="text-center space-y-6 z-10 relative px-4 w-full max-w-2xl mx-auto py-8">
                         <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mx-auto mb-6`}>
                            <Brain className={`${activeTheme.ui.secondaryText} w-8 h-8 md:w-10 md:h-10`} />
                         </div>
                         <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Status Report</h3>
                         <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                            Before we archive your progress, did you manage to complete the {activeEngine.name} tutorial successfully?
                         </p>
                         <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button onClick={() => setTutorialOutcome('success')} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 hover:scale-105"><CheckCircle2 size={16}/> Yes, Logic Built</button>
                            <button onClick={() => setTutorialOutcome('help')} className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2 hover:scale-105"><ShieldAlert size={16}/> No, I got stuck</button>
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
                                       {imageHistory.slice(1).map((url: string, idx: number) => (
                                          <div key={idx} className="rounded-xl md:rounded-2xl overflow-hidden border border-white/10 opacity-70 hover:opacity-100 transition-opacity relative group cursor-pointer bg-black" onClick={() => window.open(url, '_blank')}>
                                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Search className="text-white w-5 h-5 md:w-6 md:h-6" /></div>
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
                              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${tutorialOutcome === 'help' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-white/10'} flex items-center justify-center border mt-4 md:mt-0 shadow-inner`}>
                                 {tutorialOutcome === 'help' ? <ShieldAlert className="text-rose-400 w-8 h-8 md:w-10 md:h-10" /> : <Camera className={`${activeTheme.ui.primaryText} w-8 h-8 md:w-10 md:h-10`} />}
                              </div>
                              <div className="text-center space-y-2 md:space-y-3 z-10 relative px-4">
                                <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">{tutorialOutcome === 'help' ? 'Request Assistance' : activeTheme.terminology.capture}</h3>
                                <p className="text-slate-300 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                                  {tutorialOutcome === 'help' ? activeEngine.messages.sos : isMakeCodeRenderer ? activeEngine.messages.captureIntro : activeEngine.messages.captureCode}
                                </p>
                              </div>
                              <button onClick={startCapture} className={`mt-4 px-8 py-4 md:px-10 md:py-5 ${tutorialOutcome === 'help' ? 'bg-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.3)]' : `${activeTheme.ui.primaryBtn}`} font-black uppercase text-[10px] md:text-xs tracking-widest rounded-xl md:rounded-2xl transition-all border relative z-10`}>
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
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed bottom-4 right-4 md:bottom-12 md:right-12 w-[calc(100vw-32px)] md:w-96 ${activeTheme.ui.panelBg} border ${activeTheme.ui.primaryBorder} rounded-[24px] md:rounded-[32px] shadow-2xl overflow-hidden z-50`}>
                  <div className="p-3 md:p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
                     <div className={`flex items-center gap-2 ${activeTheme.ui.primaryText} text-[9px] md:text-[10px] font-black uppercase tracking-widest`}><Cpu size={14} className="md:w-4 md:h-4" /> {theme.console}</div>
                     <button onClick={endSimulation} className="p-1.5 md:p-1 text-red-500 hover:bg-red-500/10 rounded-md"><Power size={16} className="md:w-4 md:h-4" /></button>
                  </div>
                  <div className="p-4 md:p-6 h-48 md:h-64 overflow-y-auto font-mono text-[10px] md:text-[11px] space-y-2 no-scrollbar">
                     {simLogs.map((log: string, idx: number) => (
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
                  <div className="bg-white/5 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 hover:scale-110 transition-all">
                    <ChevronDown size={16} className={`${activeTheme.ui.primaryText} transition-colors animate-bounce`} />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
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
                className={`pointer-events-auto w-full max-w-sm mx-auto ${activeTheme.ui.panelBg} backdrop-blur-xl border ${activeTheme.ui.primaryBorder} shadow-2xl rounded-2xl p-4 flex items-center justify-between ${activeTheme.ui.primaryText} active:scale-95 transition-all`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl"><Zap size={16} fill="currentColor"/></div>
                  <span className="font-black uppercase tracking-widest text-[11px]">{activeTheme.terminology.briefing}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><ChevronUp size={16} className="text-white" /></div>
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
              className={`md:hidden fixed bottom-0 left-0 right-0 z-50 ${activeTheme.ui.panelBg} border-t ${activeTheme.ui.primaryBorder} rounded-t-[32px] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] max-h-[85vh] flex flex-col font-mono`}
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div className={`flex items-center gap-2 ${activeTheme.ui.primaryText}`}>
                  <Zap size={16} fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">{activeTheme.terminology.briefing}</span>
                </div>
                <button 
                  onClick={() => setIsBriefingDrawerOpen(false)} 
                  disabled={isTyping}
                  className={`p-2 rounded-full transition-all ${isTyping ? 'bg-white/5 text-slate-600 cursor-not-allowed opacity-50' : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20'}`}
                >
                  <X size={16}/>
                </button>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-[24px] p-5 overflow-y-auto no-scrollbar">
                <p className={`text-sm leading-loose ${activeTheme.ui.primaryText}`}>
                  <span dangerouslySetInnerHTML={{ __html: getFormattedLore() }} />
                  {isTyping && <span className="inline-block w-1.5 h-3 ml-1 align-middle animate-pulse bg-white" />}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CAPTURE PREVIEW MODAL */}
      <AnimatePresence>
        {showCapturePreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-6">
            <div className={`max-w-4xl w-full ${activeTheme.ui.panelBg} border ${activeTheme.ui.primaryBorder} rounded-[32px] md:rounded-[48px] overflow-hidden shadow-2xl`}>
              <div className="p-5 md:p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tighter text-white">Review_Snapshot</h3>
                <button onClick={() => setShowCapturePreview(false)} className="text-slate-500 hover:text-white p-2"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
              </div>
              <div className="p-4 md:p-8 bg-black/40 text-center">
                {tempCaptureBlob && <img src={URL.createObjectURL(tempCaptureBlob)} className="w-full h-auto rounded-2xl md:rounded-3xl border border-white/10 mx-auto" alt="Preview" /> }
              </div>
              <div className="p-4 md:p-8 border-t border-white/5 flex gap-3 md:gap-4">
                <button onClick={() => setShowCapturePreview(false)} className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl border border-white/10 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 transition-colors">Discard</button>
                <button onClick={confirmCapture} className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl ${activeTheme.ui.primaryBtn} text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border`}>Confirm Snapshot</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MISSION COMPLETED MODAL */}
      <AnimatePresence>
        {isCompleted && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-4 md:p-6">
            <div className="max-w-md w-full bg-white/[0.03] border border-white/10 rounded-[40px] md:rounded-[56px] p-8 md:p-12 text-center space-y-6 md:space-y-8">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-[32px] flex items-center justify-center mx-auto border bg-green-500/20 border-green-500/30"><Trophy className="w-8 h-8 md:w-10 md:h-10 text-green-400" /></div>
              <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-white leading-tight">{activeTheme.terminology.success.split(' ')[0]} <br /><span className="text-green-400">{activeTheme.terminology.success.split(' ').slice(1).join(' ')}</span></h2>
              <button onClick={() => window.location.href = '/student/courses'} className={`${activeTheme.ui.primaryBtn} border flex items-center justify-center gap-2 md:gap-3 w-full py-4 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase italic shadow-xl text-[10px] md:text-base tracking-widest`}>Return to Hub <ArrowRight size={16} className="md:w-[18px] md:h-[18px]" /></button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}