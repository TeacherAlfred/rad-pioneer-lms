// Shared between the public /kiosk/[token] flow and its API route, plus
// the admin reviews/testimonials views. See RAD_Post_Session_Review_Spec.md.

export const ENJOYMENT_FACES = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '🙁' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

export const DIFFICULTY_OPTIONS = ['Too easy', 'A bit easy', 'Just right', 'A bit tricky', 'Too tricky'];
export const COMPLETION_OPTIONS = ['Yes', 'Nearly', 'No, ran out of time', 'No, got stuck'];
export const WANTS_MORE_OPTIONS = ['Yes!', 'Maybe', 'Not really'];
export const TIMING_OPTIONS = ['On time', 'Over', 'Under'];

export type SessionReviewPatch = {
  enjoyment?: number | null;
  built_text?: string | null;
  difficulty?: string | null;
  completion?: string | null;
  wants_more?: string | null;
  open_text?: string | null;
  device_context?: string | null;
  completed_at?: string | null;
};

// Best-effort keyword scan, not a substitute for the founder actually
// reading held reviews - just enough to force that read to happen. Kept
// short and low-precision on purpose: false positives just mean an
// extra review gets held, which is the safe direction to err in.
const DISTRESS_KEYWORDS = [
  'hurt', 'scared', 'afraid', 'cry', 'crying', 'bully', 'bullied', 'bullying',
  'hate', 'hit me', 'hit by', 'unsafe', 'touched me', 'sad', 'alone', 'left out',
];

export function computeHoldStatus(review: {
  enjoyment?: number | null;
  wants_more?: string | null;
  completion?: string | null;
  built_text?: string | null;
  open_text?: string | null;
}): 'none' | 'held' {
  if (review.enjoyment !== null && review.enjoyment !== undefined && review.enjoyment <= 2) return 'held';
  if (review.wants_more === 'Not really') return 'held';
  if (review.completion === 'No, got stuck') return 'held';
  const text = `${review.built_text || ''} ${review.open_text || ''}`.toLowerCase();
  if (DISTRESS_KEYWORDS.some(k => text.includes(k))) return 'held';
  return 'none';
}

export function formatLabel(str: string | null | undefined) {
  if (!str) return 'Unknown';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
