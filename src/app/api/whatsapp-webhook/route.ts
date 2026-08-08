import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper function to send WhatsApp messages and keep our code clean
async function sendWhatsAppMessage(to: string, messagePayload: any) {
  const phoneId = process.env.PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_TOKEN!;
  
  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      ...messagePayload
    })
  });
}

// Meta verifies the webhook via a GET request
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Meta sends incoming messages via a POST request
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          if (value.statuses) continue; 

          if (value.messages) {
            for (const message of value.messages) {
              const senderPhone = message.from || message.from_user_id;
              if (!senderPhone) continue;

              // Extract text based on payload type
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
              } else {
                messageText = `[${message.type} message]`;
              }

              // Initialize Supabase
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );

              // 1. TWO-TABLE ARCHITECTURE: Get or Create Lead
              let { data: lead } = await supabase
                .from('leads')
                .select('*')
                .eq('phone', senderPhone)
                .single();

              if (!lead) {
                const { data: newLead } = await supabase
                  .from('leads')
                  .insert([{ phone: senderPhone, status: 'new_lead' }])
                  .select()
                  .single();
                lead = newLead;
              }

              if (!lead) continue; // Failsafe execution

              // 2. Log the Inbound Message
              await supabase.from('messages').insert([{
                lead_id: lead.id,
                direction: 'inbound',
                body: messageText
              }]);

              // 3. Trigger Auto-Responder with R2 PDF + Interactive Buttons
              if (message.type === 'text' && messageText.toLowerCase().includes('guide')) {
                const pdfPayload = {
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
                    footer: { text: "RAD Academy" },
                    action: {
                      buttons: [
                        { type: 'reply', reply: { id: 'btn_workshops', title: 'View Workshops' } },
                        { type: 'reply', reply: { id: 'btn_human', title: 'Talk to a Human' } }
                      ]
                    }
                  }
                };

                await sendWhatsAppMessage(senderPhone, pdfPayload);

                // Log outbound automated PDF response
                await supabase.from('messages').insert([{
                  lead_id: lead.id,
                  direction: 'outbound',
                  body: "[Automated PDF & Menu Sent]"
                }]);
              }

              // 4. Handle Interactive Button Tap Events
              if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                const buttonId = message.interactive.button_reply?.id;

                // NEW: Catch the Admin clicking "Mark as Contacted"
                if (buttonId.startsWith('contacted_')) {
                  const targetLeadId = buttonId.replace('contacted_', '');

                  // Update Supabase with the timestamp
                  await supabase
                    .from('leads')
                    .update({ 
                      status: 'contacted', 
                      contacted_at: new Date().toISOString() 
                    })
                    .eq('id', targetLeadId);

                  // Send a confirmation receipt back to the Admin phone
                  await sendWhatsAppMessage(senderPhone, { 
                    type: 'text', 
                    text: { body: "✅ Lead successfully marked as contacted and timestamped in the database." } 
                  });

                } else if (buttonId === 'btn_human') {
                  // A. Update Lead Status
                  await supabase
                    .from('leads')
                    .update({ status: 'needs_human' })
                    .eq('id', lead.id);

                  // B. Send Confirmation to User
                  const confirmationText = "Got it! 👤 One of our staff members will be in touch with you shortly.";
                  await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: confirmationText } });

                  await supabase.from('messages').insert([{
                    lead_id: lead.id, direction: 'outbound', body: confirmationText
                  }]);

                  // C. ADMIN ALERT: Send WhatsApp Template to Staff
                  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
                  if (adminPhone) {
                    const prefilledMessage = encodeURIComponent("Hi! I'm reaching out from RAD Academy. You requested to speak with an instructor—how can I help you today?");
                    const dynamicUrlParam = `${senderPhone}?text=${prefilledMessage}`;

                    await sendWhatsAppMessage(adminPhone, {
                      type: 'template',
                      template: {
                        name: 'admin_lead_alert',
                        language: {
                          code: 'en' 
                        },
                        components: [
                          {
                            type: 'body',
                            parameters: [
                              {
                                type: 'text',
                                text: dynamicUrlParam 
                              }
                            ]
                          },
                          {
                            type: 'button',
                            sub_type: 'quick_reply',
                            index: 0,
                            parameters: [
                              {
                                type: 'payload',
                                payload: `contacted_${lead.id}` // Injects the Supabase ID silently into the button
                              }
                            ]
                          }
                        ]
                      }
                    });
                  }
                  
                } else if (buttonId === 'btn_workshops') {
                  // Send workshop overview
                  const workshopText = "🎯 *Upcoming Minecraft Education Workshop*\n\n📍 *Location:* Menlyn\n📅 *Dates:* Aug 15–16\n\nWould you like details on how to register your child?";
                  await sendWhatsAppMessage(senderPhone, { type: 'text', text: { body: workshopText } });

                  await supabase.from('messages').insert([{
                    lead_id: lead.id, direction: 'outbound', body: workshopText
                  }]);
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
    return new NextResponse('EVENT_RECEIVED', { status: 200 }); 
  }
}