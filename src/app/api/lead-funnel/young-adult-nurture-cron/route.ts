import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMetaTemplate, resolveVariable } from '@/lib/metaTemplate';
import { YOUNG_ADULT_TRACK_TAG } from '@/lib/leadQualification';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAY_MS = 24 * 60 * 60 * 1000;
// Roughly "once a quarter" per lead - re-checked every run rather than
// hardcoding calendar quarters, so a lead tagged mid-quarter still gets ~90
// days of spacing from their own last send instead of possibly getting two
// sends close together across a quarter boundary.
const RESEND_GAP_DAYS = 80;

// Quarterly nurture for leads whose child was marked "Too Old" on the
// child_age_fits_program qualification check (see leadQualification.ts) -
// not a disqualification, a redirect toward a future young-adults program.
// No-ops safely until an admin sets dashboard_settings.young_adult_template_name
// to an already Meta-approved template - that approval is an external,
// non-code step (Meta Business Manager), so this can ship now and start
// sending the moment a template exists, with no further deploy needed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from('dashboard_settings')
      .select('young_adult_template_name, young_adult_template_language, young_adult_template_variable_names')
      .limit(1)
      .single();

    if (!settings?.young_adult_template_name) {
      return NextResponse.json({ success: true, skipped: 'young_adult_template_name not configured' });
    }

    const { data: candidates, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .contains('tags', [YOUNG_ADULT_TRACK_TAG])
      .eq('bot_paused', false)
      .eq('opted_out', false);
    if (error) throw error;

    const cutoff = Date.now() - RESEND_GAP_DAYS * DAY_MS;
    const due = (candidates || []).filter((lead) => {
      if (!lead.young_adult_last_nurture_sent_at) return true;
      return new Date(lead.young_adult_last_nurture_sent_at).getTime() < cutoff;
    });

    const variableNames: string[] = settings.young_adult_template_variable_names || [];
    let sent = 0;
    let failed = 0;

    for (const lead of due) {
      const bodyValues = variableNames.map((name) => resolveVariable(`{{${name}}}`, lead));
      const result = await sendMetaTemplate(
        lead.phone,
        settings.young_adult_template_name,
        settings.young_adult_template_language || 'en',
        bodyValues,
        variableNames
      );

      await supabaseAdmin.from('messages').insert([{
        lead_id: lead.id,
        direction: 'outbound',
        body: result.ok
          ? `[Delivered template: ${settings.young_adult_template_name}]`
          : `[FAILED to deliver template ${settings.young_adult_template_name}: ${result.error}]`,
      }]);

      if (result.ok) {
        await supabaseAdmin.from('leads').update({ young_adult_last_nurture_sent_at: new Date().toISOString() }).eq('id', lead.id);
        sent++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({ success: true, candidates: candidates?.length || 0, due: due.length, sent, failed });
  } catch (error: any) {
    console.error('Young-adult nurture cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
