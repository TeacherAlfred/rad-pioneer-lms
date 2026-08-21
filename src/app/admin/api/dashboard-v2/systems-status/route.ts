import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = supabaseAdmin();
  const [{ data: systems, error: sysErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabase.from('systems_status').select('*').order('sort_order'),
    supabase.from('system_checklist_items').select('*').order('sort_order'),
  ]);
  if (sysErr) return NextResponse.json({ error: sysErr.message }, { status: 500 });
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  return NextResponse.json({ systems: systems || [], items: items || [] });
}
