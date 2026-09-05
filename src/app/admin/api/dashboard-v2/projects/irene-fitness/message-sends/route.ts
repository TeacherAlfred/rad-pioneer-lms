import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const TEMPLATE_KEYS = ['guide', 'my_link'] as const;
const CHANNELS = ['whatsapp', 'email'] as const;

// Logs one "Send" click from the Responses admin page's Guide/My Link
// buttons - fired right before the wa.me/mailto link opens. This records
// that the admin clicked, not that the message was actually delivered
// (there's no way to know that from here), same honesty level the existing
// copy-to-clipboard feedback on those buttons already has.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { family_id, template_key, channel } = body as {
    family_id?: string;
    template_key?: string;
    channel?: string;
  };

  if (!family_id) return NextResponse.json({ error: 'family_id is required' }, { status: 400 });
  if (!TEMPLATE_KEYS.includes(template_key as (typeof TEMPLATE_KEYS)[number])) {
    return NextResponse.json({ error: `Invalid template_key: ${template_key}` }, { status: 400 });
  }
  if (!CHANNELS.includes(channel as (typeof CHANNELS)[number])) {
    return NextResponse.json({ error: `Invalid channel: ${channel}` }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_message_sends')
    .insert([{ family_id, template_key, channel }])
    .select('sent_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sent_at: data.sent_at });
}
