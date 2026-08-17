import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public-callable by design — lets a parent who knows their child's first name on file
// (an admin-only field, never shown anywhere on the public voting page) find their
// family's response by first name + grade. Same pattern as verify-staff-code: the secret
// (here, the child's name) is only ever compared server-side via the service-role key.
// The response returns nothing but info that's already public elsewhere on the site
// (initial/grade/class) — never the name itself, and never a hint on a near-miss.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { name, grade } = await req.json();
    if (!name || typeof name !== 'string' || !grade || typeof grade !== 'string') {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('irene_responses')
      .select('cubs, cub_full_names')
      .eq('is_verified', true);
    if (error) throw error;

    const needle = name.trim().toLowerCase();

    for (const r of data || []) {
      const cubs = r.cubs || [];
      const fullNames = r.cub_full_names || [];
      for (let i = 0; i < cubs.length; i++) {
        // Match on first name only — cub_full_names may hold a full name or just a first
        // name depending on what the admin entered, so always compare the first token.
        const storedFirstName = (fullNames[i] || '').trim().toLowerCase().split(/\s+/)[0] || '';
        if (storedFirstName && storedFirstName === needle && cubs[i].grade === grade) {
          return NextResponse.json({
            found: true,
            initial: cubs[i].cub_initial,
            grade: cubs[i].grade,
            className: cubs[i].class_name,
          });
        }
      }
    }

    return NextResponse.json({ found: false });
  } catch (error: any) {
    return NextResponse.json({ found: false, error: error.message }, { status: 500 });
  }
}
