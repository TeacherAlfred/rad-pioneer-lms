import { createHmac, timingSafeEqual } from 'node:crypto';
import { isWithinDnd } from '@/lib/dndSchedule';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';
import { STATUS_BUTTONS } from '@/lib/adminPipelineButtons';

// Shared by the /api/register-interest/* routes (RAD_Academy_SOP_Event_
// Registration_Forms.md) - split out rather than duplicated per-route
// since four routes need the same confirm-token, phone, and alert logic.

export function normalizePhone(v: string | null | undefined): string {
  return String(v || '').replace(/\D/g, '');
}

export function last4(v: string | null | undefined): string {
  const digits = normalizePhone(v);
  return digits.slice(-4);
}

// Short-lived, stateless proof that a lead actively confirmed their own
// identity (SOP §3) - lets /submit pull name/whatsapp_number from the
// existing leads row server-side without ever echoing that data back to
// the browser first. Not a payment-grade token (the SOP explicitly says
// this confirmation step isn't one either) - HMAC keyed off the
// service-role key, which only the server ever holds.
const TOKEN_TTL_MS = 15 * 60 * 1000;

function tokenKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY!;
}

export function signConfirmToken(email: string): string {
  const normEmail = email.trim().toLowerCase();
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${normEmail}|${expires}`;
  const sig = createHmac('sha256', tokenKey()).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

export function verifyConfirmToken(token: string | null | undefined, email: string): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 3) return false;
    const [normEmail, expiresStr, sig] = parts;
    if (normEmail !== email.trim().toLowerCase()) return false;
    if (Date.now() > Number(expiresStr)) return false;

    const expectedSig = createHmac('sha256', tokenKey()).update(`${normEmail}|${expiresStr}`).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Same buffered/immediate/DND pattern as the WhatsApp webhook's own
// notifyAdmin (src/app/api/whatsapp-webhook/route.ts) - SOP §8 requires
// this form to route through "the same alert path already used for
// WhatsApp stage changes", not a separate email-only queue.
export async function notifyAdminOfRegistration(supabaseAdmin: any, leadId: string, eventText: string) {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) return;

  const { data: schedule } = await supabaseAdmin.from('admin_dnd_schedule').select('*');
  if (isWithinDnd(schedule || [])) {
    await supabaseAdmin.from('admin_notification_buffer').insert([{ lead_id: leadId, event_text: eventText }]);
    return;
  }

  const adminAlertText = `🌐 *Website Registration*\n\n${eventText}`;
  const result = await sendWhatsAppMessage(adminPhone, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: adminAlertText },
      action: {
        buttons: Object.entries(STATUS_BUTTONS).map(([prefix, def]) => ({
          type: 'reply',
          reply: { id: `${prefix}_${leadId}`, title: def.title },
        })),
      },
    },
  });

  if (!result.ok) {
    await supabaseAdmin.from('admin_notification_buffer').insert([{ lead_id: leadId, event_text: eventText }]);
  }
}
