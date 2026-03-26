'use client'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect, Suspense } from 'react'
import { PostHogPageView } from './PostHogPageView'

export function PHProvider({ children }: { children: React.ReactNode }) {
useEffect(() => {
    // DEBUG LOGS - check your browser console on the live site!
    console.log("PH Key:", process.env.NEXT_PUBLIC_POSTHOG_KEY ? "Found" : "NOT FOUND");
    console.log("PH Host:", process.env.NEXT_PUBLIC_POSTHOG_HOST);

    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
      })
    }
  }, [])

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  )
}