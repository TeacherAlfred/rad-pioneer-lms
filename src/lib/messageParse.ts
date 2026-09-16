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
  | { kind: 'welcome_menu'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'human_handoff'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'freeform_bulk'; status: 'delivered' | 'failed'; label: string; detail?: string }
  | { kind: 'queued'; label: string }
  | { kind: 'admin_alert'; label: string }
  | { kind: 'button_tap'; label: string; detail?: string }
  | { kind: 'system'; label: string }
  | { kind: 'unsupported'; label: string }
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

    // A lead flagged leads.is_business_number - sent to outbound_message_queue
    // for approval instead of Meta (see src/lib/leadSend.ts's sendToLead()).
    // Checked before the generic bot_media catch-all below for the same
    // reason bot_flow/admin_alert are.
    match = body.match(/^\[Queued for approval: (.+)\]$/);
    if (match) return { kind: 'queued', label: match[1] };

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

    // The STAGE 1 catch-all sent to any new/returning lead with no keyword
    // match - not a real bot_media row (nothing under /admin/bot-media
    // produces this), so it needs its own case ahead of the generic
    // catch-all below, same reason bot_flow/queued/admin_alert do. Covers
    // both the generic welcome menu and the robotics-watch ad set's own
    // greeting - both log this same body text (see whatsapp-webhook/
    // route.ts's sendToLead(..., 'welcome menu') call), so this label alone
    // can't distinguish which variant actually went out.
    if (body === '[Delivered welcome menu]') {
      return { kind: 'welcome_menu', status: 'delivered', label: 'Welcome menu' };
    }
    match = body.match(/^\[FAILED to deliver welcome menu: (.+)\]$/);
    if (match) return { kind: 'welcome_menu', status: 'failed', label: 'Welcome menu', detail: match[1] };

    // The Message Funnel page's bulk-send wizard (src/app/admin/bot-flows/
    // funnel) - a labeled freeform blast, so it lands leads on a real,
    // reusable stage key next time instead of the generic 'text' bucket
    // every other freeform send falls into. Checked before the generic
    // bot_media catch-all below for the same reason bot_flow/welcome_menu
    // are.
    match = body.match(/^\[Delivered freeform: (.+)\]$/);
    if (match) return { kind: 'freeform_bulk', status: 'delivered', label: match[1] };
    match = body.match(/^\[FAILED to deliver freeform (.+?): (.+)\]$/);
    if (match) return { kind: 'freeform_bulk', status: 'failed', label: match[1], detail: match[2] };

    match = body.match(/^\[Delivered (.+)\]$/);
    if (match) return { kind: 'bot_media', status: 'delivered', label: match[1] };

    return { kind: 'text', label: body };
  }

  const match = body.match(/^\[Button Reply: (.+) \((.+)\)\]$/);
  if (match) return { kind: 'button_tap', label: match[1], detail: match[2] };

  const systemMatch = body.match(/^\[System: ([\s\S]+)\]$/);
  if (systemMatch) return { kind: 'system', label: systemMatch[1] };

  const unsupportedMatch = body.match(/^\[Unsupported message: ([\s\S]+)\]$/);
  if (unsupportedMatch) return { kind: 'unsupported', label: unsupportedMatch[1] };

  return { kind: 'text', label: body };
}

export const KIND_LABEL: Record<string, string> = {
  template: 'Template Send',
  bot_flow: 'Bot Flow',
  bot_media: 'Bot Media',
  welcome_menu: 'Welcome Menu',
  human_handoff: 'Human Handoff',
  freeform_bulk: 'Bulk Message',
  queued: 'Awaiting Approval',
  admin_alert: 'Admin Alert',
  button_tap: 'Button Tap',
  system: 'System Notice',
  unsupported: 'Unsupported Message',
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
