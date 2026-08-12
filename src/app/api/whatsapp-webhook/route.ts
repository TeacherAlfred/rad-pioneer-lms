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

// 2. Core Helper: Admin Pipeline Tracker
async function notifyAdmin(senderPhone: string, stageText: string) {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) return;

  const adminAlertText = `🚦 *Pipeline Update*\n\nLead: +${senderPhone}\nStage: ${stageText}\n\nReach out instantly: https://wa.me/${senderPhone}`;
  
  await sendWhatsAppMessage(adminPhone, {
    type: 'text',
    text: { body: adminAlertText }
  });
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
                if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                  const buttonId = message.interactive.button_reply?.id;
                  if (buttonId?.startsWith('contacted_')) {
                    const targetLeadId = buttonId.replace('contacted_', '');
                    await supabase.from('leads').update({ status: 'contacted', contacted_at: new Date().toISOString() }).eq('id', targetLeadId);
                    await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "✅ Lead marked as contacted in database." } });
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
                await notifyAdmin(senderPhone, "🆕 Brand New Lead entered the funnel.");
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
                  await notifyAdmin(senderPhone, "🗳️ IRENE VOTING SUPPORT — needs a human.");
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
                const { data: mediaCandidates } = await supabase.from('bot_media').select('*').eq('active', true);
                const keywordMatches = (mediaCandidates || []).filter((m: any) =>
                  (m.trigger_keywords || []).some((k: string) => textLower.includes(k.toLowerCase()))
                );
                const matchedMedia = keywordMatches.find((m: any) => m.tag_filter && (lead.tags || []).includes(m.tag_filter))
                  || keywordMatches.find((m: any) => !m.tag_filter);

                if (matchedMedia) {
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
                    await notifyAdmin(senderPhone, `📥 Downloaded the ${matchedMedia.title}.`);
                  } else {
                    // Meta rejected the send (bad file link, malformed buttons, etc.) -
                    // record the real reason instead of a false "delivered" log, since
                    // that's exactly what made a broken media item hard to diagnose.
                    await supabase.from('messages').insert([{ lead_id: lead.id, direction: 'outbound', body: `[FAILED to deliver ${matchedMedia.title}: ${sendResult.error}]` }]);
                    await notifyAdmin(senderPhone, `⚠️ Failed to deliver "${matchedMedia.title}": ${sendResult.error}`);
                  }
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
                          { type: 'reply', reply: { id: 'btn_do_it', title: 'View Workshops' } },
                          { type: 'reply', reply: { id: 'btn_human', title: 'Talk to Educator' } }
                        ]
                      }
                    }
                  };
                  await sendWhatsAppMessage(senderPhone, welcomePayload);
                }
              }

              // --- STAGE 2 & 3: INTERACTIVE FUNNEL ROUTING ---
              if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                const buttonId = message.interactive.button_reply?.id;

                if (buttonId === 'btn_human') {
                  await supabase.from('leads').update({ status: 'needs_human' }).eq('id', lead.id);
                  await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "Got it! 👤 One of our educators will be in touch with you shortly." } });
                  await notifyAdmin(senderPhone, "🚨 DIRECT REQUEST: Wants to speak to an Educator.");

                } else if (buttonId === 'btn_do_it') {
                  // WARM LEAD: Booking Process
                  const bookingText = "Awesome! Getting your child enrolled takes just 3 quick steps:\n\n1️⃣ Pick your city.\n2️⃣ Choose your date.\n3️⃣ Secure the spot.\n\nLet's start—where are you located?";
                  await sendWhatsAppMessage(senderPhone, {
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      body: { text: bookingText },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'btn_pta', title: 'Pretoria' } },
                          { type: 'reply', reply: { id: 'btn_plk', title: 'Polokwane' } },
                          { type: 'reply', reply: { id: 'btn_human', title: 'Talk to Educator' } }
                        ]
                      }
                    }
                  });
                  await supabase.from('leads').update({ status: 'booking_started' }).eq('id', lead.id);
                  await notifyAdmin(senderPhone, "🔥 WARM LEAD: Clicked 'Let RAD Do It'. Selecting their city now.");

                } else if (buttonId === 'btn_webinar') {
                  // COLD LEAD: Nurture Process
                  const webinarText = "Great choice! The free webinar is 20 minutes long and will show you exactly how to implement the guide.\n\nJust 2 steps:\n1️⃣ Get the link.\n2️⃣ Watch anytime.\n\nReady for the link?";
                  await sendWhatsAppMessage(senderPhone, {
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      body: { text: webinarText },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'btn_webinar_link', title: 'Get Webinar Link' } },
                          { type: 'reply', reply: { id: 'btn_human', title: 'Talk to Educator' } }
                        ]
                      }
                    }
                  });
                  await supabase.from('leads').update({ status: 'nurture_webinar' }).eq('id', lead.id);
                  await notifyAdmin(senderPhone, "❄️ COLD LEAD: Opted for the Free Webinar.");

                } else if (buttonId === 'btn_pta') {
                  // PRETORIA WORKSHOPS
                  const ptaText = "Great! Here are our upcoming Pretoria workshops:\n\n📅 9-12 Aug: Minecraft Education\n📅 13-31 Aug: Robotics for Sports\n📅 1-23 Sept: Advanced Robotics\n\nReply to this message with the date you'd like, or tap below to chat with us!";
                  await sendWhatsAppMessage(senderPhone, {
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      body: { text: ptaText },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'btn_human', title: 'Talk to Educator' } }
                        ]
                      }
                    }
                  });
                  await notifyAdmin(senderPhone, "📍 Selected Pretoria.");

                } else if (buttonId === 'btn_plk') {
                  // POLOKWANE WORKSHOPS
                  const plkText = "Awesome! We have two immersive workshops in Polokwane this October. You can choose one, or book both for a complete tech weekend!\n\n📍 Location: Polokwane\n📅 Oct 3: Minecraft Education\n📅 Oct 4: Robotics";
                  await sendWhatsAppMessage(senderPhone, {
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      body: { text: plkText },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'btn_plk_mc', title: 'Oct 3: Minecraft' } },
                          { type: 'reply', reply: { id: 'btn_plk_rob', title: 'Oct 4: Robotics' } },
                          { type: 'reply', reply: { id: 'btn_plk_both', title: 'Book Both Days' } }
                        ]
                      }
                    }
                  });
                  await notifyAdmin(senderPhone, "📍 Selected Polokwane.");
                  
                } else if (buttonId === 'btn_webinar_link') {
                  // WEBINAR LINK DELIVERY
                  const linkText = "Here is your link to the webinar: [INSERT_YOUTUBE_OR_ZOOM_LINK]\n\nEnjoy the session! If you have any questions afterward, just reply here.";
                  await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: linkText } });
                  await notifyAdmin(senderPhone, "📺 Accessed the Webinar Link.");
                }
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