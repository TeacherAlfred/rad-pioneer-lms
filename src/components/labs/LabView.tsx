import Image from 'next/image';
import Link from 'next/link';
import { defaultWalkthrough, faqsForLab, getSeries, labsInSeries, seriesNeighbours, SERIES, type SharedFaqs } from '@/content/labs';
import type { LabContent } from '@/content/labs/types';
import s from '@/app/labs/[slug]/rad-lab.module.css';
import { labFontVars } from './fonts';
import { Rich } from './Rich';
import { Shot } from './Shot';
import { ZoneLabel } from './ZoneLabel';
import { DevZones } from './DevZones';
import { EditSlot } from './EditSlot';
import { ChipRow } from './ChipRow';
import { StepSlider } from './StepSlider';
import { AhaCarousel } from './AhaCarousel';
import { ForkCard } from './ForkCard';
import { ForkOptIn } from './ForkOptIn';
import { FaqFilter } from './FaqFilter';
import { HelpSheet } from './HelpSheet';

// The whole lab page layout, rendered identically by the public route
// (src/app/labs/[slug]/page.tsx, server) and the admin editor
// (/admin/labs/[slug], client, with live draft content). No data fetching
// here - callers pass everything in - and every edit affordance is an
// <EditSlot/>, which renders nothing outside the editor.

export type Workshop = { startsAt: string; venue: string | null };

const pad = (n: number) => String(n).padStart(2, '0');

