import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lastDayOfMonthISO, addOneMonthISO } from '@/lib/billingDates';

const resend = new Resend(process.env.RESEND_API_KEY);

// Turns a recurring_billing_plans row into this cycle's real v2 `invoices`
// row against its source quote - the same table/shape every other v2
// invoice lives in, so it shows up in the quote's own invoice history and
// renders at /invoice-v2/[id] exactly like one created via quote acceptance.
// Deliberately semi-automatic: an admin clicks this each cycle (send=true
// also emails it) - nothing about a real client's invoice goes out without
// a human click.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const send: boolean = !!body.send;

  const supabase = supabaseAdmin();

  const { data: plan, error: planError } = await supabase
    .from('recurring_billing_plans')
    .select('*')
    .eq('id', id)
    .single();
  if (planError || !plan) return NextResponse.json({ error: 'Recurring plan not found' }, { status: 404 });
  if (plan.status !== 'active') {
    return NextResponse.json({ error: `Plan is ${plan.status}, not active - resume it first.` }, { status: 400 });
  }
  if (!plan.source_quote_id) {
    return NextResponse.json({ error: 'This plan has no source quote to invoice against.' }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', plan.lead_id).single();
  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (send && !lead.email) {
    return NextResponse.json({ error: 'Lead has no email on file - generate without sending, or add an email first.' }, { status: 400 });
  }

  try {
    const { data: lastInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('invoice_number', { ascending: false })
      .limit(1);
    const invoiceNumber = (lastInvoice?.[0]?.invoice_number || 0) + 1;
    const dueDate = lastDayOfMonthISO();

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        quote_id: plan.source_quote_id,
        lead_id: plan.lead_id,
        sequence_number: 1,
        amount: plan.total_amount,
        amount_paid: 0,
        status: 'pending',
        due_at: new Date(dueDate).toISOString(),
        payment_reference: `${new Date().getFullYear()}${invoiceNumber}`,
        created_by: 'recurring_plan',
      })
      .select('*')
      .single();
    if (invError) throw invError;

    const { error: updateError } = await supabase
      .from('recurring_billing_plans')
      .update({
        last_generated_invoice_id: invoice.id,
        next_due_date: addOneMonthISO(plan.next_due_date),
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id);
    if (updateError) throw updateError;

    let emailed = false;
    if (send) {
      const baseUrl = new URL(request.url).origin;
      const invoiceUrl = `${baseUrl}/invoice-v2/${invoice.id}`;
      const amountStr = Number(plan.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 });

      const { error: sendError } = await resend.emails.send({
        from: 'RAD Academy <onboarding@updates.radacademy.co.za>',
        to: [lead.email],
        subject: `Invoice INV-${invoiceNumber} — RAD Academy`,
        html: `
          <div style="font-family: sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto;">
            <h2>Your invoice is ready</h2>
            <p>Hi ${(lead.name || 'there').split(' ')[0]},</p>
            <p>Your recurring invoice for <strong>${lead.company_name || 'your account'}</strong> has been generated.</p>
            <p style="font-size: 20px; font-weight: bold;">R ${amountStr}</p>
            <a href="${invoiceUrl}" style="display: inline-block; padding: 12px 24px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">View Invoice</a>
            <p style="margin-top: 24px; font-size: 12px; color: #64748b;">Reference: INV-${invoiceNumber}</p>
          </div>
        `,
      });
      if (sendError) {
        return NextResponse.json({
          invoice,
          emailed: false,
          warning: `Invoice recorded, but email transmission failed: ${sendError.message}`,
        });
      }
      emailed = true;
    }

    return NextResponse.json({ invoice, emailed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
