import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseMessage, KIND_LABEL } from '@/lib/messageParse';
import { isEligibleStage, stageKeyFor } from '@/lib/messageFunnel';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE_SIZE = 1000;

export async function GET() {
  try {
    // Supabase caps a single response at 1000 rows - paginated so this stays
    // correct as messages grows well past that, same concern noted in the
    // Messages page's own full-table fetch.
    const allMessages: { lead_id: string; body: string | null; created_at: string }[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('lead_id, body, created_at')
        .eq('direction', 'outbound')
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allMessages.push(...(data as any[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Rows arrive oldest-first, so the last eligible row seen per lead while
    // iterating in order is naturally their most recent one - no separate
    // sort-and-take-last pass needed.
    const currentByLead = new Map<string, { key: string; label: string; kind: string; sentAt: string }>();
    const everByLead = new Map<string, Map<string, { key: string; label: string; kind: string; sentAt: string }>>();

    for (const row of allMessages) {
      const parsed = parseMessage({ direction: 'outbound', body: row.body });
      if (!isEligibleStage(parsed)) continue;
      const stage = stageKeyFor(parsed);

      currentByLead.set(row.lead_id, { ...stage, sentAt: row.created_at });

      let everMap = everByLead.get(row.lead_id);
      if (!everMap) {
        everMap = new Map();
        everByLead.set(row.lead_id, everMap);
      }
      // First time this lead hit this stage, not the most recent - "already
      // received this before, sent on X" should point at when it first
      // happened, not restate whatever their current stage already shows.
      if (!everMap.has(stage.key)) {
        everMap.set(stage.key, { ...stage, sentAt: row.created_at });
      }
    }

    const leadIds = Array.from(new Set([...currentByLead.keys(), ...everByLead.keys()]));
    if (leadIds.length === 0) {
      return NextResponse.json({ stages: [], leads: [] });
    }

    // merged_into_id leads are duplicates folded into another lead record -
    // excluded so a merged-away contact doesn't show up as its own stuck
    // funnel entry alongside the record it was merged into.
    //
    // Chunked, not one .in('id', leadIds) call - with real message volume
    // this resolves to hundreds of unique lead UUIDs, and supabase-js
    // serializes .in() into the request URL itself (?id=in.(uuid1,uuid2,...)),
    // which blew past undici's ~16KB URL/header limit at ~350+ ids
    // (HeadersOverflowError, confirmed against production data 2026-09-16).
    const ID_CHUNK_SIZE = 150;
    const leads: any[] = [];
    for (let i = 0; i < leadIds.length; i += ID_CHUNK_SIZE) {
      const chunk = leadIds.slice(i, i + ID_CHUNK_SIZE);
      const { data, error: leadsErr } = await supabaseAdmin
        .from('leads')
        .select('id, name, phone, email, opted_out, is_blocked, is_business_number, tags, merged_into_id')
        .in('id', chunk);
      if (leadsErr) throw leadsErr;
      leads.push(...(data || []));
    }

    const { data: flows, error: flowsErr } = await supabaseAdmin
      .from('bot_flows')
      .select('id, label, action_type')
      .eq('action_type', 'message');
    if (flowsErr) throw flowsErr;
    const flowIdByLabel = new Map((flows || []).map((f: any) => [f.label, f.id]));

    const leadRows = (leads || [])
      .filter((lead: any) => !lead.merged_into_id)
      .map((lead: any) => {
        const current = currentByLead.get(lead.id) || null;
        const everMap = everByLead.get(lead.id);
        const everStages = everMap ? Array.from(everMap.values()).map(s => ({ key: s.key, sentAt: s.sentAt })) : [];
        return {
          leadId: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          optedOut: !!lead.opted_out,
          isBlocked: !!lead.is_blocked,
          isBusinessNumber: !!lead.is_business_number,
          tags: lead.tags || [],
          currentStageKey: current?.key || null,
          lastActivityAt: current?.sentAt || null,
          everStageKeys: everStages,
        };
      });

    // Aggregate counts per stage across the (now merge-filtered) lead set,
    // rather than trusting the raw per-message reduction above - a lead
    // filtered out for being merged-away shouldn't still inflate a count.
    const stageMeta = new Map<string, { key: string; label: string; kind: string }>();
    for (const s of currentByLead.values()) stageMeta.set(s.key, { key: s.key, label: s.label, kind: s.kind });
    for (const everMap of everByLead.values()) for (const s of everMap.values()) stageMeta.set(s.key, { key: s.key, label: s.label, kind: s.kind });

    const currentCounts = new Map<string, number>();
    const everCounts = new Map<string, number>();
    for (const lead of leadRows) {
      if (lead.currentStageKey) currentCounts.set(lead.currentStageKey, (currentCounts.get(lead.currentStageKey) || 0) + 1);
      for (const s of lead.everStageKeys) everCounts.set(s.key, (everCounts.get(s.key) || 0) + 1);
    }

    const stages = Array.from(stageMeta.values())
      .map(s => ({
        key: s.key,
        label: s.label,
        kind: s.kind,
        kindLabel: KIND_LABEL[s.kind] || s.kind,
        currentCount: currentCounts.get(s.key) || 0,
        everCount: everCounts.get(s.key) || 0,
        flowId: s.kind === 'bot_flow' ? flowIdByLabel.get(s.label) || null : null,
      }))
      .filter(s => s.currentCount > 0 || s.everCount > 0)
      .sort((a, b) => b.everCount - a.everCount);

    return NextResponse.json({ stages, leads: leadRows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
