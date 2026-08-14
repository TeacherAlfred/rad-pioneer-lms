import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PASS_CREDIT_SELECT = 'id, status, enrolment_id, redeemed_at, enrolments(id, student_id, session_id, kids(id, name), sessions(id, starts_at, programme_id, programs(id, code, name)))';

// A Pass is a purchased entitlement to N sessions, redeemed over time -
// see RAD_Programme_Model_and_Catalogue.md 2.5. No DELETE route -
// financial records aren't removed.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('passes')
    .select(`*, leads(id, name, phone), first_session:first_session_id(id, starts_at, programme_id, programs(id, code, name)), pass_credits(${PASS_CREDIT_SELECT})`)
    .order('purchased_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Attaches a redeemed pass credit to a student's enrolment on a session -
// reusing an existing enrolment (e.g. the admin already enrolled them
// directly from /admin/kids before the parent paid) rather than always
// inserting a new one, which would double them up on the session's
// roster/attendance list. enrolments has a unique (student_id,
// session_id) constraint as a backstop against this regardless of path.
async function attachCreditToEnrolment(studentId: string, sessionId: string, creditId: string) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('enrolments')
    .select('id, pass_credit_id')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    if (existing.pass_credit_id && existing.pass_credit_id !== creditId) {
      throw new Error('This student is already enrolled on that session via a different pass credit.');
    }
    const { data, error } = await supabaseAdmin
      .from('enrolments')
      .update({ pass_credit_id: creditId })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('enrolments')
    .insert([{ student_id: studentId, session_id: sessionId, pass_credit_id: creditId, status: 'registered' }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// firstSessionId + firstStudentId are required - the model doc calls the
// first session "required at purchase, non-negotiable" (it forces the
// attendance that generates proof for the acquisition funnel). This
// creates the pass, generates one PassCredit row per credit, and
// immediately redeems the first credit into an Enrolment for that
// session/student - the other credits stay unredeemed until used later.
export async function POST(req: Request) {
  try {
    const {
      guardianLeadId, firstSessionId, firstStudentId, orderId,
      creditsTotal, qualifyingLocation, qualifyingTypes, unusedCreditValue,
    } = await req.json();

    if (!guardianLeadId) return NextResponse.json({ error: 'guardianLeadId is required' }, { status: 400 });
    if (!firstSessionId) return NextResponse.json({ error: 'firstSessionId is required - a pass must have its first session booked at purchase' }, { status: 400 });
    if (!firstStudentId) return NextResponse.json({ error: 'firstStudentId is required - who is the first credit for' }, { status: 400 });

    const total = creditsTotal ? Number(creditsTotal) : 3;
    const purchasedAt = new Date();
    const expiresAt = new Date(purchasedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const { data: pass, error: passErr } = await supabaseAdmin
      .from('passes')
      .insert([{
        guardian_lead_id: guardianLeadId,
        order_id: orderId || null,
        credits_total: total,
        credits_used: 1,
        qualifying_location: qualifyingLocation || null,
        qualifying_types: Array.isArray(qualifyingTypes) ? qualifyingTypes : null,
        purchased_at: purchasedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        first_session_id: firstSessionId,
        unused_credit_value: unusedCreditValue ? Number(unusedCreditValue) : 500,
      }])
      .select()
      .single();
    if (passErr) throw passErr;

    const { data: credits, error: creditsErr } = await supabaseAdmin
      .from('pass_credits')
      .insert(Array.from({ length: total }, () => ({ pass_id: pass.id })))
      .select()
      .order('created_at', { ascending: true });
    if (creditsErr) throw creditsErr;

    const firstCredit = credits[0];
    const enrolment = await attachCreditToEnrolment(firstStudentId, firstSessionId, firstCredit.id);

    const { error: redeemErr } = await supabaseAdmin
      .from('pass_credits')
      .update({ status: 'redeemed', enrolment_id: enrolment.id, redeemed_at: new Date().toISOString() })
      .eq('id', firstCredit.id);
    if (redeemErr) throw redeemErr;

    const { data: fullPass, error: fetchErr } = await supabaseAdmin
      .from('passes')
      .select(`*, leads(id, name, phone), pass_credits(${PASS_CREDIT_SELECT})`)
      .eq('id', pass.id)
      .single();
    if (fetchErr) throw fetchErr;

    return NextResponse.json({ row: fullPass });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Redeems one unredeemed credit on a pass into a new enrolment.
export async function PATCH(req: Request) {
  try {
    const { passId, redeemCreditId, studentId, sessionId } = await req.json();
    if (!passId || !redeemCreditId || !studentId || !sessionId) {
      return NextResponse.json({ error: 'passId, redeemCreditId, studentId and sessionId are required' }, { status: 400 });
    }

    const { data: credit, error: creditErr } = await supabaseAdmin
      .from('pass_credits')
      .select('id, status, pass_id')
      .eq('id', redeemCreditId)
      .single();
    if (creditErr) throw creditErr;
    if (credit.pass_id !== passId) return NextResponse.json({ error: 'That credit does not belong to this pass' }, { status: 400 });
    if (credit.status === 'redeemed') return NextResponse.json({ error: 'That credit is already redeemed' }, { status: 409 });

    const enrolment = await attachCreditToEnrolment(studentId, sessionId, redeemCreditId);

    await supabaseAdmin
      .from('pass_credits')
      .update({ status: 'redeemed', enrolment_id: enrolment.id, redeemed_at: new Date().toISOString() })
      .eq('id', redeemCreditId);

    const { data: pass } = await supabaseAdmin.from('passes').select('credits_used').eq('id', passId).single();
    await supabaseAdmin.from('passes').update({ credits_used: (pass?.credits_used || 0) + 1 }).eq('id', passId);

    const { data: fullPass, error: fetchErr } = await supabaseAdmin
      .from('passes')
      .select(`*, leads(id, name, phone), pass_credits(${PASS_CREDIT_SELECT})`)
      .eq('id', passId)
      .single();
    if (fetchErr) throw fetchErr;

    return NextResponse.json({ row: fullPass });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
