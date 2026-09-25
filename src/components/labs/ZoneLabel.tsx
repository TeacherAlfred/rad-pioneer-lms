import s from '@/app/labs/[slug]/rad-lab.module.css';

// Template-authoring aid from the original HTML spec. Never rendered in
// production; in dev they stay hidden until ?zones=1 (see DevZones).
export function ZoneLabel({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') return null;
  return <div className={s.zoneLabel}>{children}</div>;
}
