import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We use the Supabase Service Role Key here because webhooks operate in the background 
// without an active user session, so they need to bypass Row Level Security (RLS).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    // 1. Extract the form data sent by PayFast
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    // 2. Prepare the data to send BACK to PayFast for validation
    // (This prevents hackers from faking a webhook request)
    const pfParamString = new URLSearchParams(data as Record<string, string>).toString();
    
    // NOTE: Change to 'https://www.payfast.co.za/eng/query/validate' when going live
    const validationUrl = 'https://sandbox.payfast.co.za/eng/query/validate';

    const pfValidResponse = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: pfParamString,
    });

    const pfValidResult = await pfValidResponse.text();

    // 3. If PayFast confirms this is a valid transaction and it was completed
    if (pfValidResult === 'VALID' && data.payment_status === 'COMPLETE') {
      
      const guardianId = data.custom_str1 as string;
      const amountPaid = Number(data.amount_gross);

      if (guardianId) {
        // --- YOUR CUSTOM TEST BEHAVIOR ---
        // Instead of marking as 'paid', we mark all pending/overdue invoices for this parent
        // as 'itn_received' so you can visibly see the integration worked in your dashboard.
        
        const { error } = await supabaseAdmin
          .from('billing_records')
          .update({ status: 'itn_received' })
          .eq('guardian_id', guardianId)
          .in('status', ['pending', 'overdue']);

        if (error) {
          console.error("Webhook DB Update Error:", error);
        } else {
          console.log(`✅ ITN Processed successfully for Guardian: ${guardianId}`);
        }
      }
    } else {
      console.warn("⚠️ PayFast ITN Validation Failed or Status not COMPLETE", { pfValidResult, status: data.payment_status });
    }

    // PayFast requires a 200 OK response immediately, or they will keep retrying.
    return new NextResponse('OK', { status: 200 });

  } catch (error: any) {
    console.error('Critical ITN Webhook Error:', error);
    return new NextResponse('Webhook Error', { status: 500 });
  }
}