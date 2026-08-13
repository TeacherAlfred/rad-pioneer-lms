import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStatusChange } from '@/lib/leadStatusHistory';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pushes approved, not-yet-committed staging rows into the real leads table.
// This is the one action in this tool that touches live data - only rows an
// admin explicitly approved get here, nothing from the raw import reaches
// leads on its own. With no body (or no ids), commits every approved row;
// with { ids }, scopes to just those - review_status='approved' is still
// enforced server-side either way, so passing a pending/excluded id is a
// no-op rather than a way to bypass the approval gate.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;

    let query = supabaseAdmin
      .from('warm_list_staging')
      .select('*')
      .eq('review_status', 'approved')
      .is('committed_at', null);
    if (ids && ids.length > 0) query = query.in('id', ids);

    const { data: rows, error: fetchErr } = await query;

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
        const { data } = await supabaseAdmin.from('leads').select('id, tags').eq('phone', row.phone).maybeSingle();
        existing = data;
      }
      if (!existing && row.email) {
        const { data } = await supabaseAdmin.from('leads').select('id, tags').eq('email', row.email).maybeSingle();
        existing = data;
      }

      if (existing) {
        // Status/funnel progress stays untouched - just merge in whatever new
        // tags this review pass surfaced (e.g. an already-known lead turning
        // out to also be an Irene Primary parent).
        const mergedTags = Array.from(new Set([...(existing.tags || []), ...(row.tags || [])]));
        await supabaseAdmin.from('leads').update({ tags: mergedTags }).eq('id', existing.id);
        alreadyExisted++;
      } else {
        const { data: newLead, error: insertErr } = await supabaseAdmin.from('leads').insert([{
          phone: row.phone || null,
          email: row.email || null,
          name: row.name || null,
          status: 'new_lead',
          source: row.source || 'warm_list',
          tags: row.tags || [],
        }]).select().single();
        if (insertErr) {
          skipped++;
          skippedReasons.push(`${row.name || row.id}: ${insertErr.message}`);
          continue;
        }
        await recordStatusChange(supabaseAdmin, newLead.id, 'new_lead');
        inserted++;
      }

      await supabaseAdmin.from('warm_list_staging').update({ committed_at: new Date().toISOString() }).eq('id', row.id);
    }

    return NextResponse.json({ inserted, alreadyExisted, skipped, skippedReasons });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
