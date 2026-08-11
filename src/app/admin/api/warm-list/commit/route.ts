import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pushes every approved, not-yet-committed staging row into the real leads
// table. This is the one action in this tool that touches live data - only
// rows an admin explicitly approved get here, nothing from the raw import
// reaches leads on its own.
export async function POST() {
  try {
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('warm_list_staging')
      .select('*')
      .eq('review_status', 'approved')
      .is('committed_at', null);

    if (fetchErr) throw fetchErr;

    let inserted = 0;
    let alreadyExisted = 0;
    let skipped = 0;
    const skippedReasons: string[] = [];

    for (const row of rows || []) {
      if (!row.phone && !row.email) {
        skipped++;
        skippedReasons.push(`${row.name || row.id}: no phone or email`);
        continue;
      }

      // Check for an existing lead by phone first, then email - never
      // overwrite an existing lead's funnel status, same rule as the webhook.
      let existing = null;
      if (row.phone) {
        const { data } = await supabaseAdmin.from('leads').select('id').eq('phone', row.phone).maybeSingle();
        existing = data;
      }
      if (!existing && row.email) {
        const { data } = await supabaseAdmin.from('leads').select('id').eq('email', row.email).maybeSingle();
        existing = data;
      }

      if (existing) {
        alreadyExisted++;
      } else {
        const { error: insertErr } = await supabaseAdmin.from('leads').insert([{
          phone: row.phone || null,
          email: row.email || null,
          name: row.name || null,
          status: 'new_lead',
          source: row.is_plk ? 'meta_plk' : 'warm_list',
        }]);
        if (insertErr) {
          skipped++;
          skippedReasons.push(`${row.name || row.id}: ${insertErr.message}`);
          continue;
        }
        inserted++;
      }

      await supabaseAdmin.from('warm_list_staging').update({ committed_at: new Date().toISOString() }).eq('id', row.id);
    }

    return NextResponse.json({ inserted, alreadyExisted, skipped, skippedReasons });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
