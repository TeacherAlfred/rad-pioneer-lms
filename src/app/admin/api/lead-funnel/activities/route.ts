import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CONTACT_CHANNELS, CONTACT_OUTCOMES } from '@/lib/contactLog';

const RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;

// Feed of a lead's contact-attempt outcomes (channel, direction, outcome,
// who logged it, optionally what it was for). Written by two sources:
// the webhook's pipeline-alert buttons/reply-capture flow (channel
// 'whatsapp', its own outcome vocabulary, no `objective`), and - as of the
// POST below - the admin-facing contact log (any CONTACT_CHANNELS/
// CONTACT_OUTCOMES value, `objective` set). Both write into the same
// free-text columns; see src/lib/contactLog.ts for why that's fine.
//
// ?needsReview=true (no leadId) instead lists every lead across the whole
// funnel still awaiting a response 24h+ after the "what I did" was logged -
// see PATCH below and the nightly cron's flagging pass.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId');
  const supabase = supabaseAdmin();

  if (searchParams.get('needsReview') === 'true') {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*, leads(id, name, phone)')
      .eq('needs_response_review', true)
      .order('response_due_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data || [] });
  }

  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Logs "what I did" (channel/objective/note) - the response ("what they
// did") is often not knowable yet (a WhatsApp invite or email needs time
// for a reply, unlike a live call where you often already know), so
// `outcome` is optional here. Left out, response_due_at is stamped 24h out
// for the nightly cron to pick up; provided (e.g. a call where the outcome
// was immediately obvious), it's resolved on the spot. Also clears
// leads.needs_human, mirroring the webhook's STATUS_BUTTONS behavior so a
// lead logged as contacted from either surface stops showing "Needs Reply".
export async function POST(req: Request) {
  try {
    const { leadId, channel, outcome, objective, note, createdBy, occurredAt } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    if (!CONTACT_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: `channel must be one of: ${CONTACT_CHANNELS.join(', ')}` }, { status: 400 });
    }
    if (outcome && !CONTACT_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: `outcome must be one of: ${CONTACT_OUTCOMES.join(', ')}` }, { status: 400 });
    }

    const now = new Date();
    const supabase = supabaseAdmin();
    // created_at only spread in when actually provided - see the matching
    // note in call-queue/route.ts's POST for why an `undefined`-valued key
    // here would make PostgREST insert NULL instead of applying `default
    // now()`, tripping created_at's NOT NULL constraint.
    const { data, error } = await supabase
      .from('lead_activities')
      .insert([{
        lead_id: leadId,
        channel,
        direction: 'outbound',
        outcome: outcome || null,
        objective: objective || null,
        note: note?.trim() || null,
        created_by: createdBy || null,
        ...(occurredAt ? { created_at: occurredAt } : {}),
        ...(outcome
          ? { response_recorded_at: now.toISOString(), response_recorded_by: createdBy || 'admin' }
          : { response_due_at: new Date(now.getTime() + RESPONSE_WINDOW_MS).toISOString() }),
      }])
      .select()
      .single();
    if (error) throw error;

    await supabase.from('leads').update({ needs_human: false }).eq('id', leadId);

    // Logging any contact attempt for a lead resolves their spot in the
    // call queue, regardless of which page triggered the log (the queue's
    // own "Log Outcome" row action, the lead drawer, wherever ContactLogForm
    // is used) - the queue is about making the attempt, not about waiting
    // for their reply, so this happens whether or not outcome is known yet.
    // Stays queryable as history via
    // GET /admin/api/lead-funnel/call-queue?status=history rather than
    // disappearing outright.
    const { data: pendingQueueRow } = await supabase
      .from('lead_call_queue')
      .select('id')
      .eq('lead_id', leadId)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingQueueRow) {
      await supabase.from('lead_call_queue').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', pendingQueueRow.id);
    }

    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Captures "what they did" for an entry that was logged without a known
// outcome yet - one-shot only (rejects if this entry already has an
// outcome), so this is completing a two-phase record rather than editing
// history; the log otherwise stays append-only like lead_notes/
// lead_stage_history. Used both for a manual "reopen the lead" capture and
// for the admin confirming a needs_response_review-flagged entry (bulk
// "mark as no response" included) from the Call Queue page's Needs
// Response view.
export async function PATCH(req: Request) {
  try {
    const { id, outcome, note } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (!CONTACT_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: `outcome must be one of: ${CONTACT_OUTCOMES.join(', ')}` }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: existing, error: fetchError } = await supabase.from('lead_activities').select('id, outcome, note').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    if (existing.outcome) return NextResponse.json({ error: 'This entry already has a recorded outcome' }, { status: 400 });

    const mergedNote = note?.trim()
      ? (existing.note ? `${existing.note}\n\n[Response] ${note.trim()}` : note.trim())
      : existing.note;

    const { data, error } = await supabase
      .from('lead_activities')
      .update({
        outcome,
        note: mergedNote,
        response_recorded_at: new Date().toISOString(),
        response_recorded_by: 'admin',
        needs_response_review: false,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Removing a genuinely mis-logged entry.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const supabase = supabaseAdmin();
    const { error } = await supabase.from('lead_activities').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
