import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computePayfastSignature } from '@/lib/payfast';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const [{ data: lead }, { data: lineItems }] = await Promise.all([
    supabase.from('leads').select('id, name, phone, email, customer_type, company_name').eq('id', invoice.lead_id).single(),
    invoice.quote_id
      ? supabase.from('quote_line_items').select('*').eq('quote_id', invoice.quote_id).order('sort_order')
      : Promise.resolve({ data: [] }),
  ]);

  // While PAYFAST_URL points at sandbox, a real parent with a real unpaid
  // invoice must never see a "Pay via PayFast" button - it would only talk
  // to PayFast's test environment. Flipping PAYFAST_URL to the live process
  // URL (once sandbox testing is done) is the same switch that brings this
  // back, so there's nothing separate to remember to re-enable.
  const payfastReady = (process.env.PAYFAST_URL || '').includes('www.payfast.co.za');
  if (!payfastReady) {
    return NextResponse.json({ invoice, lead, lineItems: lineItems || [], payfastReady: false });
  }

  // Signature computed server-side so PAYFAST_PASSPHRASE never reaches the
  // client - the browser just renders these exact fields, in this exact
  // order, as hidden inputs (field order must match what was signed, per
  // PayFast's scheme). A configured passphrase strongly implies the
  // merchant account has Payment Data Validation enabled, which rejects an
  // unsigned request - previously this form sent none at all.
  const outstanding = Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid || 0));
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const payfastFields = {
    merchant_id: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID,
    merchant_key: process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_KEY,
    return_url: `${baseUrl}/payment/success`,
    cancel_url: `${baseUrl}/payment/cancel`,
    notify_url: `${baseUrl}/api/payfast/webhook`,
    name_first: (lead?.name || 'Customer').split(' ')[0],
    email_address: lead?.email || 'info@radacademy.co.za',
    amount: outstanding.toFixed(2),
    item_name: `RAD Academy Invoice INV-${invoice.invoice_number}`,
    custom_str1: invoice.id,
  };
  const payfastSignature = computePayfastSignature(payfastFields, process.env.PAYFAST_PASSPHRASE);

  return NextResponse.json({ invoice, lead, lineItems: lineItems || [], payfastReady: true, payfastFields, payfastSignature, payfastUrl: process.env.PAYFAST_URL });
}
