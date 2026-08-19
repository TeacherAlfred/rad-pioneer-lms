import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { recordStageChange } from '@/lib/leadStageHistory';
import { resolveVariable, sendMetaTemplate, sendWhatsAppMessage } from '@/lib/metaTemplate';
import { STATUS_BUTTONS } from '@/lib/adminPipelineButtons';
import { isWithinDnd } from '@/lib/dndSchedule';

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

// Meta's delivery/read status events (sent -> delivered -> read, or
// failed) arrive as value.statuses[], separate from value.messages[],
// keyed by the message's own wamid rather than the phone number. Matches
// back to whichever `messages` row we stamped with that wamid when we sent
// it (see sendWhatsAppMessage/sendMetaTemplate in metaTemplate.ts). Meta
// explicitly does not guarantee delivery order (a `read` can arrive before
// its `delivered`), so this only ever moves status forward, never back.
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, played: 2, read: 3 };

async function applyMessageStatus(supabase: any, status: any) {
  if (!status?.id) return;

  const { data: existing } = await supabase.from('messages').select('id, status').eq('wamid', status.id).maybeSingle();
  if (!existing) return; // no matching row - a status for a message sent before this feature existed, or something we don't log.

  // `failed` is a terminal error state, not a step in the sent->read
  // progression, so it always applies regardless of what's already stored.
  if (status.status !== 'failed') {
    const currentRank = STATUS_RANK[existing.status] || 0;
    const incomingRank = STATUS_RANK[status.status] || 0;
    if (incomingRank < currentRank) return;
  }

  const update: Record<string, any> = {
    status: status.status,
    status_updated_at: new Date().toISOString(),
  };
  if (status.conversation) {
    update.conversation_category = status.conversation.origin?.type ?? null;
    // Only ever present on the 'sent' status - when this lead's 24hr free-
    // reply window closes. Not an adjustable setting, just Meta telling us
    // the fixed policy's actual close time for this specific conversation.
    if (status.conversation.expiration_timestamp) {
      update.conversation_expires_at = new Date(Number(status.conversation.expiration_timestamp) * 1000).toISOString();
    }
  }

  await supabase.from('messages').update(update).eq('id', existing.id);
}

// 2. Core Helper: Admin Pipeline Tracker
// Meta only allows free-form (non-template) sends to a number within 24hrs of
// that number last messaging the WABA - the "customer service window". If the
// admin hasn't texted the bot recently, this send gets rejected by Meta. Queue
// it instead of losing it silently; it surfaces as a catch-up summary the
// moment the admin next messages the bot (see isFromAdmin below).
//
// Most events don't send here at all anymore - see
// RAD_Lead_Stages_and_Followup_Spec-adjacent buffering: everything except
// { immediate: true } callers (new lead, opt-out, bot_media delivery
// failure) gets queued into admin_notification_buffer and consolidated into
// one message per lead by the notify-flush endpoint once that lead's
// buffer window elapses. During DND, even immediate-tier events queue
// instead of sending - "any lead notifications are not sent during that
// time" applies across the board, not just the buffered ones.
async function notifyAdmin(supabase: any, senderPhone: string, stageText: string, leadId: string, opts?: { immediate?: boolean }) {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) return;

  const { data: schedule } = await supabase.from('admin_dnd_schedule').select('*');

  if (isWithinDnd(schedule || []) || !opts?.immediate) {
    await supabase.from('admin_notification_buffer').insert([{ lead_id: leadId, event_text: stageText }]);
    return;
  }

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

