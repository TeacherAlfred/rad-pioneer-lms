import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { COMMUNITIES, getCommunity } from "@/lib/communities";
import CommunityInterest, { type CommunityOffer } from "./CommunityInterest";

// Only slugs listed in communities.ts render - anything else at the top
// level 404s instead of becoming an empty community page.
export const dynamicParams = false;
// Offers come from featured_programs, so an admin edit (or a workshop's
// live_until passing) shows up within a few minutes without a deploy.
export const revalidate = 300;

export function generateStaticParams() {
  return COMMUNITIES.map(c => ({ community: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ community: string }> }): Promise<Metadata> {
  const community = getCommunity((await params).community);
  return {
    title: `RAD Academy · ${community?.audienceLabel ?? ""}`,
    // A follow-up page for families we've met, not a public listing - and
    // it shouldn't surface in search looking like an official school page.
    robots: { index: false, follow: false },
  };
}

async function loadOffers(programIds: string[]): Promise<CommunityOffer[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase
    .from("featured_programs")
    .select("id, title, details, image_url, date_options, age_label, draft, live_from, live_until")
    .in("id", programIds);
  if (error) throw error;

  const now = Date.now();
  return programIds
    .map(id => (data || []).find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> =>
      !!p && !p.draft && now >= new Date(p.live_from).getTime() && now <= new Date(p.live_until).getTime())
    .map(p => ({
      id: p.id,
      title: p.title,
      details: p.details,
      imageUrl: p.image_url,
      dates: ((p.date_options || []) as { label: string }[]).map(d => d.label),
      ageLabel: p.age_label,
    }));
}

export default async function CommunityPage({ params }: { params: Promise<{ community: string }> }) {
  const community = getCommunity((await params).community)!;
  const offers = await loadOffers(community.programIds);

  return (
    <CommunityInterest
      slug={community.slug}
      audienceLabel={community.audienceLabel}
      heroTitle={community.heroTitle}
      heroSubtitle={community.heroSubtitle}
      bonusLine={community.bonusLine}
      disclaimer={community.disclaimer}
      offers={offers}
    />
  );
}
