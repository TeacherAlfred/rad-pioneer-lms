import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BUTTONS = 3; // WhatsApp interactive-button messages allow at most 3.
const MAX_BUTTON_TITLE = 20; // Meta error 131009 above this.

// Free-form (non-template) reply from the admin, sent from Message
// Activity - only deliverable while Meta's 24h customer-service window is
// open (i.e. the lead messaged in recently), same rule as any freeform
// send elsewhere in this app. Meta rejects it outright if that window has
// closed, which comes back as a clear error here rather than a silent
// failure - this route doesn't try to pre-check the window itself.
//
// `buttons` (optional, up to 3) are {id, title} pairs the admin picked
// from active bot_flows.trigger_button_id/label in the UI - tapping one
// re-enters STAGE 2 in whatsapp-webhook/route.ts exactly like a bot-sent
// button would, so a manual reply can still hand the conversation back to
// automation at a specific point instead of staying fully manual forever.
export async function POST(req: Request) {
  try {
    const { leadId, body, buttons } = await req.json();
    if (!leadId || !body || !String(body).trim()) {
      return NextResponse.json({ error: 'leadId and a non-empty body are required' }, { status: 400 });
    }
    if (buttons !== undefined && (!Array.isArray(buttons) || buttons.length > MAX_BUTTONS)) {
      return NextResponse.json({ error: `buttons must be an array of at most ${MAX_BUTTONS}` }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('id, phone')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const text = String(body).trim();
    const cleanButtons = (buttons || [])
      .filter((b: any) => b && b.id && b.title)
      .map((b: any) => ({ id: String(b.id), title: String(b.title).slice(0, MAX_BUTTON_TITLE) }));

    const payload = cleanButtons.length > 0
      ? {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text },
            action: { buttons: cleanButtons.map((b: any) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
          },
        }
      : { type: 'text', text: { body: text } };

    const result = await sendWhatsAppMessage(lead.phone, payload);

    // status is only ever set here on failure (Meta rejected the send
    // outright, so no async status webhook will ever arrive for it) -
    // omitted entirely on success, matching every other outbound insert in
    // whatsapp-webhook/route.ts, which leave it for the later sent/
    // delivered/read webhook to fill in via applyMessageStatus.
    await supabaseAdmin.from('messages').insert([{
      lead_id: lead.id,
      direction: 'outbound',
      body: text,
      wamid: result.wamid || null,
      buttons: cleanButtons.length > 0 ? cleanButtons : null,
      ...(result.ok ? {} : { status: 'failed' }),
    }]);

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'WhatsApp rejected this message - the 24h reply window may have closed.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
