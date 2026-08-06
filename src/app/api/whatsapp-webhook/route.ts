import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

const VERIFY_TOKEN = 'rad_academy_secure_token_123'; // Make this up, just needs to match Meta
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Meta verifies the webhook via a GET request
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Meta sends incoming messages via a POST request
export async function POST(request: Request) {
  const body = await request.json();

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;

    if (changes?.messages) {
      const message = changes.messages[0];
      const senderPhone = message.from;
      const messageText = message.text?.body;

      // 1. Log the lead to Supabase
      await supabase.from('leads').insert([{ phone: senderPhone, message: messageText }]);

      // 2. Trigger Auto-Responder if they ask for the guide
      if (messageText && messageText.toLowerCase().includes('guide')) {
        await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: senderPhone,
            type: 'text', // Later, change this to 'document' and pass your PDF media_id
            text: { body: "Here is your Parent's Guide! 🚀 By the way, we are running our Minecraft Workshop in Menlyn on Aug 15-16. Want the details?" }
          })
        });
      }
    }
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  }
  return new NextResponse('Not Found', { status: 404 });
}