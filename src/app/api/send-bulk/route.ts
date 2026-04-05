import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Define the shape of our recipient data to satisfy TypeScript
interface Recipient {
  email: string;
  id?: string;       // Optional for Onboarding
  invNum?: string;   // Optional for Billing
  total?: string;    // Optional for Billing
}

export async function POST(request: Request) {
  try {
    const { recipients, subject, htmlTemplate, baseUrl } = await request.json();

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }

    const payfastUrl = process.env.PAYFAST_URL;
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;

    // Explicitly type 'person' as Recipient
    const payload = recipients.map((person: Recipient) => {
      let individualizedHtml = htmlTemplate;

      // 1. Handle Onboarding Placeholders
      if (person.id) {
        const uniqueOnboardingLink = `${baseUrl}/onboarding/guardian?id=${person.id}`;
        individualizedHtml = individualizedHtml.replace(/{{onboardingLink}}/g, uniqueOnboardingLink);
      }

      // 2. Handle Billing & PayFast Placeholders
      if (person.invNum) {
        const invNo = `INV-${person.invNum}`;
        const payRef = `${new Date().getFullYear()}${person.invNum}`;
        
        const payfastLink = `${payfastUrl}?merchant_id=${merchantId}&merchant_key=${merchantKey}` +
          `&amount=${person.total}` +
          `&item_name=${invNo}` +
          `&m_payment_id=${payRef}` +
          `&email_address=${person.email}`;

        individualizedHtml = individualizedHtml
          .replace(/{{invoiceNumber}}/g, invNo)
          .replace(/{{paymentReference}}/g, payRef)
          .replace(/{{grandTotal}}/g, person.total || '0.00')
          .replace(/{{payfastLink}}/g, payfastLink);
      }

      return {
        from: 'RAD Academy <onboarding@updates.radacademy.co.za>',
        to: [person.email],
        subject: subject.replace(/{{invoiceNumber}}/g, `INV-${person.invNum || ''}`),
        html: individualizedHtml,
      };
    });

    const response = await resend.batch.send(payload);

    if (response.error) {
      console.error("🚨 RESEND REJECTED BATCH:", response.error);
      return NextResponse.json({ error: response.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("🚨 INTERNAL SERVER ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}