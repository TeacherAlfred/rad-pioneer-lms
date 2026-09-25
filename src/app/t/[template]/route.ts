import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public click-tracking redirect for a WhatsApp template's URL button:
//   https://www.radacademy.co.za/t/<template_name>?to=/labs/makecode-01
// Meta sends no webhook when a URL button is tapped, so the button points
// here instead - this logs one click against the template, then forwards to
// `to`. Counted per template only (see 20260925210000_template_link_clicks.sql).

const TEMPLATE_NAME = /^[a-z0-9_]{1,80}$/i;
// Link-preview fetchers and scanners hit URLs too - flagged so they don't
// inflate the click count. WhatsApp's own preview crawler identifies as
// "WhatsApp/x.y".
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp\/|slackbot|curl|wget|python|headless/i;

// Only a same-site path is ever redirected to - never a caller-supplied
// absolute URL, or this becomes an open redirect anyone could point at a
// phishing page under our domain.
function safePath(to: string | null): string {
  if (!to || !to.startsWith('/') || to.startsWith('//') || to.startsWith('/\\') || /[\r\n]/.test(to)) return '/';
  return to;
}

export async function GET(req: Request, { params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  const url = new URL(req.url);
  const to = safePath(url.searchParams.get('to'));
  const userAgent = req.headers.get('user-agent') || '';

  if (TEMPLATE_NAME.test(template)) {
    try {
      await supabaseAdmin.from('template_link_clicks').insert([{
        template_name: template,
        destination: to,
        user_agent: userAgent.slice(0, 300),
        is_bot: BOT_UA.test(userAgent),
      }]);
    } catch {
      // Never let a logging failure stop the visitor reaching the page.
    }
  }

  return NextResponse.redirect(new URL(to, url.origin), 302);
}
