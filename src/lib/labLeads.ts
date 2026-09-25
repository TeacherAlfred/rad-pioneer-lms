import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/registerInterest';
import { recordStageChange } from '@/lib/leadStageHistory';
import { applyLeadRole, roleFromLead } from '@/lib/leadRole';

// Shared by /api/labs/optin and /api/labs/help (public /labs/[slug] page).
// Phone-keyed, same as /api/term-program/register: leads.phone is NOT NULL
// + unique and the WhatsApp webhook stores numbers as bare international
// digits, so a lab visitor who later messages the bot resolves to the same
// lead row.

export type LabRole = 'parent' | 'student';
export const LAB_ROLES: LabRole[] = ['parent', 'student'];
export const LAB_GRADES = ['4-6', '7-9', '10-12'] as const;
export type LabGrade = typeof LAB_GRADES[number];

// Lab visitors type local SA numbers ("082 123 4567"). The shared
// normalizePhone only strips non-digits, which would store "0821234567"
// and never match the webhook's "27821234567" - so convert the local
// trunk prefix here. Kept lab-local rather than changing the shared helper
// so other intake forms' stored values don't shift under them.
export function normaliseSaPhone(raw: unknown): string | null {
  let digits = normalizePhone(typeof raw === 'string' ? raw : '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

type UpsertParams = {
  phone: string;
  name?: string;
  role: LabRole;
  grade?: LabGrade | null;
  source: string;
  tags: string[];
  // Only for the opt-in form, where the visitor ticks explicit consent.
  marketingConsent?: { wordingVersion: string; consentSource: string };
};

export async function upsertLabLead(supabase: SupabaseClient, p: UpsertParams): Promise<{ leadId: string; isNew: boolean }> {
  const nowIso = new Date().toISOString();
  const roleTags = [`role:${p.role}`, ...(p.grade ? [`grade:${p.grade}`] : [])];
  const tags = Array.from(new Set([...p.tags, ...roleTags]));

  const consentFields = p.marketingConsent ? {
    consent_marketing: true,
    consent_timestamp: nowIso,
    consent_wording_version: p.marketingConsent.wordingVersion,
    consent_source: p.marketingConsent.consentSource,
    marketing_consent_at: nowIso,
  } : {};

  const { data: existing } = await supabase
    .from('leads')
    .select('id, name, tags, is_potential_student, is_confirmed_parent')
    .eq('phone', p.phone)
    .maybeSingle();

  if (existing) {
    // Never regress status/lifecycle/source on a lead the funnel already
    // knows - only fill gaps and add tags.
    const update: Record<string, unknown> = {
      tags: Array.from(new Set([...(existing.tags || []), ...tags])),
      ...consentFields,
    };
    if (!existing.name && p.name) update.name = p.name;
    await supabase.from('leads').update(update).eq('id', existing.id);
    // Only fills a gap - never overrides a parent/student answer the funnel
    // already has on record (same "never regress" rule as the fields above).
    if (p.role && !roleFromLead(existing)) await applyLeadRole(supabase, existing.id, p.role);
    return { leadId: existing.id, isNew: false };
  }

  const { data: inserted, error } = await supabase
    .from('leads')
    .insert([{
      phone: p.phone,
      name: p.name || null,
      status: 'new_lead',
      lifecycle_stage: 'new',
      source: p.source,
      preferred_channel: 'whatsapp',
      tags,
      is_potential_student: p.role === 'student',
      ...consentFields,
    }])
    .select('id')
    .single();

  if (error) {
    // Lost a race with a concurrent insert (e.g. the webhook) on the unique
    // phone constraint - fall back to the row that won.
    const { data: raced } = await supabase.from('leads').select('id').eq('phone', p.phone).maybeSingle();
    if (!raced) throw error;
    return { leadId: raced.id, isNew: false };
  }

  if (p.role) await applyLeadRole(supabase, inserted.id, p.role);
  await recordStageChange(supabase, inserted.id, { toStage: 'new', changedBy: 'lab_page' });
  return { leadId: inserted.id, isNew: true };
}
