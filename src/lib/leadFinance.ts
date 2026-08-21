import { recordStageChange } from '@/lib/leadStageHistory';

// Shared by the new (lead_id-linked) finance pipeline - composer, capture,
// and the public quote/invoice pages all need to resolve "who is this
// customer" onto a real `leads` row before writing a quote/invoice/payment.
//
// Race-safe insert-first / select-on-conflict against leads.phone's UNIQUE
// constraint - identical shape to the proven pattern already used in
// src/app/api/whatsapp-webhook/route.ts and src/app/api/irene/consent/route.ts.
// Only calls recordStageChange on the branch that actually created a new row.
export async function findOrCreateLeadByPhone(
  supabase: any,
  { phone, name, email, source }: { phone: string; name?: string | null; email?: string | null; source: string }
) {
  let { data: lead } = await supabase
    .from('leads')
    .insert([{
      phone,
      name: name || null,
      email: email || null,
      status: 'new_lead',
      lifecycle_stage: 'new',
      source,
    }])
    .select()
    .single();

  const isNewLead = !!lead;

  if (isNewLead) {
    await recordStageChange(supabase, lead.id, { toStage: 'new' });
  } else {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .single();
    lead = existingLead;
  }

  return lead;
}
