import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// irene_class_aliases has RLS enabled with zero anon policies (admin-only,
// by design). Same reasoning as irene-merge-candidates/route.ts.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('irene_class_aliases')
    .select('*')
    .order('raw_grade', { ascending: true })
    .order('raw_class_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aliases: data });
}

export async function POST(req: Request) {
  try {
    const { raw_grade, raw_class_name, canonical_grade, canonical_class_name } = await req.json();
    if (!raw_grade || !raw_class_name || !canonical_grade || !canonical_class_name) {
      return NextResponse.json({ error: 'All four fields are required' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from('irene_class_aliases').insert({
      raw_grade, raw_class_name, canonical_grade, canonical_class_name,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { raw_grade, raw_class_name, canonical_grade, canonical_class_name } = await req.json();
    if (!raw_grade || !raw_class_name || !canonical_grade || !canonical_class_name) {
      return NextResponse.json({ error: 'All four fields are required' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('irene_class_aliases')
      .update({ canonical_grade, canonical_class_name })
      .eq('raw_grade', raw_grade)
      .eq('raw_class_name', raw_class_name);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { raw_grade, raw_class_name } = await req.json();
    if (!raw_grade || !raw_class_name) {
      return NextResponse.json({ error: 'raw_grade and raw_class_name are required' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('irene_class_aliases')
      .delete()
      .eq('raw_grade', raw_grade)
      .eq('raw_class_name', raw_class_name);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
