import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createMetaTemplate } from '@/lib/metaTemplate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Numbered placeholders only ({{1}}, {{2}}...) - see the Template Rollout
// Wizard plan for why: Meta's named-parameter creation shape is newer and
// riskier to get exactly right sight-unseen, and placeholder_labels already
// gets the auto-fill UX without it (see lead-funnel/templates/route.ts).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: row, error: fetchError } = await supabaseAdmin
      .from('template_rollouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.status !== 'draft') {
      return NextResponse.json({ error: `Already ${row.status} - can't resubmit from this state.` }, { status: 400 });
    }
    if (!row.body_text?.trim()) {
      return NextResponse.json({ error: 'Body text is required before submitting.' }, { status: 400 });
    }

    const placeholderCount = new Set(
      [...(row.body_text as string).matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => m[1])
    ).size;
    if (placeholderCount > 0 && row.placeholder_samples.filter((s: string) => s?.trim()).length < placeholderCount) {
      return NextResponse.json({ error: `${placeholderCount} placeholder(s) in the body need a sample value each before Meta will accept this.` }, { status: 400 });
    }

    const components: any[] = [];
    if (row.header_text?.trim()) {
      components.push({ type: 'HEADER', format: 'TEXT', text: row.header_text.trim() });
    }
    components.push({
      type: 'BODY',
      text: row.body_text.trim(),
      ...(placeholderCount > 0 ? { example: { body_text: [row.placeholder_samples.slice(0, placeholderCount)] } } : {}),
    });
    if (row.footer_text?.trim()) {
      components.push({ type: 'FOOTER', text: row.footer_text.trim() });
    }
    if ((row.buttons || []).length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: row.buttons.map((b: any) => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
          return { type: 'QUICK_REPLY', text: b.text };
        }),
      });
    }

    const result = await createMetaTemplate(row.name, row.language, row.category, components);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Meta rejected this template.' }, { status: 502 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('template_rollouts')
      .update({
        status: 'submitted',
        meta_template_id: result.metaTemplateId,
        meta_status: result.status || 'PENDING',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ row: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
