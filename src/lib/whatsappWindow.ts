// Whether a lead can still receive a free-form/interactive WhatsApp message
// right now, per Meta's customer-service window rule. That window is 24h for
// an organic inbound message, but Meta grants 72h for "free entry point"
// conversations opened via a Click-to-WhatsApp ad referral - so this always
// prefers Meta's own conversation_expires_at (re-stamped on every outbound
// status webhook while a conversation is active - see
// whatsapp-webhook/route.ts) over a locally computed lastInbound+24h
// estimate, since only Meta's value reflects which window actually applies.
// Falls back to the 24h computed value whenever no Meta-sourced timestamp is
// available yet for the current conversation (e.g. brand-new lead, or the
// status webhook for the triggering message hasn't landed yet).
const DEFAULT_WINDOW_HOURS = 24;

export type WhatsAppWindowMessage = {
  direction: string;
  created_at?: string | null;
  conversation_expires_at?: string | null;
};

export type WindowState = {
  expiresAt: Date | null;
  isOpen: boolean;
  msRemaining: number;
  source: 'meta' | 'computed' | null;
  // Total length of the window this expiry describes (24 for the standard
  // rule, 72 for an ad-referral entry point, etc.) - derived from Meta's own
  // expiresAt when available, so this reflects reality rather than assuming
  // the standard rule always applies.
  totalHours: number | null;
};

export function computeWindowState(messages: WhatsAppWindowMessage[]): WindowState {
  const lastInbound = [...messages]
    .filter(m => m.direction === 'inbound' && m.created_at)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())[0];

  if (!lastInbound?.created_at) {
    return { expiresAt: null, isOpen: false, msRemaining: 0, source: null, totalHours: null };
  }

  const lastInboundTime = new Date(lastInbound.created_at).getTime();
  const computedExpiresAt = new Date(lastInboundTime + DEFAULT_WINDOW_HOURS * 60 * 60 * 1000);

  // Only trust a Meta-supplied expiry if it describes the CURRENT window
  // (i.e. it came from a message at/after the last inbound one) - otherwise
  // it's a stale value from a previous, already-closed conversation.
  const metaCandidate = [...messages]
    .filter(m => m.conversation_expires_at && m.created_at && new Date(m.created_at).getTime() >= lastInboundTime)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())[0];

  const expiresAt = metaCandidate?.conversation_expires_at
    ? new Date(metaCandidate.conversation_expires_at)
    : computedExpiresAt;
  const source: WindowState['source'] = metaCandidate?.conversation_expires_at ? 'meta' : 'computed';
  const totalHours = Math.round((expiresAt.getTime() - lastInboundTime) / (60 * 60 * 1000));

  const msRemaining = expiresAt.getTime() - Date.now();
  return { expiresAt, isOpen: msRemaining > 0, msRemaining: Math.max(0, msRemaining), source, totalHours };
}
