import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public lookup for a single message template by key - used by the
// community feed's share-preview banner (whatsapp_body only, for the
// "Send via WhatsApp" button's pre-filled text). Not sensitive content, so
// no auth needed, same reasoning as any other admin-editable public copy
// (FAQ items, etc.) in this project.
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_message_templates')
    .select('key, whatsapp_body')
    .eq('key', key)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Unknown template key' }, { status: 404 });
  return NextResponse.json(data);
}
