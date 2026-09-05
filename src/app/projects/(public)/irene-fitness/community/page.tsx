'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Smile,
  Sparkles,
  FlaskConical,
  Footprints,
  Mountain,
  Target,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Copy,
  Share2,
} from 'lucide-react';
import { BottomSheetModal } from '../BottomSheetModal';
import { TourOverlay, type TourStep } from '../TourOverlay';
import { START_TOUR_EVENT, openIreneFitnessContact } from '../HeaderActions';

type VoteCategory = 'funniest' | 'most_inspiring' | 'mad_scientist';
type Phase = 'locked' | 'open' | 'standings_only';

// The written fields an admin can pick between as a category's public
// stand-in (Responses admin page) - excludes the fact fields (club_member/
// club_names/shoe_count), which are pills, not narrative teasers.
type StoryFieldKey =
  | 'motivation'
  | 'toughest_challenge'
  | 'proudest_moment'
  | 'weirdest_fuel'
  | 'funniest_fail'
  | 'boss_level_challenge_2026';

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
  // 'blank' is a deliberate admin marking (Responses page) for when a
  // family's answer for this category is content-free even though the
  // field itself isn't empty (e.g. "Nothing really") - distinct from no
  // override at all, since it must never fall through to auto-detected
  // content, only to no display at all.
  category_overrides: Partial<Record<VoteCategory, StoryFieldKey | 'blank'>> | null;
  featured_category: VoteCategory | null;
} | null;

type FeedResponse = {
  id: string;
  display_name: string;
  story: Story;
  votes: Record<VoteCategory, number>;
};

type FeedAd = {
  id: string;
  image_url: string;
  cta_label: string;
  contact_prefill: string;
};

type FeedItem = { type: 'response'; response: FeedResponse } | { type: 'ad'; ad: FeedAd };

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

