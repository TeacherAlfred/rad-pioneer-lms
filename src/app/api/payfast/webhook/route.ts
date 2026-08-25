import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computePayfastSignature, payfastValidateUrl } from '@/lib/payfast';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyPayfastSignature(data: Record<string, string>, receivedSignature: string): boolean {
  return computePayfastSignature(data, process.env.PAYFAST_PASSPHRASE) === receivedSignature;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const signatureOk = verifyPayfastSignature(data, data.signature);
    if (!signatureOk) {
      console.error('❌ PayFast ITN signature mismatch - rejecting.');
      return new NextResponse('Invalid signature', { status: 400 });
    }

    const pfParamString = new URLSearchParams(data).toString();
    // Was hardcoded to the live validate endpoint regardless of PAYFAST_URL -
    // every sandbox ITN would fail validation here even with a correct
    // signature, since PayFast's live validator doesn't recognize sandbox
    // transactions.
    const validationUrl = payfastValidateUrl(process.env.PAYFAST_URL);
    const pfValidResponse = await fetch(validationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: pfParamString,
    });
    const pfValidResult = await pfValidResponse.text();

    if (pfValidResult !== 'VALID' || data.payment_status !== 'COMPLETE') {
      console.warn('⚠️ PayFast ITN validation failed or status not COMPLETE');
      return new NextResponse('OK', { status: 200 });
    }

    const correlationId = data.custom_str1;
    const amountPaid = Number(data.amount_gross);
    const pfPaymentId = data.pf_payment_id;

    if (!correlationId || amountPaid <= 0) {
      return new NextResponse('OK', { status: 200 });
    }

    // custom_str1 now carries an invoices.id directly (new pipeline) instead
    // of a guardian id resolved against a guessed outstanding-invoice list -
    // try that first; anything that doesn't resolve is an old in-flight
    // billing_records document, handled exactly as before (frozen system,
    // still needs to keep working for documents already out in the wild).
    const { data: newInvoice } = await supabaseAdmin
      .from('invoices')
      .select('id, amount, amount_paid')
      .eq('id', correlationId)
      .maybeSingle();

    if (newInvoice) {
      // Idempotency: invoice_payments.payfast_payment_id is the guard here -
      // a replayed ITN for a payment already recorded is a no-op, not a
      // double-credit. (No equivalent guard existed before this rewrite.)
      const { data: existingPayment } = await supabaseAdmin
        .from('invoice_payments')
        .select('id')
        .eq('payfast_payment_id', pfPaymentId)
        .maybeSingle();

      if (existingPayment) {
        console.log(`ℹ️ PayFast ITN ${pfPaymentId} already processed - skipping.`);
        return new NextResponse('OK', { status: 200 });
      }

      const { error: payError } = await supabaseAdmin.from('invoice_payments').insert([{
        invoice_id: newInvoice.id,
        amount: amountPaid,
        method: 'payfast',
        payfast_payment_id: pfPaymentId,
        payfast_raw_payload: data,
        received_at: new Date().toISOString(),
        created_by: 'payfast_webhook',
      }]);
      if (payError) throw payError;

      const newPaidTotal = Number(newInvoice.amount_paid || 0) + amountPaid;
      const isFullyPaid = newPaidTotal >= Number(newInvoice.amount);
      await supabaseAdmin
        .from('invoices')
        .update({ amount_paid: newPaidTotal, status: isFullyPaid ? 'paid' : 'partially_paid', paid_at: isFullyPaid ? new Date().toISOString() : null })
        .eq('id', newInvoice.id);

      console.log(`✅ PayFast ITN processed for invoice ${newInvoice.id}`);
      return new NextResponse('OK', { status: 200 });
    }

    // --- OLD PATH (unchanged): billing_records via guardian_id waterfall ---
    const guardianId = correlationId;
    let remaining = amountPaid;

    const { data: openInvoices, error: fetchErr } = await supabaseAdmin
      .from('billing_records')
      .select('*')
      .eq('guardian_id', guardianId)
      .eq('doc_type', 'invoice')
      .in('status', ['pending', 'overdue', 'partially_paid', 'itn_received'])
      .order('created_at', { ascending: true });

    if (fetchErr) throw fetchErr;

    if (openInvoices && openInvoices.length > 0) {
      for (const inv of openInvoices) {
        if (remaining <= 0) break;
        const invTotal = Number(inv.total_amount) || 0;
        const alreadyPaid = Number(inv.amount_paid) || 0;
        const outstanding = invTotal - alreadyPaid;
        if (outstanding > 0) {
          const allocation = Math.min(outstanding, remaining);
          const newPaidTotal = alreadyPaid + allocation;
          await supabaseAdmin
            .from('billing_records')
            .update({ amount_paid: newPaidTotal, status: 'itn_received', paid_at: new Date().toISOString() })
            .eq('id', inv.id);
          remaining -= allocation;
        }
      }
      console.log(`✅ ITN Waterfall Processed for Guardian: ${guardianId}`);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('Critical ITN Webhook Error:', error);
    return new NextResponse('Webhook Error', { status: 500 });
  }
}
