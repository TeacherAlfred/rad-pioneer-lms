import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { acceptQuote } from '@/lib/quoteAccept';

// Admin-triggered equivalent of the lead clicking Accept on /quote-v2/[id] -
// for a client who agreed by phone/WhatsApp instead of online. Same
// invoice-creation and lead-lifecycle logic (acceptQuote), just recorded as
// accepted_by: 'admin' instead of 'customer'.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const planChoice: 'full_term' | 'monthly' = body.planChoice === 'monthly' ? 'monthly' : 'full_term';

  const supabase = supabaseAdmin();
  try {
    const { acceptedPlan, invoices } = await acceptQuote(supabase, id, { planChoice, acceptedBy: 'admin' });
    return NextResponse.json({ ok: true, acceptedPlan, invoices });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
