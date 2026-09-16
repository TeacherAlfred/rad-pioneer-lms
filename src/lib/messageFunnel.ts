// Shared between the Message Funnel aggregation endpoint (computes every
// lead's current/ever stage) and its send endpoint (re-checks a lead's
// history server-side before allowing a resend) - both need the exact same
// "what counts as a stage" rule, or a lead could dodge the resend warning by
// one endpoint disagreeing with the other about what happened.
import { parseMessage, ParsedMessage } from '@/lib/messageParse';

// Kinds that exist in messages.body but aren't a lead-visible "stage" - a
// queued row was never actually delivered yet, and an admin_alert is a
// message TO the admin about the lead, never TO the lead.
const EXCLUDED_KINDS = new Set(['queued', 'admin_alert']);

export function isEligibleStage(parsed: ParsedMessage): boolean {
  if (EXCLUDED_KINDS.has(parsed.kind)) return false;
  // A failed send never reached the lead - they can't be "sitting" at it.
  if ('status' in parsed && (parsed as any).status === 'failed') return false;
  return true;
}

// Freeform (kind:'text') outbound sends carry the literal message body as
// their label - useful in Message Activity, useless as a funnel stage (every
// manual reply would be its own one-lead "stage" forever), so every plain
// text send collapses into one shared bucket here. This feature's own bulk
// freeform sends use the separate, genuinely-labeled 'freeform_bulk' kind
// instead (see messageParse.ts) and are never collapsed.
export const GENERIC_TEXT_KEY = 'text:__generic__';
export const GENERIC_TEXT_LABEL = 'Freeform reply (untracked)';

export function stageKeyFor(parsed: ParsedMessage): { key: string; label: string; kind: string } {
  if (parsed.kind === 'text') return { key: GENERIC_TEXT_KEY, label: GENERIC_TEXT_LABEL, kind: 'text' };
  return { key: `${parsed.kind}:${parsed.label}`, label: parsed.label, kind: parsed.kind };
}

// A lead's set of stage keys ever reached (delivered, non-excluded) from
// their outbound message rows, oldest occurrence per key kept. Callers pass
// only that lead's own rows, oldest-first.
export function everStageKeysFor(rows: { body: string | null }[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    const parsed = parseMessage({ direction: 'outbound', body: row.body });
    if (!isEligibleStage(parsed)) continue;
    keys.add(stageKeyFor(parsed).key);
  }
  return keys;
}
