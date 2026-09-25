'use client';

import { useEffect } from 'react';

// Dev-only: flips the page root's data-zones attribute when the URL has
// ?zones=1, revealing <ZoneLabel/>s. Read on the client so the page itself
// stays statically generated.
export function DevZones({ rootId }: { rootId: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (new URLSearchParams(window.location.search).get('zones') === '1') {
      document.getElementById(rootId)?.setAttribute('data-zones', 'on');
    }
  }, [rootId]);
  return null;
}
