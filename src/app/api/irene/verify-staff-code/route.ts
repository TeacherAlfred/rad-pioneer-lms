import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public-callable by design — any teacher needs to reach it during the
// Educators phase. It only ever returns a boolean; the real code is compared
// server-side via the service-role key and never sent to the browser.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('irene_staff_codes').select('code').eq('id', 1).single();
    if (error) throw error;

    const valid = code.trim().toUpperCase() === (data.code || '').trim().toUpperCase();
    return NextResponse.json({ valid });
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: error.message }, { status: 500 });
  }
}
