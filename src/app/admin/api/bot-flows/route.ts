import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same 3-button/20-char constraint as bot_media - Meta rejects the whole
// interactive message if any one button fails this, not just the offender.
function validateButtons(buttons: any[]): string | null {
  if (!Array.isArray(buttons)) return 'message_buttons must be an array';
  if (buttons.length > 3) return 'Max 3 buttons per message';
  for (const b of buttons) {
    if (!b?.id || !String(b.id).trim()) return 'Every button needs an id';
    const titleLen = String(b.title || '').trim().length;
    if (titleLen < 1 || titleLen > 20) return `Button "${b.title}" is ${titleLen} characters - must be 1-20`;
  }
  return null;
}

function validate(body: any): string | null {
  if (!body.trigger_button_id?.trim()) return 'trigger_button_id is required';
  if (!body.label?.trim()) return 'label is required';
  if (!['message', 'template'].includes(body.action_type)) return 'action_type must be "message" or "template"';

  if (body.action_type === 'message') {
    if (!body.message_body?.trim()) return 'message_body is required for a message flow';
    const buttonsErr = validateButtons(body.message_buttons || []);
    if (buttonsErr) return buttonsErr;
  } else {
    if (!body.template_name?.trim()) return 'template_name is required for a template flow';
    if (!body.template_language?.trim()) return 'template_language is required for a template flow';
  }
  if (body.expects_reply && !body.reply_label?.trim()) {
    return 'reply_label is required when this message expects a reply';
  }
  return null;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('bot_flows')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validate(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('bot_flows')
      .insert([{
        trigger_button_id: body.trigger_button_id.trim(),
        label: body.label.trim(),
        action_type: body.action_type,
        message_body: body.message_body || null,
        message_buttons: body.message_buttons || [],
        template_name: body.template_name || null,
        template_language: body.template_language || null,
        template_variables: body.template_variables || [],
        template_variable_names: body.template_variable_names || [],
        template_button_payloads: body.template_button_payloads || [],
        set_source: body.set_source || null,
        add_tags: body.add_tags || [],
        notify_admin: !!body.notify_admin,
        skip_human_handoff: body.skip_human_handoff !== false,
        expects_reply: !!body.expects_reply,
        reply_label: body.expects_reply ? body.reply_label.trim() : null,
        reply_confirmation: body.reply_confirmation?.trim() || null,
        completion_tag: body.expects_reply ? (body.completion_tag?.trim() || null) : null,
        active: true,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `A flow already uses trigger id "${body.trigger_button_id}" - pick another or edit that one.` }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Field-only edits skip full validate() (e.g. toggling `active` alone
    // shouldn't require message_body to be re-sent) - only re-check buttons
    // if they're actually part of this edit.
    if ('message_buttons' in fields) {
      const buttonsErr = validateButtons(fields.message_buttons);
      if (buttonsErr) return NextResponse.json({ error: buttonsErr }, { status: 400 });
    }
    if (fields.expects_reply && !fields.reply_label?.trim()) {
      return NextResponse.json({ error: 'reply_label is required when this message expects a reply' }, { status: 400 });
    }

    const allowed = [
      'trigger_button_id', 'label', 'action_type', 'message_body', 'message_buttons',
      'template_name', 'template_language', 'template_variables', 'template_variable_names', 'template_button_payloads',
      'set_source', 'add_tags', 'notify_admin', 'skip_human_handoff', 'active',
      'expects_reply', 'reply_label', 'reply_confirmation', 'completion_tag',
    ];
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key];
    }

    const { data, error } = await supabaseAdmin
      .from('bot_flows')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `A flow already uses that trigger id.` }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('bot_flows').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