// Flyer/voucher channels (75HARD, running clubs, Irene fitness flyer) arrive
// as a wa.me prefilled-message substring, not a button tap - matched
// case-insensitively against the admin-editable voucher_codes lookup table,
// not a hardcoded list, since this set is expected to grow. Longest-code-
// first so a code that happens to be a substring of another never wins by
// table order.
async function matchVoucherCode(supabase: any, searchText: string) {
  const { data: codes } = await supabase.from('voucher_codes').select('*').eq('active', true);
  const lower = searchText.toLowerCase();
  return (codes || [])
    .filter((c: any) => lower.includes(c.code.toLowerCase()))
    .sort((a: any, b: any) => b.code.length - a.code.length)[0] || null;
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
    await supabase.from('messages').insert([{ lead_id: lead.id, direction: 'outbound', body: `[Delivered ${matchedMedia.title}]`, wamid: sendResult.wamid || null }]);
    await notifyAdmin(supabase, senderPhone, `📥 Downloaded the ${matchedMedia.title}.`, lead.id);
  } else {
    await supabase.from('messages').insert([{ lead_id: lead.id, direction: 'outbound', body: `[FAILED to deliver ${matchedMedia.title}: ${sendResult.error}]` }]);
    await notifyAdmin(supabase, senderPhone, `⚠️ Failed to deliver "${matchedMedia.title}": ${sendResult.error}`, lead.id, { immediate: true });
  }
  return sendResult;
}

// The fallback for any button tap that isn't handled by a matching
// bot_flows row - acknowledge, flag the lead as needing a human, and tell
// the admin exactly which button was tapped. Also what a bot_media-type
// flow (e.g. btn_guide) falls back to if its keyword currently matches
// nothing in bot_media, rather than going silent on the lead.
async function handleGenericHandoff(supabase: any, senderPhone: string, lead: any, buttonTitle: string) {
  // Stamped here too, not just in the needs-human gate below - this
  // acknowledgment already tells them a human's coming, so a message
  // seconds later shouldn't immediately trigger a second, near-identical
  // "someone will be in touch" nudge on top of it.
  await supabase.from('leads').update({ needs_human: true, needs_human_nudged_at: new Date().toISOString() }).eq('id', lead.id);
  const ackResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "Got it! 👤 One of our educators will be in touch with you shortly." } });
  await supabase.from('messages').insert([{
    lead_id: lead.id,
    direction: 'outbound',
    body: ackResult.ok ? '[Delivered human-handoff acknowledgment]' : `[FAILED to deliver acknowledgment: ${ackResult.error}]`,
    wamid: ackResult.wamid || null,
  }]);
  await notifyAdmin(supabase, senderPhone, `🔘 Tapped: "${buttonTitle}" — needs a human.`, lead.id);
}

