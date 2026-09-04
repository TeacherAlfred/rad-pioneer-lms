import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public GET - currently-live micro-ads for the community feed
// (community/page.tsx). Date-filtered here in app code rather than via an
// RLS policy, matching every other irene_fitness_* table's convention:
// service-role only, zero anon policies, all access mediated through
// Next.js API routes.
export async function GET() {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('irene_fitness_feed_ads')
    .select('id, image_url, cta_label, contact_prefill')
    .lte('live_from', now)
    .gte('live_until', now)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ads: data || [] });
}