export function LabView({
  lab, allLabs, workshop, sharedFaqs, editing = false,
}: {
  lab: LabContent;
  allLabs: LabContent[];      // published labs (for nav, dots, prev/next, topic grid)
  workshop: Workshop | null;  // next bookable session for Fork Card C, if any
  sharedFaqs?: SharedFaqs;    // live "all labs" + series FAQs (code defaults if omitted)
  editing?: boolean;
}) {
  // Include this lab even if it isn't published yet (editor preview), with
  // its current content, so nav/prev-next reflect the page being edited.
  const labs = allLabs.some(l => l.slug === lab.slug)
    ? allLabs.map(l => (l.slug === lab.slug ? lab : l))
    : [...allLabs, lab];
  const series = getSeries(lab.seriesKey) ?? { key: lab.seriesKey, name: 'Labs', platform: 'the editor' };
  const seriesLabs = labsInSeries(labs, lab.seriesKey);
  const { prev, next } = seriesNeighbours(labs, lab);
  const faqs = faqsForLab(lab, sharedFaqs);
  const nextLabLabel = `Lab ${pad(lab.labNumber + 1)}`;
  const walkthrough = lab.walkthrough ?? defaultWalkthrough(series.platform);
  // Card C shows when a workshop is bookable (and as a placeholder in the editor).
  const forkCols = workshop || editing ? 3 : 2;

  return (
    <div id="radlab" className={`${s.page} ${labFontVars}`} data-editing={editing ? 'on' : undefined}>
      <DevZones rootId="radlab" />

      {/* ── Zone 0: nav ── */}
      <nav className={s.nav} aria-label="Labs">
        <div className={s.navInner}>
          <Link href="/" className={s.navBrand} aria-label="RAD Academy home">
            <Image src="/logo/rad-logo.png" alt="RAD Academy" width={70} height={23} priority unoptimized />
            <span className={s.navBrandLabel}>Labs</span>
          </Link>
          <div className={s.seriesTabs}>
            {SERIES.map(ser => {
              const first = labsInSeries(labs, ser.key)[0];
              if (ser.key === lab.seriesKey) return <span key={ser.key} className={`${s.tab} ${s.tabActive}`} aria-current="page">{ser.name}</span>;
              if (!first) return <span key={ser.key} className={`${s.tab} ${s.tabDisabled}`} title="Coming soon">{ser.name}</span>;
              return <Link key={ser.key} href={`/labs/${first.slug}`} className={s.tab}>{ser.name}</Link>;
            })}
          </div>
          {seriesLabs.length > 1 && (
            <div className={s.labDots} aria-hidden="true">
              {seriesLabs.map(l => <span key={l.slug} className={`${s.labDot} ${l.slug === lab.slug ? s.labDotActive : ''}`} />)}
            </div>
          )}
        </div>
      </nav>

      <main>
        <div className={s.content}>
          {/* ── Zone 1: identity ── */}
          <header className={`${s.header} ${s.editable}`}>
            <EditSlot target={{ section: 'identity' }} label="title & chips" />
            <ZoneLabel>ZONE 1 — Lab identity · title, subtitle, chips</ZoneLabel>
            <div className={s.labNumBg} aria-hidden="true">#{pad(lab.labNumber)}</div>
            <p className={s.eyebrow}><span className={s.eyebrowDot} />{series.name} series · Lab {pad(lab.labNumber)}</p>
            <h1 className={s.labTitle}>{lab.title}</h1>
            <p className={s.labSub}><Rich text={lab.subtitle} /></p>
            <ChipRow chips={lab.chips} />
            <div className={s.heroCta}>
              <a href="#walkthrough" className={`${s.btn} ${s.btnPrimary}`}>Start the lab ↓</a>
              <span className={s.heroCtaNote}>Free · works in any browser</span>
            </div>
          </header>

          {/* ── Zone 2: hook ── */}
          <div className={s.editable}>
            <EditSlot target={{ section: 'hook' }} label="hook" />
            <ZoneLabel>ZONE 2 — Hook · 2–3 sentences · parent-addressed</ZoneLabel>
            <span className={`${s.badge} ${s.badgeParent}`}>👨‍👩‍👧 For parents</span>
            <div className={s.hook}><p><Rich text={lab.hook} /></p></div>
          </div>

          {/* ── Zone 3: context ── */}
          <section className={`${s.section} ${s.editable}`} aria-labelledby="ctx-head">
            <EditSlot target={{ section: 'context' }} label="platform intro" />
            <ZoneLabel>ZONE 3 — Context setter · max 80 words · 1 screenshot</ZoneLabel>
            <span className={`${s.badge} ${s.badgeParent}`}>👨‍👩‍👧 For parents</span>
            <h2 className={s.sectionHead} id="ctx-head">{lab.context.heading}</h2>
            <p className={s.sectionBody}><Rich text={lab.context.body} /></p>
            <Shot shot={lab.context.screenshot} label="Screenshot · Platform intro" />
          </section>

          {/* ── Zone 4: walkthrough ── */}
          <section className={s.section} id="walkthrough" aria-labelledby="walk-head">
            <ZoneLabel>ZONE 4 — Walkthrough · 5–10 steps · screenshot per step</ZoneLabel>
            <div className={s.editable}>
              <EditSlot target={{ section: 'walkthrough' }} label="walkthrough intro" />
              <span className={`${s.badge} ${s.badgeChild}`}>🎯 Your turn</span>
              <h2 className={s.sectionHead} id="walk-head">{walkthrough.heading}</h2>
              <p className={s.sectionBody}><Rich text={walkthrough.intro} /></p>
            </div>
            {lab.steps.length > 0 && <StepSlider slug={lab.slug} steps={lab.steps} nextSectionId="aha" />}
            <p className={s.keyHint} aria-hidden="true">Tip: use ← → keys or swipe to move between steps</p>
          </section>

          {/* ── Zone 4B: AHA ── */}
          <section className={s.section} id="aha" aria-labelledby="aha-head">
            <ZoneLabel>ZONE 4B — AHA carousel · child-addressed · 3 unplugged + 3 tech</ZoneLabel>
            <div className={s.editable}>
              <EditSlot target={{ section: 'aha' }} label="section & images" />
              <span className={`${s.badge} ${s.badgeChild}`}>🧠 For you</span>
              <h2 className={s.sectionHead} id="aha-head">{lab.aha.heading}</h2>
              <p className={s.sectionBody}><Rich text={lab.aha.intro} /></p>
            </div>
            <AhaCarousel cards={lab.aha.cards} showImages={lab.aha.showImages !== false} />
          </section>
        </div>

        {/* ── Zone 5: reveal (full-bleed light feature band) ── */}
        <section className={`${s.reveal} ${s.editable}`} aria-labelledby="reveal-head">
          <div className={s.content}>
            <EditSlot target={{ section: 'reveal' }} label="reveal" />
            <ZoneLabel>ZONE 5 — The Reveal · mandatory every edition</ZoneLabel>
            <span className={`${s.badge} ${s.badgeParent}`}>👨‍👩‍👧 For parents</span>
            <p className={s.eyebrow}><span className={s.eyebrowDot} />{lab.reveal.eyebrow}</p>
            <h2 className={s.revealConcept} id="reveal-head"><span>{lab.reveal.concept}</span></h2>
            <p className={s.revealBody}><Rich text={lab.reveal.body} /></p>
            <blockquote className={s.revealQuote}><Rich text={lab.reveal.quote} /></blockquote>
          </div>
        </section>

        <div className={s.content}>
          {/* ── Zone 6: fork ── */}
          <section className={`${s.fork} ${s.editable}`} aria-labelledby="fork-head">
            <EditSlot target={{ section: 'fork' }} label="next-step cards" />
            <ZoneLabel>ZONE 6 — The Fork · Card A opt-in · Card B waitlist · Card C only when a workshop is live</ZoneLabel>
            <h2 className={s.sectionHead} id="fork-head">Where does your child go from here?</h2>
            <p className={s.sectionBody}>Pick the path that fits where you are right now.</p>
            <div className={s.forkGrid} style={{ ['--cols' as string]: forkCols }}>
              <ForkCard title={`Get ${nextLabLabel} on WhatsApp`}>
                <ForkOptIn
                  labSlug={lab.slug}
                  intent="next_lab"
                  body={lab.fork.nextLabTeaser}
                  submitLabel={`Send me ${nextLabLabel} →`}
                  successBody={`${nextLabLabel} is on its way when it drops.`}
                />
              </ForkCard>
              <ForkCard title={lab.fork.waitlistTitle} variant="featured" badge={<span className={s.fbadge}>Waitlist</span>}>
                <ForkOptIn
                  labSlug={lab.slug}
                  intent="waitlist"
                  body={lab.fork.waitlistBody}
                  ctaLabel="Join the waitlist →"
                  submitLabel="Join the waitlist →"
                  successBody="You'll hear about workshops near you before they go public."
                />
              </ForkCard>
              {workshop ? (
                <ForkCard title="Book a seat" variant="book" badge={<span className={`${s.fbadge} ${s.fbadgeLive}`}>Booking now</span>}>
                  <p className={s.fcardBody}>A live {series.name} workshop is taking registrations.</p>
                  <div className={s.fcardMeta}>
                    <strong>{new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg' }).format(new Date(workshop.startsAt))}</strong>
                    {workshop.venue && <span>{workshop.venue}</span>}
                  </div>
                  <Link href="/term-program" className={`${s.btn} ${s.btnOnDark} ${s.pushDown}`}>See dates &amp; book →</Link>
                </ForkCard>
              ) : editing ? (
                <ForkCard title="Book a seat" variant="ghost" badge={<span className={s.fbadge}>Hidden right now</span>}>
                  <p className={s.fcardBody}>
                    {lab.fork.workshopProgramCode
                      ? `Appears automatically when a ${lab.fork.workshopProgramCode} session is confirmed and on sale. Visitors don't see this placeholder.`
                      : 'Set a programme code (Edit next-step cards) to show a "Book a seat" card whenever that workshop is on sale.'}
                  </p>
                </ForkCard>
              ) : null}
            </div>
          </section>

          {/* ── Zone 7: series nav ── */}
          <nav className={s.seriesNav} aria-label="Series navigation">
            <ZoneLabel>ZONE 7 — Series navigation · generated from published labs</ZoneLabel>
            <div>
              <p className={`${s.eyebrow} ${s.snavLabel}`}>{series.name} series</p>
              <div className={s.prevNext}>
                {prev ? (
                  <Link href={`/labs/${prev.slug}`} className={s.pnCard}>
                    <span className={s.pnArrow} aria-hidden="true">←</span>
                    <span className={s.pnText}><span className={s.pnDir}>Previous · Lab {pad(prev.labNumber)}</span><span className={s.pnName}>{prev.title}</span></span>
                  </Link>
                ) : (
                  <div className={`${s.pnCard} ${s.pnDisabled}`}>
                    <span className={s.pnText}><span className={s.pnDir}>Previous</span><span className={s.pnName}>This is the first lab</span></span>
                  </div>
                )}
                {next ? (
                  <Link href={`/labs/${next.slug}`} className={`${s.pnCard} ${s.pnNext}`}>
                    <span className={s.pnText}><span className={s.pnDir}>Next · Lab {pad(next.labNumber)}</span><span className={s.pnName}>{next.title}</span></span>
                    <span className={s.pnArrow} aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <div className={`${s.pnCard} ${s.pnNext} ${s.pnDisabled}`}>
                    <span className={s.pnText}><span className={s.pnDir}>Next · {nextLabLabel}</span><span className={s.pnName}>Coming soon</span></span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className={`${s.eyebrow} ${s.snavLabel}`}>All topics</p>
              <div className={s.clusterGrid}>
                {SERIES.map(ser => {
                  const inSeries = labsInSeries(labs, ser.key);
                  if (ser.key === lab.seriesKey) {
                    return (
                      <div key={ser.key} className={`${s.cluster} ${s.clusterCurrent}`} aria-current="true">
                        <div className={s.clusterName}>{ser.name}</div>
                        <div className={s.clusterCount}>Lab {pad(lab.labNumber)} of {inSeries.length}</div>
                      </div>
                    );
                  }
                  if (!inSeries.length) {
                    return (
                      <div key={ser.key} className={`${s.cluster} ${s.clusterSoon}`}>
                        <div className={s.clusterName}>{ser.name}</div>
                        <div className={s.clusterCount}>Coming soon</div>
                      </div>
                    );
                  }
                  return (
                    <Link key={ser.key} href={`/labs/${inSeries[0].slug}`} className={s.cluster}>
                      <div className={s.clusterName}>{ser.name}</div>
                      <div className={s.clusterCount}>{inSeries.length} lab{inSeries.length === 1 ? '' : 's'}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* ── FAQ ── */}
          <section className={`${s.faqSection} ${s.editable}`} aria-labelledby="faq-head">
            <EditSlot target={{ section: 'faqs' }} label="this lab's FAQs" />
            <ZoneLabel>FAQ — bucketed: this lab / series / all labs</ZoneLabel>
            <h2 className={s.sectionHead} id="faq-head">Questions we get asked</h2>
            <p className={s.sectionBody}>From parents who are new to coding, and from kids wondering what they just built.</p>
            <FaqFilter faqs={faqs} seriesName={series.name} />
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

      <HelpSheet labSlug={lab.slug} />
    </div>
  );
}
