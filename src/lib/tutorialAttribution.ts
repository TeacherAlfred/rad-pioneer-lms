// Channel attribution for the Tutorial Hub (radacademy.co.za/tutorials,
// RAD_Tutorial_Hub_Page_Spec.md S8). Same capture fields as
// RegisterInterestModal.tsx (utm_source/utm_campaign/referrer), but a
// tutorial-hub visit spans many page loads (Hub -> series -> tutorial ->
// steps) rather than one modal's lifetime, so this persists to
// sessionStorage instead of component state, and only ever captures the
// first touch of a session - a later internal navigation with no utm
// params in the URL must never overwrite where this visitor actually
// arrived from.

export type TutorialAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
};

const STORAGE_KEY = 'rad_tutorial_attribution';

export function captureAttributionOnArrival(): TutorialAttribution {
  if (typeof window === 'undefined') return {};

  const existing = getStoredAttribution();
  if (Object.keys(existing).length > 0) return existing;

  const params = new URLSearchParams(window.location.search);
  const captured: TutorialAttribution = {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    referrer: document.referrer || undefined,
  };

  const hasAnyValue = Object.values(captured).some(Boolean);
  if (!hasAnyValue) return {};

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  } catch {
    // sessionStorage unavailable (private mode etc.) - attribution is
    // best-effort, never a gate on reaching the content (spec S9).
  }
  return captured;
}

export function getStoredAttribution(): TutorialAttribution {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
