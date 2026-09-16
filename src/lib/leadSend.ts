// One choke point for every automated (non-admin-initiated) send TO a
// lead's own number - used by whatsapp-webhook/route.ts's 11 lead-directed
// send sites, the young-adult nurture cron, and the self-serve
// package-selection quote send. Manual sends (Send Template, the Reply box,
// DesktopSendButton, QuoteReminderButton) do NOT go through this - those
// are already a human choosing to send at that moment, which is exactly
// what this gate exists to require for the automated paths.
//
// Two independent things can force a send into the queue instead of Meta:
// leads.is_business_number (per-lead, every automated send to them gets
// reviewed) and opts.forceQueue (per-flow - a specific bot_flows row always
// wants a human's eyes on it before it goes out, regardless of the lead -
// see runBotFlow's requires_approval handling). Either alone is enough;
// both can be true for the same send, hence `reason` being an array. Queued
// entries land in outbound_message_queue for an admin to approve or reject
// from /admin/lead-funnel/outbox, and the admin gets a buffered heads-up via
// admin_notification_buffer (written directly rather than through the
// webhook's local notifyAdmin(), which isn't exported/reusable outside that
// file). Otherwise this is a passthrough to the real send functions.
import { sendMetaTemplate, sendWhatsAppMessage } from '@/lib/metaTemplate';

export type LeadSend =
  | { kind: 'freeform'; payload: any }
  | {
      kind: 'template';
      templateName: string;
      templateLanguage: string;
      bodyValues: string[];
      variableNames?: string[];
      buttonPayloads?: string[];
    };

export type LeadSendResult = {
  ok: boolean;
  queued: boolean;
  error?: string;
  errorCode?: string;
  wamid?: string;
  messageStatus?: string;
};

function buildPreviewText(send: LeadSend): string {
  if (send.kind === 'template') {
    const values = send.bodyValues.length ? ` - ${send.bodyValues.join(' / ')}` : '';
    return `[Template: ${send.templateName}]${values}`;
  }
  const p = send.payload;
  if (p?.text?.body) return p.text.body;
  if (p?.interactive?.body?.text) return p.interactive.body.text;
  if (p?.document?.caption) return `[Document] ${p.document.caption}`;
  return JSON.stringify(p);
}

export type SendToLeadOptions = {
  // A specific bot_flows row wants every send it produces reviewed first,
  // independent of the lead - see runBotFlow's requires_approval handling.
  forceQueue?: boolean;
  // The bot_flows row this send came from, if any (the welcome menu,
  // opt-out prompt, needs-human nudge etc. have none) - stamped onto the
  // queue row for traceability/display in /admin/lead-funnel/outbox.
  botFlowId?: string;
};

const REASON_LABEL: Record<string, string> = {
  business_number: 'business number',
  flow_requires_approval: 'flow requires approval',
};

export async function sendToLead(
  supabase: any,
  lead: { id: string; is_business_number?: boolean | null },
  phone: string,
  send: LeadSend,
  label: string,
  opts: SendToLeadOptions = {}
): Promise<LeadSendResult> {
  const reasons: string[] = [];
  if (lead.is_business_number) reasons.push('business_number');
  if (opts.forceQueue) reasons.push('flow_requires_approval');

  if (reasons.length > 0) {
    await supabase.from('outbound_message_queue').insert([{
      lead_id: lead.id,
      phone,
      label,
      kind: send.kind,
      send_payload: send,
      preview_text: buildPreviewText(send),
      bot_flow_id: opts.botFlowId || null,
      reason: reasons,
    }]);
    const reasonText = reasons.map(r => REASON_LABEL[r] || r).join(', ');
    await supabase.from('admin_notification_buffer').insert([{
      lead_id: lead.id,
      event_text: `📋 Message queued for approval (${reasonText}) - ${label}`,
    }]);
    return { ok: true, queued: true };
  }

  if (send.kind === 'template') {
    const result = await sendMetaTemplate(
      phone,
      send.templateName,
      send.templateLanguage,
      send.bodyValues,
      send.variableNames || [],
      send.buttonPayloads || []
    );
    return { ...result, queued: false };
  }

  const result = await sendWhatsAppMessage(phone, send.payload);
  return { ...result, queued: false };
}
