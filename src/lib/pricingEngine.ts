// Quote & Pricing Engine cost/margin math (RAD_Academy_Quote_Pricing_Engine_
// Spec_v1.md §5). Pure functions shared by the admin pricing wizard (to
// persist computed_cost/recommended_fee snapshots on an event_packages row)
// and anywhere else that needs to preview the same numbers without a write.

export type CostType = 'flat' | 'per_unit' | 'per_session';
export type QuantityType = 'per_child' | 'flat';

export interface RollupItem {
  cost_type: CostType;
  unit_cost: number;
  quantity_type: QuantityType;
  // Multiplier for a per_child/per_unit item priced per occurrence (e.g. 4
  // weekly sessions in a month) - defaults to 1 when unset. Spec §2.3 calls
  // this quantity_override ("2 workbooks"); reused here the same way for
  // "R60/session x 4 sessions" style per-child-per-period items.
  quantity_override?: number | null;
}

// Per-child cost rollup, spec §5:
//   per_child_cost = Σ(per_unit/per_session item costs)
//                  + (Σ(flat item costs) ÷ expected_attendee_count)
// A package-level quantity_type of 'flat' means the cost is shared across
// the whole event's expected attendees regardless of the underlying
// inventory item's own cost_type (e.g. venue hire) - so the apportionment
// is driven by quantity_type, not cost_type, matching how event_packages
// actually composes items in the seed data (§9).
// unitMultiplier scales the WHOLE rollup for one attachment - e.g. the same
// "Workshop — Per Day" package attached at unitMultiplier=2 becomes "Both
// Days" without needing a separate package definition per day-count.
// Mathematically equivalent to multiplying every item's own contribution
// (per_child and flat alike) before dividing flat by attendee count, since
// (perChild + flat/attendees) * M === perChild*M + (flat*M)/attendees.
export function computeCostRollup(
  items: RollupItem[],
  expectedAttendeeCount: number | null | undefined,
  unitMultiplier: number | null | undefined = 1
): number {
  let perChildTotal = 0;
  let flatTotal = 0;

  for (const item of items) {
    // 0 is a legitimate override ("exclude this item from this package")
    // distinct from null/undefined ("no override, default to ×1") - a
    // truthy/">0" check would silently treat an explicit 0 as unset.
    const multiplier = item.quantity_override !== null && item.quantity_override !== undefined ? item.quantity_override : 1;
    const contribution = Number(item.unit_cost) * multiplier;
    if (item.quantity_type === 'flat') {
      flatTotal += contribution;
    } else {
      perChildTotal += contribution;
    }
  }

  const attendees = expectedAttendeeCount && expectedAttendeeCount > 0 ? expectedAttendeeCount : 1;
  const units = unitMultiplier && unitMultiplier > 0 ? unitMultiplier : 1;
  return (perChildTotal + flatTotal / attendees) * units;
}

// recommended_fee = per_child_cost ÷ (1 - target_margin_pct) - solves for
// margin as a percentage of price (not markup-on-cost), spec §5.
export function computeRecommendedFee(perChildCost: number, targetMarginPct: number | null | undefined): number | null {
  if (targetMarginPct === null || targetMarginPct === undefined) return null;
  const marginFraction = targetMarginPct / 100;
  if (marginFraction >= 1) return null;
  return perChildCost / (1 - marginFraction);
}

// margin_pct = (final_fee − per_child_cost) ÷ final_fee, spec §5.
export function computeMarginPct(finalFee: number, perChildCost: number): number | null {
  if (!finalFee) return null;
  return ((finalFee - perChildCost) / finalFee) * 100;
}

// Spec §4's advisory default margin bands, keyed by event_type - editable
// per-event in the wizard, never hardcoded as an enforced percentage.
export const DEFAULT_MARGIN_BAND: Record<string, { min: number; max: number }> = {
  workshop: { min: 35, max: 45 },
  term_lessons: { min: 55, max: 65 },
  priority_coaching: { min: 60, max: 75 },
  webinar: { min: 0, max: 0 },
  // Same reasoning as priority_coaching - scarce 1-on-1 educator time, not
  // a price-sensitive volume play. Confirmed with the founder rather than
  // assumed (spec §16.1 explicitly flags not to reuse term_lessons's
  // cohort-sharing-assumption band for this product).
  personalized_lessons: { min: 60, max: 75 },
};

export function defaultTargetMarginPct(eventType: string): number | null {
  const band = DEFAULT_MARGIN_BAND[eventType];
  if (!band || eventType === 'webinar') return null;
  return (band.min + band.max) / 2;
}

// Spec §6 guardrail check - soft notice below the recommended band, hard
// block (override required) below cost. Mirrors the DB check constraint on
// event_packages (event_packages_below_cost_needs_reason) so the UI can
// warn before a save attempt hits that constraint.
export function guardrailCheck(
  finalFee: number,
  computedCost: number,
  eventType: string
): { level: 'ok' | 'soft' | 'hard'; message: string | null } {
  if (finalFee < computedCost) {
    return { level: 'hard', message: 'This final fee is below cost — an override reason is required before this can be saved.' };
  }
  const band = DEFAULT_MARGIN_BAND[eventType];
  if (band && eventType !== 'webinar') {
    const marginPct = computeMarginPct(finalFee, computedCost);
    if (marginPct !== null && marginPct < band.min) {
      return { level: 'soft', message: `This is below the recommended ${band.min}–${band.max}% band for ${eventType.replace('_', ' ')}.` };
    }
  }
  return { level: 'ok', message: null };
}
