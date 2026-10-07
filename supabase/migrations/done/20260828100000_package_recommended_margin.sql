-- Recommended margin lives on the package itself (the reusable library),
-- not just per-attachment - a founder call about a package's typical margin
-- shouldn't need re-entering every time it's attached to a new program.
-- event_packages.target_margin_pct remains the per-attachment authoritative
-- value (can still be overridden there); this is just the default that
-- pre-fills it, pulled in by the attach flow in
-- src/app/admin/featured-programs/page.tsx.
alter table packages
  add column recommended_margin_pct numeric(5,2);