function Avatar({
  name,
  size = 36,
  className = '',
  id,
}: {
  name: string;
  size?: number;
  className?: string;
  id?: string;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const { bg, text } = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return (
    <div
      id={id}
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
const STORY_FIELD_LABELS: Record<StoryFieldKey, string> = {
  motivation: 'Why I started',
  toughest_challenge: 'Toughest challenge yet',
  proudest_moment: 'Proudest moment',
  weirdest_fuel: 'Weirdest training fuel',
  funniest_fail: 'Funniest fitness fail',
  boss_level_challenge_2026: '2026 "Boss Level" goal',
};

function storyFieldValue(story: Story, key: StoryFieldKey): string | null {
  if (!story) return null;
  const v = story[key];
  return typeof v === 'string' && v ? v : null;
}

// Which field reads as "what they wrote for this category" - same mapping
// the admin vote-leaderboard uses (see vote-leaderboard/route.ts's
// excerptFor), kept in sync so "top voted" means the same story on both the
// public carousel and the admin leaderboard. An admin-set override
// (Responses page) always wins: a real field name substitutes that field's
// text for when the default is blank or just says "N/A"; 'blank' is the
// admin explicitly saying this category has nothing real to show, which
// must return null here - never fall through to the default field-priority
// below, and never borrow a different category's content.
function categoryExcerpt(category: VoteCategory, story: Story): { label: string; value: string } | null {
  if (!story) return null;

  const overrideValue = story.category_overrides?.[category];
  if (overrideValue === 'blank') return null;
  if (overrideValue) {
    const value = storyFieldValue(story, overrideValue);
    if (value) return { label: STORY_FIELD_LABELS[overrideValue], value };
  }

  if (category === 'funniest') {
    return story.funniest_fail ? { label: 'Funniest fitness fail', value: story.funniest_fail } : null;
  }
  if (category === 'most_inspiring') {
    if (story.proudest_moment) return { label: 'Proudest moment', value: story.proudest_moment };
    if (story.motivation) return { label: 'Why I started', value: story.motivation };
    return null;
  }
  if (story.weirdest_fuel) return { label: 'Weirdest training fuel', value: story.weirdest_fuel };
  if (story.toughest_challenge) return { label: 'Toughest challenge yet', value: story.toughest_challenge };
  return null;
}

// The card's single teaser line is just whichever category is "featured"
// (Responses page; defaults to Funny when nothing's picked) - always
// resolved through categoryExcerpt so there is exactly one place that
// decides what a category shows. Previously this had its own separate
// funniest_fail -> proudest_moment fallback, which meant a blank funny
// answer would silently surface an *inspiring* story under what read as the
// humour slot - fixed by removing that fallback entirely rather than
// teaching it about 'blank' too.
function teaserLine(story: Story): { label: string; value: string } | null {
  if (!story) return null;
  return categoryExcerpt(story.featured_category || 'funniest', story);
}

// Highest-voted entry that actually wrote something for this category - ties
// (including the common "everyone's at 0 votes, voting just opened" case)
// resolve to whichever comes first in the list passed in, same as any other
// unranked tie.
function topCategoryHighlight(
  responses: FeedResponse[],
  category: VoteCategory
): { response: FeedResponse; excerpt: { label: string; value: string } } | null {
  let best: FeedResponse | null = null;
  let bestExcerpt: { label: string; value: string } | null = null;
  for (const r of responses) {
    const excerpt = categoryExcerpt(category, r.story);
    if (!excerpt) continue;
    if (!best || r.votes[category] > best.votes[category]) {
      best = r;
      bestExcerpt = excerpt;
    }
  }
  return best && bestExcerpt ? { response: best, excerpt: bestExcerpt } : null;
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

// Native content in the scroll, same mechanic as any other card - not a
// separate banner/takeover. First ad lands after 6-8 real entries (never in
// the first 5-6), then repeats every 8-10 entries after that, so it reads as
// occasional and in-context rather than front-loaded or relentless. Capped
// at MAX_AD_INSERTIONS total appearances so a long scroll doesn't keep
// resurfacing the same ad indefinitely.
const MAX_AD_INSERTIONS = 2;

// highlightId (the shared/auto-scrolled response, if any) never gets an ad
// inserted directly above it: that would push its own position down and
// make the auto-scroll landing spot feel wrong ("is this what I was sent
// to look at, or is it the thing above it?"). When the normal rotation
// would have landed there, the ad slides to right after that card instead
// - still shows up in roughly the same place, just never displaces it.
function interleaveAds(cards: FeedResponse[], ads: FeedAd[], highlightId?: string | null): FeedItem[] {
  const items: FeedItem[] = cards.map((response) => ({ type: 'response', response }));
  if (ads.length === 0) return items;

  let nextAdIndex = 8 + Math.floor(Math.random() * 3); // 8, 9, or 10 real cards before the first ad
  let adCursor = 0;
  let inserted = 0;
  while (nextAdIndex < items.length && inserted < MAX_AD_INSERTIONS) {
    const targetItem = items[nextAdIndex];
    const wouldPushDownHighlighted =
      !!highlightId && targetItem.type === 'response' && targetItem.response.id === highlightId;
    const insertAt = wouldPushDownHighlighted ? nextAdIndex + 1 : nextAdIndex;
    items.splice(insertAt, 0, { type: 'ad', ad: ads[adCursor % ads.length] });
    adCursor++;
    inserted++;
    nextAdIndex += 9 + Math.floor(Math.random() * 3); // then another 8-10 real cards (+1 for the ad slot itself)
  }
  return items;
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
  isExample,
  voteButtonsId,
  highlighted,
}: {
  response: FeedResponse;
  tapped: Set<VoteCategory>;
  votedBefore: boolean;
  interactive: boolean;
  onVote: (category: VoteCategory) => void;
  onReadStory?: () => void;
  isExample?: boolean;
  voteButtonsId?: string;
  highlighted?: boolean;
}) {
  const pills = factPills(response.story);
  const teaser = teaserLine(response.story);

  return (
    <div
      id={`response-${response.id}`}
      className={`p-5 rounded-2xl bg-white border shadow-sm mb-4 transition-shadow duration-500 ${
        highlighted ? 'border-[#0066cc]/30 ring-4 ring-[#0066cc]/30' : 'border-black/5'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={response.display_name} size={36} />
        <p className="font-black text-lg">{response.display_name}</p>
        {isExample && (
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-slate-100 text-slate-400">
            Example
          </span>
        )}
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

      {onReadStory && (
        <button
          onClick={onReadStory}
          className="flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline mb-4"
        >
          Read full story
          <ChevronDown size={14} />
        </button>
      )}

      <div id={voteButtonsId} className="pt-4 border-t border-black/5">
        <VoteButtons votes={response.votes} tapped={tapped} interactive={interactive} onVote={onVote} />
      </div>
    </div>
  );
}

// A native promotional card, same footprint as a story card so it reads as
// "content in the scroll" rather than a banner takeover - no separate guide,
// no consolidated web page, just a tap straight into the existing contact
// form. Title/intro are set to match what was actually tapped (the CTA
// label itself, plus webinar-specific framing) rather than falling through
// to the generic "Ask us" / "drop your question" copy that fits a real
// question, not a registration.
// Full-size lightbox for a tapped ad image - portaled to document.body for
// the same reason BottomSheetModal is (the header nav's backdrop-blur
// establishes a new containing block for position:fixed descendants).
function AdImageModal({ ad, onClose }: { ad: FeedAd; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X size={20} />
      </button>
      <div className="relative w-full max-w-2xl aspect-[9/16] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <Image src={ad.image_url} alt={ad.cta_label} fill className="object-contain" sizes="100vw" />
      </div>
    </div>,
    document.body
  );
}

// Half the viewport's height (not full-bleed width like a story card's
// avatar/text content) so the ad reads as "one native card among many" in
// the scroll rather than dominating it - height-driven with an auto width
// keeps the creative's real 9:16 aspect ratio intact. Tapping the image
// opens it full-size (AdImageModal); the CTA underneath is a separate tap
// target straight into the contact form, so a curious tap on the artwork
// doesn't accidentally launch the registration flow.
function AdCard({ ad }: { ad: FeedAd }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm mb-4 overflow-hidden">
      <button onClick={() => setExpanded(true)} className="block w-full">
        <div className="relative mx-auto w-auto h-[50vh] aspect-[9/16] bg-slate-100">
          <Image src={ad.image_url} alt={ad.cta_label} fill className="object-cover" sizes="320px" />
        </div>
      </button>
      <div className="p-4">
        <button
          onClick={() =>
            openIreneFitnessContact(ad.contact_prefill, {
              title: ad.cta_label,
              intro: "Pop your details below and we'll confirm your spot and send the webinar link.",
            })
          }
          className="block w-full text-center py-3 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white"
        >
          {ad.cta_label}
        </button>
      </div>
      {expanded && <AdImageModal ad={ad} onClose={() => setExpanded(false)} />}
    </div>
  );
}

// Client-side only - never touches the API, never appears in `responses`,
// so there's no real id for anyone to vote against and nothing to clean up
// server-side. Exists purely so the tour's "Categories" step has a stable
// element to scroll to and spotlight (real cards shuffle position), and is
// only rendered for the duration of that one step (see tourStep === 2
// below) so it's never mistaken for an actual entry.
const TOUR_DUMMY_RESPONSE: FeedResponse = {
  id: '__tour_dummy__',
  display_name: 'Example Family',
  story: {
    motivation: null,
    club_member: null,
    club_names: null,
    category_overrides: null,
    featured_category: null,
    shoe_count: 2,
    boss_level_challenge_2026: null,
    toughest_challenge: null,
    proudest_moment: null,
    weirdest_fuel: null,
    funniest_fail: 'Tripped over my own shoelaces crossing the finish line',
  },
  votes: { funniest: 0, most_inspiring: 0, mad_scientist: 0 },
};

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
function CheerSquad({ responses, highlightId }: { responses: FeedResponse[]; highlightId?: string | null }) {
  if (responses.length === 0) return null;
  const visible = responses.slice(0, CHEER_SQUAD_VISIBLE);
  const remaining = responses.length - visible.length;
  return (
    <div id="tour-cheer-squad" className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4">
      <p className="text-xs font-bold text-slate-400">Also cheering everyone on</p>
      <p className="text-[11px] text-slate-400 mb-3">No story shared, but you can still vote on their entries.</p>
      <div className="flex items-center flex-nowrap">
        {visible.map((r, i) => (
          <Avatar
            key={r.id}
            id={`response-${r.id}`}
            name={r.display_name}
            size={32}
            className={`ring-2 transition-shadow duration-500 ${
              r.id === highlightId ? 'ring-[#0066cc] ring-[3px]' : 'ring-white'
            } ${i > 0 ? '-ml-3' : ''}`}
          />
        ))}
        {remaining > 0 && (
          <span className="shrink-0 whitespace-nowrap text-xs font-bold text-slate-400 ml-2">+{remaining} more</span>
        )}
      </div>
    </div>
  );
}

// Text-only tint per category, matching the admin leaderboard's
// VOTE_CATEGORY_COLORS - CATEGORY_CONFIG's activeClass/idleClass are tuned
// for full pill buttons, not a small icon swatch.
const CATEGORY_TEXT_COLOR: Record<VoteCategory, string> = {
  funniest: 'text-teal-700',
  most_inspiring: 'text-[#0066cc]',
  mad_scientist: 'text-violet-700',
};

// Shows only the single category excerpt tapped, not the full story - a
// narrower sibling of StoryModal for "Read more" on a carousel card.
function CategoryHighlightModal({
  name,
  label,
  value,
  onClose,
}: {
  name: string;
  label: string;
  value: string;
  onClose: () => void;
}) {
  return (
    <BottomSheetModal title={name} onClose={onClose}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </BottomSheetModal>
  );
}

// Top entry per category, one card at a time with left/right nav, right
// after the Cheer Squad strip - a quick "who's leading" glance before the
// full scroll. A horizontal-scroll strip here read as a stray scrollbar
// rather than a deliberate carousel, so this steps through one card per tap
// instead. "Read more" opens only that one category's excerpt
// (CategoryHighlightModal), never the full multi-field story.
function CategoryHighlightsCarousel({
  responses,
  onReadMore,
}: {
  responses: FeedResponse[];
  onReadMore: (highlight: { name: string; label: string; value: string }) => void;
}) {
  const highlights = CATEGORY_CONFIG.map((config) => ({
    config,
    highlight: topCategoryHighlight(responses, config.key),
  })).filter((h): h is { config: (typeof CATEGORY_CONFIG)[number]; highlight: NonNullable<typeof h.highlight> } => h.highlight !== null);

  const [index, setIndex] = useState(0);

  if (highlights.length === 0) return null;

  // Guards against a stale index after `responses` changes shrink the list
  // (e.g. a category briefly has no entries with story content yet).
  const current = Math.min(index, highlights.length - 1);
  const { config, highlight } = highlights[current];
  const canNavigate = highlights.length > 1;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => (Math.min(i, highlights.length - 1) - 1 + highlights.length) % highlights.length)}
          disabled={!canNavigate}
          aria-label="Previous category highlight"
          className="shrink-0 w-8 h-8 rounded-full bg-white border border-black/5 shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1 min-w-0 p-4 rounded-2xl bg-white border border-black/5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <config.icon size={13} className={CATEGORY_TEXT_COLOR[config.key]} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Top {config.label}
            </span>
          </div>
          <p className="font-black text-sm truncate mb-1">{highlight.response.display_name}</p>
          <p className="text-xs text-slate-600 truncate mb-2">{highlight.excerpt.value}</p>
          <button
            onClick={() =>
              onReadMore({
                name: highlight.response.display_name,
                label: highlight.excerpt.label,
                value: highlight.excerpt.value,
              })
            }
            className="text-xs font-bold text-[#0066cc] hover:underline"
          >
            Read more
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => (Math.min(i, highlights.length - 1) + 1) % highlights.length)}
          disabled={!canNavigate}
          aria-label="Next category highlight"
          className="shrink-0 w-8 h-8 rounded-full bg-white border border-black/5 shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {canNavigate && (
        <div className="flex justify-center gap-1 mt-2">
          {highlights.map((h, i) => (
            <span
              key={h.config.key}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-[#0066cc]' : 'w-1.5 bg-slate-200'}`}
            />
          ))}
        </div>
      )}
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
    <div id="tour-filter-tabs" className="mb-4">
      <div className="flex items-center gap-2">
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
      <p className="text-[11px] text-slate-400 mt-2">
        New to you = haven&apos;t voted yet · Your favourites = already voted
      </p>
    </div>
  );
}

