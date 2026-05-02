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

    // 2. Merge it into our metadata payload
    const enrichedMetadata = {
      ...metadata,
      ip_address: ipAddress
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