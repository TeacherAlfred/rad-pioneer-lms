// Shared between Message Activity (per-lead conversation view) and the
// Messages Outbox (flat "every outbound attempt" view) - both need to
// decode the same bracketed-text convention `messages.body` uses instead of
// structured columns (see whatsapp-webhook/route.ts) into something
// groupable/countable. Extracted from src/app/admin/lead-funnel/messages/page.tsx
// (2026-09-08) rather than left duplicated a second time - the exact
// bracket-format list already needed hand-syncing across every send site
// that produces one, no reason to also hand-sync two readers of them.

export type ParsedMessage =
  | { kind: 'template'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'bot_flow'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'bot_media'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'human_handoff'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'admin_alert'; label: string }
  | { kind: 'button_tap'; label: string; detail?: string }
  | { kind: 'text'; label: string };

export function parseMessage(m: { direction: string | null; body: string | null }): ParsedMessage {
  const body = m.body || '';

  if (m.direction === 'outbound') {
    let match = body.match(/^\[Delivered template: (.+)\]$/);
    if (match) return { kind: 'template', status: 'delivered', label: match[1] };

    match = body.match(/^\[FAILED to deliver template (.+?): (.+)\]$/);
    if (match) return { kind: 'template', status: 'failed', label: match[1], detail: match[2] };

    if (body === '[Delivered human-handoff acknowledgment]') {
      return { kind: 'human_handoff', status: 'delivered', label: 'Human handoff acknowledgment' };
    }
    match = body.match(/^\[FAILED to deliver acknowledgment: (.+)\]$/);
    if (match) return { kind: 'human_handoff', status: 'failed', label: 'Human handoff acknowledgment', detail: match[1] };

    // Admin pipeline/registration alerts - sent TO the admin's own number
    // ABOUT a lead (see notifyAdmin/notifyAdminOfRegistration/
    // flushBufferedNotifications), never to the lead itself. Checked before
    // the generic bot_media catch-all below for the same reason bot_flow is.
    match = body.match(/^\[Admin Alert\] ([\s\S]+)$/);
    if (match) return { kind: 'admin_alert', label: match[1] };

    // Checked before the generic "[Delivered X]" bot_media catch-all below,
    // which would otherwise also match this and mislabel every Bot Flows
    // message-type send as Bot Media.
    match = body.match(/^\[Delivered flow: (.+)\]$/);
    if (match) return { kind: 'bot_flow', status: 'delivered', label: match[1] };
    match = body.match(/^\[FAILED to deliver flow (.+?): (.+)\]$/);
    if (match) return { kind: 'bot_flow', status: 'failed', label: match[1], detail: match[2] };

    match = body.match(/^\[FAILED to deliver "(.+?)": (.+)\]$/);
    if (match) return { kind: 'bot_media', status: 'failed', label: match[1], detail: match[2] };

    match = body.match(/^\[Delivered (.+)\]$/);
    if (match) return { kind: 'bot_media', status: 'delivered', label: match[1] };

    return { kind: 'text', label: body };
  }

  const match = body.match(/^\[Button Reply: (.+) \((.+)\)\]$/);
  if (match) return { kind: 'button_tap', label: match[1], detail: match[2] };
  return { kind: 'text', label: body };
}

export const KIND_LABEL: Record<string, string> = {
  template: 'Template Send',
  bot_flow: 'Bot Flow',
  bot_media: 'Bot Media',
  human_handoff: 'Human Handoff',
  admin_alert: 'Admin Alert',
  button_tap: 'Button Tap',
  text: 'Text',
};

// WhatsApp's own check-mark convention - only meaningful for outbound rows
// that actually got a status webhook (see whatsapp-webhook/route.ts's
// applyMessageStatus). Rows sent before this feature existed, or sent via
// method='desktop' (no API delivery confirmation is possible), have no
// status at all and render with none of this, not a placeholder.
export const STATUS_DISPLAY: Record<string, { icon: string; label: string; className: string }> = {
  sent: { icon: '✓', label: 'Sent', className: 'text-slate-400' },
  delivered: { icon: '✓✓', label: 'Delivered', className: 'text-slate-400' },
  played: { icon: '✓✓', label: 'Played', className: 'text-slate-400' },
  read: { icon: '✓✓', label: 'Read', className: 'text-sky-500' },
  failed: { icon: '⚠', label: 'Failed', className: 'text-rose-500' },
};
