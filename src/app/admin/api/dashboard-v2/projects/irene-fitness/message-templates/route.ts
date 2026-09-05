import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Every WhatsApp/email message a button in the Irene Fitness portal can
// send - {{name}}/{{link}} placeholders are the only parts app code
// substitutes at send-time, so an admin can reword the rest freely from the
// Settings page without touching code.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_message_templates')
    .select('key, label, whatsapp_body, email_subject, email_body, updated_at')
    .order('key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}
