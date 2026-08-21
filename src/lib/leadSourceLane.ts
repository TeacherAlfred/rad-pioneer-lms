// Groups leads.source's real distinct values (meta_plk, irene_ips,
// warm_list*, organic, website_register_interest, migration_backfill, null)
// into the lanes the dashboard-v2 screens filter/report by. No existing code
// did this grouping before - source has never been bucketed into lanes.
export type SourceLane = 'Meta' | 'Irene' | 'Warm List' | 'Organic' | 'Unknown';

export function getSourceLane(source: string | null | undefined): SourceLane {
  if (!source) return 'Unknown';
  if (source.startsWith('meta_')) return 'Meta';
  if (source.startsWith('irene_')) return 'Irene';
  if (source.startsWith('warm_list')) return 'Warm List';
  if (source === 'organic') return 'Organic';
  return 'Unknown';
}
