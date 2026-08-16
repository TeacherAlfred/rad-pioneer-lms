// The session rating formula - RAD_Post_Session_Review_Spec.md S8.
// Wants-more carries the most weight because it's the only field that
// predicts revenue and, for this ICP, it's the child's veto captured
// directly. Never display without the response count alongside it (see
// confidence below) - a rating built on a handful of enthusiastic
// responses out of a full roster isn't the same claim as one built on
// near-total response.
import { DIFFICULTY_OPTIONS, COMPLETION_OPTIONS } from './sessionReview';

const WANTS_MORE_SCORE: Record<string, number> = { 'Yes!': 5, 'Maybe': 3, 'Not really': 1 };
const COMPLETION_SCORE: Record<string, number> = {
  'Yes': 5, 'Nearly': 4, 'No, ran out of time': 2, 'No, got stuck': 1,
};
// Distance from "Just right" (index 2), either direction - a flat
// distribution around it (mixed-ability room) is a different problem
// than a skewed one (wrong level), but for a single rollup number both
// just count as "not quite right" in proportion to how far off they are.
const JUST_RIGHT_INDEX = DIFFICULTY_OPTIONS.indexOf('Just right');

function avg(nums: number[]): number | null {
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length;
}

export type SessionReviewRow = {
  enjoyment: number | null;
  difficulty: string | null;
  completion: string | null;
  wants_more: string | null;
};

export type SessionRating = {
  value: number | null; // out of 5, one decimal - null if nobody's answered anything yet
  responseCount: number;
  rosterSize: number;
  responseRate: number; // 0-1
  confidence: 'low' | 'normal';
};

export function computeSessionRating(reviews: SessionReviewRow[], rosterSize: number): SessionRating {
  const wantsMoreScores = reviews.map(r => (r.wants_more ? WANTS_MORE_SCORE[r.wants_more] : undefined)).filter((v): v is number => v !== undefined);
  const enjoymentScores = reviews.map(r => r.enjoyment).filter((v): v is number => v !== null && v !== undefined);
  const completionScores = reviews.map(r => (r.completion ? COMPLETION_SCORE[r.completion] : undefined)).filter((v): v is number => v !== undefined);
  const difficultyFitScores = reviews
    .map(r => {
      if (!r.difficulty) return undefined;
      const idx = DIFFICULTY_OPTIONS.indexOf(r.difficulty);
      if (idx === -1) return undefined;
      const distance = Math.abs(idx - JUST_RIGHT_INDEX);
      const maxDistance = Math.max(JUST_RIGHT_INDEX, DIFFICULTY_OPTIONS.length - 1 - JUST_RIGHT_INDEX);
      return 5 - (distance / maxDistance) * 4;
    })
    .filter((v): v is number => v !== undefined);

  const components = [
    { avg: avg(wantsMoreScores), weight: 0.4 },
    { avg: avg(enjoymentScores), weight: 0.3 },
    { avg: avg(completionScores), weight: 0.2 },
    { avg: avg(difficultyFitScores), weight: 0.1 },
  ].filter((c): c is { avg: number; weight: number } => c.avg !== null);

  let value: number | null = null;
  if (components.length > 0) {
    // Re-normalised over whichever components actually have data, so a
    // session where nobody answered the difficulty question doesn't
    // just silently score 10% lower for a question nobody saw.
    const totalWeight = components.reduce((s, c) => s + c.weight, 0);
    const weightedSum = components.reduce((s, c) => s + c.avg * c.weight, 0);
    value = Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  const responseRate = rosterSize > 0 ? reviews.length / rosterSize : 0;

  return {
    value,
    responseCount: reviews.length,
    rosterSize,
    responseRate,
    confidence: responseRate < 0.5 ? 'low' : 'normal',
  };
}

// Counts per option, in a fixed display order - never reduced to a mean
// (spec S7.1: a flat "too easy"/"too tricky" split would average out to
// a false "just right").
export function countByOption(values: (string | null)[], options: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt] = 0;
  for (const v of values) {
    if (v && v in counts) counts[v]++;
  }
  return counts;
}

export function countByEnjoyment(values: (number | null)[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of values) {
    if (v !== null && v !== undefined && v in counts) counts[v]++;
  }
  return counts;
}
