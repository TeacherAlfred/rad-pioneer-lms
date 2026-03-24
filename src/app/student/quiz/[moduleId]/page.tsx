"use client";

import { useEffect, useState } from "react";
import { 
  ShieldCheck, ShieldAlert, Zap, ArrowRight, Loader2, 
  Terminal, CheckCircle2, XCircle, RotateCcw,
  Sparkles, History
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import confetti from "canvas-confetti";

export default function QuizPlayerPage() {
  const { moduleId } = useParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);
  
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; xpEarned: number } | null>(null);

  const BASE_XP = 100;
  const FLAWLESS_BONUS = 400;
  const PERSISTENCE_BONUS = 150;

  useEffect(() => {
    async function initQuiz() {
      if (!moduleId) return;
      const sessionData = localStorage.getItem("pioneer_session");
      if (!sessionData) { router.push("/login"); return; }
      const localUser = JSON.parse(sessionData);
      setUser(localUser);

      try {
        setLoading(true);
        const mId = Array.isArray(moduleId) ? moduleId[0] : moduleId;
        setActiveModuleId(mId); 

        const { data: mod } = await supabase.from('modules').select('*').eq('id', mId).single();
        if (mod) setModuleData(mod);

        const { data: qData } = await supabase
          .from('quiz_items')
          .select('*')
          .eq('module_id', mId)
          .eq('is_published', true)
          .order('order_index', { ascending: true });
        
        setQuestions(qData || []);

        const { count } = await supabase
          .from('quiz_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('module_id', mId)
          .eq('student_id', localUser.id);
          
        setAttemptCount(count || 0);
      } catch (err) {
        console.error("Initialization Error");
      } finally {
        setLoading(false);
      }
    }
    initQuiz();
  }, [moduleId, router]);

  const handleSelect = (questionId: number, option: string) => {
    if (result) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const submitQuiz = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      alert("Make sure to answer every question before we finish the uplink!");
      return;
    }

    setIsSubmitting(true);
    let correctCount = 0;

    questions.forEach(q => {
      const correctAnswers = Array.isArray(q.answer) ? q.answer : JSON.parse(q.answer);
      if (correctAnswers.includes(selectedAnswers[q.id])) {
        correctCount++;
      }
    });

    const score = (correctCount / questions.length) * 100;
    const passed = score === 100;
    
    let xpEarned = 0;
    const currentAttempt = attemptCount + 1;

    if (passed) {
      if (currentAttempt === 1) xpEarned = BASE_XP + FLAWLESS_BONUS;
      else if (currentAttempt === 2) xpEarned = BASE_XP + PERSISTENCE_BONUS;
      else xpEarned = BASE_XP;
    }

    try {
      const { error: insertErr } = await supabase.from('quiz_attempts').insert({
        student_id: user.id,
        module_id: activeModuleId, 
        attempt_number: currentAttempt,
        score: score,
        total_questions: questions.length,
        passed: passed
      });

      if (insertErr) {
        console.error("Database Insert Error:", insertErr.message);
        alert("System error saving results. Please contact the Director.");
        setIsSubmitting(false);
        return;
      }

      if (passed) {
        const newXP = (user.xp || 0) + xpEarned;
        await supabase.from('profiles').update({ xp: newXP }).eq('id', user.id);
        
        // ---------- NEW ARCHITECTURE FIX ----------
        // Wipe the active_task pointer so the dashboard is forced to recalculate 
        // and find the next mission!
        await supabase.from('enrollments').update({ active_task: null }).eq('student_id', user.id);
        // ------------------------------------------

        localStorage.setItem("pioneer_session", JSON.stringify({ ...user, xp: newXP }));
        confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
      }
      setResult({ passed, score, xpEarned });
      setAttemptCount(currentAttempt);
    } catch (err) {
      console.error("Save Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (!questions.length) return <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-white"><ShieldAlert size={48} className="text-yellow-500 mb-4" /><h1 className="text-2xl font-black uppercase">Checkpoint Offline</h1><Link href="/student/courses" className="mt-4 px-6 py-2 bg-white text-black rounded-lg font-bold">Return to Roadmap</Link></div>;

  const currentQ = questions[currentIndex];
  const options = Array.isArray(currentQ.options) ? currentQ.options : JSON.parse(currentQ.options);

  return (
    <main className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-3xl w-full space-y-8 relative z-10">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Terminal size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Pioneer_Checkpoint</span>
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter">{moduleData?.title}</h1>
          {!result && <p className="text-sm font-mono text-slate-400">Sequence Progress: {currentIndex + 1} / {questions.length}</p>}
        </header>

        {!result ? (
          <div className="bg-white/[0.02] border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl backdrop-blur-sm space-y-10 text-left">
            <h2 className="text-2xl font-bold leading-relaxed">{currentQ.question}</h2>
            <div className="grid gap-4">
              {options.map((opt: string, idx: number) => {
                const isSelected = selectedAnswers[currentQ.id] === opt;
                return (
                  <button key={idx} onClick={() => handleSelect(currentQ.id, opt)} className={`p-6 text-left rounded-2xl border-2 transition-all font-medium ${isSelected ? 'border-blue-500 bg-blue-500/10 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-white/5 bg-black/40 text-slate-300 hover:border-white/20 hover:bg-white/5'}`}>{opt}</button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-white/5">
              <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-400 hover:text-white disabled:opacity-30 transition-all">Back</button>
              {currentIndex === questions.length - 1 ? (
                <button onClick={submitQuiz} disabled={isSubmitting || Object.keys(selectedAnswers).length < questions.length} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-500 text-black font-black uppercase tracking-widest text-xs hover:scale-105 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20">{isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Finalize Uplink</button>
              ) : (
                <button onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))} disabled={!selectedAnswers[currentQ.id]} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs hover:scale-105 disabled:opacity-50 transition-all">Next Task <ArrowRight size={16} /></button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className={`p-12 text-center border-b ${result.passed ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
              <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6 border-4 ${result.passed ? 'border-green-400 bg-green-400/20 text-green-400' : 'border-yellow-500 bg-yellow-500/20 text-yellow-500'}`}>
                {result.passed ? <ShieldCheck size={48} /> : <History size={48} />}
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2">
                {result.passed ? 'Level Unlocked!' : 'Almost There, Director!'}
              </h2>
              <p className="text-slate-400 font-mono text-sm max-w-md mx-auto text-center">
                {result.passed 
                  ? "Great job! Your logic is airtight and your skills are verified." 
                  : "Even the world's best game developers have to debug! Let's check your logs and try one more time to get that 100% score."}
              </p>
              
              {result.passed && (
                <div className="mt-8 inline-flex items-center gap-4 bg-black/40 border border-yellow-500/30 px-6 py-4 rounded-3xl mx-auto">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500"><Zap size={24} fill="currentColor" /></div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">{attemptCount === 1 ? 'Flawless Execution!' : attemptCount === 2 ? 'Persistence Bonus!' : 'Base Reward'}</p><p className="text-2xl font-black italic">+{result.xpEarned} XP</p></div>
                </div>
              )}
            </div>

            <div className="p-8 space-y-6 bg-black/40 text-left max-h-[400px] overflow-y-auto">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                {result.passed ? <Sparkles size={14} /> : <Terminal size={14} />} Session Logs
              </h3>
              
              {questions.map((q) => {
                const correctAnswers = Array.isArray(q.answer) ? q.answer : JSON.parse(q.answer);
                const isCorrect = correctAnswers.includes(selectedAnswers[q.id]);
                
                return (
                  <div key={q.id} className={`p-6 rounded-2xl border transition-all ${isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex items-start gap-4">
                      {isCorrect ? <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-1" /> : <XCircle size={18} className="text-red-400 shrink-0 mt-1" />}
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-white">{q.question}</p>
                        <p className={`text-xs font-medium ${isCorrect ? 'text-green-400' : 'text-red-300'}`}>
                          Your Input: {selectedAnswers[q.id]}
                        </p>
                        {!isCorrect && (
                          <div className="text-sm text-blue-300 bg-blue-500/10 p-4 rounded-xl mt-3 border border-blue-500/20 leading-relaxed">
                            <span className="font-black uppercase text-[10px] tracking-widest mb-1 block text-blue-400">Director's Hint</span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-8 text-center bg-black/60">
              <button 
                onClick={() => {
                  if (result.passed) { router.push('/student/courses'); } 
                  else { setResult(null); setCurrentIndex(0); setSelectedAnswers({}); }
                }} 
                className={`flex items-center justify-center gap-3 w-full py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${result.passed ? 'bg-white text-black hover:scale-[1.02]' : 'bg-blue-500 text-black hover:scale-[1.02] shadow-xl shadow-blue-500/20'}`}
              >
                {result.passed ? <>Complete Checkpoint <ArrowRight size={16} /></> : <>Reboot System & Try Again <RotateCcw size={16} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}