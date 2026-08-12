import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Verifies the request actually came from Meta by checking the HMAC-SHA256
// signature Meta signs the raw body with, using the app secret.
function isValidMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const [scheme, receivedHex] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !receivedHex) return false;

  const expectedHex = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');

  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}

// 1. Core Helper: Send WhatsApp Message
// Returns whether Meta actually accepted the send, plus its error detail if
// not - callers that log "[Delivered ...]" or notify the admin need this,
// otherwise a rejected send still gets recorded as if it succeeded.
async function sendWhatsAppMessage(to: string, messagePayload: any): Promise<{ ok: boolean; error?: string }> {
  const phoneId = process.env.PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_TOKEN!;

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      ...messagePayload
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorDetail = data?.error?.message || JSON.stringify(data);
    console.error(`❌ Meta API Error sending to ${to}:`, JSON.stringify(data, null, 2));
    return { ok: false, error: errorDetail };
  }
  console.log(`✅ Message successfully sent to ${to}`);
  return { ok: true };
}

// Statuses the admin can log directly from a pipeline alert's buttons.
// Button title max 20 chars (Meta error 131009); id prefix + "_" + leadId
// is what STAGE 2's admin button handler matches back to a status update.
const STATUS_BUTTONS: Record<string, { title: string; status: string; label: string }> = {
  status_contacted: { title: 'Contacted', status: 'contacted', label: 'Contacted successfully' },
  status_no_response: { title: 'No Response', status: 'no_response', label: 'Contacted, no response' },
  status_followup: { title: 'Follow-up Set', status: 'followup_scheduled', label: 'Follow-up/call scheduled' },
};

// 2. Core Helper: Admin Pipeline Tracker
// Meta only allows free-form (non-template) sends to a number within 24hrs of
// that number last messaging the WABA - the "customer service window". If the
// admin hasn't texted the bot recently, this send gets rejected by Meta. Queue
// it instead of losing it silently; it surfaces as a catch-up summary the
// moment the admin next messages the bot (see isFromAdmin below).
async function notifyAdmin(supabase: any, senderPhone: string, stageText: string, leadId: string) {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) return;

  const adminAlertText = `🚦 *Pipeline Update*\n\nLead: +${senderPhone}\nStage: ${stageText}\n\nReach out instantly: https://wa.me/${senderPhone}`;

  // Buttons let the admin log the outcome straight from the alert instead of
  // touching the database directly - handled by the STATUS_BUTTONS map below.
  const result = await sendWhatsAppMessage(adminPhone, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: adminAlertText },
      action: {
        buttons: Object.entries(STATUS_BUTTONS).map(([prefix, def]) => ({
          type: 'reply',
          reply: { id: `${prefix}_${leadId}`, title: def.title }
        }))
      }
    }
  });

  if (!result.ok) {
    await supabase.from('pending_admin_alerts').insert([{ lead_phone: senderPhone, stage_text: stageText }]);
  }
}

// 3. Core Helper: bot_media lookup + delivery, shared by the STAGE 1 keyword
// match (typed "guide") and the STAGE 2 "Get Free Guide" button tap - both
// need the exact same tag_filter-aware matching and delivered/failed logging.
async function matchBotMedia(supabase: any, searchText: string, lead: any) {
  const { data: mediaCandidates } = await supabase.from('bot_media').select('*').eq('active', true);
  const lower = searchText.toLowerCase();
  const keywordMatches = (mediaCandidates || []).filter((m: any) =>
    (m.trigger_keywords || []).some((k: string) => lower.includes(k.toLowerCase()))
  );
  return keywordMatches.find((m: any) => m.tag_filter && (lead.tags || []).includes(m.tag_filter))
    || keywordMatches.find((m: any) => !m.tag_filter);
}

async function deliverBotMedia(supabase: any, senderPhone: string, lead: any, matchedMedia: any) {
  const mediaPayload = {
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'document',
        document: { link: matchedMedia.file_url, filename: matchedMedia.filename }
      },
      body: { text: matchedMedia.caption },
      footer: { text: "RAD Academy" },
      action: {
        buttons: (matchedMedia.buttons || []).map((b: any) => ({ type: 'reply', reply: { id: b.id, title: b.title } }))
      }
    }
  };
  const sendResult = await sendWhatsAppMessage(senderPhone, mediaPayload);
  if (sendResult.ok) {
    await supabase.from('messages').insert([{ lead_id: lead.id, direction: 'outbound', body: `[Delivered ${matchedMedia.title}]` }]);
    await notifyAdmin(supabase, senderPhone, `📥 Downloaded the ${matchedMedia.title}.`, lead.id);
  } else {
    await supabase.from('messages').insert([{ lead_id: lead.id, direction: 'outbound', body: `[FAILED to deliver ${matchedMedia.title}: ${sendResult.error}]` }]);
    await notifyAdmin(supabase, senderPhone, `⚠️ Failed to deliver "${matchedMedia.title}": ${sendResult.error}`, lead.id);
  }
  return sendResult;
}

