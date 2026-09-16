import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveVariable, resolveProgramTokens, sendWhatsAppMessage, sendMetaTemplate } from '@/lib/metaTemplate';
import { logOutboundContactAndResolveQueue } from '@/lib/contactLog';
import { parseMessage } from '@/lib/messageParse';
import { isEligibleStage, stageKeyFor } from '@/lib/messageFunnel';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same cap and reasoning as send-template/route.ts - sequential sends inside
// one request, bounded by a Vercel function's execution time limit.
const MAX_RECIPIENTS = 50;
const MAX_BUTTONS = 3;
const MAX_BUTTON_TITLE = 20;

type Target =
  | { kind: 'flow'; flowId: string }
  | { kind: 'template'; templateName: string; languageCode: string; variables?: string[]; variableNames?: string[]; buttonPayloads?: string[] }
  | { kind: 'freeform'; body: string; buttons?: { id: string; title: string }[]; label: string };

// Mirrors matchBotMedia() in whatsapp-webhook/route.ts exactly (not
// importable from a route file) - a bot_media-type flow's keyword is matched
// as a substring search against every active item's trigger_keywords, with a
// lead's own tags able to steer it to a tag_filter-specific variant over the
// generic fallback. Has to run PER LEAD, not once for the whole send - two
// leads with different tags can genuinely resolve the same flow to two
// different bot_media items.
async function matchBotMediaForLead(flow: any, lead: any) {
  const { data: candidates } = await supabaseAdmin.from('bot_media').select('*').eq('active', true);
  const searchText = String(flow.bot_media_keyword || '').toLowerCase();
  const keywordMatches = (candidates || []).filter((m: any) =>
    (m.trigger_keywords || []).some((k: string) => searchText.includes(String(k).toLowerCase()))
  );
  return keywordMatches.find((m: any) => m.tag_filter && (lead.tags || []).includes(m.tag_filter))
    || keywordMatches.find((m: any) => !m.tag_filter)
    || null;
}

// What stage key sending this target to this specific lead will produce -
// has to exactly match the bracket-text convention the corresponding send
// actually logs below, or a lead wouldn't show up back at the right stage
// next time the funnel loads. Resolved per-lead because a bot_media-type
// flow's actual item can vary by lead (see matchBotMediaForLead).
async function resolveLeadTarget(target: Target, flow: any, lead: any): Promise<{ key: string; media?: any } | { error: string }> {
  if (target.kind === 'template') return { key: `template:${target.templateName}` };
  if (target.kind === 'freeform') return { key: `freeform_bulk:${target.label}` };
  if (flow.action_type === 'message') return { key: `bot_flow:${flow.label}` };
  if (flow.action_type === 'template') return { key: `template:${flow.template_name}` };
  if (flow.action_type === 'bot_media') {
    const media = await matchBotMediaForLead(flow, lead);
    if (!media) return { error: `No active bot_media item matches "${flow.bot_media_keyword}" for this lead` };
    return { key: `bot_media:${media.title}`, media };
  }
  return { error: 'Unsupported flow action_type' };
}

async function sendOne(target: Target, flow: any, media: any, lead: any): Promise<{ ok: boolean; error?: string; wamid?: string; messageStatus?: string; logBody: string }> {
  if (target.kind === 'template') {
    const bodyValues = (target.variables || []).map(v => resolveVariable(String(v), lead));
    const result = await sendMetaTemplate(lead.phone, target.templateName, target.languageCode, bodyValues, target.variableNames || [], target.buttonPayloads || []);
    return { ...result, logBody: result.ok ? `[Delivered template: ${target.templateName}]` : `[FAILED to deliver template ${target.templateName}: ${result.error}]` };
  }

  if (target.kind === 'freeform') {
    const text = resolveVariable(target.body, lead);
    const cleanButtons = (target.buttons || [])
      .filter(b => b && b.id && b.title)
      .slice(0, MAX_BUTTONS)
      .map(b => ({ id: String(b.id), title: String(b.title).slice(0, MAX_BUTTON_TITLE) }));
    const payload = cleanButtons.length > 0
      ? { type: 'interactive', interactive: { type: 'button', body: { text }, action: { buttons: cleanButtons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) } } }
      : { type: 'text', text: { body: text } };
    const result = await sendWhatsAppMessage(lead.phone, payload);
    return { ...result, logBody: result.ok ? `[Delivered freeform: ${target.label}]` : `[FAILED to deliver freeform ${target.label}: ${result.error}]` };
  }

  // target.kind === 'flow'
  if (flow.action_type === 'message') {
    let messageBody = flow.message_body;
    if (flow.featured_program_id) {
      const { data: program } = await supabaseAdmin
        .from('featured_programs')
        .select('title, location, date_options')
        .eq('id', flow.featured_program_id)
        .maybeSingle();
      messageBody = resolveProgramTokens(messageBody, program);
    }
    messageBody = resolveVariable(messageBody, lead);
    const payload = (flow.message_buttons || []).length > 0
      ? { type: 'interactive', interactive: { type: 'button', body: { text: messageBody }, action: { buttons: flow.message_buttons.map((b: any) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) } } }
      : { type: 'text', text: { body: messageBody } };
    const result = await sendWhatsAppMessage(lead.phone, payload);
    return { ...result, logBody: result.ok ? `[Delivered flow: ${flow.label}]` : `[FAILED to deliver flow ${flow.label}: ${result.error}]` };
  }
  if (flow.action_type === 'template') {
    const bodyValues = (flow.template_variables || []).map((v: string) => resolveVariable(String(v), lead));
    const result = await sendMetaTemplate(lead.phone, flow.template_name, flow.template_language, bodyValues, flow.template_variable_names || [], flow.template_button_payloads || []);
    return { ...result, logBody: result.ok ? `[Delivered template: ${flow.template_name}]` : `[FAILED to deliver template ${flow.template_name}: ${result.error}]` };
  }
  // bot_media
  const payload = {
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'document', document: { link: media.file_url, filename: media.filename } },
      body: { text: media.caption },
      footer: { text: 'RAD Academy' },
      action: { buttons: (media.buttons || []).map((b: any) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
    },
  };
  const result = await sendWhatsAppMessage(lead.phone, payload);
  return { ...result, logBody: result.ok ? `[Delivered ${media.title}]` : `[FAILED to deliver ${media.title}: ${result.error}]` };
}