// 4. Core Helper: bot_flows - admin-configured automated responses, keyed
// by button id, that send a freeform message (optionally with its own
// buttons, so steps chain: tapping one flow's button can itself be another
// flow's trigger_button_id), fire a Meta template, or deliver a bot_media
// item (the "Get Free Guide" mechanism - this used to be hardcoded to
// btn_guide specifically; now it's just another flow, like any other
// button, configured via /admin/bot-flows rather than baked into this file).
async function runBotFlow(supabase: any, senderPhone: string, lead: any, flow: any, buttonTitle: string) {
  const leadUpdate: Record<string, any> = {};
  if (flow.set_source) leadUpdate.source = flow.set_source;
  if (flow.add_tags?.length) leadUpdate.tags = Array.from(new Set([...(lead.tags || []), ...flow.add_tags]));
  // Marks this lead as mid-question so their next freeform text is captured
  // (see STAGE 1) instead of falling through to the generic welcome.
  if (flow.expects_reply) {
    leadUpdate.awaiting_reply_flow_id = flow.id;
    leadUpdate.awaiting_reply_label = flow.reply_label || flow.label;
    leadUpdate.awaiting_reply_confirmation = flow.reply_confirmation || null;
    leadUpdate.awaiting_reply_completion_tag = flow.completion_tag || null;
  }
  if (Object.keys(leadUpdate).length > 0) {
    await supabase.from('leads').update(leadUpdate).eq('id', lead.id);
  }
  const effectiveLead = { ...lead, ...leadUpdate };

  if (flow.action_type === 'bot_media') {
    // deliverBotMedia handles its own messages-log + admin notify (e.g.
    // "📥 Downloaded the X.") - no needs_human, no generic "Tapped ..."
    // notify, same as the old hardcoded btn_guide behavior.
    const matchedMedia = await matchBotMedia(supabase, flow.bot_media_keyword || '', effectiveLead);
    if (matchedMedia) {
      await deliverBotMedia(supabase, senderPhone, effectiveLead, matchedMedia);
    } else {
      await handleGenericHandoff(supabase, senderPhone, effectiveLead, buttonTitle);
    }
    return;
  }

  let sendResult: { ok: boolean; error?: string; wamid?: string };
  if (flow.action_type === 'message') {
    const payload = (flow.message_buttons || []).length > 0
      ? {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: flow.message_body },
            action: { buttons: flow.message_buttons.map((b: any) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
          },
        }
      : { type: 'text', text: { body: flow.message_body } };
    sendResult = await sendWhatsAppMessage(senderPhone, payload);
    await supabase.from('messages').insert([{
      lead_id: lead.id,
      direction: 'outbound',
      body: sendResult.ok ? `[Delivered flow: ${flow.label}]` : `[FAILED to deliver flow ${flow.label}: ${sendResult.error}]`,
      wamid: sendResult.wamid || null,
    }]);
  } else {
    const bodyValues = (flow.template_variables || []).map((v: string) => resolveVariable(String(v), effectiveLead));
    sendResult = await sendMetaTemplate(senderPhone, flow.template_name, flow.template_language, bodyValues, flow.template_variable_names || [], flow.template_button_payloads || []);
    await supabase.from('messages').insert([{
      lead_id: lead.id,
      direction: 'outbound',
      body: sendResult.ok ? `[Delivered template: ${flow.template_name}]` : `[FAILED to deliver template ${flow.template_name}: ${sendResult.error}]`,
      wamid: sendResult.wamid || null,
    }]);
  }

  if (!flow.skip_human_handoff) {
    await supabase.from('leads').update({ needs_human: true }).eq('id', lead.id);
  }
  if (flow.notify_admin) {
    await notifyAdmin(supabase, senderPhone, `🔘 Tapped: "${buttonTitle}" — ${flow.label}`, lead.id, { immediate: !!flow.notify_admin_immediate });
  }
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

          if (value.statuses) {
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            for (const status of value.statuses) {
              await applyMessageStatus(supabase, status);
            }
            continue;
          }

          if (value.messages) {
            for (const message of value.messages) {
              const senderPhone = message.from || message.from_user_id;
              if (!senderPhone) continue;

              // Service role, not anon: this route is server-only (never shipped to
              // a browser), and NEXT_PUBLIC_SUPABASE_ANON_KEY is public by design -
              // using it here meant leads/messages RLS had to stay open to anyone
              // holding that key, not just this webhook. See rad-pioneer RLS lockdown.
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
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
                    const { outcome, label } = STATUS_BUTTONS[matchedPrefix];
                    const update: Record<string, any> = { needs_human: false };
                    if (outcome === 'contacted') update.contacted_at = new Date().toISOString();
                    // .select().maybeSingle() so a bad id or an RLS block shows up as
                    // "not found"/no error instead of a false "Logged" confirmation.
                    const { data: updatedLead, error: statusError } = await supabase
                      .from('leads')
                      .update(update)
                      .eq('id', targetLeadId)
                      .select()
                      .maybeSingle();
                    const confirmText = statusError
                      ? `⚠️ Failed to log outcome: ${statusError.message}`
                      : !updatedLead
                        ? `⚠️ No lead found for that button - outcome not logged.`
                        : `✅ Logged: ${label}`;
                    // Logs the outcome of this contact attempt only - it never moves
                    // lifecycle_stage, which advances on what the lead does, not what
                    // the admin tried (RAD_Lead_Stages_and_Followup_Spec.md §2).
                    if (updatedLead) {
                      await supabase.from('lead_activities').insert([{
                        lead_id: targetLeadId,
                        channel: 'whatsapp',
                        direction: 'outbound',
                        outcome,
                        created_by: senderPhone,
                      }]);
                    }
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
              } else if (message.type === 'button') {
                // Quick-reply buttons attached to an approved TEMPLATE arrive as
                // type "button", not "interactive" - a different shape than our
                // own bot-sent buttons (message.button.text/.payload, not
                // message.interactive.button_reply.title/.id). Missing this meant
                // every template button tap fell through every check below with
                // no reply, no guide, no handoff - silently.
                messageText = `[Button Reply: ${message.button?.text} (${message.button?.payload})]`;
              }

              // Click-to-WhatsApp ads attach this to the first inbound message of the
              // conversation they open - captured only at insert time (first touch),
              // never overwritten on a returning lead's later messages, so this stays
              // "which ad actually brought them in" rather than "most recent ad seen".
              const referral = message.referral;

              // Get or Create Lead. Insert-first relies on the UNIQUE constraint on
              // leads.phone to atomically reject a duplicate, so two concurrent
              // webhook deliveries for the same brand-new number can't both succeed
              // in creating a lead - the loser falls back to selecting the winner's row.
              let { data: lead } = await supabase
                .from('leads')
                .insert([{
                  phone: senderPhone,
                  status: 'new_lead',
                  lifecycle_stage: 'new',
                  ...(referral ? {
                    ad_id: referral.source_id || null,
                    ad_headline: referral.headline || null,
                    ctwa_clid: referral.ctwa_clid || null,
                  } : {}),
                }])
                .select()
                .single();

              // Captured before the fallback fetch overwrites `lead` below - used to
              // pick different welcome copy for a lead we already know (STAGE 1),
              // instead of greeting an existing/imported contact like a stranger.
              const isNewLead = !!lead;

              if (isNewLead) {
                await recordStageChange(supabase, lead.id, { toStage: 'new' });
                // Alert Admin of brand new lead
                await notifyAdmin(supabase, senderPhone, "🆕 Brand New Lead entered the funnel.", lead.id, { immediate: true });
              } else {
                const { data: existingLead } = await supabase
                  .from('leads')
                  .select('*')
                  .eq('phone', senderPhone)
                  .single();
                lead = existingLead;
              }

              if (!lead) continue;

              // Any inbound message is fresh signal of warmth, regardless of what
              // it says - update recency, and forward-only bump 'new' to 'engaged'
              // once this isn't their very first message (the first message is
              // what creates a lead at 'new' - it shouldn't also bump it forward
              // before the bot's had a chance to get a reply to that outreach).
              // An auto-expired 'lost' lead reopens on any new inbound (spec §3);
              // a manually-lost lead does not.
              const inboundLeadUpdate: Record<string, any> = { last_inbound_at: new Date().toISOString() };
              if (!isNewLead && lead.lifecycle_stage === 'new') {
                inboundLeadUpdate.lifecycle_stage = 'engaged';
                inboundLeadUpdate.stage_entered_at = new Date().toISOString();
              } else if (lead.lifecycle_stage === 'lost' && lead.lost_reason === 'auto_expired') {
                inboundLeadUpdate.lifecycle_stage = 'engaged';
                inboundLeadUpdate.stage_entered_at = new Date().toISOString();
                inboundLeadUpdate.lost_reason = null;
              }
              if (inboundLeadUpdate.lifecycle_stage) {
                await recordStageChange(supabase, lead.id, {
                  fromStage: lead.lifecycle_stage,
                  toStage: inboundLeadUpdate.lifecycle_stage,
                  reason: 'inbound_reply',
                });
              }
              await supabase.from('leads').update(inboundLeadUpdate).eq('id', lead.id);
              lead = { ...lead, ...inboundLeadUpdate };

              await supabase.from('messages').insert([{
                lead_id: lead.id,
                direction: 'inbound',
                body: messageText
              }]);

              // --- BOT PAUSED: admin has taken this conversation over manually ---
              // Set from /admin/lead-funnel/messages (or the lead's edit drawer),
              // this is a hard stop before every other automated branch below -
              // opt-out detection, Irene/voucher routing, reply-capture,
              // needs_human nudges, STAGE 1/2 - so nothing gets auto-sent, not
              // even a STOP confirmation. Deliberately different from
              // needs_human, which still sends one nudge and is meant to clear
              // itself once handled; bot_paused sends nothing at all and stays
              // set until an admin explicitly turns it back off. The message is
              // still logged above and alerted immediately, so a human sees it
              // and can act (including honoring an opt-out) manually.
              if (lead.bot_paused) {
                await notifyAdmin(supabase, senderPhone, `💬 ${messageText || '[non-text message]'} (bot paused - manual replies only)`, lead.id, { immediate: true });
                continue;
              }

              // --- OPT-OUT (POPIA) ---
              // Exact-message match only, not substring/keyword-in-sentence - "please
              // stop by our stand" must never be read as an opt-out. This only records
              // the flag; it doesn't gate anything in this webhook, since everything
              // it sends is a reactive reply to something the lead just asked for, not
              // unsolicited marketing. Any future proactive/campaign send path must
              // check leads.opted_out before sending.
              if (message.type === 'text') {
                const trimmed = messageText.trim().toLowerCase();
                if (['stop', 'unsubscribe', 'opt out', 'optout'].includes(trimmed)) {
                  await supabase.from('leads').update({ opted_out: true }).eq('id', lead.id);
                  const optOutResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "You've been unsubscribed from marketing messages from RAD Academy. Reply anytime if you still need help - we're still here for that." } });
                  await supabase.from('messages').insert([{
                    lead_id: lead.id,
                    direction: 'outbound',
                    body: optOutResult.ok ? '[Delivered opt-out confirmation]' : `[FAILED to deliver opt-out confirmation: ${optOutResult.error}]`,
                    wamid: optOutResult.wamid || null,
                  }]);
                  await notifyAdmin(supabase, senderPhone, "🚫 Opted out of marketing.", lead.id, { immediate: true });
                  continue;
                }
              }

              // --- CAPTURE A PENDING BOT_FLOW REPLY ---
              // A flow with expects_reply=true (e.g. "reply with your email
              // address") sets awaiting_reply_* on the lead when it fires.
              // Without this, the lead's next message fell through to STAGE
              // 1's generic keyword/catch-all logic and got the "Hey, great
              // to hear from you!" welcome instead of being captured.
              if (message.type === 'text' && lead.awaiting_reply_flow_id) {
                const label = lead.awaiting_reply_label || 'Reply';
                await supabase.from('lead_notes').insert([{
                  lead_id: lead.id,
                  note: `${label}: ${messageText}`,
                  created_by: 'bot_flow_capture',
                }]);
                const captureUpdate: Record<string, any> = {
                  awaiting_reply_flow_id: null,
                  awaiting_reply_label: null,
                  awaiting_reply_confirmation: null,
                  awaiting_reply_completion_tag: null,
                  needs_human: true,
                  needs_human_nudged_at: new Date().toISOString(),
                };
                // Reporting-only label (e.g. "webinar_registered") so admins can
                // filter who actually completed this flow - doesn't affect
                // needs_human or any other bot behavior.
                if (lead.awaiting_reply_completion_tag) {
                  captureUpdate.tags = Array.from(new Set([...(lead.tags || []), lead.awaiting_reply_completion_tag]));
                }
                await supabase.from('leads').update(captureUpdate).eq('id', lead.id);
                const confirmationText = lead.awaiting_reply_confirmation || "Thanks, I've passed that on to the team.";
                const captureAckResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: confirmationText } });
                await supabase.from('messages').insert([{
                  lead_id: lead.id,
                  direction: 'outbound',
                  body: captureAckResult.ok ? '[Delivered reply-capture confirmation]' : `[FAILED to deliver reply-capture confirmation: ${captureAckResult.error}]`,
                  wamid: captureAckResult.wamid || null,
                }]);
                await notifyAdmin(supabase, senderPhone, `📝 ${label}: ${messageText}`, lead.id);
                continue;
              }

              // --- IRENE VOTING SUPPORT DETECTION ---
              // The Irene voting page's "Need Help" button prefills a message
              // tagged with these words. Route straight to a human, same as a
              // "Talk to Educator" tap - the generic guide/welcome flow below
              // would be a jarring mismatch for someone stuck trying to vote.
              if (message.type === 'text') {
                const textLower = messageText.toLowerCase();
                if (textLower.includes('irene') && textLower.includes('voting')) {
                  await supabase.from('leads').update({ needs_human: true, needs_human_nudged_at: new Date().toISOString() }).eq('id', lead.id);
                  const ireneAckResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "Thanks for reaching out about the Irene Primary voting page! 🗳️ One of our team will help you shortly." } });
                  await supabase.from('messages').insert([{
                    lead_id: lead.id,
                    direction: 'outbound',
                    body: ireneAckResult.ok ? '[Delivered Irene voting support acknowledgment]' : `[FAILED to deliver Irene voting support acknowledgment: ${ireneAckResult.error}]`,
                    wamid: ireneAckResult.wamid || null,
                  }]);
                  await notifyAdmin(supabase, senderPhone, "🗳️ IRENE VOTING SUPPORT — needs a human.", lead.id);
                  continue;
                }
              }

              // --- VOUCHER CODE DETECTION (flyer channels) ---
              // First-touch only, same convention as ad_id/ctwa_clid above -
              // once a lead is attributed to a flyer channel, a later message
              // that happens to contain a different code shouldn't overwrite
              // where they actually came from.
              if (message.type === 'text' && !lead.voucher_code) {
                const matchedVoucher = await matchVoucherCode(supabase, messageText);
                if (matchedVoucher) {
                  const voucherUpdate = { voucher_code: matchedVoucher.code, source: matchedVoucher.source_value };
                  await supabase.from('leads').update(voucherUpdate).eq('id', lead.id);
                  lead = { ...lead, ...voucherUpdate };

                  // 75HARD carries no hold/reward logic - it's a pure routing
                  // signal so the admin takes this first touch personally
                  // instead of the automated flow taking it (spec §3.1).
                  if (matchedVoucher.code === '75HARD') {
                    await supabase.from('leads').update({ needs_human: true, needs_human_nudged_at: new Date().toISOString() }).eq('id', lead.id);
                    const voucherAckResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "Thanks for reaching out! 🙌 One of our team will be in touch with you personally shortly." } });
                    await supabase.from('messages').insert([{
                      lead_id: lead.id,
                      direction: 'outbound',
                      body: voucherAckResult.ok ? '[Delivered 75HARD handoff acknowledgment]' : `[FAILED to deliver acknowledgment: ${voucherAckResult.error}]`,
                      wamid: voucherAckResult.wamid || null,
                    }]);
                    await notifyAdmin(supabase, senderPhone, `🏋️ 75HARD voucher - needs a human (personal reply, no automated flow).`, lead.id, { immediate: true });
                    continue;
                  }
                }
              }

              // --- ALREADY PASSED TO A HUMAN: stop looping them through bot
              // menus ---
              // Confirmed against a real conversation (+27688503165): a lead
              // tapped "Talk to an Educator" twice, asked a direct question,
              // and still got bounced through the generic welcome menu and
              // an unrelated flow because nothing here checked needs_human
              // before running STAGE 1/STAGE 2. Once flagged, every further
              // action - free text or a button tap - gets a gentle reminder
              // instead of a bot flow, at most once per cooldown window (the
              // handoff acknowledgment that originally set needs_human
              // already told them this once; no need to repeat it on every
              // single tap). The admin still sees what they did/said, via
              // the same buffered path everything else here uses.
              if (lead.needs_human) {
                const NUDGE_COOLDOWN_MS = 30 * 60 * 1000;
                const lastNudge = lead.needs_human_nudged_at ? new Date(lead.needs_human_nudged_at).getTime() : 0;
                if (Date.now() - lastNudge > NUDGE_COOLDOWN_MS) {
                  const nudgeResult = await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: "Thanks for the message! 🙏 You're already on our team's list - one of our educators will be in touch with you as soon as possible. No need to tap or type anything else in the meantime." } });
                  await supabase.from('messages').insert([{
                    lead_id: lead.id,
                    direction: 'outbound',
                    body: nudgeResult.ok ? '[Delivered needs-human nudge]' : `[FAILED to deliver needs-human nudge: ${nudgeResult.error}]`,
                    wamid: nudgeResult.wamid || null,
                  }]);
                  await supabase.from('leads').update({ needs_human_nudged_at: new Date().toISOString() }).eq('id', lead.id);
                }
                await notifyAdmin(supabase, senderPhone, `💬 ${messageText} (already passed to educator)`, lead.id);
                continue;
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
                  // Catch-All Welcome - a lead we already have on file (an existing
                  // contact, or anyone carried over from the warm-list import) gets a
                  // "good to hear from you" framing instead of a first-contact
                  // "Welcome to RAD Academy", since we may well already have a
                  // commercial relationship with them.
                  const welcomeText = isNewLead
                    ? "👋 Hi! Welcome to RAD Academy.\n\nWhether you're a returning parent or new to our community, we help turn screen time into skill-building. What would you like to explore?"
                    : "👋 Hey, great to hear from you!\n\nWhat can we help you with today?";
                  const welcomePayload = {
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      body: {
                        text: welcomeText
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
                  // Plain text with no keyword match previously generated no
                  // buffered event at all - the bot replied with the generic
                  // menu and the admin had no visibility into what was
                  // actually said, buffered or otherwise. Surfacing it here
                  // is what lets "just browsing" and "needs more info" read
                  // differently in the Pending list.
                  await notifyAdmin(supabase, senderPhone, `💬 Said: "${messageText}"`, lead.id);
                }
              }

              // --- STAGE 2: BUTTON TAP ---
              // Two different shapes tap through here: our own bot-sent buttons
              // (welcome message, bot_media) arrive as type "interactive" with
              // interactive.button_reply.{id,title}; a quick-reply button on an
              // approved TEMPLATE arrives as type "button" with button.{payload,
              // text} instead. Every button - including "Get Free Guide" - is
              // just a bot_flows lookup by id now (see /admin/bot-flows); nothing
              // about a specific button is hardcoded in this file anymore. No
              // matching flow falls to the generic human handoff.
              const isBotButtonReply = message.type === 'interactive' && message.interactive?.type === 'button_reply';
              const isTemplateButtonReply = message.type === 'button';

              if (isBotButtonReply || isTemplateButtonReply) {
                const buttonId = isBotButtonReply ? message.interactive.button_reply?.id : message.button?.payload;
                const buttonTitle = (isBotButtonReply ? message.interactive.button_reply?.title : message.button?.text) || buttonId || 'a button';

                // A button tap means the lead moved on from whatever open
                // question they were mid-answering - don't let a later,
                // unrelated message get captured as the answer to it.
                if (lead.awaiting_reply_flow_id) {
                  await supabase.from('leads').update({ awaiting_reply_flow_id: null, awaiting_reply_label: null, awaiting_reply_confirmation: null, awaiting_reply_completion_tag: null }).eq('id', lead.id);
                  lead.awaiting_reply_flow_id = null;
                }

                const { data: flow } = await supabase
                  .from('bot_flows')
                  .select('*')
                  .eq('trigger_button_id', buttonId)
                  .eq('active', true)
                  .maybeSingle();
                if (flow) {
                  await runBotFlow(supabase, senderPhone, lead, flow, buttonTitle);
                  continue;
                }

                await handleGenericHandoff(supabase, senderPhone, lead, buttonTitle);
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