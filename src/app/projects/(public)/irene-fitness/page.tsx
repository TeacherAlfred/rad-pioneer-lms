'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const GRADES = ['R', '1', '2', '3', '4', '5', '6', '7'];
const MAX_CHILDREN = 6;
const STORY_GROUPS = [1, 2, 3, 4] as const;

type ChildRow = { grade: string; class: string };
type StoryState = {
  motivation: string;
  clubMember: boolean | null;
  clubNames: string;
  shoeCount: number | null;
  bossLevel: string;
  toughest: string;
  proudest: string;
  weirdestFuel: string;
  funniestFail: string;
};
type Step = 'loading' | 'consent' | 'submission' | 'story' | 'story_preview' | 'confirmation';

const SOURCE_MAP: Record<string, string> = {
  paper_qr: 'irene_paper_qr',
  web_direct: 'irene_web_direct',
  gallery_cta: 'irene_gallery_cta',
};

function emptyChild(): ChildRow {
  return { grade: '', class: '' };
}

function emptyStory(): StoryState {
  return {
    motivation: '',
    clubMember: null,
    clubNames: '',
    shoeCount: null,
    bossLevel: '',
    toughest: '',
    proudest: '',
    weirdestFuel: '',
    funniestFail: '',
  };
}

function IreneFitnessPageInner() {
  const searchParams = useSearchParams();
  const consentSource = SOURCE_MAP[searchParams.get('src') || ''] || 'irene_web_direct';

  const [step, setStep] = useState<Step>('loading');
  const [isReturning, setIsReturning] = useState(false);

  const [consentTicked, setConsentTicked] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([emptyChild()]);
  const [updatesOptIn, setUpdatesOptIn] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedName, setConfirmedName] = useState('');

  const [responseId, setResponseId] = useState<string | null>(null);
  const [storyGroup, setStoryGroup] = useState<1 | 2 | 3 | 4>(1);
  const [story, setStory] = useState<StoryState>(emptyStory());
  const [storySaving, setStorySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/irene-fitness/family')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.family) {
          setDisplayName(data.family.display_name || '');
          setWhatsapp(data.family.whatsapp || '');
          setEmail(data.family.email || '');
          setChildren(data.family.children?.length ? data.family.children : [emptyChild()]);
          setResponseId(data.family.response_id || null);
          if (data.family.story) {
            const s = data.family.story;
            setStory({
              motivation: s.motivation || '',
              clubMember: s.club_member ?? null,
              clubNames: s.club_names || '',
              shoeCount: s.shoe_count ?? null,
              bossLevel: s.boss_level_challenge_2026 || '',
              toughest: s.toughest_challenge || '',
              proudest: s.proudest_moment || '',
              weirdestFuel: s.weirdest_fuel || '',
              funniestFail: s.funniest_fail || '',
            });
          }
          setIsReturning(true);
          setConsentTicked(true);
          setStep('submission');
        } else {
          setStep('consent');
        }
      })
      .catch(() => {
        if (!cancelled) setStep('consent');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateChild(index: number, field: keyof ChildRow, value: string) {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addChild() {
    setChildren((prev) => (prev.length >= MAX_CHILDREN ? prev : [...prev, emptyChild()]));
  }

  function removeChild(index: number) {
    setChildren((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const waDigits = whatsapp.replace(/\D/g, '');
  const canSubmit =
    displayName.trim().length > 0 &&
    displayName.trim().length <= 40 &&
    (waDigits.length > 0 || email.trim().length > 0) &&
    children.every((c) => c.grade && c.class.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/irene-fitness/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          consent_source: consentSource,
          display_name: displayName.trim(),
          whatsapp: waDigits || null,
          email: email.trim() || null,
          children,
          consent_updates: updatesOptIn,
          consent_marketing: marketingOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setConfirmedName(data.display_name);
      setResponseId(data.response_id);
      setStoryGroup(1);
      setStep('story');
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function persistLateOptIn(field: 'updates' | 'marketing') {
    if (field === 'updates') setUpdatesOptIn(true);
    else setMarketingOptIn(true);
    try {
      await fetch('/api/irene-fitness/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          consent_source: consentSource,
          display_name: confirmedName || displayName.trim(),
          whatsapp: waDigits || null,
          email: email.trim() || null,
          children,
          consent_updates: field === 'updates' ? true : updatesOptIn,
          consent_marketing: field === 'marketing' ? true : marketingOptIn,
        }),
      });
    } catch {
      // Best-effort — the family record is already saved, this only adds the
      // opt-in on top of it.
    }
  }

  // "Tell Your Story" is entirely optional flavor content (spec §7.5) — best
  // effort, never blocks the flow. Used by both "Skip for now" (whatever's
  // filled so far) and the preview screen's final Submit (everything).
  async function persistStory(next: Step) {
    setStorySaving(true);
    try {
      await fetch('/api/irene-fitness/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_id: responseId,
          motivation: story.motivation.trim() || null,
          club_member: story.clubMember,
          club_names: story.clubNames.trim() || null,
          shoe_count: story.shoeCount,
          boss_level_challenge_2026: story.bossLevel.trim() || null,
          toughest_challenge: story.toughest.trim() || null,
          proudest_moment: story.proudest.trim() || null,
          weirdest_fuel: story.weirdestFuel.trim() || null,
          funniest_fail: story.funniestFail.trim() || null,
        }),
      });
    } catch {
      // Optional content — don't block Confirmation on a failed save.
    } finally {
      setStorySaving(false);
      setStep(next);
    }
  }

  if (step === 'loading') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center text-slate-400 text-sm">Loading…</div>
    );
  }

  const storyAnswers: { label: string; value: string; group: 1 | 2 | 3 | 4 }[] = [];
  if (story.motivation.trim()) storyAnswers.push({ label: 'Why I started', value: story.motivation.trim(), group: 1 });
  if (story.clubMember === true) {
    storyAnswers.push({
      label: 'Fitness club',
      value: story.clubNames.trim() || 'Yes',
      group: 2,
    });
  }
  if (story.shoeCount !== null) {
    storyAnswers.push({ label: 'Pairs of shoes owned', value: String(story.shoeCount), group: 2 });
  }
  if (story.bossLevel.trim()) storyAnswers.push({ label: '2026 "Boss Level" goal', value: story.bossLevel.trim(), group: 3 });
  if (story.toughest.trim()) storyAnswers.push({ label: 'Toughest challenge yet', value: story.toughest.trim(), group: 3 });
  if (story.proudest.trim()) storyAnswers.push({ label: 'Proudest moment', value: story.proudest.trim(), group: 3 });
  if (story.weirdestFuel.trim()) storyAnswers.push({ label: 'Weirdest training fuel', value: story.weirdestFuel.trim(), group: 4 });
  if (story.funniestFail.trim()) storyAnswers.push({ label: 'Funniest fitness fail', value: story.funniestFail.trim(), group: 4 });

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-16">
      {step === 'consent' && (
        <div>
          <h2 className="text-2xl font-black tracking-tight mb-4">Before we start</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            Irene Primary is looking to build a health & wellness fitness community and getting kids active and involved.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            To take part, we just need one thing from you first.
          </p>

          <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={consentTicked}
              onChange={(e) => setConsentTicked(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
            />
            <span className="text-sm leading-relaxed">
              I consent to my response being shown on this platform, under the name I choose to give it
              below. <strong>Nothing about my child</strong> — name, grade, class, or any other detail — is ever
              displayed.
            </span>
          </label>

          <button
            disabled={!consentTicked}
            onClick={() => setStep('submission')}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {step === 'submission' && (
        <div>
          <h2 className="text-2xl font-black tracking-tight mb-1">
            {isReturning ? 'Update your response' : 'Your family\'s response'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {isReturning ? 'Change anything below, then save.' : 'Just a couple of quick things.'}
          </p>

          {/* Public section */}
          <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#0066cc]/10 px-2 py-1 rounded-full">
                Public
              </span>
              <span className="text-xs text-slate-500">Anyone can see this</span>
            </div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Display name</label>
            <input
              type="text"
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sarah or The Smith Family"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
            />
            <p className="text-xs text-slate-400 mt-2">
              This is the only thing anyone sees. You could use a first name, but it&apos;s your choice.
            </p>
          </div>

          {/* Private: children */}
          <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                Private
              </span>
              <span className="text-xs text-slate-500">Never shown to anyone</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              We only use this to work out which class wins the class prize.
            </p>

            {children.map((child, i) => (
              <div key={i} className="flex items-end gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Grade</label>
                  <select
                    value={child.grade}
                    onChange={(e) => updateChild(i, 'grade', e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  >
                    <option value="">Select</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class</label>
                  <input
                    type="text"
                    value={child.class}
                    onChange={(e) => updateChild(i, 'class', e.target.value)}
                    placeholder="e.g. 3A"
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  />
                </div>
                {children.length > 1 && (
                  <button
                    onClick={() => removeChild(i)}
                    aria-label="Remove child"
                    className="mb-1 w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {children.length < MAX_CHILDREN && (
              <button
                onClick={addChild}
                className="text-xs font-bold text-[#0066cc] hover:underline"
              >
                + Add another child
              </button>
            )}
          </div>

          {/* Private: linking */}
          <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                Private
              </span>
              <span className="text-xs text-slate-500">Never displayed publicly</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              We ask for a contact number or email so your response stays as one entry, even if
              you come back and update it later — this is not to sign you up for anything.
            </p>

            <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp number (preferred)</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="e.g. 082 123 4567"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
            />
            <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
            />
            {!waDigits && !email.trim() && (
              <p className="text-xs text-amber-600 mt-2">Please provide at least one of these.</p>
            )}
          </div>

          {/* Two independent opt-ins, deliberately not conflated */}
          <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={updatesOptIn}
              onChange={(e) => setUpdatesOptIn(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
            />
            <span className="text-sm leading-relaxed text-slate-600">
              I&apos;d also like to be notified of next steps in this community initiative.
            </span>
          </label>
          <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
            />
            <span className="text-sm leading-relaxed text-slate-600">
              Also send me RAD Academy&apos;s free guide on turning screen time into a coding skill.
            </span>
          </label>

          {submitError && <p className="text-sm text-red-600 mb-4">{submitError}</p>}

          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          >
            {submitting ? 'Saving…' : isReturning ? 'Save changes' : 'Submit'}
          </button>
        </div>
      )}

      {step === 'story' && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            {STORY_GROUPS.map((g) => (
              <div
                key={g}
                className={`h-1.5 flex-1 rounded-full ${g <= storyGroup ? 'bg-[#0066cc]' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {storyGroup} of 4
          </p>

          {storyGroup === 1 && (
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-2">Tell your story</h2>
              <p className="text-sm text-slate-500 mb-6">
                Optional, but this is what other families will actually read on your card. Two minutes, tops.
              </p>
              <label className="block text-xs font-bold text-slate-700 mb-1">Why did you start exercising?</label>
              <textarea
                value={story.motivation}
                maxLength={150}
                onChange={(e) => setStory((s) => ({ ...s, motivation: e.target.value }))}
                placeholder="e.g. My knees started complaining about stairs"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
              />
            </div>
          )}

          {storyGroup === 2 && (
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-6">Your fitness life</h2>
              <label className="flex items-center justify-between p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-3">
                <span className="text-sm font-medium">Part of a fitness club or gym?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStory((s) => ({ ...s, clubMember: true }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold ${story.clubMember === true ? 'bg-[#0066cc] text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setStory((s) => ({ ...s, clubMember: false, clubNames: '' }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold ${story.clubMember === false ? 'bg-[#0066cc] text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    No
                  </button>
                </div>
              </label>

              {story.clubMember === true && (
                <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Which one(s)?</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={story.clubNames}
                    onChange={(e) => setStory((s) => ({ ...s, clubNames: e.target.value }))}
                    placeholder="e.g. Team Vitality, Planet Fitness"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  />
                </div>
              )}

              <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm">
                <label className="block text-xs font-bold text-slate-700 mb-3">
                  How many pairs of running/gym/hiking shoes do you own?
                </label>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setStory((s) => ({ ...s, shoeCount: s.shoeCount === null ? null : Math.max(0, s.shoeCount - 1) }))}
                    className="w-11 h-11 rounded-full bg-slate-100 text-slate-600 text-xl font-bold"
                  >
                    −
                  </button>
                  <span className="text-3xl font-black tabular-nums w-12 text-center">
                    {story.shoeCount === null ? '–' : story.shoeCount}
                  </span>
                  <button
                    onClick={() => setStory((s) => ({ ...s, shoeCount: s.shoeCount === null ? 1 : Math.min(50, s.shoeCount + 1) }))}
                    className="w-11 h-11 rounded-full bg-slate-100 text-slate-600 text-xl font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {storyGroup === 3 && (
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-6">Your story</h2>
              {[
                { key: 'bossLevel' as const, label: "What's your ultimate \"Boss Level\" race or health goal for 2026?", placeholder: 'e.g. Finishing my first Comrades / Losing 15kg' },
                { key: 'toughest' as const, label: "What's the toughest health or fitness challenge you've ever done?", placeholder: 'e.g. Hiking for 5km / Two Oceans in the rain, 2023' },
                { key: 'proudest' as const, label: "What's your proudest moment during your health and fitness journey?", placeholder: "e.g. Crossing the line when I wanted to quit" },
              ].map((f) => (
                <div key={f.key} className="mb-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={story[f.key]}
                    onChange={(e) => setStory((s) => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  />
                </div>
              ))}
            </div>
          )}

          {storyGroup === 4 && (
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-6">Just for fun</h2>
              {[
                { key: 'weirdestFuel' as const, label: "What's the weirdest thing you eat or drink while training/racing or for your diet?", placeholder: "e.g. Pickle juice, don't ask" },
                { key: 'funniestFail' as const, label: "What's the funniest or most embarrassing health and fitness fail?", placeholder: 'e.g. Ran 5km before realising my shoes were on the wrong feet' },
              ].map((f) => (
                <div key={f.key} className="mb-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={story[f.key]}
                    onChange={(e) => setStory((s) => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            {storyGroup > 1 && (
              <button
                onClick={() => setStoryGroup((g) => (g - 1) as 1 | 2 | 3 | 4)}
                className="px-5 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-100 text-slate-500"
              >
                Back
              </button>
            )}
            <button
              disabled={(storyGroup === 1 && !story.motivation.trim()) || storySaving}
              onClick={() => (storyGroup === 4 ? setStep('story_preview') : setStoryGroup((g) => (g + 1) as 1 | 2 | 3 | 4))}
              className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              {storyGroup === 4 ? 'Review' : 'Continue'}
            </button>
          </div>
          <button
            onClick={() => (storyGroup === 4 ? setStep('story_preview') : setStoryGroup((g) => (g + 1) as 1 | 2 | 3 | 4))}
            className="w-full mt-3 py-3 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Skip for now
          </button>
        </div>
      )}

      {step === 'story_preview' && (
        <div>
          <h2 className="text-2xl font-black tracking-tight mb-1">This is your card</h2>
          <p className="text-sm text-slate-500 mb-6">Exactly how families will see it once voting opens.</p>

          <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-6">
            <p className="font-black text-lg mb-3">{displayName.trim() || confirmedName}</p>
            {storyAnswers.length === 0 && (
              <p className="text-sm text-slate-400 italic">No story added — just your name and votes will show.</p>
            )}
            {storyAnswers.map((a, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{a.label}</p>
                  <button
                    onClick={() => {
                      setStoryGroup(a.group);
                      setStep('story');
                    }}
                    className="text-[10px] font-bold text-[#0066cc] hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-sm text-slate-700">{a.value}</p>
              </div>
            ))}
          </div>

          <button
            disabled={storySaving}
            onClick={() => persistStory('confirmation')}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 transition-colors"
          >
            {storySaving ? 'Saving…' : 'Looks good, submit'}
          </button>
        </div>
      )}

      {step === 'confirmation' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center text-3xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-3">Thanks, {confirmedName}!</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-2">
            Your response has been saved. Don&apos;t forget — there are class prizes for Grade
            R–3 and Grade 4–7.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Voting hasn&apos;t opened yet — we&apos;ll share the link and date once it&apos;s live.
          </p>
          {!updatesOptIn && (
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-3 cursor-pointer text-left">
              <input
                type="checkbox"
                onChange={(e) => e.target.checked && persistLateOptIn('updates')}
                className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
              />
              <span className="text-sm leading-relaxed text-slate-600">
                Actually, I&apos;d like to be notified of next steps in this community initiative.
              </span>
            </label>
          )}
          {!marketingOptIn && (
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-black/5 shadow-sm mb-6 cursor-pointer text-left">
              <input
                type="checkbox"
                onChange={(e) => e.target.checked && persistLateOptIn('marketing')}
                className="mt-1 w-5 h-5 accent-[#0066cc] shrink-0"
              />
              <span className="text-sm leading-relaxed text-slate-600">
                Actually, send me RAD Academy&apos;s free guide on turning screen time into a coding skill.
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export default function IreneFitnessPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-24 text-center text-slate-400 text-sm">Loading…</div>}>
      <IreneFitnessPageInner />
    </Suspense>
  );
}