export async function POST(req: Request) {
  try {
    const { leadIds, target, confirmResend } = await req.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds[] is required' }, { status: 400 });
    }
    if (leadIds.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Max ${MAX_RECIPIENTS} recipients per send - select fewer and send again.` }, { status: 400 });
    }
    if (!target?.kind || !['flow', 'template', 'freeform'].includes(target.kind)) {
      return NextResponse.json({ error: 'target.kind must be "flow", "template", or "freeform"' }, { status: 400 });
    }
    if (target.kind === 'freeform' && !target.label?.trim()) {
      return NextResponse.json({ error: "target.label is required for a freeform send - it becomes this blast's stage name" }, { status: 400 });
    }

    let flow: any = null;
    if (target.kind === 'flow') {
      const { data, error } = await supabaseAdmin.from('bot_flows').select('*').eq('id', target.flowId).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      if (data.action_type === 'tag_only') return NextResponse.json({ error: 'This flow sends nothing (tag_only) - pick a different message' }, { status: 400 });
      flow = data;
    }

    const { data: leads, error: leadsErr } = await supabaseAdmin.from('leads').select('*').in('id', leadIds);
    if (leadsErr) throw leadsErr;

    // Resolve each lead's own target stage key up front - needed both for
    // the resend re-check below and for sending itself (a bot_media flow can
    // resolve to a different item per lead, see resolveLeadTarget).
    const perLead = new Map<string, { key: string; media?: any; error?: string }>();
    for (const lead of leads || []) {
      const resolved = await resolveLeadTarget(target as Target, flow, lead);
      perLead.set(lead.id, 'error' in resolved ? { key: '', error: resolved.error } : resolved);
    }

    // Server-side resend re-check - the UI's warning is a guard, not the
    // authority.
    if (!confirmResend) {
      const { data: history, error: histErr } = await supabaseAdmin
        .from('messages')
        .select('lead_id, body')
        .eq('direction', 'outbound')
        .in('lead_id', leadIds);
      if (histErr) throw histErr;
      const everKeysByLead = new Map<string, Set<string>>();
      for (const row of history || []) {
        const parsed = parseMessage({ direction: 'outbound', body: row.body });
        if (!isEligibleStage(parsed)) continue;
        const key = stageKeyFor(parsed).key;
        if (!everKeysByLead.has(row.lead_id)) everKeysByLead.set(row.lead_id, new Set());
        everKeysByLead.get(row.lead_id)!.add(key);
      }
      const alreadyReceived = (leads || [])
        .filter((lead: any) => {
          const target_ = perLead.get(lead.id);
          return target_?.key && everKeysByLead.get(lead.id)?.has(target_.key);
        })
        .map((lead: any) => lead.id);
      if (alreadyReceived.length > 0) {
        return NextResponse.json({
          error: 'Some selected leads already received this exact message before - resend requires confirmResend:true.',
          leadIdsAlreadyReceived: alreadyReceived,
        }, { status: 409 });
      }
    }

    const results: { leadId: string; phone: string; ok: boolean; skipped?: boolean; error?: string }[] = [];

    for (const lead of leads || []) {
      if (lead.opted_out) {
        results.push({ leadId: lead.id, phone: lead.phone, ok: false, skipped: true, error: 'Opted out' });
        continue;
      }
      const resolved = perLead.get(lead.id);
      if (!resolved || resolved.error) {
        results.push({ leadId: lead.id, phone: lead.phone, ok: false, skipped: true, error: resolved?.error || 'Could not resolve message for this lead' });
        continue;
      }

      const sendResult = await sendOne(target as Target, flow, resolved.media, lead);

      await supabaseAdmin.from('messages').insert([{
        lead_id: lead.id,
        direction: 'outbound',
        body: sendResult.logBody,
        wamid: sendResult.wamid || null,
        meta_message_status: sendResult.messageStatus || null,
        ...(sendResult.ok ? {} : { status: 'failed' }),
      }]);

      if (sendResult.ok) {
        await logOutboundContactAndResolveQueue(supabaseAdmin, lead.id, `Message Funnel send: ${resolved.key}`, 'message_funnel');
      }

      results.push({ leadId: lead.id, phone: lead.phone, ok: sendResult.ok, error: sendResult.error });
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
