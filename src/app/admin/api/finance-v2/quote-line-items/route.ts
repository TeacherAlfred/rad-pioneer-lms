import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Powers the "Cost Linking" tab on /admin/pricing - every quote line item,
// annotated with how (if at all) its real cost is known: via a priced
// Pricing Package (event_package_id) or via manual quote_line_item_costs
// links. Lines with neither are what the tab is actually for surfacing.
export async function GET() {
  const supabase = supabaseAdmin();

  const { data: lines, error } = await supabase
    .from('quote_line_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const quoteIds = [...new Set((lines || []).map((l) => l.quote_id).filter(Boolean))];
  const lineIds = (lines || []).map((l) => l.id);
  const eventPackageIds = [...new Set((lines || []).map((l) => l.event_package_id).filter(Boolean))];

  const [{ data: quotes }, { data: costLinks }, { data: eventPackages }] = await Promise.all([
    quoteIds.length ? supabase.from('quotes').select('id, quote_number, lead_id').in('id', quoteIds) : Promise.resolve({ data: [] as any[] }),
    lineIds.length
      ? supabase.from('quote_line_item_costs').select('*, inventory_item:inventory_items(id, name, unit_cost, unit_label)').in('quote_line_item_id', lineIds)
      : Promise.resolve({ data: [] as any[] }),
    eventPackageIds.length
      ? supabase.from('event_packages').select('id, computed_cost, display_name, package:packages(name)').in('id', eventPackageIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const leadIds = [...new Set((quotes || []).map((q: any) => q.lead_id).filter(Boolean))];
  const { data: leads } = leadIds.length
    ? await supabase.from('leads').select('id, name').in('id', leadIds)
    : { data: [] as any[] };

  const leadById = new Map((leads || []).map((l: any) => [l.id, l]));
  const quoteById = new Map((quotes || []).map((q: any) => [q.id, { ...q, lead: leadById.get(q.lead_id) || null }]));
  const eventPackageById = new Map((eventPackages || []).map((e: any) => [e.id, e]));
  const costLinksByLine = new Map<string, any[]>();
  (costLinks || []).forEach((link: any) => {
    const arr = costLinksByLine.get(link.quote_line_item_id) || [];
    arr.push(link);
    costLinksByLine.set(link.quote_line_item_id, arr);
  });

  const rows = (lines || []).map((line: any) => {
    const links = costLinksByLine.get(line.id) || [];
    const eventPackage = line.event_package_id ? eventPackageById.get(line.event_package_id) : null;
    const isPackageCosted = !!eventPackage && eventPackage.computed_cost != null;
    const manualCost = links.reduce((sum: number, l: any) => sum + Number(l.quantity) * Number(l.inventory_item?.unit_cost || 0), 0);
    // See cash-waterfall/route.ts lineCostBasis - same override rule.
    const packageQty = line.event_package_quantity !== null && line.event_package_quantity !== undefined ? line.event_package_quantity : line.quantity;
    const costBasis = isPackageCosted
      ? Number(eventPackage!.computed_cost) * Number(packageQty)
      : links.length > 0
      ? manualCost
      : null; // null = uncosted, distinct from a legitimately-R0 cost

    return {
      ...line,
      quote: quoteById.get(line.quote_id) || null,
      costLinks: links,
      eventPackage: eventPackage || null,
      costSource: isPackageCosted ? 'package' : links.length > 0 ? 'manual' : 'uncosted',
      costBasis,
    };
  });

  return NextResponse.json({ lineItems: rows });
}
