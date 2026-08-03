'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Heart, X, Search, Sparkles, MessageCircle, Mail, UserX, AlertCircle, Loader2, ChevronDown, ThumbsUp } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getIreneLeaderboard } from "@/app/actions/irene";

const FOUNDATION_GRADES = ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3'];
const SENIOR_GRADES = ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];

const LETTER_GROUPS = [
  { label: 'A-E', letters: ['A','B','C','D','E'] },
  { label: 'F-J', letters: ['F','G','H','I','J'] },
  { label: 'K-O', letters: ['K','L','M','N','O'] },
  { label: 'P-T', letters: ['P','Q','R','S','T'] },
  { label: 'U-Z', letters: ['U','V','W','X','Y','Z'] }
];

// --- EXTRACTED COMPONENT: INDIVIDUAL TOP 3 CARD ---
function Top3Card({ 
  item, 
  index, 
  category, 
  handleQuickVote, 
  isQuickVoted, 
  isQuickVoteLoading 
}: { 
  item: any, 
  index: number, 
  category: string,
  handleQuickVote: (id: string) => void,
  isQuickVoted: boolean,
  isQuickVoteLoading: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Maintain the distinctive podium glows
  const rankStyles = [
    'border-amber-300/60 shadow-[0_4px_16px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/20 bg-gradient-to-b from-amber-50/40 to-white',
    'border-slate-300/60 shadow-[0_4px_16px_rgba(148,163,184,0.15)] ring-1 ring-slate-400/20 bg-gradient-to-b from-slate-50/60 to-white',
    'border-orange-300/60 shadow-[0_4px_16px_rgba(249,115,22,0.15)] ring-1 ring-orange-400/20 bg-gradient-to-b from-orange-50/40 to-white'
  ];

  const badgeStyles = [
    'bg-[#fff9eb] border-amber-200 text-amber-500',
    'bg-slate-50 border-slate-300 text-slate-600',
    'bg-orange-50 border-orange-200 text-orange-500'
  ];

  const nameColor = [
    'text-amber-600',
    'text-slate-600',
    'text-orange-600'
  ];

  const responseText = category === 'inspiring' 
    ? (item.q_why_start || item.q_boss_level || 'No answer provided.') 
    : category === 'funny' 
      ? (item.q_funny_fail || 'No answer provided.') 
      : (item.q_weird_habit || 'No answer provided.');

  // Extract just the first name
  const firstName = item.parent_first_name ? item.parent_first_name.trim().split(/\s+/)[0] : 'Unknown';
  
  // ~70 characters is a safe threshold for 2 lines of text-xs on mobile before it truly overflows
  const needsExpansion = responseText.length > 70;

  return (
    <div className={`flex flex-col rounded-2xl p-3 md:p-4 transition-all h-full w-full ${rankStyles[index]}`}>
      {/* Consolidated Top Header */}
      <div className="flex justify-between items-center mb-2 gap-2">
        {/* Rank Badge */}
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm border ${badgeStyles[index]}`}>
          #{index + 1}
        </div>
        
        {/* Names (Centered) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center text-center">
          <div className={`text-[12px] font-black uppercase tracking-widest truncate leading-tight ${nameColor[index]}`}>
            {firstName}
          </div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
            Child ({item.cub_initial}) • {item.class_name}
          </div>
        </div>

        {/* Action & Votes */}
        <div className="shrink-0 flex items-stretch gap-1">
          <button 
            onClick={() => handleQuickVote(item.id)}
            disabled={isQuickVoted || isQuickVoteLoading}
            title={isQuickVoted ? "You've already quick-voted for this response!" : "Cast 1 Quick Vote"}
            className={`flex items-center justify-center px-2 py-1 rounded-lg border shadow-sm transition-all ${isQuickVoted ? 'bg-emerald-50 border-emerald-200 text-emerald-500 cursor-not-allowed' : 'bg-white border-slate-100 text-slate-400 hover:text-[#0066cc] hover:border-[#0066cc] active:scale-95'}`}
          >
            {isQuickVoteLoading ? <Loader2 size={14} className="animate-spin"/> : <ThumbsUp size={14} className={isQuickVoted ? "fill-emerald-500" : ""} />}
          </button>
          <div className="bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm text-center min-w-[44px]">
            <span className="block text-sm font-black text-slate-900 leading-none">{item.totalVotes}</span>
            <span className="text-[7px] uppercase tracking-widest text-[#8ba3cb] font-bold block mt-0.5">Votes</span>
          </div>
        </div>
      </div>

      {/* Response Section */}
      <div className="flex flex-col mt-auto pt-1">
        <p className={`text-xs text-slate-700 italic leading-snug font-medium bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
          "{responseText}"
        </p>
        {needsExpansion && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="mt-2 text-[9px] font-black text-[#0066cc] uppercase tracking-widest hover:text-blue-800 transition-colors self-start"
          >
            {isExpanded ? 'Show Less' : 'View More'}
          </button>
        )}
      </div>
    </div>
  );
}

