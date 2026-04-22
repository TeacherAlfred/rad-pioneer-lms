import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    const pfParamString = new URLSearchParams(data as Record<string, string>).toString();
    const validationUrl = 'https://sandbox.payfast.co.za/eng/query/validate';

    const pfValidResponse = await fetch(validationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: pfParamString,
    });

    const pfValidResult = await pfValidResponse.text();

    if (pfValidResult === 'VALID' && data.payment_status === 'COMPLETE') {
      
      const guardianId = data.custom_str1 as string;
      let amountPaid = Number(data.amount_gross); // The total lump sum paid by parent

      if (guardianId && amountPaid > 0) {
        
        // 1. Fetch all unpaid invoices for this parent, oldest first
        const { data: openInvoices, error: fetchErr } = await supabaseAdmin
          .from('billing_records')
          .select('*')
          .eq('guardian_id', guardianId)
          .eq('doc_type', 'invoice')
          .in('status', ['pending', 'overdue', 'partially_paid', 'itn_received'])
          .order('created_at', { ascending: true });

        if (fetchErr) throw fetchErr;

        // 2. Waterfall Allocation Logic
        if (openInvoices && openInvoices.length > 0) {
          for (const inv of openInvoices) {
            if (amountPaid <= 0) break; // Payment is fully allocated

            const invTotal = Number(inv.total_amount) || 0;
            const alreadyPaid = Number(inv.amount_paid) || 0;
            const outstanding = invTotal - alreadyPaid;

            if (outstanding > 0) {
              // Determine how much of the payment goes to THIS specific invoice
              const allocation = Math.min(outstanding, amountPaid);
              const newPaidTotal = alreadyPaid + allocation;
              
              await supabaseAdmin
                .from('billing_records')
                .update({ 
                  amount_paid: newPaidTotal,
                  status: 'itn_received' // Flags it for Admin Review
                })
                .eq('id', inv.id);

              // Deduct allocated amount from the running total
              amountPaid -= allocation;
            }
          }
          console.log(`✅ ITN Waterfall Processed for Guardian: ${guardianId}`);
        }
      }
    } else {
      console.warn("⚠️ PayFast ITN Validation Failed or Status not COMPLETE");
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error: any) {
    console.error('Critical ITN Webhook Error:', error);
    return new NextResponse('Webhook Error', { status: 500 });
  }
}