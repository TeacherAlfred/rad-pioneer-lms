"use client";

import { usePageTracking } from '@/hooks/useTracker';

export default function AnalyticsTracker() {
  // Turn on global pageview tracking
  usePageTracking();
  
  // Render nothing, just run the hook behind the scenes
  return null; 
}