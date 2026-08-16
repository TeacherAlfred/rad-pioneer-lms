"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ENJOYMENT_FACES, DIFFICULTY_OPTIONS, COMPLETION_OPTIONS, WANTS_MORE_OPTIONS } from "@/lib/sessionReview";

type RosterKid = { id: string; name: string; completed: boolean };
type SessionInfo = { id: string; starts_at: string | null; programs: { id: string; code: string; name: string } | null };

const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;
type QuestionKey = typeof QUESTIONS[number];

type Answers = {
  enjoyment: number | null;
  built_text: string;
  difficulty: string;
  completion: string;
  wants_more: string;
  open_text: string;
};

const emptyAnswers = (): Answers => ({ enjoyment: null, built_text: '', difficulty: '', completion: '', wants_more: '', open_text: '' });

const BIG_TAP = "w-full py-5 rounded-3xl text-[17px] font-medium transition-all duration-150 active:scale-[0.98]";

export default function KioskPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const remindedStudentId = searchParams.get('student');

  const [mode, setMode] = useState<'loading' | 'error' | 'picker' | 'intro' | 'flow' | 'done'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [roster, setRoster] = useState<RosterKid[]>([]);
  const [activeChild, setActiveChild] = useState<RosterKid | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());
  const [saving, setSaving] = useState(false);

  async function load() {
    setMode('loading');
    try {
      const res = await fetch(`/api/kiosk/${token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'This link could not be loaded.');
      setSession(data.session);
      setRoster(data.roster);
      // A "Remind" tap from the admin's Reviews Status Panel deep-links
      // straight to that child's form instead of the roster picker.
      const remindedKid = remindedStudentId ? (data.roster as RosterKid[]).find(k => k.id === remindedStudentId) : null;
      if (remindedKid) {
        pickChild(remindedKid);
      } else {
        setMode('picker');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setMode('error');
    }
  }

  useEffect(() => { load(); }, [token]);

  function pickChild(kid: RosterKid) {
    setActiveChild(kid);
    setAnswers(emptyAnswers());
    setQIndex(0);
    setMode('intro');
  }

  async function save(patch: Partial<Answers>, complete = false) {
    if (!activeChild) return;
    setSaving(true);
    try {
      await fetch(`/api/kiosk/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: activeChild.id, patch, complete, device_context: 'kiosk' }),
      });
    } catch {
      // best-effort autosave - a network hiccup shouldn't block the child mid-flow
    } finally {
      setSaving(false);
    }
  }

  function selectAndAdvance(field: keyof Answers, value: any) {
    const next = { ...answers, [field]: value };
    setAnswers(next);
    save({ [field]: value } as Partial<Answers>);
    setTimeout(() => {
      if (qIndex < QUESTIONS.length - 1) setQIndex(i => i + 1);
      else finish(next);
    }, 280);
  }

  async function finish(finalAnswers: Answers) {
    await save({ open_text: finalAnswers.open_text }, true);
    setRoster(prev => prev.map(k => k.id === activeChild?.id ? { ...k, completed: true } : k));
    setMode('done');
    setTimeout(() => resetToPicker(), 3500);
  }

  function resetToPicker() {
    setActiveChild(null);
    setAnswers(emptyAnswers());
    setQIndex(0);
    setMode('picker');
  }

  // ---------------- render ----------------

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-300" size={28} />
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="h-14 w-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Link not available</h1>
          <p className="text-[15px] text-slate-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (mode === 'picker') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="max-w-md w-full mx-auto px-6 pt-14 pb-10 flex-1">
          <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight leading-tight">
            {session?.programs?.name || 'Today\'s Session'}
          </h1>
          <p className="text-[15px] text-slate-500 mt-2">Tap your name to tell us how it went!</p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {roster.map(kid => (
              <button
                key={kid.id}
                onClick={() => pickChild(kid)}
                className={`relative py-6 rounded-3xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.97] ${
                  kid.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-800'
                }`}
              >
                {kid.completed && <CheckCircle2 size={16} className="absolute top-2.5 right-2.5 text-emerald-500" />}
                {kid.name}
              </button>
            ))}
          </div>

          {roster.length === 0 && (
            <p className="text-[14px] text-slate-400 mt-8 text-center">No one's on this session's roster yet.</p>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'intro' && activeChild) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="text-[48px] mb-4">🎉</div>
        <h1 className="text-[24px] font-semibold text-slate-900">Nice work today, {activeChild.name}!</h1>
        <p className="text-[15px] text-slate-500 mt-3 max-w-xs leading-relaxed">
          Tell us how it went - there are no wrong answers, and this isn't marked. It helps us make the next one better.
        </p>
        <button onClick={() => setMode('flow')} className="mt-8 w-full max-w-xs py-4 rounded-2xl text-[16px] font-medium text-white bg-slate-900 active:scale-[0.98] transition-transform duration-150">
          Let's go
        </button>
      </div>
    );
  }

  if (mode === 'done') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6">
          <CheckCircle2 size={30} />
        </div>
        <h1 className="text-[22px] font-semibold text-slate-900">Thanks, {activeChild?.name}!</h1>
        <p className="text-[15px] text-slate-500 mt-2">Next person's turn.</p>
        <button onClick={resetToPicker} className="mt-8 w-full max-w-xs py-4 rounded-2xl text-[16px] font-medium text-white bg-slate-900">
          Done
        </button>
      </div>
    );
  }

  // flow
  const q = QUESTIONS[qIndex];
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="shrink-0 px-6 pt-6">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-slate-900 rounded-full transition-all duration-300" style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto">
        {q === 'q1' && (
          <div>
            <h2 className="text-[22px] font-semibold text-slate-900 text-center mb-8">How was today?</h2>
            <div className="flex justify-between gap-2">
              {ENJOYMENT_FACES.map(f => (
                <button
                  key={f.value}
                  onClick={() => selectAndAdvance('enjoyment', f.value)}
                  className="flex-1 aspect-square rounded-3xl bg-slate-50 text-[36px] flex items-center justify-center active:scale-90 transition-transform duration-150"
                >
                  {f.emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {q === 'q2' && (
          <div>
            <h2 className="text-[22px] font-semibold text-slate-900 text-center mb-2">What did you build or learn?</h2>
            <p className="text-[14px] text-slate-400 text-center mb-6">Totally optional</p>
            <textarea
              value={answers.built_text}
              onChange={e => setAnswers(a => ({ ...a, built_text: e.target.value }))}
              placeholder="I made a..."
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-5 py-4 text-[17px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
            />
            <button
              onClick={() => { save({ built_text: answers.built_text }); setQIndex(i => i + 1); }}
              className={`${BIG_TAP} bg-slate-900 text-white mt-6`}
            >
              {answers.built_text.trim() ? 'Next' : 'Skip'}
            </button>
          </div>
        )}

        {q === 'q3' && (
          <div>
            <h2 className="text-[22px] font-semibold text-slate-900 text-center mb-8">How hard was it?</h2>
            <div className="space-y-3">
              {DIFFICULTY_OPTIONS.map(opt => (
                <button key={opt} onClick={() => selectAndAdvance('difficulty', opt)} className={`${BIG_TAP} bg-slate-50 text-slate-800`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {q === 'q4' && (
          <div>
            <h2 className="text-[22px] font-semibold text-slate-900 text-center mb-8">Did you finish what you were working on?</h2>
            <div className="space-y-3">
              {COMPLETION_OPTIONS.map(opt => (
                <button key={opt} onClick={() => selectAndAdvance('completion', opt)} className={`${BIG_TAP} bg-slate-50 text-slate-800`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {q === 'q5' && (
          <div>
            <h2 className="text-[22px] font-semibold text-slate-900 text-center mb-8">Do you want to do more of this?</h2>
            <div className="space-y-3">
              {WANTS_MORE_OPTIONS.map(opt => (
                <button key={opt} onClick={() => selectAndAdvance('wants_more', opt)} className={`${BIG_TAP} bg-slate-50 text-slate-800`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {q === 'q6' && (
          <div>
            <h2 className="text-[22px] font-semibold text-slate-900 text-center mb-2">Anything you want to tell us?</h2>
            <p className="text-[14px] text-slate-400 text-center mb-6">Totally optional</p>
            <textarea
              value={answers.open_text}
              onChange={e => setAnswers(a => ({ ...a, open_text: e.target.value }))}
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-5 py-4 text-[17px] text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
            />
            <button
              disabled={saving}
              onClick={() => finish({ ...answers })}
              className={`${BIG_TAP} bg-slate-900 text-white mt-6 disabled:opacity-50`}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
