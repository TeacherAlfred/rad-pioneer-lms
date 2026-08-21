import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { recordStageChange } from '@/lib/leadStageHistory';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const planChoice: 'full_term' | 'monthly' = body.planChoice === 'monthly' ? 'monthly' : 'full_term';

  const supabase = supabaseAdmin();
  try {
    const { data: quote, error: quoteFetchError } = await supabase.from('quotes').select('*').eq('id', id).single();
    if (quoteFetchError || !quote) throw new Error('Quote not found');
    if (quote.status !== 'sent') throw new Error('Quote is not open for acceptance');

    const canOfferMonthly = quote.installment_count > 1 && quote.monthly_installment_amount;
    const acceptedPlan = canOfferMonthly && planChoice === 'monthly' ? 'monthly' : 'full_term';
    const now = new Date();

    const { data: lastInvoice } = await supabase.from('invoices').select('invoice_number').order('invoice_number', { ascending: false }).limit(1);
    let nextInvoiceNumber = (lastInvoice?.[0]?.invoice_number || 0) + 1;

    const invoicesToCreate: any[] = [];
    if (acceptedPlan === 'monthly') {
      for (let i = 0; i < quote.installment_count; i++) {
        invoicesToCreate.push({
          invoice_number: nextInvoiceNumber++,
          quote_id: quote.id,
          lead_id: quote.lead_id,
          sequence_number: i + 1,
          amount: quote.monthly_installment_amount,
          amount_paid: 0,
          status: 'pending',
          due_at: addMonths(now, i).toISOString(),
          hold_expires_at: i === 0 ? new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString() : null,
          created_by: 'quote_v2_accept',
        });
      }
    } else {
      invoicesToCreate.push({
        invoice_number: nextInvoiceNumber,
        quote_id: quote.id,
        lead_id: quote.lead_id,
        sequence_number: 1,
        amount: quote.total_amount,
        amount_paid: 0,
        status: 'pending',
        due_at: now.toISOString(),
        hold_expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        created_by: 'quote_v2_accept',
      });
    }

    const { data: newInvoices, error: invError } = await supabase.from('invoices').insert(invoicesToCreate).select();
    if (invError) throw invError;

    await supabase
      .from('quotes')
      .update({ status: 'accepted', accepted_at: now.toISOString(), accepted_by: 'customer', accepted_plan_type: acceptedPlan })
      .eq('id', quote.id);

    const { data: lead } = await supabase.from('leads').select('*').eq('id', quote.lead_id).single();
    if (lead) {
      const wasCustomer = lead.is_customer;
      await supabase
        .from('leads')
        .update({
          is_customer: true,
          first_purchase_at: lead.first_purchase_at || now.toISOString(),
          last_purchase_at: now.toISOString(),
          lifecycle_stage: 'customer',
        })
        .eq('id', lead.id);
      if (!wasCustomer) {
        await recordStageChange(supabase, lead.id, { fromStage: lead.lifecycle_stage, toStage: 'customer', reason: 'Quote accepted' });
      }
    }

    return NextResponse.json({ ok: true, acceptedPlan, invoices: newInvoices });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
