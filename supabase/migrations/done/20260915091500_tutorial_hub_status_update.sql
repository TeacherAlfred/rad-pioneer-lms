-- Reflects this round of Tutorial Hub work: cross-device sync intentionally
-- disabled behind a feature flag (not "partial and untested" anymore - a
-- deliberate product decision to ship it later), a new Getting Started/
-- hotspot-guide feature that's built but has no real screenshots yet, and
-- the RAD logo now in the /tutorials header.
update system_checklist_items
set state = 'not_started',
    notes = 'Deliberately disabled behind FEATURE_ENABLED=false in SaveProgressPrompt.tsx and marked "Coming soon" in the UI - product decision, not a bug. The WhatsApp "LINK <code>" flow underneath is still fully built and untouched; flip the flag to re-enable once the RAD_WHATSAPP_NUMBER question below is resolved and the flow has been exercised end-to-end.',
    updated_at = now()
where system_key = 'lead_generation'
  and label = 'Tutorial Hub: cross-device progress via WhatsApp phone-link';

insert into system_checklist_items (system_key, label, state, notes, sort_order) values
  ('lead_generation', 'Tutorial Hub: Getting Started screenshots + guide hotspots', 'not_started', 'Every series now gets 3 seeded onboarding items (Accessing the Resources / The Platform UI / Finding Tutorials, shown before its tutorial list) with an admin editor for click-to-place "Guide" hotspots on a screenshot - but no real screenshots have been uploaded yet, so the two UI-tour items currently render text-only. Needs one or two screenshots per platform (MakeCode first) plus the hotspots placed against them.', 10);