const TOUR_DISMISSED_KEY = 'irene_fitness_tour_dismissed';

// The three genuinely non-obvious items on the feed (business-advisor
// review, 2026-09-01, plus the vote-category step added after) - the FAQ/
// message icons are already self-evident on sight, so no step for those.
// Same explanations also live permanently in the "How do I use this page?"
// FAQ entry, so dismissing this once doesn't mean losing access to it.
const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-filter-tabs',
    title: 'Filter the feed',
    description: (
      <>
        <strong>New to you</strong> shows entries you haven&apos;t voted on yet. <strong>Your favourites</strong>{' '}
        shows the ones you have.
      </>
    ),
  },
  {
    targetId: 'tour-cheer-squad',
    title: 'Cheer Squad',
    description: (
      <>Families who joined to show support. They can still vote on everyone else&apos;s entries.</>
    ),
  },
  {
    targetId: 'tour-vote-categories',
    title: 'Categories',
    description: (
      <>
        Tap <strong className="text-teal-700">Funny</strong>, <strong className="text-[#0066cc]">Inspiring</strong>,
        and/or <strong className="text-violet-700">Craziest Diet</strong> to like and vote for an entry.
      </>
    ),
  },
];

// Opt-in, not forced (business-advisor review, 2026-09-01): a chunk of real
// traffic is shared links landing mid-feed, not top-of-page, so a blocking
// sequential tour has a real blind spot. Dismissing is remembered per
// device; nothing forces it on a second visit.
function TourPrompt({ onStart }: { onStart: () => void }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Starting `dismissed` true keeps the server-rendered and first-client-
    // paint output identical (localStorage doesn't exist during SSR) - this
    // read has to happen post-mount, not in a lazy initializer, or the two
    // renders diverge and React flags a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(localStorage.getItem(TOUR_DISMISSED_KEY) === '1');
  }, []);

  function dismiss() {
    localStorage.setItem(TOUR_DISMISSED_KEY, '1');
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#0066cc]/5 border border-[#0066cc]/10 mb-4">
      <button
        onClick={() => {
          onStart();
          dismiss();
        }}
        className="flex-1 text-left text-sm font-bold text-[#0066cc]"
      >
        New here? Quick 30-second tour →
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 p-1.5 rounded-full text-slate-400 hover:bg-black/5 hover:text-slate-600 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Shown only when a family previews their own "share for votes" link
// (?preview=1, from the my-link chooser page) - never to an actual
// recipient. shareUrl is this same page's URL minus &preview=1, so what the
// family copies/sends is exactly the page they're looking at right now.
// Fixed/hovering rather than in-flow, so it stays reachable while scrolling
// instead of sliding away with the rest of the page - topOffset (measured
// from the real <nav> height, see IreneFitnessCommunityInner) keeps it
// pinned just under the site header rather than guessing a pixel value.
// Default matches the seeded "share_vote" template exactly - only used for
// the brief window before that template has loaded, or if the fetch fails.
const DEFAULT_SHARE_TEMPLATE = 'Vote for {{name}} in the Irene Primary Fit Fam! {{link}}';

function SharePreviewBanner({
  displayName,
  shareUrl,
  shareTemplate,
  topOffset,
  bannerRef,
}: {
  displayName: string | null;
  shareUrl: string;
  shareTemplate: string;
  topOffset: number;
  bannerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API can fail (permissions, insecure context) - the link is
      // still visible/selectable in the WhatsApp share text as a fallback.
    }
  }

  function shareViaWhatsapp() {
    const text = shareTemplate
      .split('{{name}}')
      .join(displayName || 'us')
      .split('{{link}}')
      .join(shareUrl);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div ref={bannerRef} style={{ top: topOffset }} className="fixed left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
      <div className="rounded-2xl px-4 py-3 mt-3 bg-[#0066cc] text-white shadow-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs font-bold flex-1 min-w-[180px]">
            This is what friends & family will see — your card&apos;s just below.
          </p>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-white/15 hover:bg-white/25 transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            onClick={shareViaWhatsapp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-white text-[#0066cc] hover:bg-white/90 transition-colors"
          >
            <Share2 size={13} />
            Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function IreneFitnessCommunityInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const isPreview = searchParams.get('preview') === '1';
  const showBanner = isPreview && !!highlightId;

  const [phase, setPhase] = useState<Phase | null>(null);
  const [responses, setResponses] = useState<FeedResponse[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [ads, setAds] = useState<FeedAd[]>([]);
  const [shareTemplate, setShareTemplate] = useState(DEFAULT_SHARE_TEMPLATE);
  const [tappedByResponse, setTappedByResponse] = useState<Map<string, Set<VoteCategory>>>(new Map());
  const [everVotedIds, setEverVotedIds] = useState<Set<string>>(new Set());
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [scrolledToHighlight, setScrolledToHighlight] = useState(false);
  const [showHighlightRing, setShowHighlightRing] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(0);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [categoryHighlightModal, setCategoryHighlightModal] = useState<{
    name: string;
    label: string;
    value: string;
  } | null>(null);
  const [filter, setFilter] = useState<CardFilter>('all');
  const [tourStep, setTourStep] = useState<number | null>(null);

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

  useEffect(() => {
    fetch('/api/irene-fitness/feed-ads')
      .then((r) => r.json())
      .then((d) => setAds(d.ads || []))
      .catch(() => {});
  }, []);

  // Only fetched for a preview/share visitor - most feed visits never need
  // this admin-editable wording (Settings page's Message Templates).
  useEffect(() => {
    if (!showBanner) return;
    fetch('/api/irene-fitness/message-templates/share_vote')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.whatsapp_body === 'string') setShareTemplate(d.whatsapp_body);
      })
      .catch(() => {});
  }, [showBanner]);

  // "Replay the guide" in the FAQ (HeaderActions.tsx's FaqAccordion, via its
  // REPLAY_TOUR_LINK sentinel) dispatches this instead of navigating - same
  // tour targets TourPrompt uses, just triggered from the FAQ modal instead
  // of the banner. No phase check needed here the way TourPrompt has one:
  // by the time someone reaches this link the feed has already loaded (the
  // FAQ button itself is part of that loaded page), so the tour's targets
  // already exist in the DOM.
  useEffect(() => {
    function onStartTour() {
      setTourStep(0);
    }
    window.addEventListener(START_TOUR_EVENT, onStartTour);
    return () => window.removeEventListener(START_TOUR_EVENT, onStartTour);
  }, []);

  // Measures the real <nav> height (layout.tsx's sticky header) so the
  // preview banner can pin itself just beneath it instead of guessing a
  // pixel offset - re-measures on resize since the header can wrap to a
  // second line on a narrow phone.
  useEffect(() => {
    if (!showBanner) return;
    const nav = document.querySelector('nav');
    if (!nav) return;
    const measure = () => setNavHeight(nav.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [showBanner]);

  // Same idea for the banner's own height (it can wrap to two lines too) -
  // needed both for the in-flow spacer beneath it and to offset where the
  // highlighted card scrolls to. Depends on `loading` too, not just
  // `showBanner`: the banner (and bannerRef.current) only actually mounts
  // once loading flips false - while loading, this page renders nothing but
  // a "Loading…" placeholder, so bannerRef.current is still null and this
  // effect would otherwise never get a second chance to measure it once it
  // exists, permanently stalling bannerHeight at 0 (which was silently
  // blocking the highlight auto-scroll below).
  useEffect(() => {
    if (!showBanner || loading || !bannerRef.current) return;
    const el = bannerRef.current;
    const measure = () => setBannerHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showBanner, loading]);

  // Deep-link support for shared "vote for us" links (my-link chooser page's
  // "Share our entry for votes" -> ?highlight={response_id}): once the feed
  // has actually loaded, scroll to and briefly ring-highlight that card -
  // works for both a real story card and a Cheer Squad avatar, since both
  // share the same id={`response-${id}`} convention. Runs once per page
  // load; if the id isn't found (e.g. the response was since un-published),
  // it's a silent no-op.
  //
  // In preview mode, the actual scroll-margin-top offset is measured fresh
  // (via getBoundingClientRect, not the navHeight/bannerHeight *state*)
  // right before scrolling, on a short delay - mobile browsers reflow the
  // header after first paint (address-bar collapse, webfont swap, the
  // logo's intrinsic size loading in), so a state value that looked correct
  // a render or two ago can already be stale by the time this fires. This
  // was previously landing the card partly behind the banner on mobile even
  // though the same offset looked right on desktop.
  useEffect(() => {
    if (!highlightId || loading || scrolledToHighlight) return;
    const el = document.getElementById(`response-${highlightId}`);
    if (!el) return;

    const t = setTimeout(() => {
      if (showBanner) {
        const nav = document.querySelector('nav');
        const navH = nav?.getBoundingClientRect().height || 0;
        const bannerH = bannerRef.current?.getBoundingClientRect().height || 0;
        el.style.scrollMarginTop = `${navH + bannerH + 16}px`;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setScrolledToHighlight(true);
      setShowHighlightRing(true);
      setTimeout(() => setShowHighlightRing(false), 3000);
    }, 350); // let mobile layout (address bar, fonts, images) settle first

    return () => clearTimeout(t);
  }, [highlightId, loading, scrolledToHighlight, showBanner]);

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

  // Ads only rotate into the main story scroll, never the Cheer Squad strip
  // or the tour's dummy card - "native content in the scroll" means the real
  // scroll, not every list on the page.
  const feedItems = interleaveAds(filteredResponses, ads, highlightId);

  const highlightedResponse = highlightId ? responses.find((r) => r.id === highlightId) || null : null;
  const shareUrl = (() => {
    if (typeof window === 'undefined') return '';
    const u = new URL(window.location.href);
    u.searchParams.delete('preview');
    return u.toString();
  })();
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      {showBanner && (
        <>
          <SharePreviewBanner
            displayName={highlightedResponse?.display_name || null}
            shareUrl={shareUrl}
            shareTemplate={shareTemplate}
            topOffset={navHeight}
            bannerRef={bannerRef}
          />
          {/* Flow spacer - the banner itself is `fixed` and out of flow, so
              this holds its place to keep everything below from jumping up
              underneath it. */}
          <div style={{ height: bannerHeight ? bannerHeight + 12 : 0 }} />
        </>
      )}

      <h2 className="text-2xl font-black tracking-tight mb-1">Fit Fam Community</h2>
      <p className="text-sm text-slate-500 mb-6">
        {phase === 'standings_only'
          ? "Voting has closed — here's how it went."
          : 'Tap to vote for your favourites — one tap per category, per entry, per day.'}
      </p>

      {phase === 'open' && <TourPrompt onStart={() => setTourStep(0)} />}

      <CheerSquad responses={cheerSquad} highlightId={showHighlightRing ? highlightId : null} />

      <CategoryHighlightsCarousel responses={storiedResponses} onReadMore={setCategoryHighlightModal} />

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

      {tourStep === 2 && (
        <ResponseCard
          response={TOUR_DUMMY_RESPONSE}
          tapped={new Set()}
          votedBefore={false}
          interactive={false}
          onVote={() => {}}
          isExample
          voteButtonsId="tour-vote-categories"
        />
      )}

      {feedItems.map((item, i) =>
        item.type === 'ad' ? (
          <AdCard key={`ad-${item.ad.id}-${i}`} ad={item.ad} />
        ) : (
          <ResponseCard
            key={item.response.id}
            response={item.response}
            tapped={tappedByResponse.get(item.response.id) || new Set()}
            votedBefore={everVotedIds.has(item.response.id)}
            interactive={interactive}
            onVote={(category) => handleVote(item.response.id, category)}
            onReadStory={() => setOpenStoryId(item.response.id)}
            highlighted={showHighlightRing && item.response.id === highlightId}
          />
        )
      )}

      {openStoryResponse && (
        <StoryModal
          name={openStoryResponse.display_name}
          story={openStoryResponse.story}
          onClose={() => setOpenStoryId(null)}
        />
      )}

      {categoryHighlightModal && (
        <CategoryHighlightModal
          name={categoryHighlightModal.name}
          label={categoryHighlightModal.label}
          value={categoryHighlightModal.value}
          onClose={() => setCategoryHighlightModal(null)}
        />
      )}

      {tourStep !== null && (
        <TourOverlay
          steps={TOUR_STEPS}
          current={tourStep}
          onNext={() => (tourStep === TOUR_STEPS.length - 1 ? setTourStep(null) : setTourStep((s) => (s ?? 0) + 1))}
          onPrev={() => setTourStep((s) => Math.max(0, (s ?? 0) - 1))}
          onClose={() => setTourStep(null)}
        />
      )}
    </div>
  );
}

export default function IreneFitnessCommunityPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-24 text-center text-slate-400 text-sm">Loading…</div>}>
      <IreneFitnessCommunityInner />
    </Suspense>
  );
}
