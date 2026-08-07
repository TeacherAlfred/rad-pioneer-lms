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
  console.log("INCOMING META PAYLOAD:", await request.clone().text());
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
              } else if (message.type === 'interactive') {
                const buttonReply = message.interactive?.button_reply;
                const listReply = message.interactive?.list_reply;
                if (buttonReply) {
                  messageText = `[Button Reply: ${buttonReply.title} (${buttonReply.id})]`;
                } else if (listReply) {
                  messageText = `[List Reply: ${listReply.title} (${listReply.id})]`;
                } else {
                  messageText = '[Interactive Message]';
                }
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

              // Log the lead entry to Supabase
              await supabase.from('leads').insert([{ phone: senderPhone, message: messageText }]);

              // 5. Trigger Auto-Responder with R2 PDF + Interactive Buttons
              if (message.type === 'text' && messageText.toLowerCase().includes('guide')) {
                await fetch(`https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: senderPhone,
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      header: {
                        type: 'document',
                        document: {
                          link: 'https://pub-5baa3fb9dc2549008c18dac88b524ed9.r2.dev/marketing_material/pdfs/RAD_Hacking_Screen_Time.pdf',
                          filename: 'RAD_Hacking_Screen_Time.pdf'
                        }
                      },
                      body: {
                        text: "Here is your *Hacking Screen Time* guide! 🚀\n\nTake a read and let us know if you'd like to explore how our curriculum helps turn screen time into skill-building, or if you'd prefer to chat with one of our instructors."
                      },
                      footer: {
                        text: "RAD Academy"
                      },
                      action: {
                        buttons: [
                          {
                            type: 'reply',
                            reply: {
                              id: 'btn_workshops',
                              title: 'View Workshops'
                            }
                          },
                          {
                            type: 'reply',
                            reply: {
                              id: 'btn_human',
                              title: 'Talk to a Human'
                            }
                          }
                        ]
                      }
                    }
                  })
                });
              }

              // 6. Handle Interactive Button Tap Events
              if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                const buttonId = message.interactive.button_reply?.id;

                if (buttonId === 'btn_human') {
                  // Mark lead for human handoff in Supabase
                  await supabase
                    .from('leads')
                    .update({ status: 'needs_human' })
                    .eq('phone', senderPhone);

                  // Send confirmation message to the user
                  await fetch(`https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      messaging_product: 'whatsapp',
                      recipient_type: 'individual',
                      to: senderPhone,
                      type: 'text',
                      text: {
                        body: "Got it! 👤 One of our staff members will be in touch with you shortly."
                      }
                    })
                  });
                } else if (buttonId === 'btn_workshops') {
                  // Send workshop overview to the user
                  await fetch(`https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      messaging_product: 'whatsapp',
                      recipient_type: 'individual',
                      to: senderPhone,
                      type: 'text',
                      text: {
                        body: "🎯 *Upcoming Minecraft Education Workshop*\n\n📍 *Location:* Menlyn\n📅 *Dates:* Aug 15–16\n\nWould you like details on how to register your child?"
                      }
                    })
                  });
                }
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