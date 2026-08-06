import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Meta verifies the webhook via a GET request
export async function GET(request: NextRequest) {
  // Log the exact URL that Next.js sees
  console.log("Full Request URL:", request.url);
  
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  console.log("Parsed Token:", token);
  console.log("Environment Token:", process.env.WHATSAPP_VERIFY_TOKEN);

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Meta sends incoming messages via a POST request
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.object === 'whatsapp_business_account') {
      
      // 1. Iterate safely through potentially batched arrays
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          // 2. Skip delivery status updates so they don't break the message parser
          if (value.statuses) {
            continue; 
          }

          if (value.messages) {
            for (const message of value.messages) {
              
              // 3. Fallback identifier for privacy scenarios (phone unavailable)
              const senderPhone = message.from || message.from_user_id;
              if (!senderPhone) continue;

              // 4. Safely extract text based on the message type
              let messageText = '';
              if (message.type === 'text') {
                messageText = message.text?.body || '';
              } else if (message.type === 'contacts') {
                messageText = '[Contact Card Shared]';
              } else {
                messageText = `[${message.type} message]`;
              }

              // Initialize Supabase INSIDE the handler to prevent Vercel build crashes
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );

              // Log the lead to Supabase
              await supabase.from('leads').insert([{ phone: senderPhone, message: messageText }]);

              // Trigger Auto-Responder if they ask for the guide
              if (message.type === 'text' && messageText.toLowerCase().includes('guide')) {
                await fetch(`https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: senderPhone,
                    type: 'text', 
                    text: { body: "Here is your Parent's Guide! 🚀 By the way, we are running our Minecraft Workshop in Menlyn on Aug 15-16. Want the details?" }
                  })
                });
              }
            }
          }
        }
      }
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }
    return new NextResponse('Not Found', { status: 404 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Always return 200 on error to stop Meta from retrying and spamming the endpoint
    return new NextResponse('EVENT_RECEIVED', { status: 200 }); 
  }
}