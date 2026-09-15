import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Aggregates the generic analytics_events log (src/app/api/track/route.ts,
// already firing a "page_view" on every route change site-wide via the
// root layout's AnalyticsTracker) into what the Tutorial Hub actually
// wants to know: Hub landings, series entries, and - the point of this
// route - per-step average dwell time, so an admin can see which steps
// run long enough to need splitting up without hand-querying raw events.
// Computed server-side (service role, sees hidden/draft content too) so
// the client only ever receives the small aggregated shape, not the raw
// event log.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Handed back so the admin UI can offer a one-click "exclude my IP"
  // rather than making an admin go look their own IP up elsewhere.
  const forwardedFor = req.headers.get('x-forwarded-for');
  const requesterIp = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || null;

  const [seriesRes, tutorialsRes, stepsRes, eventsRes, excludedIpsRes] = await Promise.all([
    supabaseAdmin.from('tutorial_series').select('id, title, slug'),
    supabaseAdmin.from('tutorials').select('id, series_id, title, slug, estimated_minutes'),
    supabaseAdmin.from('tutorial_steps').select('id, tutorial_id, instruction, order_index'),
    supabaseAdmin.from('analytics_events').select('event_type, url_path, metadata, created_at').gte('created_at', since),
    supabaseAdmin.from('analytics_excluded_ips').select('ip_address'),
  ]);
  if (seriesRes.error) return NextResponse.json({ error: seriesRes.error.message }, { status: 500 });
  if (tutorialsRes.error) return NextResponse.json({ error: tutorialsRes.error.message }, { status: 500 });
  if (stepsRes.error) return NextResponse.json({ error: stepsRes.error.message }, { status: 500 });
  if (eventsRes.error) return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });

  // Admin/office IPs marked in analytics_excluded_ips (managed from this
  // same analytics page) never count toward landings, entries, or step
  // timing - otherwise every time someone here clicks through a tutorial
  // to check the copy, it skews the very numbers meant to reflect real
  // visitor behavior.
  const excludedIps = new Set((excludedIpsRes.data || []).map(r => r.ip_address));
  const events = (eventsRes.data || []).filter(e => !excludedIps.has((e.metadata as any)?.ip_address));

  // Hub landings / series entries ride on the free, already-firing
  // page_view event - no dedicated instrumentation needed for those two.
  let hubLandings = 0;
  let seriesEntries = 0;
  for (const e of events) {
    if (e.event_type !== 'page_view') continue;
    if (e.url_path === '/tutorials') hubLandings++;
    else if (/^\/tutorials\/[^/]+$/.test(e.url_path) && !e.url_path.startsWith('/tutorials/resume')) seriesEntries++;
  }

  // Per-step duration aggregation, keyed by "tutorialId:stepOrderIndex" -
  // order_index rather than step_id so a step still aggregates correctly
  // even if it was ever deleted and re-added at the same position.
  const stepAgg = new Map<string, { tutorialId: string; orderIndex: number; totalSeconds: number; count: number }>();
  for (const e of events) {
    if (e.event_type !== 'tutorial_step_duration') continue;
    const m = e.metadata as any;
    if (!m?.tutorial_id || m.step_order_index === undefined || typeof m.seconds !== 'number') continue;
    const key = `${m.tutorial_id}:${m.step_order_index}`;
    const existing = stepAgg.get(key) || { tutorialId: m.tutorial_id, orderIndex: m.step_order_index, totalSeconds: 0, count: 0 };
    existing.totalSeconds += m.seconds;
    existing.count += 1;
    stepAgg.set(key, existing);
  }

  const seriesById = new Map((seriesRes.data || []).map(s => [s.id, s]));
  const stepsByTutorial = new Map<string, typeof stepsRes.data>();
  for (const s of stepsRes.data || []) {
    const list = stepsByTutorial.get(s.tutorial_id) || [];
    list.push(s);
    stepsByTutorial.set(s.tutorial_id, list);
  }

  const tutorialSummaries = (tutorialsRes.data || []).map(t => {
    const series = seriesById.get(t.series_id);
    const stepRows = (stepsByTutorial.get(t.id) || []).sort((a, b) => a.order_index - b.order_index);

    const steps = stepRows.map(step => {
      const agg = stepAgg.get(`${t.id}:${step.order_index}`);
      const avgSeconds = agg ? Math.round(agg.totalSeconds / agg.count) : null;
      return {
        stepId: step.id,
        orderIndex: step.order_index,
        instructionPreview: step.instruction.slice(0, 80),
        avgSeconds,
        sampleCount: agg?.count || 0,
      };
    });

    const measuredSteps = steps.filter(s => s.avgSeconds !== null);
    const tutorialAvgStepSeconds = measuredSteps.length > 0
      ? measuredSteps.reduce((sum, s) => sum + (s.avgSeconds || 0), 0) / measuredSteps.length
      : null;

    return {
      tutorialId: t.id,
      title: t.title,
      slug: t.slug,
      seriesTitle: series?.title || null,
      seriesSlug: series?.slug || null,
      estimatedMinutes: t.estimated_minutes,
      totalEstimatedFromData: measuredSteps.length > 0 ? Math.round(measuredSteps.reduce((sum, s) => sum + (s.avgSeconds || 0), 0) / 60 * 10) / 10 : null,
      steps: steps.map(s => ({
        ...s,
        // Flag a step as an outlier worth splitting when it runs
        // meaningfully longer than this tutorial's own average step -
        // relative to itself, not some fixed cutoff, since tutorials vary.
        isOutlier: s.avgSeconds !== null && tutorialAvgStepSeconds !== null && s.avgSeconds > tutorialAvgStepSeconds * 1.5,
      })),
    };
  }).filter(t => t.steps.some(s => s.sampleCount > 0)); // only show tutorials with any real data

  return NextResponse.json({
    days,
    hubLandings,
    seriesEntries,
    tutorials: tutorialSummaries,
    requesterIp,
    excludedIps: Array.from(excludedIps),
  });
}
