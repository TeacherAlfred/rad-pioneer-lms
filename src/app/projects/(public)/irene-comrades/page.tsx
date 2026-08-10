'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Heart, X, Search, Sparkles, MessageCircle, Mail, Loader2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Zap, Share2, Users, Laugh,
  FlaskConical, Check, Medal, GraduationCap, KeyRound
} from 'lucide-react';
import confetti from 'canvas-confetti';

const FOUNDATION_GRADES = ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3'];
const SENIOR_GRADES = ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];

const CATEGORIES = [
  { key: 'inspiring', label: 'Most Inspiring', shortLabel: 'Inspiring', icon: Heart, color: '#0066cc' },
  { key: 'oopsie', label: 'Epic Oopsie', shortLabel: 'Oopsie', icon: Laugh, color: '#f59e0b' },
  { key: 'weird', label: 'Mad Scientist', shortLabel: 'Weird', icon: FlaskConical, color: '#8b5cf6' },
] as const;
type CategoryKey = typeof CATEGORIES[number]['key'];

const TIER_WEIGHTS: Record<string, number> = { anonymous: 1, email: 5, whatsapp: 15 };
const TIER_RANK: Record<string, number> = { anonymous: 0, email: 1, whatsapp: 2 };
const DAILY_TAP_CAP = 30;

// This year's race is an Up Run: Durban → Pietermaritzburg.
// Landmarks + fun facts are approximate/well-known ones — exact km markers
// shift slightly year to year with the official route.
const MILESTONES = [
  { km: 0, label: 'Durban', fact: "The race starts outside Durban City Hall — sent off by a recording of a cockerel crow and 'Chariots of Fire', a tradition since the 1970s." },
  { km: 8, label: 'Cowies Hill', fact: "The first of the legendary 'Big Five' hills runners face on the Up Run." },
  { km: 16, label: 'Fields Hill', fact: 'One of the steepest climbs on the route — famous for wrecking quads on the Down Run and lungs on the Up Run.' },
  { km: 30, label: "Botha's Hill", fact: 'One of the best-loved spectator spots on the whole route — locals turn out in their thousands every year.' },
  { km: 45, label: 'Drummond', fact: "Roughly the halfway mark. Nearby Arthur's Seat is where runners doff their caps to honour 5-time winner Arthur Newton — legend says it brings good luck." },
  { km: 51, label: 'Inchanga', fact: "The third of the Big Five hills — its Zulu name roughly translates to 'the hill that moves'." },
  { km: 60, label: 'Cato Ridge', fact: 'Many veteran runners say the real race only begins once you’re through Cato Ridge.' },
  { km: 68, label: 'Camperdown', fact: 'Home to one of the last major refreshment stations before the final push into Pietermaritzburg.' },
  { km: 83, label: 'Polly Shortts', fact: 'The final and most feared of the Big Five — it hits just 7km from the finish, when legs have nothing left to give.' },
  { km: 90, label: 'Pietermaritzburg', fact: 'Runners finish at Scottsville Racecourse — crossing the line within 12 hours earns the coveted Comrades medal.' },
];

// Maps each category to its underlying schema field(s). "Most Inspiring" draws
// on two separate questions — both are shown, labelled, when answered.
function categoryContent(response: any, category: CategoryKey): { label: string; text: string }[] {
  if (category === 'inspiring') {
    const parts: { label: string; text: string }[] = [];
    if (response.q_why_start) parts.push({ label: 'Why they started', text: response.q_why_start });
    if (response.q_boss_level) parts.push({ label: 'Their next goal', text: response.q_boss_level });
    return parts.length ? parts : [{ label: '', text: 'No answer provided.' }];
  }
  if (category === 'oopsie') return [{ label: '', text: response.q_funny_fail || 'No answer provided.' }];
  return [{ label: '', text: response.q_weird_habit || 'No answer provided.' }];
}

// Privacy: some records have a full child name on file (e.g. "Mckenzie Moalushi")
// instead of a true initial — never show more than initials publicly. "Mckenzie
// Moalushi" -> "MM", a lone "M" stays "M".
function childInitials(cub: any) {
  const raw = (cub?.cub_initial || '').trim();
  if (!raw) return '?';
  return raw.split(/\s+/).map((part: string) => part[0]?.toUpperCase() || '').join('');
}

function childrenLabel(response: any) {
  return (response.cubs || []).map((c: any) => `${childInitials(c)} · ${c.grade}${c.class_name ? ` (${c.class_name})` : ''}`).join('  •  ');
}

// Privacy: only ever show the parent's first name publicly, never the full name on file.
function firstName(response: any) {
  return (response.parent_first_name || '').trim().split(/\s+/)[0] || 'A Parent';
}

function classKey(cub: any) {
  return `${cub.grade || '?'}::${cub.class_name || '?'}`;
}

