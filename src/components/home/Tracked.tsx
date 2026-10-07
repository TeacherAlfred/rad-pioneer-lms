"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";

// Links that record a PostHog event when tapped. The homepage's whole job
// is getting a parent into a WhatsApp chat, so every WhatsApp link says
// where on the page it was tapped (home_whatsapp_click, source: ...), and
// the "classic homepage" links say which entry point was used
// (home_classic_click). Usable from Server Components: only the event name
// and plain props cross the boundary.
type EventProps = Record<string, string | null>;

type AnchorProps = ComponentProps<"a"> & { event: string; eventProps: EventProps };

export function TrackedAnchor({ event, eventProps, onClick, ...rest }: AnchorProps) {
  const posthog = usePostHog();
  return (
    <a
      {...rest}
      onClick={(e) => {
        posthog?.capture(event, eventProps);
        onClick?.(e);
      }}
    />
  );
}

type LinkProps = ComponentProps<typeof Link> & { event: string; eventProps: EventProps };

export function TrackedLink({ event, eventProps, onClick, ...rest }: LinkProps) {
  const posthog = usePostHog();
  return (
    <Link
      {...rest}
      onClick={(e) => {
        posthog?.capture(event, eventProps);
        onClick?.(e);
      }}
    />
  );
}
