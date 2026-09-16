import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// The generic (non-ad-set) welcome menu's editable copy - see
// whatsapp-webhook/route.ts's STAGE 1 catch-all, which reads these same
// columns with a fallback to its own hardcoded default text/buttons when
// unset. Single implicit settings row, same convention as every other
// dashboard_settings field (young_adult_template_name etc.).
function validateButtons(buttons: any[]): string | null {
  if (!Array.isArray(buttons)) return 'buttons must be an array';
  if (buttons.length > 3) return 'Max 3 buttons';
  for (const b of buttons) {
    if (!b?.id || !String(b.id).trim()) return 'Every button needs an id';
    const titleLen = String(b.title || '').trim().length;
    if (titleLen < 1 || titleLen > 20) return `Button "${b.title}" is ${titleLen} characters - must be 1-20`;
  }
  return null;
}

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('dashboard_settings')
    .select('welcome_message_new, welcome_message_returning, welcome_buttons')
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { welcome_message_new, welcome_message_returning, welcome_buttons } = body;

    if (welcome_buttons !== undefined) {
      const err = validateButtons(welcome_buttons);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: existing } = await supabase.from('dashboard_settings').select('id').limit(1).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'dashboard_settings has no row to update' }, { status: 500 });

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (welcome_message_new !== undefined) update.welcome_message_new = welcome_message_new?.trim() || null;
    if (welcome_message_returning !== undefined) update.welcome_message_returning = welcome_message_returning?.trim() || null;
    if (welcome_buttons !== undefined) update.welcome_buttons = welcome_buttons;

    const { data, error } = await supabase
      .from('dashboard_settings')
      .update(update)
      .eq('id', existing.id)
      .select('welcome_message_new, welcome_message_returning, welcome_buttons')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
