'use client';

import React, { useEffect, useState } from 'react';
import { Smile, Sparkles, FlaskConical, Footprints, Mountain, Target, ChevronDown, Check } from 'lucide-react';
import { BottomSheetModal } from '../BottomSheetModal';

type VoteCategory = 'funniest' | 'most_inspiring' | 'mad_scientist';
type Phase = 'locked' | 'open' | 'standings_only';

type Story = {
  motivation: string | null;
  club_member: boolean | null;
  club_names: string | null;
  shoe_count: number | null;
  boss_level_challenge_2026: string | null;
  toughest_challenge: string | null;
  proudest_moment: string | null;
  weirdest_fuel: string | null;
  funniest_fail: string | null;
} | null;

type FeedResponse = {
  id: string;
  display_name: string;
  story: Story;
  votes: Record<VoteCategory, number>;
};

// Real labels + a distinct colour per category so which button does what is
// legible at a glance, not something to guess at from an unlabelled icon.
// Purple continues the "mad scientist = weird/purple" association the old
// irene-comrades platform already used; blue matches this platform's own
// primary accent (#0066cc); teal is new, reserved for "funniest" alone.
const CATEGORY_CONFIG: {
  key: VoteCategory;
  label: string;
  icon: typeof Smile;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    key: 'funniest',
    label: 'Funny',
    icon: Smile,
    activeClass: 'bg-teal-600 text-white',
    idleClass: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
  },
  {
    key: 'most_inspiring',
    label: 'Inspiring',
    icon: Sparkles,
    activeClass: 'bg-[#0066cc] text-white',
    idleClass: 'bg-blue-50 text-[#0066cc] hover:bg-blue-100',
  },
  {
    key: 'mad_scientist',
    label: 'Craziest Diet',
    icon: FlaskConical,
    activeClass: 'bg-violet-600 text-white',
    idleClass: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
];

const DEVICE_ID_KEY = 'irene_fitness_device_id';

