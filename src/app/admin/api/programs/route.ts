import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PROGRAM_TYPES, AUDIENCES, PROGRAM_LEVELS } from '@/lib/programs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Programme = curriculum only (see RAD_Programme_Model_and_Catalogue.md).
// Dates/prices/capacity live on sessions, embedded here just as a count
// per programme - the sessions themselves are managed via /admin/api/sessions.
const PROGRAM_SELECT = `
  *,
  prerequisite:prerequisite_programme_id(id, code, name),
  sessions(id, status)
`;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('programs')
    .select(PROGRAM_SELECT)
    .order('code');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || []).map((r: any) => {
    const { sessions, ...rest } = r;
    return { ...rest, session_count: (sessions || []).length };
  });
  return NextResponse.json({ rows });
}

function validatePayload(body: any, { partial }: { partial: boolean }) {
  const { name, code, type, audience, level } = body;
  if (!partial || name !== undefined) {
    if (!name || !String(name).trim()) return 'Name is required';
  }
  if (!partial || code !== undefined) {
    if (!code || !String(code).trim()) return 'Code is required';
  }
  if (!partial || type !== undefined) {
    if (!PROGRAM_TYPES.includes(type)) return `type must be one of: ${PROGRAM_TYPES.join(', ')}`;
  }
  if (audience !== undefined && audience !== null && !AUDIENCES.includes(audience)) {
    return `audience must be one of: ${AUDIENCES.join(', ')}`;
  }
  if (level !== undefined && level !== null && level !== '' && !PROGRAM_LEVELS.includes(level)) {
    return `level must be one of: ${PROGRAM_LEVELS.join(', ')}`;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validatePayload(body, { partial: false });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const {
      code, name, type, audience, level, sequence, version,
      age_min, age_max, duration_hours, prerequisite_programme_id,
      description_short, description_long, includes, active,
    } = body;

    const { data, error } = await supabaseAdmin
      .from('programs')
      .insert([{
        code: String(code).trim(),
        name: String(name).trim(),
        type,
        audience: audience || 'student',
        level: level || null,
        sequence: sequence === '' || sequence === undefined ? null : Number(sequence),
        version: version === '' || version === undefined ? 1 : Number(version),
        age_min: age_min === '' || age_min === undefined ? null : Number(age_min),
        age_max: age_max === '' || age_max === undefined ? null : Number(age_max),
        duration_hours: duration_hours === '' || duration_hours === undefined ? null : Number(duration_hours),
        prerequisite_programme_id: prerequisite_programme_id || null,
        description_short: description_short || null,
        description_long: description_long || null,
        includes: Array.isArray(includes) ? includes : null,
        active: active === undefined ? true : !!active,
      }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That programme code is already in use.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const err = validatePayload(body, { partial: true });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const {
      code, name, type, audience, level, sequence, version,
      age_min, age_max, duration_hours, prerequisite_programme_id,
      description_short, description_long, includes, active,
    } = body;

    const update: Record<string, any> = {};
    if (code !== undefined) update.code = String(code).trim();
    if (name !== undefined) update.name = String(name).trim();
    if (type !== undefined) update.type = type;
    if (audience !== undefined) update.audience = audience || 'student';
    if (level !== undefined) update.level = level || null;
    if (sequence !== undefined) update.sequence = sequence === '' ? null : Number(sequence);
    if (version !== undefined) update.version = version === '' ? 1 : Number(version);
    if (age_min !== undefined) update.age_min = age_min === '' ? null : Number(age_min);
    if (age_max !== undefined) update.age_max = age_max === '' ? null : Number(age_max);
    if (duration_hours !== undefined) update.duration_hours = duration_hours === '' ? null : Number(duration_hours);
    if (prerequisite_programme_id !== undefined) update.prerequisite_programme_id = prerequisite_programme_id || null;
    if (description_short !== undefined) update.description_short = description_short || null;
    if (description_long !== undefined) update.description_long = description_long || null;
    if (includes !== undefined) update.includes = Array.isArray(includes) ? includes : null;
    if (active !== undefined) update.active = !!active;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('programs').update(update).eq('id', id).select().single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That programme code is already in use.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Cascades to sessions (on delete cascade), which cascades to enrolments -
// deleting a programme removes every session and enrolment under it.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('programs').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
