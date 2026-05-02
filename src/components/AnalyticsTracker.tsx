"use client";

import { Suspense } from 'react';
import { usePageTracking } from '@/hooks/useTracker';

// 1. Isolate the hook inside a sub-component
function TrackerLogic() {
  usePageTracking();
  return null; 
}

// 2. Wrap the sub-component in a Suspense boundary
export default function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerLogic />
    </Suspense>
  );
}