function TrackerContent() {
  const searchParams = useSearchParams();

  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [voters, setVoters] = useState<any[]>([]);

  // --- PHASE STATE (irene_settings, realtime) ---
  const [phase, setPhase] = useState<'setup' | 'educators' | 'parents' | 'closed'>('setup');
  const [educatorVoteWeight, setEducatorVoteWeight] = useState(10);
  const [phaseEndsHint, setPhaseEndsHint] = useState<string | null>(null);

  // --- DEVICE / TIER STATE ---
  const [deviceId, setDeviceId] = useState('');
  const [myVoter, setMyVoter] = useState<any>(null);
  const [dailyTapCount, setDailyTapCount] = useState(0);
  const [tappedKeys, setTappedKeys] = useState<Set<string>>(new Set());
  const [hasSeenUpsell, setHasSeenUpsell] = useState(false);

  // --- EDUCATOR GATE STATE ---
  const [educatorUnlocked, setEducatorUnlocked] = useState(false);
  const [educatorGrade, setEducatorGrade] = useState<string | null>(null);
  const [staffCodeInput, setStaffCodeInput] = useState('');
  const [staffCodeError, setStaffCodeError] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [educatorViewAllGrades, setEducatorViewAllGrades] = useState(false);

  // --- UI/FILTER STATE ---
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<'All' | 'Foundation' | 'Senior'>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('inspiring');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [familySearch, setFamilySearch] = useState('');

  // --- TIER UPSELL MODAL STATE ---
  const [showTierModal, setShowTierModal] = useState(false);
  const [tierTab, setTierTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [contactInput, setContactInput] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // --- REFERRAL STATE ---
  const refResponseId = searchParams.get('ref');
  const [refAcknowledged, setRefAcknowledged] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  useEffect(() => { setCarouselIndex(0); }, [activeCategory, selectedGrade, selectedPhaseFilter]);

  // --- INIT DEVICE, LOCAL ANTI-SPAM STATE, FETCH DATA, SUBSCRIBE ---
  useEffect(() => {
    let storedDeviceId = localStorage.getItem('irene_device_id');
    if (!storedDeviceId) {
      storedDeviceId = 'DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('irene_device_id', storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    const storedDate = localStorage.getItem('irene_tap_date');
    const today = new Date().toDateString();
    if (storedDate !== today) {
      localStorage.setItem('irene_tap_date', today);
      localStorage.setItem('irene_tap_count', '0');
      setDailyTapCount(0);
    } else {
      setDailyTapCount(parseInt(localStorage.getItem('irene_tap_count') || '0', 10));
    }

    try {
      const stored = JSON.parse(localStorage.getItem('irene_tapped_keys') || '[]');
      setTappedKeys(new Set(stored));
    } catch { /* ignore malformed storage */ }

    setHasSeenUpsell(localStorage.getItem('irene_seen_upsell') === 'true');
    setEducatorUnlocked(localStorage.getItem('irene_educator_unlocked') === 'true');
    setEducatorGrade(localStorage.getItem('irene_educator_grade'));

    fetchData();
    fetchSettings();

    const votesChannel = supabase.channel('public:irene_votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'irene_votes' }, () => fetchData())
      .subscribe();

    const settingsChannel = supabase.channel('public:irene_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'irene_settings' }, (payload: any) => {
        setPhase(payload.new.phase);
        setEducatorVoteWeight(payload.new.educator_vote_weight);
        setPhaseEndsHint(payload.new.phase_ends_hint);
      })
      .subscribe();

    return () => { supabase.removeChannel(votesChannel); supabase.removeChannel(settingsChannel); };
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('irene_settings').select('phase, educator_vote_weight, phase_ends_hint').eq('id', 1).single();
    if (data) {
      setPhase(data.phase);
      setEducatorVoteWeight(data.educator_vote_weight);
      setPhaseEndsHint(data.phase_ends_hint);
    }
  };

  const fetchData = async () => {
    try {
      // Explicit column list — media_url is deliberately excluded, response photos are never public.
      const { data: respData } = await supabase
        .from('irene_responses')
        .select('id, parent_first_name, cubs, q_why_start, q_boss_level, q_funny_fail, q_weird_habit, is_verified, needs_name_review')
        .eq('is_verified', true);
      const { data: voteData } = await supabase.from('irene_votes').select('response_id, category, weight, voter_id');
      const { data: voterData } = await supabase.from('irene_voters').select('id, voter_type, voter_group, referred_by_response_id');

      setResponses(respData || []);
      setVotes(voteData || []);
      setVoters(voterData || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // --- DERIVED: AGGREGATION ---
  // Category totals per response (independent leaderboards) and class totals (blended, fans out to every child).
  const categoryTotals: Record<string, Record<CategoryKey, number>> = {};
  const classTotals: Record<string, { grade: string; className: string; total: number }> = {};
  const responsesById: Record<string, any> = {};
  responses.forEach(r => { responsesById[r.id] = r; });

  votes.forEach(v => {
    if (!categoryTotals[v.response_id]) categoryTotals[v.response_id] = { inspiring: 0, oopsie: 0, weird: 0 };
    categoryTotals[v.response_id][v.category as CategoryKey] = (categoryTotals[v.response_id][v.category as CategoryKey] || 0) + v.weight;

    const response = responsesById[v.response_id];
    (response?.cubs || []).forEach((cub: any) => {
      const key = classKey(cub);
      if (!classTotals[key]) classTotals[key] = { grade: cub.grade, className: cub.class_name, total: 0 };
      classTotals[key].total += v.weight;
    });
  });

  const totalForResponse = (id: string) => {
    const t = categoryTotals[id];
    return t ? t.inspiring + t.oopsie + t.weird : 0;
  };

  const totalVotedWeightAllTime = votes.reduce((sum, v) => sum + v.weight, 0);
  const familiesVotedCount = new Set(votes.map(v => v.voter_id)).size;

  // --- DERIVED: FILTERING ---
  const gradeInScope = (grade: string) => {
    if (selectedGrade !== 'All') return grade === selectedGrade;
    if (selectedPhaseFilter === 'Foundation') return FOUNDATION_GRADES.includes(grade);
    if (selectedPhaseFilter === 'Senior') return SENIOR_GRADES.includes(grade);
    return true;
  };

  const filteredResponses = responses.filter(r => (r.cubs || []).some((c: any) => gradeInScope(c.grade)));

  const top5ForCategory = [...filteredResponses]
    .sort((a, b) => (categoryTotals[b.id]?.[activeCategory] || 0) - (categoryTotals[a.id]?.[activeCategory] || 0))
    .filter(r => (categoryTotals[r.id]?.[activeCategory] || 0) > 0)
    .slice(0, 5);
  const activeCarouselItem = top5ForCategory[carouselIndex] || top5ForCategory[0];

  const rosterResponses = filteredResponses
    .filter(r => {
      const q = familySearch.trim().toLowerCase();
      if (!q) return true;
      // Search only matches the parent's FIRST name (never the surname on file), OR a
      // child's INITIALS + grade + class together (never the full name on file, even
      // when one happens to be stored) — not any one of those fields alone.
      if (firstName(r).toLowerCase().includes(q)) return true;
      return (r.cubs || []).some((c: any) => `${childInitials(c)} ${c.grade} ${c.class_name}`.toLowerCase().includes(q));
    })
    .sort((a, b) => totalForResponse(b.id) - totalForResponse(a.id));

  const getTop3Classes = (gradeFilter: string[]) => Object.values(classTotals)
    .filter(c => gradeFilter.includes(c.grade))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const topFoundation = getTop3Classes(FOUNDATION_GRADES);
  const topSenior = getTop3Classes(SENIOR_GRADES);
  const topSpecificGrade = selectedGrade !== 'All' ? getTop3Classes([selectedGrade]) : [];
  const podiumTitle = selectedGrade !== 'All' ? selectedGrade : selectedPhaseFilter === 'Foundation' ? 'Grade R - 3' : selectedPhaseFilter === 'Senior' ? 'Grade 4 - 7' : 'School Overall';

  // --- DERIVED: COMMUNITY CHAMPIONS (top referrers, lead-generating only) ---
  const referrerCounts: Record<string, number> = {};
  voters.forEach(v => {
    if (v.voter_group === 'network' && (v.voter_type === 'email' || v.voter_type === 'whatsapp') && v.referred_by_response_id) {
      referrerCounts[v.referred_by_response_id] = (referrerCounts[v.referred_by_response_id] || 0) + 1;
    }
  });
  const topReferrers = Object.entries(referrerCounts)
    .map(([responseId, count]) => ({ response: responsesById[responseId], count }))
    .filter(r => r.response)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // --- REFERRAL TARGET ---
  const referredResponse = refResponseId ? responsesById[refResponseId] : null;

  // --- VOTER / TIER LOGIC ---
  const getOrCreateVoter = async (explicitTier?: 'email' | 'whatsapp', contactValue?: string) => {
    const { data: existing } = await supabase.from('irene_voters').select('*').eq('device_id', deviceId).maybeSingle();

    if (existing) {
      if (explicitTier && TIER_RANK[explicitTier] > TIER_RANK[existing.voter_type || 'anonymous']) {
        const patch: any = { voter_type: explicitTier };
        if (explicitTier === 'email') patch.email = contactValue;
        if (explicitTier === 'whatsapp') patch.whatsapp_number = contactValue;
        if (refResponseId && !existing.referred_by_response_id) { patch.voter_group = 'network'; patch.referred_by_response_id = refResponseId; }
        const { data: updated, error } = await supabase.from('irene_voters').update(patch).eq('id', existing.id).select().single();
        if (error) throw error;
        setMyVoter(updated);
        return updated;
      }
      setMyVoter(existing);
      return existing;
    }

    const insertPayload: any = {
      device_id: deviceId,
      ip_address: deviceId, // legacy NOT NULL column, kept in sync with device_id
      voter_type: explicitTier || 'anonymous',
      voter_group: refResponseId ? 'network' : 'parent',
      referred_by_response_id: refResponseId || null,
      // Legacy NOT NULL column from the old per-claim model — a device's tier is
      // now permanent for the campaign, so this is just set far in the future.
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    if (explicitTier === 'email') insertPayload.email = contactValue;
    if (explicitTier === 'whatsapp') insertPayload.whatsapp_number = contactValue;

    const { data: created, error } = await supabase.from('irene_voters').insert(insertPayload).select().single();
    if (error) throw error;
    setMyVoter(created);
    return created;
  };

  const persistTappedKey = (key: string) => {
    setTappedKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem('irene_tapped_keys', JSON.stringify([...next]));
      return next;
    });
  };

  const bumpDailyTapCount = () => {
    const next = dailyTapCount + 1;
    setDailyTapCount(next);
    localStorage.setItem('irene_tap_count', next.toString());
  };

  const handleTap = async (response: any, category: CategoryKey, isEducatorTap = false) => {
    const key = `${response.id}::${category}`;
    if (tappedKeys.has(key)) return;
    if (dailyTapCount >= DAILY_TAP_CAP) { alert("You've reached today's voting limit for this device — thank you for your enthusiasm! Come back tomorrow."); return; }

    try {
      const voter = await getOrCreateVoter();
      const weight = isEducatorTap ? educatorVoteWeight : (TIER_WEIGHTS[voter.voter_type] || 1);

      const { error } = await supabase.from('irene_votes').insert({ voter_id: voter.id, response_id: response.id, category, weight });
      if (error) {
        if ((error as any).code === '23505') { persistTappedKey(key); return; } // already voted, just sync local state
        throw error;
      }

      persistTappedKey(key);
      bumpDailyTapCount();
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: [CATEGORIES.find(c => c.key === category)?.color || '#0066cc', '#fbbf24'] });
      fetchData();

      if (!isEducatorTap && !hasSeenUpsell && (voter.voter_type || 'anonymous') === 'anonymous') {
        setHasSeenUpsell(true);
        localStorage.setItem('irene_seen_upsell', 'true');
        setTimeout(() => setShowTierModal(true), 600);
      }

      if (refResponseId === response.id && !refAcknowledged) setRefAcknowledged(true);
    } catch (err: any) {
      console.error(err);
      alert('Something went wrong casting that vote. Please try again.');
    }
  };

  const handleUnlockTier = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!contactInput) { alert('Please enter your details.'); return; }
    setIsUnlocking(true);
    try {
      await getOrCreateVoter(tierTab, contactInput);
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#0066cc', '#fbbf24', '#10b981'] });
      setShowTierModal(false);
      setContactInput('');
    } catch (err: any) {
      alert('Something went wrong. Please try again.');
    } finally { setIsUnlocking(false); }
  };

  const handleVerifyStaffCode = async () => {
    if (!staffCodeInput.trim()) return;
    setIsCheckingCode(true);
    setStaffCodeError('');
    try {
      const res = await fetch('/api/irene/verify-staff-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: staffCodeInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem('irene_educator_unlocked', 'true');
        setEducatorUnlocked(true);
      } else {
        setStaffCodeError('That code doesn\'t look right — double check with the front office.');
      }
    } catch {
      setStaffCodeError('Something went wrong checking that code. Please try again.');
    } finally { setIsCheckingCode(false); }
  };

  const handlePickEducatorGrade = (grade: string) => {
    localStorage.setItem('irene_educator_grade', grade);
    setEducatorGrade(grade);
    setSelectedGrade(grade);
  };

  const handleShare = (response: any) => {
    const url = `${window.location.origin}${window.location.pathname}?ref=${response.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShareId(response.id);
      setTimeout(() => setCopiedShareId(null), 2000);
    }).catch(() => {});
  };

  const kmProgress = Math.min(90, totalVotedWeightAllTime * 0.1);
  const kmPercent = (kmProgress / 90) * 100;

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading Dashboard...</div>;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">

      {/* --- TIER UPSELL MODAL --- */}
      <AnimatePresence>
        {showTierModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] overflow-hidden max-w-sm w-full shadow-2xl relative">
              <button onClick={() => setShowTierModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 p-2 z-10 bg-white rounded-full transition-colors"><X size={20} /></button>
              <div className="p-8 pt-10">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-3 shadow-inner"><Zap size={28} /></div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Multiply Your Impact</h2>
                  <p className="text-xs text-slate-500 mt-1">Every vote you cast from now on counts for more.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                  <button onClick={() => setTierTab('whatsapp')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${tierTab === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}><MessageCircle size={12} /> WhatsApp</button>
                  <button onClick={() => setTierTab('email')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${tierTab === 'email' ? 'bg-white text-[#0066cc] shadow-sm' : 'text-slate-500'}`}><Mail size={12} /> Email</button>
                </div>

                <form onSubmit={handleUnlockTier} className="space-y-4">
                  {tierTab === 'whatsapp' ? (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                      <p className="text-xs text-slate-600 mb-3 text-center">Unlock <b className="text-emerald-600">15x votes</b> + lucky draw entry for 50% off RAD Bootcamp/Term 3.</p>
                      <input type="tel" required placeholder="082 123 4567" value={contactInput} onChange={e => setContactInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold text-center outline-none focus:border-emerald-500" />
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                      <p className="text-xs text-slate-600 mb-3 text-center">Unlock <b className="text-[#0066cc]">5x votes</b> + a guaranteed voucher for RAD Academy.</p>
                      <input type="email" required placeholder="name@example.com" value={contactInput} onChange={e => setContactInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold text-center outline-none focus:border-[#0066cc]" />
                    </motion.div>
                  )}
                  <button type="submit" disabled={isUnlocking} className={`w-full py-4 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${tierTab === 'whatsapp' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-[#0066cc] hover:bg-blue-700 shadow-[#0066cc]/20'}`}>
                    {isUnlocking ? <Loader2 className="animate-spin" size={16} /> : <><Zap size={16} /> Unlock {tierTab === 'whatsapp' ? '15x' : '5x'} Votes</>}
                  </button>
                  <button type="button" onClick={() => setShowTierModal(false)} className="w-full text-[10px] text-slate-400 font-bold hover:text-slate-600 uppercase tracking-widest text-center transition-colors">No thanks, keep voting at 1x</button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- HERO / 90KM PROGRESS BAR --- */}
      <header className="bg-slate-900 text-white px-4 pt-8 pb-16 text-center shadow-lg relative">
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">Irene Comrades Tracker</h1>
          <p className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-widest mb-6">1 Vote = 100m • Durban → Pietermaritzburg • 90km Up Run</p>

          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-1">
            <motion.div initial={{ width: 0 }} animate={{ width: `${kmPercent}%` }} transition={{ duration: 0.8 }} className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full" />
          </div>
          <MilestoneMarkers milestones={MILESTONES} kmProgress={kmProgress} />
          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-2">Hover or tap the dots for fun facts about the route 💡</p>
          <p className="text-xs font-black text-white mt-3">{kmProgress.toFixed(1)}km <span className="text-slate-500 font-medium">of 90km</span></p>

          {phaseEndsHint && (
            <div className="inline-flex items-center gap-1.5 mt-4 bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-amber-200">
              {phaseEndsHint}
            </div>
          )}
        </div>
      </header>

      {/* --- PHASE: SETUP --- */}
      {phase === 'setup' && (
        <div className="max-w-xl mx-auto px-6 -mt-10 relative z-20">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white rounded-[40px] shadow-[0_25px_70px_-15px_rgba(0,102,204,0.28)] border border-slate-100 p-10 md:p-14 text-center overflow-hidden"
          >
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#0066cc]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 mx-auto rounded-[24px] bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center mb-6 shadow-xl shadow-amber-400/30"
              >
                <Trophy className="text-white" size={36} />
              </motion.div>

              <div className="inline-flex items-center gap-1.5 mb-4 bg-[#0066cc]/10 text-[#0066cc] px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066cc] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0066cc]" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest">Launching Soon</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">Voting Launches Soon!</h2>
              <p className="text-sm md:text-base text-slate-500 leading-relaxed max-w-sm mx-auto">Our teachers get first crack at voting, then it's the whole school's turn. Check back soon to cast your vote and help your class run all the way to Pietermaritzburg!</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- PHASE: EDUCATORS, NOT YET UNLOCKED --- */}
      {phase === 'educators' && !educatorUnlocked && (
        <div className="max-w-lg mx-auto px-6 -mt-6 relative z-20">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-10 text-center">
            <GraduationCap className="mx-auto text-[#0066cc] mb-4" size={40} />
            <h2 className="text-xl font-black text-slate-900 mb-2">Educator Voting Is Underway</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">Parent voting opens soon! If you're a staff member, enter your access code below to cast your votes now.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Staff access code" value={staffCodeInput} onChange={e => setStaffCodeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyStaffCode()} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold outline-none focus:border-[#0066cc]" />
              </div>
              <button onClick={handleVerifyStaffCode} disabled={isCheckingCode} className="px-5 bg-[#0066cc] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center">
                {isCheckingCode ? <Loader2 className="animate-spin" size={16} /> : 'Unlock'}
              </button>
            </div>
            {staffCodeError && <p className="text-xs text-rose-500 font-bold mt-3">{staffCodeError}</p>}
          </div>
        </div>
      )}

      {/* --- PHASE: EDUCATORS, UNLOCKED, GRADE NOT YET CHOSEN --- */}
      {phase === 'educators' && educatorUnlocked && !educatorGrade && (
        <div className="max-w-lg mx-auto px-6 -mt-6 relative z-20">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-10 text-center">
            <Users className="mx-auto text-[#0066cc] mb-4" size={40} />
            <h2 className="text-xl font-black text-slate-900 mb-2">Which grade do you teach?</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">We'll show you those kids first — you can always browse the whole school afterward.</p>
            <div className="grid grid-cols-4 gap-2">
              {[...FOUNDATION_GRADES, ...SENIOR_GRADES].map(g => (
                <button key={g} onClick={() => handlePickEducatorGrade(g)} className="py-3 bg-slate-50 hover:bg-[#0066cc] hover:text-white border border-slate-200 rounded-xl text-xs font-black transition-all">{g.replace('Grade ', 'Gr ')}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- REFERRAL LANDING (focused single-family funnel) --- */}
      {phase === 'parents' && referredResponse && !refAcknowledged && (
        <div className="max-w-lg mx-auto px-6 -mt-6 relative z-20">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mb-4"><Heart size={24} className="fill-current" /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] mb-2">You've Been Invited</p>
            <h2 className="text-xl font-black text-slate-900 mb-1">Vote for {firstName(referredResponse)}'s Family 💙</h2>
            <p className="text-xs text-slate-500 mb-6">{childrenLabel(referredResponse)}</p>
            <div className="space-y-2 text-left mb-4">
              {CATEGORIES.map(cat => (
                <CategorySubcard
                  key={cat.key}
                  response={referredResponse}
                  category={cat}
                  count={categoryTotals[referredResponse.id]?.[cat.key] || 0}
                  tappedKeys={tappedKeys}
                  phase={phase}
                  educatorUnlocked={educatorUnlocked}
                  onTap={handleTap}
                />
              ))}
            </div>
            <button onClick={() => setRefAcknowledged(true)} className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">Skip / See All Stories</button>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT: podium/carousel/roster, shown once gating clears --- */}
      {(phase === 'parents' || phase === 'closed' || (phase === 'educators' && educatorUnlocked && educatorGrade)) && !(phase === 'parents' && referredResponse && !refAcknowledged) && (
        <>
          {phase === 'closed' && (
            <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-20 mb-4">
              <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-2xl px-6 py-4 text-center shadow-lg flex items-center justify-center gap-2">
                <Trophy size={18} /> <span className="font-black text-sm uppercase tracking-widest">Voting Has Closed — Final Results!</span>
              </div>
            </div>
          )}

          {phase === 'educators' && educatorUnlocked && (
            <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-20 mb-4 flex items-center justify-between flex-wrap gap-2">
              <div className="bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <GraduationCap size={14} className="text-[#0066cc]" /> Viewing {educatorViewAllGrades ? 'all grades' : educatorGrade}
              </div>
              <button onClick={() => { setEducatorViewAllGrades(v => !v); setSelectedGrade(educatorViewAllGrades ? (educatorGrade || 'All') : 'All'); }} className="text-[10px] font-black text-[#0066cc] uppercase tracking-widest hover:underline">
                {educatorViewAllGrades ? 'Back to my grade' : 'See all grades'}
              </button>
            </div>
          )}

          {/* --- ADAPTIVE PODIUM --- */}
          <div className="max-w-5xl mx-auto px-4 mb-6">
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-xl border border-slate-100/60 ring-1 ring-black/5">
              <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-full flex items-center justify-center text-amber-500 shadow-inner shrink-0 ring-1 ring-amber-200/50"><Trophy size={18} /></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Class Leaderboards</p>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 leading-none">{podiumTitle}</h2>
                </div>
              </div>

              {selectedGrade !== 'All' ? (
                <PodiumRow top3={topSpecificGrade} />
              ) : selectedPhaseFilter === 'Foundation' || selectedPhaseFilter === 'Senior' ? (
                <PodiumRow top3={selectedPhaseFilter === 'Foundation' ? topFoundation : topSenior} />
              ) : (
                <div className="flex gap-2 sm:gap-8 w-full justify-between md:justify-center">
                  <div className="flex-1 min-w-0 max-w-[220px]">
                    <div className="mb-2 bg-[#0066cc]/5 px-2 py-1.5 rounded-md w-full text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] truncate">Gr R-3</p>
                      <p className="text-[8px] font-bold text-[#0066cc]/70 truncate">🏆 Wins 1hr RAD Coding</p>
                    </div>
                    <PodiumRow top3={topFoundation} compact />
                  </div>
                  <div className="w-px bg-slate-100 my-2" />
                  <div className="flex-1 min-w-0 max-w-[220px]">
                    <div className="mb-2 bg-emerald-500/5 px-2 py-1.5 rounded-md w-full text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 truncate">Gr 4-7</p>
                      <p className="text-[8px] font-bold text-emerald-600/70 truncate">🏆 Wins 1hr RAD Coding</p>
                    </div>
                    <PodiumRow top3={topSenior} compact />
                  </div>
                </div>
              )}
              <p className="text-center text-[10px] text-slate-400 font-bold mt-4">🏆 Top voted family in each category wins a RAD Academy workshop voucher for every child.</p>
            </div>
          </div>

          {/* --- GRADE FILTER --- */}
          {!(phase === 'educators') && (
            <section className="px-4 max-w-5xl mx-auto mb-8">
              <div className="flex justify-center gap-1.5 flex-wrap bg-white p-2 rounded-[24px] border border-slate-200 shadow-sm">
                {(['All', 'Foundation', 'Senior'] as const).map(p => (
                  <button key={p} onClick={() => { setSelectedPhaseFilter(p); setSelectedGrade('All'); }} className={`px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-black transition-all ${selectedPhaseFilter === p && selectedGrade === 'All' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    {p === 'All' ? 'All Grades' : p === 'Foundation' ? 'Grade R - 3' : 'Grade 4 - 7'}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {selectedPhaseFilter !== 'All' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex justify-center gap-1.5 pt-2 flex-wrap">
                      {(selectedPhaseFilter === 'Foundation' ? FOUNDATION_GRADES : SENIOR_GRADES).map(grade => (
                        <button key={grade} onClick={() => setSelectedGrade(grade)} className={`px-4 py-2 rounded-full text-[11px] font-black transition-all ${selectedGrade === grade ? 'bg-[#0066cc] text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>{grade.replace('Grade ', 'Gr ')}</button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* --- COMMUNITY CHAMPIONS --- */}
          {topReferrers.length > 0 && (
            <section className="px-4 max-w-5xl mx-auto mb-8">
              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={80} /></div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1 flex items-center gap-1.5"><Medal size={14} /> Community Champions</p>
                  <p className="text-xs text-indigo-100 mb-4">Parents who've brought the most friends & family to vote</p>
                  <div className="space-y-2">
                    {topReferrers.map((r, i) => (
                      <div key={r.response.id} className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-black text-sm w-5 shrink-0">#{i + 1}</span>
                          <span className="font-bold text-sm truncate">{firstName(r.response)}'s Family</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest shrink-0">{r.count} referred</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* --- CATEGORY SHOWCASE / TOP 5 --- */}
          <section className="px-4 max-w-5xl mx-auto mb-8">
            <div className="bg-white rounded-[32px] pt-5 pb-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
              <div className="grid grid-cols-3 gap-1.5 md:gap-2 mb-3 px-4">
                {CATEGORIES.map(cat => (
                  <button key={cat.key} onClick={() => setActiveCategory(cat.key)} className={`flex items-center justify-center text-center px-1 py-2.5 text-[9px] md:text-[10px] leading-tight font-black uppercase tracking-widest rounded-[14px] transition-all min-h-[40px] ${activeCategory === cat.key ? 'bg-[#eef4ff] text-[#0066cc]' : 'text-[#8ba3cb] hover:text-slate-600 hover:bg-slate-50'}`}>{cat.label}</button>
                ))}
              </div>
              <div className="flex items-center px-4 mb-4">
                <div className="flex-1 border-t border-slate-100" />
                <span className="px-3 text-[10px] font-black uppercase tracking-widest text-[#8ba3cb] flex items-center gap-1.5"><Trophy size={12} className="text-amber-400" />TOP 5</span>
                <div className="flex-1 border-t border-slate-100" />
              </div>
              <div className="px-5 relative">
                {top5ForCategory.length === 0 || !activeCarouselItem ? (
                  <div className="w-full text-center py-8 border border-dashed border-slate-200 rounded-[24px]"><p className="text-xs text-slate-400 font-bold">No votes in this category yet — be the first!</p></div>
                ) : (
                  <div className="relative max-w-sm mx-auto">
                    <button onClick={() => setCarouselIndex(prev => Math.max(0, prev - 1))} disabled={carouselIndex === 0} className={`flex absolute -left-2 md:-left-4 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md transition-all z-10 ${carouselIndex === 0 ? 'opacity-30 cursor-not-allowed text-slate-300 shadow-none' : 'text-slate-500 hover:text-[#0066cc] hover:scale-105'}`}><ChevronLeft size={18} /></button>
                    <button onClick={() => setCarouselIndex(prev => Math.min(top5ForCategory.length - 1, prev + 1))} disabled={carouselIndex === top5ForCategory.length - 1} className={`flex absolute -right-2 md:-right-4 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md transition-all z-10 ${carouselIndex === top5ForCategory.length - 1 ? 'opacity-30 cursor-not-allowed text-slate-300 shadow-none' : 'text-slate-500 hover:text-[#0066cc] hover:scale-105'}`}><ChevronRight size={18} /></button>
                    <AnimatePresence mode="wait">
                      <motion.div key={activeCarouselItem.id} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.15 }} className={`w-full rounded-[24px] p-5 flex flex-col justify-between transition-all bg-white ${carouselIndex === 0 ? 'border border-amber-300/60 shadow-[0_4px_16px_rgba(251,191,36,0.08)]' : carouselIndex === 1 ? 'border border-slate-300/60 shadow-[0_4px_16px_rgba(148,163,184,0.12)]' : carouselIndex === 2 ? 'border border-orange-300/60 shadow-[0_4px_16px_rgba(249,115,22,0.08)]' : 'border border-slate-100 shadow-sm'}`}>
                        <div className="flex items-start gap-3 mb-4">
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border ${carouselIndex === 0 ? 'bg-[#fff9eb] border-amber-200 text-amber-500' : carouselIndex === 1 ? 'bg-slate-50 border-slate-300 text-slate-600' : carouselIndex === 2 ? 'bg-orange-50 border-orange-200 text-orange-500' : 'bg-white border-slate-100 text-slate-300'}`}>#{carouselIndex + 1}</div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#8ba3cb] truncate">{firstName(activeCarouselItem)}'s Family</div>
                            <div className="text-[9px] font-bold text-[#8ba3cb] uppercase tracking-widest mt-0.5 truncate">{childrenLabel(activeCarouselItem)}</div>
                          </div>
                          <div className="shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center min-w-[56px]"><span className="block text-lg font-black text-slate-900 leading-none">{categoryTotals[activeCarouselItem.id]?.[activeCategory] || 0}</span><span className="text-[8px] uppercase tracking-widest text-[#8ba3cb] font-bold mt-0.5 block">Votes</span></div>
                        </div>
                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-50 mb-4">
                          {categoryContent(activeCarouselItem, activeCategory).map((part, i) => (
                            <p key={i} className="text-[13px] md:text-[14px] text-slate-700 italic leading-snug line-clamp-3 font-medium mb-2 last:mb-0">
                              {part.label && <span className="not-italic font-bold text-slate-500 text-[11px]">{part.label}: </span>}"{part.text}"
                            </p>
                          ))}
                        </div>
                        <VoteActions response={activeCarouselItem} tappedKeys={tappedKeys} phase={phase} educatorUnlocked={educatorUnlocked} onTap={handleTap} onShare={handleShare} copiedShareId={copiedShareId} />
                      </motion.div>
                    </AnimatePresence>
                    <div className="flex justify-center items-center gap-1.5 mt-5">{top5ForCategory.map((_, i) => (<button key={i} onClick={() => setCarouselIndex(i)} className={`h-2 rounded-full transition-all duration-300 ${i === carouselIndex ? 'w-6 bg-[#0066cc]' : 'w-2 bg-[#e2e8f0] hover:bg-slate-300'}`} aria-label={`Go to slide ${i + 1}`} />))}</div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* --- FIND MY FAMILY + ROSTER --- */}
          <section className="px-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-xl font-black text-slate-800">Find & Vote</h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full">{selectedGrade === 'All' ? 'All Grades' : selectedGrade}</span>
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="Find your family — parent's first name, or child's initial + grade + class" value={familySearch} onChange={(e) => setFamilySearch(e.target.value)} className="w-full bg-white p-3 pl-11 rounded-2xl border border-slate-200 shadow-sm text-sm font-bold outline-none focus:border-[#0066cc]" />
            </div>
            {familiesVotedCount > 0 && <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">🎉 {familiesVotedCount} {familiesVotedCount === 1 ? 'vote' : 'votes'} cast so far — join in!</p>}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col divide-y divide-slate-100">
              {rosterResponses.map((response) => (
                <RosterCard
                  key={response.id}
                  response={response}
                  total={totalForResponse(response.id)}
                  counts={categoryTotals[response.id]}
                  isTop={top5ForCategory.some(top => top.id === response.id)}
                  tappedKeys={tappedKeys}
                  phase={phase}
                  educatorUnlocked={educatorUnlocked}
                  onTap={handleTap}
                  onShare={handleShare}
                  copiedShareId={copiedShareId}
                />
              ))}
              {rosterResponses.length === 0 && (
                <div className="text-center py-16 bg-slate-50"><Search className="mx-auto text-slate-300 mb-4" size={32} /><p className="text-slate-500 font-bold text-sm">No families found matching this search.</p></div>
              )}
            </div>
          </section>
        </>
      )}

      {/* --- TIER STATUS PILL --- */}
      {myVoter && (myVoter.voter_type === 'whatsapp' || myVoter.voter_type === 'email') && phase === 'parents' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <Zap size={12} className="text-amber-400" /> {TIER_WEIGHTS[myVoter.voter_type]}x Power Voter
        </div>
      )}
      {phase === 'parents' && (!myVoter || myVoter.voter_type === 'anonymous') && !showTierModal && hasSeenUpsell && (
        <button onClick={() => setShowTierModal(true)} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-[#0066cc] text-[#0066cc] px-4 py-2 rounded-full shadow-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#0066cc] hover:text-white transition-colors">
          <Zap size={12} /> Go 15x
        </button>
      )}
    </div>
  );
}

function MilestoneMarkers({ milestones, kmProgress }: { milestones: typeof MILESTONES; kmProgress: number }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="relative h-6 mt-1 mb-1">
      {milestones.map((m, i) => {
        const percent = (m.km / 90) * 100;
        const reached = kmProgress >= m.km;
        const isFirst = i === 0;
        const isLast = i === milestones.length - 1;
        const dotAlign = isFirst ? '' : isLast ? '-translate-x-full' : '-translate-x-1/2';
        const popupAlign = isFirst ? 'left-0' : isLast ? 'right-0' : 'left-1/2 -translate-x-1/2';
        return (
          <div key={m.km} className="absolute top-0" style={{ left: `${percent}%` }}>
            {/* p-3 -m-3 grows the tappable hit area to ~44px on touch devices
                without visually enlarging the dot — the negative margin pulls
                the layout box back to the dot's original footprint. */}
            <button
              type="button"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(prev => (prev === i ? null : i))}
              className={`group flex items-center justify-center p-3 -m-3 ${dotAlign}`}
              aria-label={`${m.label}, ${m.km} kilometers`}
            >
              <span className={`block w-2.5 h-2.5 rounded-full border-2 transition-transform group-hover:scale-125 ${reached ? 'bg-amber-400 border-amber-200' : 'bg-slate-600 border-slate-500'}`} />
            </button>
            <AnimatePresence>
              {activeIndex === i && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute z-30 top-6 w-52 bg-white text-slate-900 rounded-2xl shadow-2xl p-4 text-left ${popupAlign}`}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] mb-1">{m.label} · {m.km}km</p>
                  <p className="text-[11px] text-slate-600 leading-snug">💡 Did you know? {m.fact}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function PodiumRow({ top3, compact = false }: { top3: { grade: string; className: string; total: number }[]; compact?: boolean }) {
  const heightClass = compact ? 'h-20' : 'h-24';
  const gap = compact ? 'gap-1' : 'gap-2';
  return (
    <div className={`flex items-end ${gap} ${heightClass} w-full max-w-[240px] mx-auto justify-center`}>
      <div className={`${compact ? 'w-1/3' : 'w-16'} flex flex-col items-center justify-end h-full`}>
        {top3[1] && <span className="text-[9px] font-bold text-slate-500 mb-1.5 truncate w-full text-center px-0.5">{top3[1].className}</span>}
        {top3[1] ? <div className="w-full bg-slate-100 rounded-t-lg h-[45%] flex items-center justify-center text-xs font-black text-slate-400">2nd</div> : <div className="w-full h-[45%]" />}
      </div>
      <div className={`${compact ? 'w-1/3' : 'w-20'} flex flex-col items-center justify-end h-full`}>
        {top3[0] && <span className="text-xs font-black text-amber-500 mb-1.5 truncate w-full text-center px-0.5">{top3[0].className}</span>}
        {top3[0] ? <div className="w-full bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-lg h-[75%] flex items-start pt-2 justify-center text-sm font-black text-white shadow-md shadow-amber-400/20">1st</div> : <div className="w-full h-[75%]" />}
        {top3[0] && top3[1] && <p className="text-[8px] text-slate-400 font-bold mt-1">+{top3[0].total - top3[1].total} ahead</p>}
      </div>
      <div className={`${compact ? 'w-1/3' : 'w-16'} flex flex-col items-center justify-end h-full`}>
        {top3[2] && <span className="text-[9px] font-bold text-orange-400 mb-1.5 truncate w-full text-center px-0.5">{top3[2].className}</span>}
        {top3[2] ? <div className="w-full bg-orange-100 rounded-t-lg h-[30%] flex items-center justify-center text-xs font-black text-orange-300">3rd</div> : <div className="w-full h-[30%]" />}
      </div>
    </div>
  );
}

function VoteActions({ response, tappedKeys, phase, educatorUnlocked, onTap, onShare, copiedShareId }: any) {
  const isEducatorMode = phase === 'educators' && educatorUnlocked;
  return (
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-3 gap-1.5 flex-1">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const key = `${response.id}::${cat.key}`;
          const tapped = tappedKeys.has(key);
          return (
            <button key={cat.key} disabled={tapped || phase === 'closed'} onClick={() => onTap(response, cat.key, isEducatorMode)} title={cat.label} className={`flex items-center justify-center gap-1 min-h-[44px] rounded-lg border text-[10px] font-black transition-all disabled:cursor-default active:opacity-60 ${tapped ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : phase === 'closed' ? 'bg-slate-50 border-slate-100 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-[#0066cc] hover:text-[#0066cc]'}`}>
              <Icon size={13} />{tapped && <Check size={11} />}
            </button>
          );
        })}
      </div>
      {phase !== 'closed' && (
        <button onClick={() => onShare(response)} title="Share this story" className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:border-[#0066cc] hover:text-[#0066cc] active:opacity-60 transition-all">
          {copiedShareId === response.id ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
        </button>
      )}
    </div>
  );
}

// One category's story + vote button, nested as a self-contained subcard so a
// family's full range (Inspiring / Oopsie / Weird) is visible at a glance
// without needing a global tab switch.
function CategorySubcard({ response, category, count, tappedKeys, phase, educatorUnlocked, onTap }: any) {
  const [expanded, setExpanded] = useState(false);
  const Icon = category.icon;
  const parts = categoryContent(response, category.key);
  const isLong = parts.reduce((n: number, p: any) => n + p.text.length, 0) > 90;
  const key = `${response.id}::${category.key}`;
  const tapped = tappedKeys.has(key);
  const isEducatorMode = phase === 'educators' && educatorUnlocked;
  const disabled = tapped || phase === 'closed';

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: category.color }}>
          <Icon size={13} /> {category.label}
        </div>
        <span className="text-[10px] font-black text-slate-700">{count} <span className="text-slate-400 font-bold normal-case">votes</span></span>
      </div>
      <div className={expanded ? '' : 'line-clamp-2'}>
        {parts.map((p: any, i: number) => (
          <p key={i} className="text-xs text-slate-600 italic leading-snug mb-1 last:mb-0">
            {p.label && <span className="not-italic font-bold text-slate-500">{p.label}: </span>}"{p.text}"
          </p>
        ))}
      </div>
      {isLong && (
        <button onClick={() => setExpanded(v => !v)} className="text-[9px] font-black uppercase tracking-widest hover:underline mt-1" style={{ color: category.color }}>
          {expanded ? 'View less' : 'View more'}
        </button>
      )}
      <button
        disabled={disabled}
        onClick={() => onTap(response, category.key, isEducatorMode)}
        className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${tapped ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : phase === 'closed' ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-white text-slate-600 border-slate-200 hover:border-current'}`}
        style={!disabled ? { color: category.color } : undefined}
      >
        {tapped ? <><Check size={12} /> Voted</> : `Vote ${category.label}`}
      </button>
    </div>
  );
}

function RosterCard({ response, total, counts, isTop, tappedKeys, phase, educatorUnlocked, onTap, onShare, copiedShareId }: any) {
  const [expanded, setExpanded] = useState(false);
  const isEducatorMode = phase === 'educators' && educatorUnlocked;

  return (
    <div className={`p-4 transition-colors ${isTop ? 'bg-amber-50/50' : 'bg-white hover:bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5 leading-tight">{firstName(response)}'s Family{isTop && <Sparkles size={12} className="text-amber-500 fill-amber-500 shrink-0" />}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">{childrenLabel(response)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-center">
            <span className="block text-lg font-black text-slate-900 leading-none">{total}</span>
            <span className="text-[8px] uppercase tracking-widest text-slate-400 font-bold">Total</span>
          </div>
          {phase !== 'closed' && (
            <button onClick={() => onShare(response)} title="Share this story" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:border-[#0066cc] hover:text-[#0066cc] active:opacity-60 transition-all">
              {copiedShareId === response.id ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Compact 3-column category row — icon doubles as the vote button */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const key = `${response.id}::${cat.key}`;
          const tapped = tappedKeys.has(key);
          const disabled = tapped || phase === 'closed';
          return (
            <button
              key={cat.key}
              disabled={disabled}
              onClick={() => onTap(response, cat.key, isEducatorMode)}
              title={`Vote ${cat.label}`}
              className="flex flex-col items-center gap-1 py-3 group disabled:cursor-default"
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${tapped ? 'text-white shadow-sm' : phase === 'closed' ? 'bg-white border border-slate-100 text-slate-300' : 'bg-white border border-slate-200 group-hover:scale-105 group-active:scale-95'}`}
                style={tapped ? { backgroundColor: cat.color } : phase !== 'closed' ? { color: cat.color } : undefined}
              >
                {tapped ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <span className="text-xs font-black text-slate-900">{counts?.[cat.key] || 0}</span>
              <span className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{cat.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-center gap-1 text-[9px] font-black text-[#0066cc] uppercase tracking-widest mt-1 py-3 min-h-[44px] hover:underline active:opacity-60">
        {expanded ? <>Show Less <ChevronUp size={11} /></> : <>View Full Stories <ChevronDown size={11} /></>}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="pt-2 space-y-3">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <div key={cat.key} className="bg-slate-50/70 rounded-xl border border-slate-100 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: cat.color }}>
                      <Icon size={11} /> {cat.label}
                    </p>
                    {categoryContent(response, cat.key).map((part, i) => (
                      <p key={i} className="text-xs text-slate-600 italic leading-snug mb-1 last:mb-0">
                        {part.label && <span className="not-italic font-bold text-slate-500">{part.label}: </span>}"{part.text}"
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function IreneComradesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading Tracker...</div>}>
      <TrackerContent />
    </Suspense>
  );
}
