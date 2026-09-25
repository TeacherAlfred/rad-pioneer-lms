import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Per-template URL-button clicks (bots excluded) logged by the public
// /t/<template> redirect - see 20260925210000_template_link_clicks.sql.
export async function GET() {
  const counts = new Map<string, { clicks: number; lastClickAt: string }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('template_link_clicks')
      .select('template_name, clicked_at')
      .eq('is_bot', false)
      .order('clicked_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data || []) {
      const cur = counts.get(row.template_name);
      if (cur) cur.clicks++;
      else counts.set(row.template_name, { clicks: 1, lastClickAt: row.clicked_at });
    }
    if (!data || data.length < PAGE) break;
  }
  const rows = Array.from(counts.entries())
    .map(([templateName, v]) => ({ templateName, ...v }))
    .sort((a, b) => b.clicks - a.clicks);
  return NextResponse.json({ rows });
}
