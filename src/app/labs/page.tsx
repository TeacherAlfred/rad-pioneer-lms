import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SERIES, getSeries, labsInSeries } from '@/content/labs';
import type { LabContent } from '@/content/labs/types';
import { loadPublishedLabs } from '@/lib/labsRepo';
import { labFontVars } from '@/components/labs/fonts';
import { plainText } from '@/components/labs/Rich';
import { LabCardProgress, ResumeBanner, type LabRef } from '@/components/labs/LabProgress';
import s from './[slug]/rad-lab.module.css';
import h from './labs-hub.module.css';

// /labs - the hub that lists every published RAD Lab. Same design language
// as /labs/[slug] (tokens come from rad-lab.module.css's .page). For now
// it's one flat list in series order; once there are enough labs, the
// list below becomes one section per series (labsInSeries already gives
// that grouping). Publishing a lab in the admin revalidates this route.

export const revalidate = 900;

const TITLE = 'RAD Labs · Free coding labs for kids · RAD Academy';
const DESCRIPTION = 'Free, self-paced coding labs for ages 8–16. Each one takes about 20 minutes, runs in any browser, and ends with your child having built something real.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', siteName: 'RAD Academy' },
};

const pad = (n: number) => String(n).padStart(2, '0');

// Chips worth showing on a card: time and age, not the platform (the
// series pill already says it) and never the tooltip text.
function cardChips(lab: LabContent) {
  return lab.chips.filter(c => !c.platform).slice(0, 3);
}

export default async function LabsHubPage() {
  const all = await loadPublishedLabs();
  // Series order first (as in the nav), then lab number within a series.
  const labs = SERIES.flatMap(ser => labsInSeries(all, ser.key))
    .concat(all.filter(l => !getSeries(l.seriesKey)).sort((a, b) => a.labNumber - b.labNumber));
  const upcoming = SERIES.filter(ser => !labsInSeries(all, ser.key).length);
  const refs: LabRef[] = labs.map(l => ({
    slug: l.slug,
    total: l.steps.length,
    title: l.title,
    label: `${getSeries(l.seriesKey)?.name ?? 'Labs'} Lab ${pad(l.labNumber)}`,
  }));

  return (
    <div className={`${s.page} ${labFontVars}`}>
      <nav className={s.nav} aria-label="Labs">
        <div className={s.navInner}>
          <Link href="/" className={s.navBrand} aria-label="RAD Academy home">
            <Image src="/logo/rad-logo.png" alt="RAD Academy" width={70} height={23} priority unoptimized />
          </Link>
          <span className={s.navBrandLabel}>Labs</span>
          <span className={h.navSpacer} />
          <Link href="/term-program" className={`${s.tab} ${h.navLink}`}>Live workshops</Link>
        </div>
      </nav>

      <main>
        <header className={`${s.content} ${h.hero}`}>
          <div className={h.heroGlow} aria-hidden="true" />
          <p className={s.eyebrow}><span className={s.eyebrowDot} />RAD Labs · free &amp; self-paced</p>
          <h1 className={h.heroTitle}>Coding labs your child can start <span>right away.</span></h1>
          <p className={h.heroSub}>
            Short, guided projects for ages 8–16. Open one next to a free coding tool, follow the steps together,
            and finish with something that actually works, plus a name for the idea behind it.
          </p>
          <ul className={h.heroFacts} aria-label="About the labs">
            <li><strong>{labs.length}</strong> lab{labs.length === 1 ? '' : 's'} live</li>
            <li><strong>Free</strong>, no account</li>
            <li><strong>~20 min</strong> each</li>
            <li>Works in <strong>any browser</strong></li>
          </ul>
        </header>

        <div className={s.content}>
          <ResumeBanner labs={refs} />

          <section className={h.section} aria-labelledby="labs-head">
            <div className={h.sectionTop}>
              <h2 className={s.sectionHead} id="labs-head">All labs</h2>
              <p className={h.sectionNote}>Your progress is saved on this device.</p>
            </div>

            {labs.length ? (
              <ul className={h.grid}>
                {labs.map(lab => {
                  const series = getSeries(lab.seriesKey);
                  return (
                    <li key={lab.slug}>
                      <Link href={`/labs/${lab.slug}`} className={h.card}>
                        <span className={h.cardNum} aria-hidden="true">{pad(lab.labNumber)}</span>
                        <span className={h.cardTop}>
                          <span className={h.seriesPill}>{series?.name ?? 'Labs'}</span>
                          <span className={h.cardLabNo}>Lab {pad(lab.labNumber)}</span>
                        </span>
                        <span className={h.cardTitle}>{lab.title}</span>
                        {series?.about && <span className={h.cardAbout}>{series.about}</span>}
                        <span className={h.cardSub}>{plainText(lab.subtitle)}</span>
                        {cardChips(lab).length > 0 && (
                          <span className={h.cardChips}>
                            {cardChips(lab).map(c => (
                              <span key={c.label} className={h.cardChip}><span aria-hidden="true">{c.icon}</span>{c.label}</span>
                            ))}
                          </span>
                        )}
                        <LabCardProgress slug={lab.slug} total={lab.steps.length} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={s.sectionBody}>The first lab is on its way. Check back soon.</p>
            )}

            {upcoming.length > 0 && (
              <div className={h.soon}>
                <p className={`${s.eyebrow} ${h.soonLabel}`}>More series on the way</p>
                <ul className={h.soonRow}>
                  {upcoming.map(ser => <li key={ser.key} className={h.soonChip}>{ser.name}</li>)}
                </ul>
              </div>
            )}
          </section>

          <section className={h.section} aria-labelledby="how-head">
            <span className={`${s.badge} ${s.badgeParent}`}>👨‍👩‍👧 For parents</span>
            <h2 className={s.sectionHead} id="how-head">How a lab works</h2>
            <ol className={h.how}>
              <li>
                <span className={h.howNum}>1</span>
                <strong>Pick a lab</strong>
                <span>Start with Lab 01 of any series. Each lab builds on the one before it.</span>
              </li>
              <li>
                <span className={h.howNum}>2</span>
                <strong>Build it side by side</strong>
                <span>Keep the lab open next to the coding tool and go one step at a time. There&apos;s a screenshot for every step.</span>
              </li>
              <li>
                <span className={h.howNum}>3</span>
                <strong>Get the next one</strong>
                <span>Leave your WhatsApp number once, at the end of any lab, and every new lab comes to you as it drops. Already on the list? You don&apos;t need to sign up again.</span>
              </li>
            </ol>
          </section>

          <footer className={s.footer}>
            <Image src="/logo/rad-logo.png" alt="RAD Academy" width={70} height={23} unoptimized />
            <div className={s.footerLinks}>
              <Link href="/term-program">Workshops</Link>
            </div>
            <span className={s.footerNote}>© {new Date().getFullYear()} RAD Academy</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
