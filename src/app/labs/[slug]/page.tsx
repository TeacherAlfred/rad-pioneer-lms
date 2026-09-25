import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSeries } from '@/content/labs';
import { getPublishedLab, loadPublishedLabs, loadSharedFaqs } from '@/lib/labsRepo';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { LabView, type Workshop } from '@/components/labs/LabView';

// Public RAD Lab page (weekly self-paced coding labs). Content comes from
// the `labs` table (edited in place at /admin/labs/[slug]) with the TS
// seeds in src/content/labs as fallback; layout lives in LabView so the
// editor preview is pixel-identical. Publishing in the admin revalidates
// this route; the timer is a backstop so Fork Card C picks up newly
// confirmed workshop sessions without anyone touching the lab.

export const revalidate = 900;

export async function generateStaticParams() {
  return (await loadPublishedLabs()).map(l => ({ slug: l.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const pad = (n: number) => String(n).padStart(2, '0');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lab = await getPublishedLab((await params).slug);
  if (!lab) return {};
  const series = getSeries(lab.seriesKey);
  const title = `${lab.title} · ${series?.name ?? 'RAD'} Lab ${pad(lab.labNumber)} · RAD Academy`;
  return {
    title,
    description: lab.seo.description,
    openGraph: { title, description: lab.seo.description, type: 'article', siteName: 'RAD Academy' },
  };
}

// Card C only shows when the lab's programme has a confirmed, upcoming
// Session that's inside its sales window. Any failure just hides the card -
// never break the page over an optional upsell.
async function nextLiveWorkshop(programCode?: string): Promise<Workshop | null> {
  if (!programCode || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const sb = supabaseAdmin();
    const { data: program } = await sb.from('programs').select('id').eq('code', programCode).eq('active', true).maybeSingle();
    if (!program) return null;
    const { data: sessions } = await sb
      .from('sessions')
      .select('starts_at, venue, sales_open_at, sales_close_at')
      .eq('programme_id', program.id)
      .eq('status', 'confirmed')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(10);
    const now = Date.now();
    const live = (sessions || []).find(x =>
      (!x.sales_open_at || Date.parse(x.sales_open_at) <= now) && (!x.sales_close_at || Date.parse(x.sales_close_at) > now));
    return live ? { startsAt: live.starts_at as string, venue: live.venue } : null;
  } catch {
    return null;
  }
}

export default async function LabPage({ params }: Props) {
  const { slug } = await params;
  const [lab, allLabs, sharedFaqs] = await Promise.all([getPublishedLab(slug), loadPublishedLabs(), loadSharedFaqs()]);
  if (!lab) notFound();
  const workshop = await nextLiveWorkshop(lab.fork.workshopProgramCode);
  return <LabView lab={lab} allLabs={allLabs} workshop={workshop} sharedFaqs={sharedFaqs} />;
}