// Meta verifies the webhook via a GET request
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Meta sends incoming messages via a POST request
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (!isValidMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
      console.error('❌ Rejected webhook: invalid or missing signature');
      return new NextResponse('Forbidden', { status: 403 });
    }

    const body = JSON.parse(rawBody);

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          if (value.statuses) continue; 

          if (value.messages) {
            for (const message of value.messages) {
              const senderPhone = message.from || message.from_user_id;
              if (!senderPhone) continue;

              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );

              // Meta delivers webhooks at-least-once, so retries can redeliver the
              // exact same message. Claim this message id before doing anything
              // else; if the claim fails on a primary key collision, we've already
              // processed it - skip to avoid double sends/double DB writes.
              if (message.id) {
                const { error: dedupeError } = await supabase
                  .from('webhook_events_seen')
                  .insert({ wa_message_id: message.id });

                if (dedupeError) {
                  if (dedupeError.code === '23505') continue;
                  console.error('❌ Dedup check failed, processing anyway:', dedupeError.message);
                }
              }

              // Messages from the admin's own number are ops actions (e.g. marking
              // a lead contacted), not customer messages - handle and stop here so
              // they never create/update a lead record for the admin's own number.
              const adminPhone = process.env.ADMIN_PHONE_NUMBER;
              const isFromAdmin = !!adminPhone && senderPhone.replace(/\D/g, '') === adminPhone.replace(/\D/g, '');

              if (isFromAdmin) {
                // Any message from the admin reopens the 24hr window, so this
                // is the first reliable moment a queued alert (see notifyAdmin)
                // can actually be delivered - flush the backlog before doing
                // anything else so the admin sees who to contact, about what.
                const { data: pending } = await supabase
                  .from('pending_admin_alerts')
                  .select('*')
                  .order('created_at', { ascending: true });

                if (pending && pending.length > 0) {
                  const shown = pending.slice(0, 25);
                  const lines = shown.map((a: any) => `• +${a.lead_phone} — ${a.stage_text} (${new Date(a.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })})`);
                  const overflow = pending.length - shown.length;
                  const summaryText = `📋 *Missed while you were away* (${pending.length})\n\n${lines.join('\n')}${overflow > 0 ? `\n\n…and ${overflow} more.` : ''}`;
                  const summaryResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: summaryText } });
                  if (summaryResult.ok) {
                    await supabase.from('pending_admin_alerts').delete().in('id', pending.map((a: any) => a.id));
                  }
                }

                if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                  const buttonId = message.interactive.button_reply?.id || '';
                  const matchedPrefix = Object.keys(STATUS_BUTTONS).find(prefix => buttonId.startsWith(`${prefix}_`));
                  if (matchedPrefix) {
                    const targetLeadId = buttonId.slice(matchedPrefix.length + 1);
                    const { status, label } = STATUS_BUTTONS[matchedPrefix];
                    const update: Record<string, any> = { status };
                    if (status === 'contacted') update.contacted_at = new Date().toISOString();
                    // .select().maybeSingle() so a bad id or an RLS block shows up as
                    // "not found"/no error instead of a false "Logged" confirmation.
                    const { data: updatedLead, error: statusError } = await supabase
                      .from('leads')
                      .update(update)
                      .eq('id', targetLeadId)
                      .select()
                      .maybeSingle();
                    const confirmText = statusError
                      ? `⚠️ Failed to log status: ${statusError.message}`
                      : !updatedLead
                        ? `⚠️ No lead found for that button - status not logged.`
                        : `✅ Logged: ${label}`;
                    await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: confirmText } });
                  }
                }
                continue;
              }

              let messageText = '';
              if (message.type === 'text') {
                messageText = message.text?.body || '';
              } else if (message.type === 'interactive') {
                const buttonReply = message.interactive?.button_reply;
                if (buttonReply) {
                  messageText = `[Button Reply: ${buttonReply.title} (${buttonReply.id})]`;
                } else {
                  messageText = '[Interactive Message]';
                }
              }

              // Get or Create Lead. Insert-first relies on the UNIQUE constraint on
              // leads.phone to atomically reject a duplicate, so two concurrent
              // webhook deliveries for the same brand-new number can't both succeed
              // in creating a lead - the loser falls back to selecting the winner's row.
              let { data: lead } = await supabase
                .from('leads')
                .insert([{ phone: senderPhone, status: 'new_lead' }])
                .select()
                .single();

              if (lead) {
                // Alert Admin of brand new lead
                await notifyAdmin(supabase, senderPhone, "🆕 Brand New Lead entered the funnel.", lead.id);
              } else {
                const { data: existingLead } = await supabase
                  .from('leads')
                  .select('*')
                  .eq('phone', senderPhone)
                  .single();
                lead = existingLead;
              }

              if (!lead) continue;

              await supabase.from('messages').insert([{
                lead_id: lead.id,
                direction: 'inbound',
                body: messageText
              }]);

              // --- IRENE VOTING SUPPORT DETECTION ---
              // The Irene voting page's "Need Help" button prefills a message
              // tagged with these words. Route straight to a human, same as a
              // "Talk to Educator" tap - the generic guide/welcome flow below
              // would be a jarring mismatch for someone stuck trying to vote.
              if (message.type === 'text') {
                const textLower = messageText.toLowerCase();
                if (textLower.includes('irene') && textLower.includes('voting')) {
                  await supabase.from('leads').update({ status: 'needs_human' }).eq('id', lead.id);
                  await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "Thanks for reaching out about the Irene Primary voting page! 🗳️ One of our team will help you shortly." } });
                  await notifyAdmin(supabase, senderPhone, "🗳️ IRENE VOTING SUPPORT — needs a human.", lead.id);
                  continue;
                }
              }

              // --- STAGE 1: INBOUND TRIGGER & VALUE DELIVERY ---
              if (message.type === 'text') {
                const textLower = messageText.toLowerCase();

                // Media (guide PDFs, brochures, etc.) lives in bot_media, managed from
                // /admin/bot-media - no more hardcoded files/links in this route. A
                // tag-specific entry (tag_filter) wins over a generic one for the
                // same keyword when the lead actually has that tag; otherwise the
                // generic (no tag_filter) entry is the fallback.
                const matchedMedia = await matchBotMedia(supabase, textLower, lead);

                if (matchedMedia) {
                  await deliverBotMedia(supabase, senderPhone, lead, matchedMedia);
                } else {
                  // Catch-All Welcome
                  const welcomePayload = {
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      body: {
                        text: "👋 Hi! Welcome to RAD Academy.\n\nWhether you're a returning parent or new to our community, we help turn screen time into skill-building. What would you like to explore?"
                      },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'btn_guide', title: 'Get Free Guide' } },
                          { type: 'reply', reply: { id: 'btn_events', title: 'Upcoming Events' } },
                          { type: 'reply', reply: { id: 'btn_human', title: 'Talk to Educator' } }
                        ]
                      }
                    }
                  };
                  await sendWhatsAppMessage(senderPhone, welcomePayload);
                }
              }

              // --- STAGE 2: BUTTON TAP ---
              // "Get Free Guide" delivers the guide immediately, same as typing
              // "guide" would - it shouldn't make the lead wait on a human just
              // to get the thing they explicitly asked for. Every other button
              // (whichever flow it came from - welcome, bot_media) routes the
              // same way: acknowledge, flag the lead as needing a human, and
              // tell the admin exactly which button was tapped.
              if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                const buttonId = message.interactive.button_reply?.id;
                const buttonTitle = message.interactive.button_reply?.title || buttonId || 'a button';

                if (buttonId === 'btn_guide') {
                  const matchedMedia = await matchBotMedia(supabase, 'guide', lead);
                  if (matchedMedia) {
                    await deliverBotMedia(supabase, senderPhone, lead, matchedMedia);
                    continue;
                  }
                  // No guide configured in bot_media - fall through to the
                  // human handoff below rather than going silent on the lead.
                }

                await supabase.from('leads').update({ status: 'needs_human' }).eq('id', lead.id);
                const ackResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "Got it! 👤 One of our educators will be in touch with you shortly." } });
                await supabase.from('messages').insert([{
                  lead_id: lead.id,
                  direction: 'outbound',
                  body: ackResult.ok ? '[Delivered human-handoff acknowledgment]' : `[FAILED to deliver acknowledgment: ${ackResult.error}]`,
                }]);
                await notifyAdmin(supabase, senderPhone, `🔘 Tapped: "${buttonTitle}" — needs a human.`, lead.id);
              }

            }
          }
        }
      }
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }
    return new NextResponse('Not Found', { status: 404 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new NextResponse('EVENT_RECEIVED', { status: 200 }); 
  }
}