// Deliberately a different localStorage key from the old irene-comrades
// platform's irene_device_id - same device, but voting identity shouldn't
// carry across two unrelated contests.
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Stable per-name colour (not per-category - this is identity, not a vote
// choice) so the same person's avatar looks the same across a refresh.
const AVATAR_PALETTE = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Avatar({ name, size = 36, className = '' }: { name: string; size?: number; className?: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const { bg, text } = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return (
    <div
      title={name}
      className={`shrink-0 rounded-full flex items-center justify-center font-black ${bg} ${text} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

// Full detail list, used only inside the "Read full story" modal - the card
// itself shows a deliberately partial view (fact pills + one teaser line),
// see factPills/teaserLine below.
function storyAnswers(story: Story): { label: string; value: string }[] {
  if (!story) return [];
  const answers: { label: string; value: string }[] = [];
  if (story.motivation) answers.push({ label: 'Why I started', value: story.motivation });
  if (story.club_member === true) answers.push({ label: 'Fitness club', value: story.club_names || 'Yes' });
  if (story.shoe_count !== null && story.shoe_count !== undefined) {
    answers.push({ label: 'Pairs of shoes owned', value: String(story.shoe_count) });
  }
  if (story.boss_level_challenge_2026) answers.push({ label: '2026 "Boss Level" goal', value: story.boss_level_challenge_2026 });
  if (story.toughest_challenge) answers.push({ label: 'Toughest challenge yet', value: story.toughest_challenge });
  if (story.proudest_moment) answers.push({ label: 'Proudest moment', value: story.proudest_moment });
  if (story.weirdest_fuel) answers.push({ label: 'Weirdest training fuel', value: story.weirdest_fuel });
  if (story.funniest_fail) answers.push({ label: 'Funniest fitness fail', value: story.funniest_fail });
  return answers;
}

function hasStoryContent(story: Story): boolean {
  return storyAnswers(story).length > 0;
}

// The three short, factual fields - glanceable pill chips, not full sentences.
function factPills(story: Story): { icon: typeof Footprints; text: string }[] {
  if (!story) return [];
  const pills: { icon: typeof Footprints; text: string }[] = [];
  if (story.shoe_count !== null && story.shoe_count !== undefined) {
    pills.push({ icon: Footprints, text: `${story.shoe_count} pair${story.shoe_count === 1 ? '' : 's'}` });
  }
  if (story.toughest_challenge) pills.push({ icon: Mountain, text: story.toughest_challenge });
  if (story.boss_level_challenge_2026) pills.push({ icon: Target, text: story.boss_level_challenge_2026 });
  return pills;
}

// One narrative teaser line - funniest fail first (humour is the most
// scroll-stopping content type in a casual feed), falling back to proudest
// moment. Everything else lives behind "Read full story."
function teaserLine(story: Story): { label: string; value: string } | null {
  if (!story) return null;
  if (story.funniest_fail) return { label: 'Funniest fitness fail', value: story.funniest_fail };
  if (story.proudest_moment) return { label: 'Proudest moment', value: story.proudest_moment };
  return null;
}

// Fisher-Yates, run once per page load - keeps the feed from always
// favouring whoever submitted first (§0: feed, not leaderboard).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function totalVotes(v: Record<VoteCategory, number>) {
  return v.funniest + v.most_inspiring + v.mad_scientist;
}

// flex-1 on each button (rather than flex-wrap) guarantees the three
// categories share one row instead of wrapping/overlapping - label size and
// padding are tuned to fit "Craziest Diet", the longest of the three, down
// to a narrow phone width.
function VoteButtons({
  votes,
  tapped,
  interactive,
  onVote,
}: {
  votes: Record<VoteCategory, number>;
  tapped: Set<VoteCategory>;
  interactive: boolean;
  onVote: (category: VoteCategory) => void;
}) {
  return (
    <div className="flex items-stretch gap-1">
      {CATEGORY_CONFIG.map(({ key, label, icon: Icon, activeClass, idleClass }) => {
        const isTapped = tapped.has(key);
        return (
          <button
            key={key}
            disabled={!interactive || isTapped}
            onClick={() => onVote(key)}
            title={label}
            className={`flex-1 min-w-0 flex items-center justify-center gap-0.5 px-1 py-2 rounded-full font-bold text-[10px] whitespace-nowrap transition-colors disabled:cursor-default ${
              isTapped ? activeClass : idleClass
            }`}
          >
            {isTapped ? <Check size={12} className="shrink-0" /> : <Icon size={12} className="shrink-0" />}
            <span className="truncate">{label}</span>
            <span className="shrink-0">{votes[key]}</span>
          </button>
        );
      })}
    </div>
  );
}

function StoryModal({ name, story, onClose }: { name: string; story: Story; onClose: () => void }) {
  const answers = storyAnswers(story);
  return (
    <BottomSheetModal title={name} onClose={onClose}>
      {answers.length === 0 && <p className="text-sm text-slate-400 italic">No story shared.</p>}
      {answers.map((a, i) => (
        <div key={i} className="mb-4 last:mb-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{a.label}</p>
          <p className="text-sm text-slate-700">{a.value}</p>
        </div>
      ))}
    </BottomSheetModal>
  );
}

function ResponseCard({
  response,
  tapped,
  votedBefore,
  interactive,
  onVote,
  onReadStory,
}: {
  response: FeedResponse;
  tapped: Set<VoteCategory>;
  votedBefore: boolean;
  interactive: boolean;
  onVote: (category: VoteCategory) => void;
  onReadStory: () => void;
}) {
  const pills = factPills(response.story);
  const teaser = teaserLine(response.story);

  return (
    <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={response.display_name} size={36} />
        <p className="font-black text-lg">{response.display_name}</p>
      </div>

      {votedBefore && (
        <p className="text-xs text-slate-400 mb-3">Voted here before — check what&apos;s left for today</p>
      )}

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pills.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold"
            >
              <p.icon size={12} />
              {p.text}
            </span>
          ))}
        </div>
      )}

      {teaser && (
        <div className="mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{teaser.label}</p>
          <p className="text-sm text-slate-700">{teaser.value}</p>
        </div>
      )}

      <button
        onClick={onReadStory}
        className="flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline mb-4"
      >
        Read full story
        <ChevronDown size={14} />
      </button>

      <div className="pt-4 border-t border-black/5">
        <VoteButtons votes={response.votes} tapped={tapped} interactive={interactive} onVote={onVote} />
      </div>
    </div>
  );
}

// Capped low enough that 8 overlapping 32px avatars + a "+N more" label
// still clear a single row on the narrowest phone widths this page
// supports (~320px) without wrapping to a second row.
const CHEER_SQUAD_VISIBLE = 8;

// Repetitive empty cards ("no story shared") read as dead scroll, and worse,
// an individually-blank card next to rich ones quietly implies that family
// didn't participate. Grouped once, near the top, as one overlapping row of
// avatars, it reads as one lively show-of-support moment instead - same
// underlying fact, better framing. They're here to cheer, not to compete,
// so unlike every other entry, these don't carry vote buttons at all.
function CheerSquad({ responses }: { responses: FeedResponse[] }) {
  if (responses.length === 0) return null;
  const visible = responses.slice(0, CHEER_SQUAD_VISIBLE);
  const remaining = responses.length - visible.length;
  return (
    <div className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
      <p className="text-xs font-bold text-slate-400 mb-3">Also cheering everyone on</p>
      <div className="flex items-center flex-nowrap">
        {visible.map((r, i) => (
          <Avatar
            key={r.id}
            name={r.display_name}
            size={32}
            className={`ring-2 ring-white ${i > 0 ? '-ml-3' : ''}`}
          />
        ))}
        {remaining > 0 && (
          <span className="shrink-0 whitespace-nowrap text-xs font-bold text-slate-400 ml-2">+{remaining} more</span>
        )}
      </div>
    </div>
  );
}

type CardFilter = 'all' | 'new' | 'favourites';

const FILTER_OPTIONS: { key: CardFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New to you' },
  { key: 'favourites', label: 'Your favourites' },
];

// Deliberately not sticky - a pinned bar would compete with the vote
// buttons for thumb reach on a narrow phone, and switching filters is a
// quick check-in, not something done while scrolling for minutes.
function FilterPills({ value, onChange }: { value: CardFilter; onChange: (f: CardFilter) => void }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {FILTER_OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              active ? 'bg-[#0066cc] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function IreneFitnessCommunityPage() {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [responses, setResponses] = useState<FeedResponse[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [tappedByResponse, setTappedByResponse] = useState<Map<string, Set<VoteCategory>>>(new Map());
  const [everVotedIds, setEverVotedIds] = useState<Set<string>>(new Set());
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>('all');

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);

    let cancelled = false;
    Promise.all([
      fetch('/api/irene-fitness/feed').then((r) => r.json()),
      fetch(`/api/irene-fitness/my-votes?device_id=${encodeURIComponent(id)}`).then((r) => r.json()),
    ])
      .then(([feedData, votesData]) => {
        if (cancelled) return;
        const list: FeedResponse[] = feedData.responses || [];
        setPhase(feedData.phase);
        setResponses(list);
        setOrder(shuffle(list.filter((r) => hasStoryContent(r.story)).map((r) => r.id)));
        const tapped = new Map<string, Set<VoteCategory>>();
        (votesData.votes || []).forEach((v: { response_id: string; category: VoteCategory }) => {
          const set = tapped.get(v.response_id) || new Set<VoteCategory>();
          set.add(v.category);
          tapped.set(v.response_id, set);
        });
        setTappedByResponse(tapped);
        setEverVotedIds(new Set<string>(votesData.ever_response_ids || []));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const interactive = phase === 'open';

  async function handleVote(responseId: string, category: VoteCategory) {
    if (!deviceId || !interactive) return;
    if (tappedByResponse.get(responseId)?.has(category)) return;

    const wasAlreadyFavourite = everVotedIds.has(responseId);

    setTappedByResponse((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(responseId) || []);
      set.add(category);
      next.set(responseId, set);
      return next;
    });
    setEverVotedIds((prev) => new Set(prev).add(responseId));
    setResponses((prev) =>
      prev.map((r) => (r.id === responseId ? { ...r, votes: { ...r.votes, [category]: r.votes[category] + 1 } } : r))
    );

    try {
      const res = await fetch('/api/irene-fitness/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_id: responseId, category, voter_device_id: deviceId }),
      });
      const data = await res.json();
      if (!res.ok && !data.already_voted) throw new Error(data.error || 'Vote failed');
    } catch {
      // Real failure (not an "already voted" conflict) - roll back the
      // optimistic update.
      setTappedByResponse((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(responseId) || []);
        set.delete(category);
        next.set(responseId, set);
        return next;
      });
      // Only drop this response from "ever voted" if it wasn't already a
      // favourite from an earlier day - this failed tap shouldn't undo that.
      if (!wasAlreadyFavourite) {
        setEverVotedIds((ids) => {
          const next = new Set(ids);
          next.delete(responseId);
          return next;
        });
      }
      setResponses((prev) =>
        prev.map((r) =>
          r.id === responseId ? { ...r, votes: { ...r.votes, [category]: Math.max(0, r.votes[category] - 1) } } : r
        )
      );
    }
  }

  if (loading || phase === null) {
    return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-slate-400 text-sm">Loading…</div>;
  }

  if (phase === 'locked') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-black tracking-tight mb-3">Not open yet</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Voting hasn&apos;t opened yet — we&apos;ll share the link and date once it&apos;s live.
        </p>
      </div>
    );
  }

  const cheerSquad = responses.filter((r) => !hasStoryContent(r.story));
  const storiedResponses =
    phase === 'standings_only'
      ? responses.filter((r) => hasStoryContent(r.story)).sort((a, b) => totalVotes(b.votes) - totalVotes(a.votes))
      : (order.map((id) => responses.find((r) => r.id === id)).filter((r): r is FeedResponse => !!r));

  // New to you / Your favourites are exhaustive, mutually-exclusive slices
  // of the same "have I ever voted on this card" fact the vote buttons
  // already track (ever_response_ids) - All is just both combined.
  const filteredResponses =
    filter === 'new'
      ? storiedResponses.filter((r) => !everVotedIds.has(r.id))
      : filter === 'favourites'
        ? storiedResponses.filter((r) => everVotedIds.has(r.id))
        : storiedResponses;

  const openStoryResponse = openStoryId ? responses.find((r) => r.id === openStoryId) || null : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      <h2 className="text-2xl font-black tracking-tight mb-1">Fit Fam Community</h2>
      <p className="text-sm text-slate-500 mb-6">
        {phase === 'standings_only'
          ? "Voting has closed — here's how it went."
          : 'Tap to vote for your favourites — one tap per category, per entry, per day.'}
      </p>

      <CheerSquad responses={cheerSquad} />

      {storiedResponses.length > 0 && <FilterPills value={filter} onChange={setFilter} />}

      {storiedResponses.length === 0 && cheerSquad.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-16">No entries yet — check back soon.</p>
      )}

      {storiedResponses.length > 0 && filteredResponses.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-16">
          {filter === 'new'
            ? "You've voted on everyone so far — nice work. Check back as more entries come in."
            : "You haven't voted on anyone yet — tap a category on a card to add it here."}
        </p>
      )}

      {filteredResponses.map((r) => (
        <ResponseCard
          key={r.id}
          response={r}
          tapped={tappedByResponse.get(r.id) || new Set()}
          votedBefore={everVotedIds.has(r.id)}
          interactive={interactive}
          onVote={(category) => handleVote(r.id, category)}
          onReadStory={() => setOpenStoryId(r.id)}
        />
      ))}

      {openStoryResponse && (
        <StoryModal
          name={openStoryResponse.display_name}
          story={openStoryResponse.story}
          onClose={() => setOpenStoryId(null)}
        />
      )}
    </div>
  );
}
