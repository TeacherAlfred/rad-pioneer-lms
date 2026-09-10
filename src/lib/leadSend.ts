// One choke point for every automated (non-admin-initiated) send TO a
// lead's own number - used by whatsapp-webhook/route.ts's 11 lead-directed
// send sites, the young-adult nurture cron, and the self-serve
// package-selection quote send. Manual sends (Send Template, the Reply box,
// DesktopSendButton, QuoteReminderButton) do NOT go through this - those
// are already a human choosing to send at that moment, which is exactly
// what this gate exists to require for the automated paths.
//
// If leads.is_business_number is set, the send never actually reaches Meta:
// it's queued in outbound_message_queue for an admin to approve or reject
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

export async function sendToLead(
  supabase: any,
  lead: { id: string; is_business_number?: boolean | null },
  phone: string,
  send: LeadSend,
  label: string
): Promise<LeadSendResult> {
  if (lead.is_business_number) {
    await supabase.from('outbound_message_queue').insert([{
      lead_id: lead.id,
      phone,
      label,
      kind: send.kind,
      send_payload: send,
      preview_text: buildPreviewText(send),
    }]);
    await supabase.from('admin_notification_buffer').insert([{
      lead_id: lead.id,
      event_text: `📋 Message queued for approval (business number) - ${label}`,
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
