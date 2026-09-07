import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('template_rollouts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

// Step 1 only - name/category/language. Everything else (body, placeholders,
// buttons, lane) is filled in via PATCH on [id] as the wizard progresses,
// same partial-update shape as admin/api/lead-funnel's PATCH.
export async function POST(req: Request) {
  try {
    const { name, category, language } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(category)) {
      return NextResponse.json({ error: 'category must be MARKETING, UTILITY, or AUTHENTICATION' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('template_rollouts')
      .insert([{ name: name.trim(), category, language: (language || 'en_US').trim() }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A rollout with that name and language already exists.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
