import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findOrCreateLeadByPhone } from '@/lib/leadFinance';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') || '';
  if (q.length < 3) return NextResponse.json({ leads: [] });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, email')
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { phone, name, email, source } = body;
  if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const lead = await findOrCreateLeadByPhone(supabase, { phone, name, email, source: source || 'finance_v2_composer' });
  if (!lead) return NextResponse.json({ error: 'Failed to find or create lead' }, { status: 500 });
  return NextResponse.json({ lead });
}
