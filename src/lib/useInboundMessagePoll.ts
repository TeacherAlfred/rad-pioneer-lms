"use client";

import { useEffect, useRef } from "react";

export type InboundMessagePollRow = {
  id: string;
  lead_id: string;
  lead_name: string | null;
  lead_phone: string | null;
  body: string | null;
  media_type: string | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 5000;

// Shared by InboundMessageAlert (the admin-wide popup) and Message
// Activity's own live-refresh - each keeps its own cursor/interval, so one
// mounting or unmounting never affects the other. Starts the cursor at
// "now" rather than the epoch - a fresh mount should only ever surface
// messages that arrive from this point on, not replay the whole backlog.
export function useInboundMessagePoll(onNewMessages: (rows: InboundMessagePollRow[]) => void) {
  const sinceRef = useRef<string>(new Date().toISOString());
  const callbackRef = useRef(onNewMessages);

  useEffect(() => {
    callbackRef.current = onNewMessages;
  }, [onNewMessages]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/admin/api/lead-funnel/messages/inbound-poll?since=${encodeURIComponent(sinceRef.current)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.serverTime) sinceRef.current = data.serverTime;
        if (data.rows?.length > 0) callbackRef.current(data.rows);
      } catch {
        // Transient network hiccup - next interval tick just tries again.
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
}
