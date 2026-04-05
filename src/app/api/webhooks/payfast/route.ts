import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const data: any = Object.fromEntries(formData.entries());

    // 1. Validate the Signature (Security Protocol)
    // You should implement the PayFast signature verification here using your Passphrase
    
    // 2. Check Payment Status
    if (data.payment_status === 'COMPLETE') {
      const payRef = data.m_payment_id; // e.g., 20261100
      const amountPaid = data.amount_gross;

      // 3. Update the Payment record in Supabase
      const { error } = await supabaseAdmin
        .from('payments')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString(),
          pf_payment_id: data.pf_payment_id 
        })
        .eq('payment_reference', payRef);

      if (error) throw error;

      console.log(`✅ Payment Verified: ${payRef} | R${amountPaid}`);
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error("🚨 PayFast Webhook Error:", error.message);
    return new Response('Internal Error', { status: 500 });
  }
}