// --- EXTRACTED COMPONENT: CATEGORY SHOWCASE ---
function Top3Showcase({ 
  top3Responses, 
  activeCategory, 
  setActiveCategory,
  handleQuickVote,
  quickVotedIds,
  quickVoteLoadingId
}: { 
  top3Responses: any[], 
  activeCategory: string, 
  setActiveCategory: (cat: any) => void,
  handleQuickVote: (id: string) => void,
  quickVotedIds: string[],
  quickVoteLoadingId: string | null
}) {
  return (
    <section className="px-4 max-w-5xl mx-auto mb-8">
      <div className="bg-white rounded-[32px] pt-5 pb-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
        
        {/* Category Tabs */}
        <div className="grid grid-cols-3 gap-1.5 md:gap-2 mb-3 px-4">
          <button onClick={() => setActiveCategory('inspiring')} className={`flex items-center justify-center text-center px-1 py-2.5 text-[9px] md:text-[10px] leading-tight font-black uppercase tracking-widest rounded-[14px] transition-all min-h-[40px] ${activeCategory === 'inspiring' ? 'bg-[#eef4ff] text-[#0066cc]' : 'text-[#8ba3cb] hover:text-slate-600 hover:bg-slate-50'}`}>Most<br/>Inspiring</button>
          <button onClick={() => setActiveCategory('funny')} className={`flex items-center justify-center text-center px-1 py-2.5 text-[9px] md:text-[10px] leading-tight font-black uppercase tracking-widest rounded-[14px] transition-all min-h-[40px] ${activeCategory === 'funny' ? 'bg-[#eef4ff] text-[#0066cc]' : 'text-[#8ba3cb] hover:text-slate-600 hover:bg-slate-50'}`}>Epic<br/>Oopsie</button>
          <button onClick={() => setActiveCategory('weird')} className={`flex items-center justify-center text-center px-1 py-2.5 text-[9px] md:text-[10px] leading-tight font-black uppercase tracking-widest rounded-[14px] transition-all min-h-[40px] ${activeCategory === 'weird' ? 'bg-[#eef4ff] text-[#0066cc]' : 'text-[#8ba3cb] hover:text-slate-600 hover:bg-slate-50'}`}>Mad<br/>Scientist</button>
        </div>
        
        {/* Divider */}
        <div className="flex items-center px-4 mb-5">
          <div className="flex-1 border-t border-slate-100"></div>
          <span className="px-3 text-[10px] font-black uppercase tracking-widest text-[#8ba3cb] flex items-center gap-1.5">
            <Trophy size={12} className="text-amber-400" />TOP 3
          </span>
          <div className="flex-1 border-t border-slate-100"></div>
        </div>
        
        {/* Grid Container */}
        <div className="px-4">
          {top3Responses.length === 0 ? (
            <div className="w-full text-center py-8 border border-dashed border-slate-200 rounded-[24px]">
              <p className="text-xs text-slate-400 font-bold">No responses found yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 items-stretch">
              {top3Responses.map((item, index) => (
                <Top3Card 
                  key={item.id} 
                  item={item} 
                  index={index} 
                  category={activeCategory} 
                  handleQuickVote={handleQuickVote}
                  isQuickVoted={quickVotedIds.includes(item.id)}
                  isQuickVoteLoading={quickVoteLoadingId === item.id}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

function TrackerContent() {
  // --- DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<any[]>([]);
  const [classStats, setClassStats] = useState<Record<string, { grade: string, totalVotes: number }>>({});
  
  // --- UI/FILTER STATE ---
  const [selectedPhase, setSelectedPhase] = useState<'All' | 'Foundation' | 'Senior'>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);
  
  const [activeCategory, setActiveCategory] = useState<'inspiring' | 'funny' | 'weird'>('inspiring');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedInitial, setSelectedInitial] = useState<string>('');
  const [parentSearch, setParentSearch] = useState('');
  
  // --- VOTING UX STATE ---
  const [activeVoteTarget, setActiveVoteTarget] = useState<any>(null);
  const [votingTab, setVotingTab] = useState<'whatsapp' | 'email' | 'anonymous'>('whatsapp');
  const [contactInput, setContactInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [quickVotedIds, setQuickVotedIds] = useState<string[]>([]);
  const [quickVoteLoadingId, setQuickVoteLoadingId] = useState<string | null>(null);
  
  // --- ANTI-SPAM STATE ---
  const [deviceId, setDeviceId] = useState<string>('');
  const [dailyClaims, setDailyClaims] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<string | null>(null);

  // --- 1. INITIALIZE DEVICE & FETCH DATA ---
  useEffect(() => {
    let storedDeviceId = localStorage.getItem('irene_device_id');
    if (!storedDeviceId) {
      storedDeviceId = 'DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('irene_device_id', storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    const storedDate = localStorage.getItem('irene_claim_date');
    const today = new Date().toDateString();
    if (storedDate !== today) {
      localStorage.setItem('irene_claim_date', today);
      localStorage.setItem('irene_daily_claims', '0');
      setDailyClaims(0);
    } else {
      setDailyClaims(parseInt(localStorage.getItem('irene_daily_claims') || '0', 10));
    }

    const storedQuickVotes = localStorage.getItem('irene_quick_votes');
    if (storedQuickVotes) {
      setQuickVotedIds(JSON.parse(storedQuickVotes));
    }

    fetchData();

    const channel = supabase.channel('public:irene_votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'irene_votes' }, () => fetchData(false))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const res = await getIreneLeaderboard();
    
    if (res.success) {
      setClassStats(res.classStats || {});
      setResponses(res.responses || []);
    } else {
      console.error("Backend Error:", res.error);
      alert("Database Error: " + res.error);
    }
    setLoading(false);
  };

  // --- 2. DERIVED STATE ---
  const filteredResponses = responses.filter(r => {
    if (selectedGrade !== 'All') return r.grade === selectedGrade;
    if (selectedPhase === 'Foundation') return FOUNDATION_GRADES.includes(r.grade);
    if (selectedPhase === 'Senior') return SENIOR_GRADES.includes(r.grade);
    return true; 
  });
  
  const top3Responses = [...filteredResponses].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 3);
  
  const rosterResponses = filteredResponses
    .filter(r => 
      (!selectedGroup || LETTER_GROUPS.find(g => g.label === selectedGroup)?.letters.includes(r.cub_initial.toUpperCase())) &&
      (!selectedInitial || r.cub_initial.toUpperCase() === selectedInitial.toUpperCase()) &&
      (!parentSearch || r.parent_first_name.toLowerCase().includes(parentSearch.toLowerCase()))
    )
    .sort((a, b) => b.totalVotes - a.totalVotes);

  const getTop3Classes = (gradeFilter: string[]) => {
    return Object.entries(classStats)
      .filter(([_, stats]) => gradeFilter.includes(stats.grade))
      .map(([name, stats]) => ({ name, votes: stats.totalVotes }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 3);
  };

  const topFoundation = getTop3Classes(FOUNDATION_GRADES);
  const topSenior = getTop3Classes(SENIOR_GRADES);
  const topSpecificGrade = selectedGrade !== 'All' ? getTop3Classes([selectedGrade]) : [];
  const podiumTitle = selectedGrade !== 'All' ? selectedGrade : selectedPhase === 'Foundation' ? 'Grade R - 3' : selectedPhase === 'Senior' ? 'Grade 4 - 7' : 'School Overall';
  
  const getDropdownLabel = () => {
    if (selectedPhase === 'Foundation') return 'Grade R - 3';
    if (selectedPhase === 'Senior') return 'Grade 4 - 7';
    return 'All Grades';
  };

  // --- 3. VOTING LOGIC ---

  // Standard "Full" Vote Process
  const handleCastVote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeVoteTarget || dailyClaims >= 3) return;
    if (votingTab !== 'anonymous' && !contactInput) { alert("Please enter your details."); return; }

    setIsProcessing(true);
    const votesAwarded = votingTab === 'whatsapp' ? 15 : votingTab === 'email' ? 5 : 1;
    const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);

    try {
      const { data: voter } = await supabase.from('irene_voters').insert({
        email: votingTab === 'email' ? contactInput : null,
        whatsapp_number: votingTab === 'whatsapp' ? contactInput : null,
        device_id: deviceId, voter_type: votingTab, votes_awarded: votesAwarded, expires_at: expiresAt.toISOString()
      }).select().single();

      const votePayloads = Array.from({ length: votesAwarded }).map(() => ({ voter_id: voter.id, response_id: activeVoteTarget.id }));
      await supabase.from('irene_votes').insert(votePayloads);

      const newClaimCount = dailyClaims + 1;
      setDailyClaims(newClaimCount);
      localStorage.setItem('irene_daily_claims', newClaimCount.toString());

      if (newClaimCount >= 3) {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const diff = tomorrow.getTime() - now.getTime();
        setLockoutTime(`${Math.floor(diff / (1000 * 60 * 60))}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m`);
      }

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#0066cc', '#fbbf24'] });
      setActiveVoteTarget(null); setContactInput(''); fetchData(false);
    } catch (err: any) { alert("An error occurred. Please try again."); } finally { setIsProcessing(false); }
  };

  // Quick 1-Click Vote Process
  const handleQuickVote = async (responseId: string) => {
    if (quickVotedIds.includes(responseId)) return;
    setQuickVoteLoadingId(responseId);

    try {
      const expiresAt = new Date(); 
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data: voter } = await supabase.from('irene_voters').insert({
        email: null,
        whatsapp_number: null,
        device_id: deviceId, 
        voter_type: 'quick_vote', 
        votes_awarded: 1, 
        expires_at: expiresAt.toISOString()
      }).select().single();

      await supabase.from('irene_votes').insert([{ voter_id: voter.id, response_id: responseId }]);

      const newQuickVotes = [...quickVotedIds, responseId];
      setQuickVotedIds(newQuickVotes);
      localStorage.setItem('irene_quick_votes', JSON.stringify(newQuickVotes));

      confetti({ particleCount: 50, spread: 45, origin: { y: 0.7 }, colors: ['#10b981', '#0066cc'] });
      fetchData(false);
    } catch (err: any) { 
      alert("Failed to cast quick vote."); 
    } finally { 
      setQuickVoteLoadingId(null); 
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading Dashboard...</div>;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen"> 
      
      {/* --- VOTING MODAL --- */}
      <AnimatePresence>
        {activeVoteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] overflow-hidden max-w-sm w-full shadow-2xl relative">
              <button onClick={() => setActiveVoteTarget(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 p-2 z-10 bg-white rounded-full transition-colors"><X size={20}/></button>
              
              <div className="p-8 pt-10">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center font-black text-2xl mb-3 shadow-inner">
                    {activeVoteTarget.cub_initial}
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Vote for Class {activeVoteTarget.class_name}</h2>
                </div>

                {dailyClaims < 3 ? (
                  <>
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-6 relative">
                      <button onClick={() => setVotingTab('whatsapp')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${votingTab === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}><MessageCircle size={12}/> WhatsApp</button>
                      <button onClick={() => setVotingTab('email')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${votingTab === 'email' ? 'bg-white text-[#0066cc] shadow-sm' : 'text-slate-500'}`}><Mail size={12}/> Email</button>
                    </div>

                    <form onSubmit={handleCastVote} className="space-y-4">
                      {votingTab === 'whatsapp' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                          <p className="text-xs text-slate-600 mb-3 text-center">Get <b className="text-emerald-600">15 Votes</b> + lucky draw entry for 50% off RAD Bootcamp/Term 3.</p>
                          <input type="tel" required placeholder="082 123 4567" value={contactInput} onChange={e => setContactInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold text-center outline-none focus:border-emerald-500" />
                        </motion.div>
                      )}
                      
                      {votingTab === 'email' && (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                          <p className="text-xs text-slate-600 mb-3 text-center">Get <b className="text-[#0066cc]">5 Votes</b> + a guaranteed voucher for RAD Academy.</p>
                          <input type="email" required placeholder="name@example.com" value={contactInput} onChange={e => setContactInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold text-center outline-none focus:border-[#0066cc]" />
                        </motion.div>
                      )}

                      <button type="submit" disabled={isProcessing} className={`w-full py-4 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${votingTab === 'whatsapp' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-[#0066cc] hover:bg-blue-700 shadow-[#0066cc]/20'}`}>
                        {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <><Heart size={16}/> Cast {votingTab === 'whatsapp' ? '15' : '5'} Votes</>}
                      </button>

                      {dailyClaims === 1 && <p className="text-[10px] text-slate-400 text-center font-medium">Note: 2 claims remaining for this network today.</p>}
                      {dailyClaims === 2 && <p className="text-[10px] text-amber-600 text-center font-bold">Warning: This is your final claim for this network today.</p>}
                      
                      <button type="button" onClick={() => { setVotingTab('anonymous'); handleCastVote(); }} className="w-full text-[10px] text-slate-400 font-bold hover:text-slate-600 uppercase tracking-widest flex items-center justify-center gap-1 mt-2 transition-colors">
                        <UserX size={10}/> No thanks, cast 1 anonymous vote.
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center">
                    <AlertCircle className="text-rose-500 mx-auto mb-3" size={32} />
                    <h3 className="font-black text-rose-700 mb-1">Network Limit Reached</h3>
                    <p className="text-xs text-rose-600/80 font-medium mb-4">To keep the leaderboard fair, a maximum of 3 entries are allowed per network daily.</p>
                    <p className="text-sm font-black text-rose-600 bg-white py-2 rounded-lg border border-rose-200 shadow-sm">Resets in {lockoutTime}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- HEADER --- */}
      <header className="bg-slate-900 text-white px-4 pt-8 pb-12 text-center shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">Irene Comrades Tracker</h1>
          <p className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-widest">1 Vote = 100m • Target: 90km</p>
        </div>
      </header>

      {/* --- 1. THE ADAPTIVE PODIUM --- */}
      <div className="-mt-8 relative z-20 max-w-5xl mx-auto px-4 mb-6">
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-xl border border-slate-100/60 ring-1 ring-black/5">
          <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-full flex items-center justify-center text-amber-500 shadow-inner shrink-0 ring-1 ring-amber-200/50"><Trophy size={18}/></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Class Leaderboards</p>
              <h2 className="text-lg md:text-xl font-black text-slate-900 leading-none">{podiumTitle}</h2>
            </div>
          </div>

          <div className="w-full flex justify-center overflow-hidden min-h-[80px]">
            <AnimatePresence mode="wait">
              {selectedGrade !== 'All' ? (
                /* SPECIFIC GRADE PODIUM */
                <motion.div key="specific" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center w-full">
                  <div className="flex items-end gap-2 h-24 w-full max-w-[240px] justify-center">
                    <div className="w-16 flex flex-col items-center justify-end h-full">
                      {topSpecificGrade[1] && <span className="text-[10px] font-bold text-slate-500 mb-1.5 truncate w-full text-center px-0.5">{topSpecificGrade[1].name}</span>}
                      {topSpecificGrade[1] ? <div className="w-full bg-slate-100 rounded-t-lg h-[45%] flex items-center justify-center text-xs font-black text-slate-400">2nd</div> : <div className="w-full h-[45%]" />}
                    </div>
                    <div className="w-20 flex flex-col items-center justify-end h-full">
                      {topSpecificGrade[0] && <span className="text-xs font-black text-amber-500 mb-1.5 truncate w-full text-center px-0.5">{topSpecificGrade[0].name}</span>}
                      {topSpecificGrade[0] ? <div className="w-full bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-lg h-[75%] flex items-start pt-2 justify-center text-sm font-black text-white shadow-md shadow-amber-400/20">1st</div> : <div className="w-full h-[75%]" />}
                    </div>
                    <div className="w-16 flex flex-col items-center justify-end h-full">
                      {topSpecificGrade[2] && <span className="text-[10px] font-bold text-orange-400 mb-1.5 truncate w-full text-center px-0.5">{topSpecificGrade[2].name}</span>}
                      {topSpecificGrade[2] ? <div className="w-full bg-orange-100 rounded-t-lg h-[30%] flex items-center justify-center text-xs font-black text-orange-300">3rd</div> : <div className="w-full h-[30%]" />}
                    </div>
                  </div>
                </motion.div>
              ) : selectedPhase === 'Foundation' || selectedPhase === 'Senior' ? (
                <motion.div key="phase" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center w-full">
                  <div className="flex items-end gap-2 h-24 w-full max-w-[240px] justify-center">
                    <div className="w-16 flex flex-col items-center justify-end h-full">
                      {(selectedPhase === 'Foundation' ? topFoundation : topSenior)[1] && <span className="text-[10px] font-bold text-slate-500 mb-1.5 truncate w-full text-center px-0.5">{(selectedPhase === 'Foundation' ? topFoundation : topSenior)[1].name}</span>}
                      {(selectedPhase === 'Foundation' ? topFoundation : topSenior)[1] ? <div className="w-full bg-slate-100 rounded-t-lg h-[45%] flex items-center justify-center text-xs font-black text-slate-400">2nd</div> : <div className="w-full h-[45%]" />}
                    </div>
                    <div className="w-20 flex flex-col items-center justify-end h-full">
                      {(selectedPhase === 'Foundation' ? topFoundation : topSenior)[0] && <span className="text-xs font-black text-amber-500 mb-1.5 truncate w-full text-center px-0.5">{(selectedPhase === 'Foundation' ? topFoundation : topSenior)[0].name}</span>}
                      {(selectedPhase === 'Foundation' ? topFoundation : topSenior)[0] ? <div className="w-full bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-lg h-[75%] flex items-start pt-2 justify-center text-sm font-black text-white shadow-md shadow-amber-400/20">1st</div> : <div className="w-full h-[75%]" />}
                    </div>
                    <div className="w-16 flex flex-col items-center justify-end h-full">
                      {(selectedPhase === 'Foundation' ? topFoundation : topSenior)[2] && <span className="text-[10px] font-bold text-orange-400 mb-1.5 truncate w-full text-center px-0.5">{(selectedPhase === 'Foundation' ? topFoundation : topSenior)[2].name}</span>}
                      {(selectedPhase === 'Foundation' ? topFoundation : topSenior)[2] ? <div className="w-full bg-orange-100 rounded-t-lg h-[30%] flex items-center justify-center text-xs font-black text-orange-300">3rd</div> : <div className="w-full h-[30%]" />}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="all" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex gap-2 sm:gap-8 w-full justify-between md:justify-center">
                  <div className="flex flex-col items-center flex-1 max-w-[160px]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#0066cc] mb-2 bg-[#0066cc]/5 px-2 py-1 rounded-md w-full text-center truncate">Gr R-3</p>
                    <div className="flex items-end gap-1 h-20 w-full justify-center">
                      <div className="w-1/3 flex flex-col items-center justify-end h-full">
                        {topFoundation[1] && <span className="text-[9px] font-bold text-slate-500 mb-1 truncate w-full text-center px-0.5">{topFoundation[1].name}</span>}
                        {topFoundation[1] ? <div className="w-full bg-slate-100 rounded-t-md h-[45%] flex items-center justify-center text-[10px] font-black text-slate-400">2</div> : <div className="w-full h-[45%]" />}
                      </div>
                      <div className="w-1/3 flex flex-col items-center justify-end h-full">
                        {topFoundation[0] && <span className="text-[10px] font-black text-amber-500 mb-1 truncate w-full text-center px-0.5">{topFoundation[0].name}</span>}
                        {topFoundation[0] ? <div className="w-full bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-md h-[70%] flex items-start pt-1.5 justify-center text-xs font-black text-white shadow-md shadow-amber-400/20">1</div> : <div className="w-full h-[70%]" />}
                      </div>
                      <div className="w-1/3 flex flex-col items-center justify-end h-full">
                        {topFoundation[2] && <span className="text-[9px] font-bold text-orange-400 mb-1 truncate w-full text-center px-0.5">{topFoundation[2].name}</span>}
                        {topFoundation[2] ? <div className="w-full bg-orange-100 rounded-t-md h-[30%] flex items-center justify-center text-[10px] font-black text-orange-300">3</div> : <div className="w-full h-[30%]" />}
                      </div>
                    </div>
                  </div>
                  <div className="w-px bg-slate-100 my-2"></div>
                  <div className="flex flex-col items-center flex-1 max-w-[160px]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2 bg-emerald-500/5 px-2 py-1 rounded-md w-full text-center truncate">Gr 4-7</p>
                    <div className="flex items-end gap-1 h-20 w-full justify-center">
                      <div className="w-1/3 flex flex-col items-center justify-end h-full">
                        {topSenior[1] && <span className="text-[9px] font-bold text-slate-500 mb-1 truncate w-full text-center px-0.5">{topSenior[1].name}</span>}
                        {topSenior[1] ? <div className="w-full bg-slate-100 rounded-t-md h-[45%] flex items-center justify-center text-[10px] font-black text-slate-400">2</div> : <div className="w-full h-[45%]" />}
                      </div>
                      <div className="w-1/3 flex flex-col items-center justify-end h-full">
                        {topSenior[0] && <span className="text-[10px] font-black text-amber-500 mb-1 truncate w-full text-center px-0.5">{topSenior[0].name}</span>}
                        {topSenior[0] ? <div className="w-full bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-md h-[70%] flex items-start pt-1.5 justify-center text-xs font-black text-white shadow-md shadow-amber-400/20">1</div> : <div className="w-full h-[70%]" />}
                      </div>
                      <div className="w-1/3 flex flex-col items-center justify-end h-full">
                        {topSenior[2] && <span className="text-[9px] font-bold text-orange-400 mb-1 truncate w-full text-center px-0.5">{topSenior[2].name}</span>}
                        {topSenior[2] ? <div className="w-full bg-orange-100 rounded-t-md h-[30%] flex items-center justify-center text-[10px] font-black text-orange-300">3</div> : <div className="w-full h-[30%]" />}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* --- 2. PROGRESSIVE MASTER FILTER --- */}
      <section className="px-4 max-w-5xl mx-auto mb-8 relative z-30">
        {isGradeDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setIsGradeDropdownOpen(false)}></div>}
        <div className="relative z-30 mb-3 bg-white p-2 pl-5 rounded-[24px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between py-2 pr-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Grade:</span>
            <div className="relative">
              <button onClick={() => setIsGradeDropdownOpen(!isGradeDropdownOpen)} className={`min-w-[140px] md:min-w-[160px] bg-slate-50 px-4 py-2.5 rounded-[14px] border transition-all flex justify-between items-center text-[11px] font-black uppercase tracking-widest ${isGradeDropdownOpen ? 'border-[#0066cc] shadow-md ring-2 ring-[#0066cc]/10 text-[#0066cc]' : 'border-slate-200 shadow-sm text-slate-800 hover:border-slate-300'}`}>
                <span>{getDropdownLabel()}</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ml-2 ${isGradeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isGradeDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={{ duration: 0.15 }} className="absolute top-full right-0 mt-2 w-[200px] bg-white rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden z-40">
                    <div className="flex flex-col">
                      <button onClick={() => { setSelectedPhase('All'); setSelectedGrade('All'); setSelectedGroup(null); setIsGradeDropdownOpen(false); }} className={`p-3.5 text-left font-black uppercase tracking-widest text-[10px] border-b border-slate-50 transition-colors ${selectedPhase === 'All' ? 'bg-[#f4f8ff] text-[#0066cc]' : 'text-slate-600 hover:bg-slate-50'}`}>All Grades</button>
                      <button onClick={() => { setSelectedPhase('Foundation'); setSelectedGrade('All'); setSelectedGroup(null); setIsGradeDropdownOpen(false); }} className={`p-3.5 text-left font-black uppercase tracking-widest text-[10px] border-b border-slate-50 transition-colors ${selectedPhase === 'Foundation' ? 'bg-[#f4f8ff] text-[#0066cc]' : 'text-slate-600 hover:bg-slate-50'}`}>Grade R - 3</button>
                      <button onClick={() => { setSelectedPhase('Senior'); setSelectedGrade('All'); setSelectedGroup(null); setIsGradeDropdownOpen(false); }} className={`p-3.5 text-left font-black uppercase tracking-widest text-[10px] transition-colors ${selectedPhase === 'Senior' ? 'bg-[#f4f8ff] text-[#0066cc]' : 'text-slate-600 hover:bg-slate-50'}`}>Grade 4 - 7</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="pt-2 pb-1 border-t border-slate-50 mt-1 mx-1">
            <p className="text-[9px] text-slate-400 font-bold leading-tight px-1">Select a grade to see the Top 3, explore more responses, or search for a specific parent to cast your vote.</p>
          </div>
        </div>
        <AnimatePresence>
          {selectedPhase !== 'All' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex justify-center gap-1.5 pb-2 flex-wrap">
                <button onClick={() => setSelectedGrade('All')} className={`px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-black transition-all ${selectedGrade === 'All' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>All {getDropdownLabel()}</button>
                {(selectedPhase === 'Foundation' ? FOUNDATION_GRADES : SENIOR_GRADES).map(grade => {
                  const shortGrade = grade.replace('Grade ', 'Gr ');
                  return (
                    <button key={grade} onClick={() => { setSelectedGrade(grade); setSelectedGroup(null); }} className={`px-4 py-2 rounded-full text-[11px] font-black transition-all ${selectedGrade === grade ? 'bg-[#0066cc] text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>{shortGrade}</button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* --- 3. CATEGORY SHOWCASE (MODULAR COMPONENT) --- */}
      <Top3Showcase 
        top3Responses={top3Responses} 
        activeCategory={activeCategory} 
        setActiveCategory={setActiveCategory} 
        handleQuickVote={handleQuickVote}
        quickVotedIds={quickVotedIds}
        quickVoteLoadingId={quickVoteLoadingId}
      />

      {/* --- 4. ROSTER --- */}
      <section className="px-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-xl font-black text-slate-800">Find & Vote</h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full">{selectedGrade === 'All' ? 'All Grades' : selectedGrade}</span>
        </div>
        <div className="flex gap-2 mb-6">
          <input type="text" maxLength={1} placeholder="Initial" value={selectedInitial} onChange={(e) => setSelectedInitial(e.target.value.toUpperCase())} className="w-20 shrink-0 text-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-sm font-black uppercase outline-none focus:border-[#0066cc]" />
          <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Filter by parent name..." value={parentSearch} onChange={(e) => setParentSearch(e.target.value)} className="w-full bg-white p-3 pl-11 rounded-2xl border border-slate-200 shadow-sm text-sm font-bold outline-none focus:border-[#0066cc]" /></div>
        </div>
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {rosterResponses.map((response) => {
            const isTop3 = top3Responses.some(top => top.id === response.id);
            return (
              <div key={response.id} className={`p-3 md:p-4 flex items-center justify-between gap-3 border-b border-slate-100 last:border-b-0 transition-colors ${isTop3 ? 'bg-amber-50/50' : 'bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-lg ${isTop3 ? 'bg-amber-100 text-amber-600 shadow-inner border border-amber-200/50' : 'bg-slate-100 text-slate-500 border border-slate-200/50'}`}>{response.cub_initial}</div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <p className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5 leading-tight">{response.parent_first_name}{isTop3 && <Sparkles size={12} className="text-amber-500 fill-amber-500 shrink-0" />}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">Class {response.class_name}</p>
                  </div>
                </div>
                <button onClick={() => setActiveVoteTarget(response)} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${isTop3 ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20' : 'bg-slate-100 text-slate-600 hover:bg-[#0066cc] hover:text-white border border-slate-200 hover:border-[#0066cc]'}`}><Heart size={14} className={isTop3 ? "fill-white" : "fill-transparent"} /><span className="font-black text-xs">{response.totalVotes}</span></button>
              </div>
            );
          })}
          {rosterResponses.length === 0 && (
            <div className="text-center py-16 bg-slate-50"><Search className="mx-auto text-slate-300 mb-4" size={32} /><p className="text-slate-500 font-bold text-sm">No cubs found matching this filter.</p><button onClick={() => { setSelectedPhase('All'); setSelectedGrade('All'); setSelectedInitial(''); setParentSearch(''); }} className="mt-4 text-xs font-black text-[#0066cc] uppercase tracking-widest hover:underline">Clear Filters</button></div>
          )}
        </div>
      </section>
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