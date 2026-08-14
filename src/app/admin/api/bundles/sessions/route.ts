import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { bundleId, sessionId } = await req.json();
    if (!bundleId || !sessionId) {
      return NextResponse.json({ error: 'bundleId and sessionId are required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('bundle_sessions')
      .insert([{ bundle_id: bundleId, session_id: sessionId }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That session is already in this bundle.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { bundleId, sessionId } = await req.json();
    if (!bundleId || !sessionId) {
      return NextResponse.json({ error: 'bundleId and sessionId are required' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from('bundle_sessions').delete().eq('bundle_id', bundleId).eq('session_id', sessionId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
