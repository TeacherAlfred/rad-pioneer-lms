import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const serverToken = process.env.FB_VERIFY_TOKEN;

  // Log to Vercel console so you can see it in your dashboard
  console.log("--- Webhook Debug ---");
  console.log("Token from URL:", token);
  console.log("Token on Server:", serverToken);

  if (mode === 'subscribe' && token === serverToken) {
    return new Response(challenge, { status: 200 });
  }

  // If it fails, return a message telling us why
  return new Response(
    `Verification failed. URL token: ${token}, Server token: ${serverToken ? 'EXISTS' : 'MISSING'}`, 
    { status: 403 }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadId = body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;

    if (!leadId) return NextResponse.json({ ok: true });

    // 1. Fetch the lead data from Meta Graph API
    const fbResponse = await fetch(
      `https://graph.facebook.com/v19.0/${leadId}?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`
    );
    const leadData = await fbResponse.json();

    // Helper: Find field values by name
    const getField = (name: string) => 
      leadData.field_data?.find((f: any) => f.name === name)?.values?.[0] || 'N/A';

    const parentName = getField('full_name');
    const phone = getField('phone_number');
    const email = getField('email');
    const studentAge = getField('student_age'); // Matches the custom question in your form

    // 2. Send to Slack with Block Kit for a "Professional" look
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "🚨 *New Polokwane Bootcamp Lead!*" }
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Parent:*\n${parentName}` },
              { type: "mrkdwn", text: `*Student Age:*\n${studentAge}` },
              { type: "mrkdwn", text: `*Phone:*\n${phone}` },
              { type: "mrkdwn", text: `*Email:*\n${email}` }
            ]
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "WhatsApp Parent 📱" },
                url: `https://wa.me/${phone.replace(/\D/g, '')}`,
                style: "primary"
              }
            ]
          }
        ]
      })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Lead Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}