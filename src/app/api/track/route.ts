import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_type, url_path, user_identifier, metadata } = body;

    if (!event_type || !url_path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Capture the IP Address from Vercel/Next.js headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : realIp || 'Unknown IP';

    // 1b. Location - Vercel populates these geo headers for free on every
    // request in production (no third-party geo-IP lookup needed). Absent
    // locally/off-Vercel, so every field is optional.
    const geo = {
      country: request.headers.get('x-vercel-ip-country') || null,
      region: request.headers.get('x-vercel-ip-country-region') || null,
      city: request.headers.get('x-vercel-ip-city') ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!) : null,
    };

    // 2. Merge it into our metadata payload
    const enrichedMetadata = {
      ...metadata,
      ip_address: ipAddress,
      geo,
    };

    const { error } = await supabase
      .from('analytics_events')
      .insert([{
        event_type,
        url_path,
        user_identifier: user_identifier || null,
        metadata: enrichedMetadata // Save the new enriched data
      }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Analytics Ingestion Error:', error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}