import crypto from 'crypto';
import { normalizePhone } from '@/lib/registerInterest';

// Shared by the Tutorial Hub's phone-link routes (src/app/api/tutorials/
// link-phone/*, src/app/api/tutorials/progress/route.ts) and the WhatsApp
// webhook's "LINK <code>" branch - split out rather than duplicated since
// all three need the same phone/code/token shape.

export { normalizePhone };

// The number this whole flow round-trips through: the visitor's own phone
// is already the second screen (spec S1), so proof-of-possession is a
// click-to-chat message to RAD's own WhatsApp Business number, resolved by
// the existing inbound webhook - no new SMS/OTP vendor needed. Matches the
// number already used as the general "contact us" WhatsApp link elsewhere
// (src/app/page.tsx, send-invite, send-registration-conf).
export const RAD_WHATSAPP_NUMBER = '27769065959';

const LINK_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I - typed by hand off a phone screen
const LINK_CODE_LENGTH = 6;
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const PROGRESS_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days, pushed out on each use

export function generateLinkCode(): string {
  let code = '';
  const bytes = crypto.randomBytes(LINK_CODE_LENGTH);
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_CHARS[bytes[i] % LINK_CODE_CHARS.length];
  }
  return code;
}

export function linkCodeExpiresAt(): string {
  return new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
}

export function generateProgressToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function progressTokenExpiresAt(): string {
  return new Date(Date.now() + PROGRESS_TOKEN_TTL_MS).toISOString();
}

export function buildLinkPhoneWaLink(code: string): string {
  const text = `LINK ${code}`;
  return `https://wa.me/${RAD_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function buildResumeUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${base.replace(/\/$/, '')}/tutorials/resume/${token}`;
}
