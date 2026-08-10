import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// irene_merge_candidates has RLS enabled with zero anon policies (admin-only,
// by design — same posture as irene_class_aliases). The admin page's regular
// browser client only ever carries the anon key, regardless of Next.js
// middleware auth, so reads/writes here must go through this service-role
// route, protected by the /admin path prefix (see src/middleware.ts).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('irene_merge_candidates')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ candidates: data });
}

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !['merged', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from('irene_merge_candidates').update({ status }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
