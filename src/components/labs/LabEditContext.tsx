'use client';

import { createContext, useContext } from 'react';

// Present only inside the admin editor (/admin/labs/[slug]). Public pages
// have no provider, so every edit affordance below renders nothing and the
// forms submit for real.

export type EditTarget =
  | { section: 'identity' | 'hook' | 'context' | 'walkthrough' | 'aha' | 'reveal' | 'fork' | 'faqs' }
  | { section: 'step'; index: number }
  | { section: 'ahaCard'; index: number };

type Ctx = { open: (target: EditTarget) => void };

export const LabEditContext = createContext<Ctx | null>(null);

export function useLabEdit() {
  return useContext(LabEditContext);
}
