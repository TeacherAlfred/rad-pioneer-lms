import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Read-only search over the legacy system's guardian accounts (profiles,
// role='guardian') - used only to find which old-system client corresponds
// to a v2 lead when bringing a balance forward. No write path here; the
// match is for the admin's own reference, not stored as a live FK.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ guardians: [] });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, metadata')
    .eq('role', 'guardian')
    .ilike('display_name', `%${q}%`)
    .order('display_name', { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const guardians = (data || []).map((p: any) => {
    const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
    return { id: p.id, display_name: p.display_name, phone: meta.phone || '', email: meta.email || '' };
  });
  return NextResponse.json({ guardians });
}
