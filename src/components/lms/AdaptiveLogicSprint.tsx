"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, XCircle, Brain, Trophy, ChevronRight, Zap, Play, Flame } from "lucide-react";
import confetti from "canvas-confetti";

interface Question {
  id: string;
  level: number;
  difficulty: number;
  prompt: string;
  options: string[] | string; 
  correct_answer: string;
}

interface AdaptiveLogicSprintProps {
  questions: Question[];
  onComplete: (stats: { score: number, timeTaken: number, maxLevel: number, multiplier: number }) => void;
}

export default function AdaptiveLogicSprint({ questions, onComplete }: AdaptiveLogicSprintProps) {
  const [phase, setPhase] = useState<'intro' | 'sprint' | 'results'>('intro');
  
  // HUD Timers
  const [elapsedTime, setElapsedTime] = useState(0); 
  const [multiplier, setMultiplier] = useState<3 | 2 | 1>(3);
  const [tierTimeLeft, setTierTimeLeft] = useState(60); 
  const [barStatus, setBarStatus] = useState<'normal' | 'surge' | 'damage'>('normal');
  const [shatterTrigger, setShatterTrigger] = useState<number>(0); 
  
  // Matrix State
  const [activeLevel, setActiveLevel] = useState(1);
  const [activeDifficulty, setActiveDifficulty] = useState(3); 
  const [isFirstAttemptAtLevel, setIsFirstAttemptAtLevel] = useState(true);
  
  // Question Tracking
  const [currentQuestion, setCurrentQuestion] = useState<(Question & { parsed_options: string[] }) | null>(null);
  const [askedQuestionIds, setAskedQuestionIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // Stats
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const startTimeRef = useRef<number>(0);

  const fetchNextQuestion = useCallback((targetLevel: number, targetDiff: number, asked: Set<string>) => {
    let pool = questions.filter(q => q.level === targetLevel && q.difficulty === targetDiff && !asked.has(q.id));
    if (pool.length === 0) pool = questions.filter(q => q.level === targetLevel && !asked.has(q.id));
    if (pool.length === 0) pool = questions.filter(q => !asked.has(q.id));

    if (pool.length > 0) {
      const selected = pool[Math.floor(Math.random() * pool.length)];
      let parsedOptions: string[] = [];
      if (typeof selected.options === 'string') {
        try { parsedOptions = JSON.parse(selected.options); } 
        catch(e) { parsedOptions = [selected.options]; }
      } else if (Array.isArray(selected.options)) {
        parsedOptions = selected.options;
      }
      const shuffledOptions = [...parsedOptions].sort(() => Math.random() - 0.5);
      setCurrentQuestion({ ...selected, parsed_options: shuffledOptions });
    } else {
      handleFinishSprint();
    }
  }, [questions]);

  const startSprint = () => {
    setPhase('sprint');
    startTimeRef.current = Date.now();
    fetchNextQuestion(activeLevel, activeDifficulty, askedQuestionIds);
  };

  // --- TIMER 1: Overall Stopwatch ---
  useEffect(() => {
    if (phase === 'sprint') {
      const timer = setTimeout(() => setElapsedTime(prev => prev + 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, elapsedTime]);

  // --- TIMER 2: The Multiplier Combo Drain ---
  useEffect(() => {
    if (phase !== 'sprint' || multiplier === 1) return; 

    if (tierTimeLeft <= 0) {
       setMultiplier(m => (m === 3 ? 2 : 1) as 3 | 2 | 1);
       setTierTimeLeft(60);
       return;
    }

    const timer = setTimeout(() => {
      setTierTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, multiplier, tierTimeLeft]);

  const handleAnswer = (answer: string) => {
    if (!currentQuestion || feedback !== null) return; 
    
    setSelectedOption(answer);
    const isCorrect = answer === currentQuestion.correct_answer;
    setTotalQuestionsAnswered(prev => prev + 1);

    const newAsked = new Set(askedQuestionIds).add(currentQuestion.id);
    setAskedQuestionIds(newAsked);

    if (isCorrect) {
      setFeedback('correct');
      setCorrectAnswers(prev => prev + 1);

      if (multiplier > 1) {
        setBarStatus('surge');
        setTierTimeLeft(prev => Math.min(60, prev + 5)); 
        setTimeout(() => setBarStatus('normal'), 400);
      }

      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 }, colors: ['#34d399', '#10b981', '#ffffff'] });

      setTimeout(() => {
        if (activeLevel >= 5) {
          handleFinishSprint();
          return;
        }
        const nextLevel = activeLevel + 1;
        let nextDiff = activeDifficulty;
        if (isFirstAttemptAtLevel) nextDiff = Math.min(5, activeDifficulty + 1);

        setActiveLevel(nextLevel);
        setActiveDifficulty(nextDiff);
        setIsFirstAttemptAtLevel(true); 
        
        fetchNextQuestion(nextLevel, nextDiff, newAsked);
        setFeedback(null);
        setSelectedOption(null);
      }, 800);

    } else {
      setFeedback('wrong');

      if (multiplier > 1) {
        setBarStatus('damage');
        setTierTimeLeft(prev => Math.max(0, prev - 3)); 
        setShatterTrigger(Date.now()); 
        setTimeout(() => setBarStatus('normal'), 400);
      }
      
      setTimeout(() => {
        const nextDiff = Math.max(1, activeDifficulty - 1); 
        setActiveDifficulty(nextDiff);
        setIsFirstAttemptAtLevel(false); 
        
        fetchNextQuestion(activeLevel, nextDiff, newAsked);
        setFeedback(null);
        setSelectedOption(null);
      }, 1000);
    }
  };

  const stableOnCompleteRef = useRef(onComplete);
  useEffect(() => { stableOnCompleteRef.current = onComplete; }, [onComplete]);

  const handleFinishSprint = () => {
    setPhase('results');
    confetti({ particleCount: 250, spread: 100, origin: { y: 0.5 }, colors: ['#3b82f6', '#8b5cf6', '#10b981'] });
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const finalScore = Math.round((correctAnswers / totalQuestionsAnswered) * 100) || 0;
    stableOnCompleteRef.current({ score: finalScore, timeTaken, maxLevel: activeLevel, multiplier });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center p-8 md:p-14 bg-white/70 backdrop-blur-2xl border border-white rounded-[48px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden h-full min-h-[500px] w-full max-w-2xl mx-auto">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}
          className="w-28 h-28 rounded-[36px] bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center mb-10 shadow-2xl shadow-blue-500/30"
        >
          <Zap size={56} fill="currentColor" />
        </motion.div>
        <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900 mb-4 text-center leading-[0.9]">
          Knowledge <span className="text-blue-600">Uplink</span>
        </h2>
        <p className="text-slate-500 text-center max-w-sm mb-12 text-sm leading-relaxed font-semibold">
          Prove your logic to clear this sector. Answering quickly fuels your <span className="text-blue-600 font-bold">Uplink Multiplier</span>. Don't let it run out!
        </p>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={startSprint}
          className="group px-12 py-6 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest flex items-center gap-3 shadow-[0_20px_40px_-10px_rgba(15,23,42,0.4)] text-sm"
        >
          <Play size={20} className="fill-white" /> Start Sprint
        </motion.button>
      </div>
    );
  }

  if (phase === 'results') {
    const accuracy = Math.round((correctAnswers / totalQuestionsAnswered) * 100) || 0;
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);

    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="bg-white/80 backdrop-blur-2xl border border-white rounded-[48px] p-8 md:p-14 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.1)] w-full max-w-2xl mx-auto flex flex-col justify-center">
        <div className="w-32 h-32 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-[40px] flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/30">
          <Trophy size={60} strokeWidth={1.5} />
        </div>
        <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-slate-900 mb-2 leading-none">
          Sector <span className="text-emerald-500">Cleared</span>
        </h2>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-12">Matrix Routing Complete</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-slate-100 rounded-[32px] p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Accuracy</p>
            <p className="text-4xl font-black italic text-slate-900">{accuracy}%</p>
          </div>
          <div className="bg-white border-2 border-slate-100 rounded-[32px] p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center justify-center gap-1.5"><Clock size={12}/> Time</p>
            <p className="text-4xl font-black italic text-slate-900">{formatTime(timeTaken)}</p>
          </div>
          <div className={`col-span-2 md:col-span-1 border-2 rounded-[32px] p-6 flex flex-col justify-center shadow-inner relative overflow-hidden ${
              multiplier === 3 ? 'bg-blue-50 border-blue-200' : multiplier === 2 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={64} fill="currentColor" className={multiplier === 3 ? 'text-blue-500' : multiplier === 2 ? 'text-emerald-500' : 'text-slate-500'}/></div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 relative z-10 ${multiplier === 3 ? 'text-blue-600' : multiplier === 2 ? 'text-emerald-600' : 'text-slate-500'}`}>Speed Bonus</p>
            <p className={`text-4xl font-black italic relative z-10 ${multiplier === 3 ? 'text-blue-600' : multiplier === 2 ? 'text-emerald-600' : 'text-slate-500'}`}>{multiplier}x</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const is3x = multiplier === 3;
  const is2x = multiplier === 2;
  const barPercentage = multiplier === 1 ? 100 : (tierTimeLeft / 60) * 100;

  // DYNAMIC BORDER COLOR
  const cardBorderClass = 
    is3x ? 'border-purple-200' : 
    is2x ? 'border-emerald-200' : 
    'border-slate-200';

  return (
    <div className="w-full h-full flex flex-col mx-auto relative max-w-4xl pt-2">
      
      {/* HUD HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 px-2 md:px-0">
        <div className="flex-1 max-w-[250px]">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={16} className="text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Matrix Level</span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div 
                key={lvl} 
                className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${
                  lvl < activeLevel ? 'bg-blue-400' : 
                  lvl === activeLevel ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 
                  'bg-slate-200'
                }`} 
              />
            ))}
          </div>
        </div>
        
        <div className="w-full md:w-auto md:min-w-[340px] relative">
          <div className="flex justify-between items-end mb-2 px-1">
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 ${
              is3x ? 'text-purple-600' : is2x ? 'text-emerald-600' : 'text-slate-500'
            }`}>
              <Flame size={12} fill="currentColor" className={multiplier > 1 ? 'animate-pulse' : ''}/> 
              {is3x ? 'Overdrive Core' : is2x ? 'Optimal Core' : 'Base Core'}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black tabular-nums tracking-widest text-slate-400 border border-slate-200 rounded-lg px-2 py-0.5">
                {formatTime(elapsedTime)}
              </span>
              <span className={`text-xl font-black italic leading-none transition-colors duration-500 ${
                is3x ? 'text-purple-600' : is2x ? 'text-emerald-600' : 'text-slate-500'
              }`}>{multiplier}x</span>
            </div>
          </div>
          
          <div className={`h-6 rounded-full overflow-visible border-2 relative transition-colors duration-500 z-20 ${
              is3x ? 'bg-purple-50 border-purple-200' : is2x ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
          }`}>
            <motion.div 
              className={`h-full relative rounded-full ${
                is3x ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 
                is2x ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 
                'bg-slate-400'
              } ${barStatus === 'surge' ? 'brightness-150' : barStatus === 'damage' ? 'bg-rose-500' : ''}`}
              animate={{ width: `${barPercentage}%` }}
              transition={{ type: "tween", ease: "linear", duration: barStatus === 'normal' ? 1 : 0.2 }}
            >
               {multiplier > 1 && (
                 <div className="absolute top-0 bottom-0 left-0 w-full bg-gradient-to-b from-white/30 to-transparent rounded-full" />
               )}

                <AnimatePresence>
                  {shatterTrigger > 0 && (
                    <div className="absolute right-0 top-full pointer-events-none z-50">
                      {[...Array(15)].map((_, i) => {
                        const randomX = `${(Math.random() - 0.5) * 30}vw`; 
                        const randomY = `${Math.random() * 25 + 30}vh`; 
                        const randomRot = (Math.random() - 0.5) * 720;
                        const startScale = Math.random() * 1.5 + 0.8;
                        
                        return (
                          <motion.div
                            key={`${shatterTrigger}-${i}`}
                            initial={{ opacity: 1, x: 0, y: 0, scale: startScale, rotate: 0 }}
                            animate={{ opacity: 0, x: randomX, y: randomY, rotate: randomRot, scale: 0.2 }}
                            transition={{ duration: 0.9, ease: "easeIn" }}
                            className="absolute w-5 h-5 bg-rose-500 rounded-[3px] shadow-2xl backdrop-blur-sm border border-rose-400"
                            style={{ left: `${Math.random() * 20 - 10}px` }}
                          />
                        );
                      })}
                    </div>
                  )}
                </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* QUESTION CARD WITH DYNAMIC PULSATING GLOW */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentQuestion?.id}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          
          // DYNAMIC ANIMATION: Merges the entrance animation with the continuous breathing glow
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            boxShadow: is3x 
              ? ["0px 0px 40px -10px rgba(139,92,246,0.3)", "0px 0px 100px 10px rgba(139,92,246,0.6)", "0px 0px 40px -10px rgba(139,92,246,0.3)"] 
              : is2x 
              ? ["0px 0px 40px -10px rgba(16,185,129,0.3)", "0px 0px 80px 5px rgba(16,185,129,0.5)", "0px 0px 40px -10px rgba(16,185,129,0.3)"] 
              : ["0px 20px 60px -15px rgba(0,0,0,0.05)", "0px 20px 60px -15px rgba(0,0,0,0.05)", "0px 20px 60px -15px rgba(0,0,0,0.05)"]
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          
          // TRANSITION: Controls the entry speed AND the infinite loop speed of the glow
          transition={{ 
            opacity: { duration: 0.3 },
            y: { type: "spring", stiffness: 300, damping: 25 },
            scale: { type: "spring", stiffness: 300, damping: 25 },
            boxShadow: { 
              repeat: Infinity, 
              duration: is3x ? 1.2 : 2.5, // 3x pulses fast (1.2s), 2x breathes slow (2.5s)
              ease: "easeInOut" 
            }
          }}
          className={`bg-white/80 backdrop-blur-xl border-2 rounded-[40px] p-6 md:p-12 relative overflow-hidden flex-1 flex flex-col justify-center z-10 transition-colors duration-700 ${cardBorderClass}`}
        >
          <div className="absolute top-6 right-8 flex gap-1.5">
             {[1,2,3,4,5].map(d => (
               <div key={d} className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                 d <= activeDifficulty ? (is3x ? 'bg-purple-500' : is2x ? 'bg-emerald-500' : 'bg-slate-400') : 'bg-slate-200'
               }`} />
             ))}
          </div>

          <h4 className="text-xl md:text-3xl font-black italic tracking-tight text-slate-900 leading-tight mb-10 text-center max-w-2xl mx-auto drop-shadow-sm">
            {currentQuestion?.prompt}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {currentQuestion?.parsed_options.map((opt, idx) => {
              
              const baseStyle = "bg-white border-slate-200 border-b-[6px] text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:-translate-y-1"; 
              const activeStyle = "active:border-b-2 active:translate-y-[4px] active:bg-slate-50"; 
              
              let btnStyle = `${baseStyle} ${activeStyle}`;
              
              if (feedback) {
                if (opt === currentQuestion.correct_answer) {
                  btnStyle = "bg-emerald-50 text-emerald-700 border-emerald-500 border-b-2 translate-y-[4px] shadow-[0_0_30px_rgba(16,185,129,0.3)] z-10"; 
                } else if (opt === selectedOption) {
                  btnStyle = "bg-rose-50 text-rose-700 border-rose-500 border-b-2 translate-y-[4px]"; 
                } else {
                  btnStyle = "bg-slate-100 border-slate-200 text-slate-400 border-b-2 translate-y-[4px] opacity-50"; 
                }
              }

              return (
                <button
                  key={idx}
                  disabled={feedback !== null}
                  onClick={() => handleAnswer(opt)}
                  className={`relative w-full p-6 md:p-8 rounded-[24px] border-2 font-black text-base md:text-lg transition-all duration-150 flex items-center justify-between group ${btnStyle} ${feedback === 'wrong' && opt === selectedOption ? 'animate-shake' : ''}`}
                >
                  <span className="flex-1 pr-4 leading-snug text-left">{opt}</span>
                  {feedback === 'correct' && opt === currentQuestion.correct_answer && <CheckCircle2 size={24} className="shrink-0 text-emerald-500" />}
                  {feedback === 'wrong' && opt === selectedOption && <XCircle size={24} className="shrink-0 text-rose-500" />}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}