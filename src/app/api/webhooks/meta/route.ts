import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Meta sends an ID for the lead. You then have to fetch the 
    // actual data using the Meta Graph API (requires an Access Token).
    const leadId = body.entry[0].changes[0].value.leadgen_id;
    
    // NOTE: This is a simplified logic. You'll fetch the full lead 
    // details from Meta here using your PAGE_ACCESS_TOKEN.
    const metaLead = await fetch(`https://graph.facebook.com/v19.0/${leadId}?access_token=${process.env.META_ACCESS_TOKEN}`).then(res => res.json());

    // 2. Map Meta fields to your Supabase Prospect schema
    const newProspect = {
      name: metaLead.field_data.find((f: any) => f.name === 'full_name')?.values[0] || "New Meta Lead",
      email: metaLead.field_data.find((f: any) => f.name === 'email')?.values[0] || "",
      phone: metaLead.field_data.find((f: any) => f.name === 'phone_number')?.values[0] || "",
      source: "Meta Ad - Polokwane Bootcamp",
      status: "New Lead",
      raw_form_data: JSON.stringify(metaLead), // Store the raw data for debugging
      contact_log: [{
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        type: "System",
        text: "Lead automatically captured from Meta Ads."
      }]
    };

    // 3. Insert into Supabase
    const { error } = await supabase.from('prospects').insert([newProspect]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

// Meta requires a GET request to verify the Webhook initially
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}