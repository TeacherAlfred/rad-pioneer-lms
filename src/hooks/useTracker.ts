"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // Import your supabase client

export const trackEvent = async (
  event_type: string,
  url_path: string,
  user_identifier?: string | null,
  metadata: Record<string, any> = {}
) => {
  try {
    // 1. Check if the user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    
    // 2. Grab their name or email if they exist (adjust based on your profiles table)
    const loggedInUser = session?.user?.user_metadata?.display_name 
                      || session?.user?.email 
                      || null;

    // 3. Attach it to the payload
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event_type,
        url_path,
        user_identifier,
        metadata: {
          ...metadata,
          logged_in_user: loggedInUser
        }
      })
    });
  } catch (e) {
    console.error("Failed to push telemetry", e);
  }
};

export function usePageTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const userIdentifier = searchParams.get('client') || searchParams.get('ref') || null;

    trackEvent('page_view', pathname, userIdentifier, {
      search_params: searchParams.toString(),
      referrer: document.referrer || null,
      user_agent: navigator.userAgent // We'll parse this in the UI!
    });

  }, [pathname, searchParams]); 
}