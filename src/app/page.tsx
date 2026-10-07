import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Mono } from "next/font/google";
import { Blocks, ChevronRight, Cpu, Flag, MapPin, Monitor, Play, Sprout, Star, Tent } from "lucide-react";
import { headingFont, bodyFont } from "@/lib/termTheme";
import { RAD_WHATSAPP_NUMBER } from "@/lib/tutorialProgress";
import ClassicNotice from "@/components/home/ClassicNotice";
import SiteHeader from "@/components/home/SiteHeader";
import TrafficLightDemo from "@/components/home/TrafficLightDemo";
import ScreenTimeToggle from "@/components/home/ScreenTimeToggle";
import ParentMessages from "@/components/home/ParentMessages";
import FitFinder from "@/components/home/FitFinder";
import FloatingDock from "@/components/home/FloatingDock";
import WhatsAppIcon from "@/components/home/WhatsAppIcon";
import { TrackedAnchor, TrackedLink } from "@/components/home/Tracked";
import s from "@/components/home/home.module.css";

// Public homepage. One job: take a parent who has never heard of RAD to
// "I get what this is, it's for my child, and messaging them is easy".
// It doubles as the door into the rest of the site (term programme, events,
// labs, logins). The previous homepage lives on at /classic for returning
// visitors who knew their way around it.

const monoFont = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"] });

const TITLE = "RAD Academy · Coding & robotics for kids in Pretoria and online";
const DESCRIPTION =
  "Kids learn to code and build real gadgets with RAD Academy. Weekend groups in Menlyn, Pretoria, or 1-on-1 online. Mostly ages 8–16, younger and older welcome.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "RAD Academy" },
};

const wa = (text: string) => `https://wa.me/${RAD_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
const WA_GENERAL = wa("Hi RAD Academy, I’d like to know more about coding and robotics for my child.");
const WA_WEEKEND = wa("Hi RAD Academy, I’m interested in weekend lessons in Menlyn for my child.");
const WA_ONLINE = wa("Hi RAD Academy, I’m interested in online 1-on-1 lessons for my child.");

const fontVars = {
  "--font-display": headingFont.style.fontFamily,
  "--font-body": bodyFont.style.fontFamily,
  "--font-mono": monoFont.style.fontFamily,
} as React.CSSProperties;

const FAQ = [
  {
    q: "Does my child need coding experience?",
    a: "No. Most children start from zero. Beginners start with block coding, where they drag instructions into order instead of typing them.",
  },
  {
    q: "What ages do you teach?",
    a: "Most of our students are 8 to 16, but that’s a guide, not a rule. We also start younger children and work with older teens. Tell us about your child and we’ll suggest where to begin.",
  },
  {
    q: "Where and when are lessons?",
    a: "In person in Menlyn, Pretoria on Saturdays 10:00–11:00 and Sundays 14:00–15:00. Online 1-on-1 lessons run Monday to Friday between 15:00 and 18:00. Term workshops and holiday bootcamps have their own dates.",
  },
  {
    q: "What does it cost?",
    a: "It depends on the programme. Workshop fees are on this term’s workshops page, and we’ll give you the exact cost for weekend or online lessons when you message us. Registering interest is free.",
  },
  {
    q: "Do they need their own laptop?",
    a: "We’ll tell you exactly what to bring when we confirm the session. If you don’t have a laptop at home, mention it when you message us.",
  },
  {
    q: "We’re not in Pretoria. Can we still join?",
    a: "Yes. Online 1-on-1 lessons work from anywhere, and the free coding labs can be started at home today.",
  },
];

export default function HomePage() {
  return (
    <div className={s.page} style={fontVars}>
      <ClassicNotice />
      <SiteHeader waHref={WA_GENERAL} />

      <main>
        {/* Hero */}
        <section className={s.hero}>
          <div className={s.wrap}>
            <span className={`${s.eyebrow} ${s.heroEyebrow} ${s.rise}`}>Coding &amp; robotics for kids</span>
            <h1 className={`${s.hXl} ${s.rise} ${s.d1}`}>Screen time, turned into build time.</h1>
            <p className={`${s.lede} ${s.rise} ${s.d2}`}>
              Your child learns to code and build real gadgets, and comes home with a project that works.{" "}
              <strong>Weekend groups in Menlyn, Pretoria</strong>, or <strong>1-on-1 online</strong>.
            </p>
            <div className={`${s.heroCtas} ${s.rise} ${s.d3}`} id="hero-cta">
              <TrackedAnchor
                className={`${s.btn} ${s.btnWa}`}
                href={WA_GENERAL}
                target="_blank"
                rel="noopener"
                event="home_whatsapp_click"
                eventProps={{ source: "hero" }}
              >
                <WhatsAppIcon className={s.icon} />Chat with us on WhatsApp
              </TrackedAnchor>
              <Link className={s.link} href="/labs">Try a free coding lab</Link>
            </div>
            <div className={`${s.ageNote} ${s.rise} ${s.d3}`}><b>Mostly ages 8–16</b> · younger &amp; older welcome</div>
            <TrafficLightDemo />
          </div>
        </section>

        {/* Who it's for */}
        <section className={`${s.sec} ${s.alt}`} id="ages" aria-labelledby="h-ages">
          <div className={`${s.wrap} ${s.narrow}`}>
            <div className={`${s.secHead} ${s.reveal}`}>
              <span className={s.eyebrow}>Who it&rsquo;s for</span>
              <h2 className={s.hLg} id="h-ages">Built for 8 to 16. Not limited to it.</h2>
              <p className={s.lede}>
                Most of our students fall in this range. We also start younger children and keep older teens going. Tell us about your child and we&rsquo;ll suggest where to begin.
              </p>
            </div>
            <div className={`${s.ruler} ${s.reveal}`} role="img" aria-label="Age range: core ages 8 to 16, open to younger and older children">
              <div className={s.ends}><span><b>Younger?</b>Ask us</span><span><b>Older?</b>Ask us</span></div>
              <div className={s.track}><div className={`${s.open} ${s.openL}`} /><div className={s.core} /><div className={`${s.open} ${s.openR}`} /></div>
              <div className={s.ticks}><div><span>8</span><span>10</span><span>12</span><span>14</span><span>16</span></div></div>
              <p className={s.caption}><b>No coding experience needed.</b> Most children start from zero, with block coding.</p>
            </div>
            <div className={`${s.group} ${s.facts} ${s.reveal}`}>
              <div className={s.row}>
                <span className={s.sq} style={{ background: "var(--sq-blue)" }}><MapPin /></span>
                <span className={s.rowText}><b>Menlyn, Pretoria</b><span>Small weekend groups</span></span>
                <span />
              </div>
              <div className={s.row}>
                <span className={s.sq} style={{ background: "var(--sq-purple)" }}><Monitor /></span>
                <span className={s.rowText}><b>Online, anywhere</b><span>1-on-1 on weekday afternoons</span></span>
                <span />
              </div>
            </div>
          </div>
        </section>

        {/* Gaming vs building */}
        <section className={s.sec} aria-labelledby="h-why">
          <div className={s.wrap}>
            <div className={`${s.secHead} ${s.center} ${s.reveal}`}>
              <span className={s.eyebrow}>From gaming to engineering</span>
              <h2 className={s.hLg} id="h-why">Same screen. Different story.</h2>
            </div>
            <ScreenTimeToggle />
            <div className={`${s.promise} ${s.reveal}`}>
              <span className={s.rad}>RAD</span>
              <p>
                <strong>Redefining African Dreams.</strong> We believe African children can build solutions the world uses. It starts with one working project, and the confidence that comes with it.
              </p>
            </div>
          </div>
        </section>

        {/* What they do */}
        <section className={`${s.sec} ${s.alt}`} id="what" aria-labelledby="h-what">
          <div className={s.wrap}>
            <div className={`${s.secHead} ${s.reveal}`}>
              <span className={s.eyebrow}>What your child actually does</span>
              <h2 className={s.hLg} id="h-what">Hands on the hardware. Eyes on the code.</h2>
            </div>
            <div className={s.tiles}>
              <div className={`${s.tile} ${s.reveal}`}>
                <span className={`${s.sq} ${s.tileSq}`} style={{ background: "var(--sq-teal)" }}><Cpu /></span>
                <h3 className={s.hMd}>Builds real gadgets</h3>
                <p>They snap together Cubroid coding blocks (lights, motors, sensors) and make them respond. When something doesn&rsquo;t work, they figure out why.</p>
                <span className={s.kit}>Cubroid · lights · motors · sensors</span>
              </div>
              <div className={`${s.tile} ${s.reveal}`}>
                <span className={`${s.sq} ${s.tileSq}`} style={{ background: "var(--sq-blue)" }}><Blocks /></span>
                <h3 className={s.hMd}>Writes real code</h3>
                <p>Beginners start with block coding: dragging instructions into order and seeing the result straight away. Some workshops also show the same program in Python, side by side.</p>
                <span className={s.kit}>Block coding first</span>
              </div>
              <div className={`${s.tile} ${s.reveal}`}>
                <span className={`${s.sq} ${s.tileSq}`} style={{ background: "var(--sq-amber)" }}><Flag /></span>
                <h3 className={s.hMd}>Finishes something</h3>
                <p>Every session ends with a project they can explain and show you at home: a game, a robot, a traffic light.</p>
                <span className={s.kit}>Built · tested · shown</span>
              </div>
            </div>
          </div>
        </section>

        {/* Parents */}
        <section className={s.sec} id="parents" aria-labelledby="h-proof">
          <div className={s.wrap}>
            <h2 className={s.srOnly} id="h-proof">What parents tell us</h2>
            <figure className={`${s.bigQuote} ${s.reveal}`}>
              <span className={s.mark} aria-hidden="true">&ldquo;</span>
              <blockquote>He keeps saying today was the best day of his life.</blockquote>
              <figcaption>A parent, on WhatsApp · &ldquo;&hellip;I&rsquo;d really like him to join and study further with RAD Academy.&rdquo;</figcaption>
            </figure>
            <ParentMessages />
          </div>
        </section>

        {/* How it starts */}
        <section className={`${s.sec} ${s.alt}`} id="how" aria-labelledby="h-how">
          <div className={s.wrap}>
            <div className={`${s.secHead} ${s.center} ${s.reveal}`}>
              <span className={s.eyebrow}>How it starts</span>
              <h2 className={s.hLg} id="h-how">Four small steps. You decide at each one.</h2>
            </div>
            <ol className={s.steps}>
              <li className={s.reveal}><h3 className={s.hMd}>Message us</h3><p>Tell us your child&rsquo;s age and what they&rsquo;re into: games, Minecraft, gadgets, anything.</p></li>
              <li className={s.reveal}><h3 className={s.hMd}>We suggest a fit</h3><p>A weekend group in Menlyn, online 1-on-1, or one of this term&rsquo;s workshops.</p></li>
              <li className={s.reveal}><h3 className={s.hMd}>They come to a session</h3><p>You see how they respond and what they built before you commit to more.</p></li>
              <li className={s.reveal}><h3 className={s.hMd}>Join for the term</h3><p>If it clicks, they keep going with a group or mentor who knows them.</p></li>
            </ol>
            <div className={`${s.free} ${s.reveal}`}>
              <span className={s.sq}><Sprout /></span>
              <p><b>No payment to register.</b> We confirm every detail with you on WhatsApp first.</p>
            </div>
          </div>
        </section>

        {/* Ways to join */}
        <section className={s.sec} id="join" aria-labelledby="h-join">
          <div className={`${s.wrap} ${s.join}`}>
            <div className={`${s.secHead} ${s.reveal}`}>
              <span className={s.eyebrow}>Ways to join</span>
              <h2 className={s.hLg} id="h-join">Pick what fits your week.</h2>
            </div>

            <p className={s.groupLabel}>Browse online</p>
            <div className={`${s.group} ${s.reveal}`}>
              <Link className={s.row} href="/term-program">
                <span className={s.sq} style={{ background: "var(--sq-amber)" }}><Star /></span>
                <span className={s.rowText}><b>This term&rsquo;s workshops</b><span>Pick a workshop and a preferred day</span></span>
                <ChevronRight className={s.chev} aria-hidden="true" />
              </Link>
              <Link className={s.row} href="/events">
                <span className={s.sq} style={{ background: "var(--sq-gold)" }}><Tent /></span>
                <span className={s.rowText}><b>Events &amp; bootcamps</b><span>Robotics days and holiday camps</span></span>
                <ChevronRight className={s.chev} aria-hidden="true" />
              </Link>
              <Link className={s.row} href="/labs">
                <span className={s.sq} style={{ background: "var(--sq-lime)" }}><Play /></span>
                <span className={s.rowText}><b>Free coding labs</b><span>About 20 minutes each, at home</span></span>
                <ChevronRight className={s.chev} aria-hidden="true" />
              </Link>
            </div>

            <p className={`${s.groupLabel} ${s.groupLabelGap}`}><WhatsAppIcon />Ask on WhatsApp</p>
            <div className={`${s.group} ${s.reveal}`}>
              <TrackedAnchor className={s.row} href={WA_WEEKEND} target="_blank" rel="noopener" event="home_whatsapp_click" eventProps={{ source: "join_weekend" }}>
                <span className={s.sq} style={{ background: "var(--sq-blue)" }}><MapPin /></span>
                <span className={s.rowText}><b>Weekend lessons, Menlyn</b><span className={s.mono}>Sat 10–11 · Sun 14–15</span></span>
                <span className={s.chat}><WhatsAppIcon />Chat</span>
              </TrackedAnchor>
              <TrackedAnchor className={s.row} href={WA_ONLINE} target="_blank" rel="noopener" event="home_whatsapp_click" eventProps={{ source: "join_online" }}>
                <span className={s.sq} style={{ background: "var(--sq-purple)" }}><Monitor /></span>
                <span className={s.rowText}><b>Online 1-on-1</b><span className={s.mono}>Mon–Fri · 15:00–18:00</span></span>
                <span className={s.chat}><WhatsAppIcon />Chat</span>
              </TrackedAnchor>
            </div>
            <p className={s.groupNote}>These open WhatsApp with a message ready for you to send. Nothing is sent until you tap send.</p>
          </div>
        </section>

        {/* FAQ */}
        <section className={`${s.sec} ${s.alt}`} id="faq" aria-labelledby="h-faq">
          <div className={s.wrap}>
            <div className={`${s.secHead} ${s.center} ${s.reveal}`}>
              <span className={s.eyebrow}>Questions parents ask</span>
              <h2 className={s.hLg} id="h-faq">Good questions.</h2>
            </div>
            <div className={`${s.faq} ${s.reveal}`}>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}<span className={s.pm} aria-hidden="true" /></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Fit finder */}
        <section className={s.sec} id="fit" aria-labelledby="h-fit">
          <div className={s.wrap}>
            <div className={`${s.secHead} ${s.center} ${s.reveal}`}>
              <span className={s.eyebrow}>Find your fit</span>
              <h2 className={s.hLg} id="h-fit">Two taps. We&rsquo;ll write the message.</h2>
            </div>
            <FitFinder waNumber={RAD_WHATSAPP_NUMBER} />
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.wrap}>
          <div className={s.footTop}>
            <Image src="/logo/rad-logo.png" alt="RAD Academy" width={79} height={26} unoptimized />
            <p>Redefining African Dreams. Building African giants through technology training, practical bootcamps and mentorship.</p>
          </div>
          <div className={s.footCols}>
            <div>
              <h4>Explore</h4>
              <ul>
                <li><Link href="/term-program">This term&rsquo;s workshops</Link></li>
                <li><Link href="/events">Events &amp; bootcamps</Link></li>
                <li><Link href="/labs">Free coding labs</Link></li>
                <li><Link href="/tutorials">Tutorials</Link></li>
              </ul>
            </div>
            <div>
              <h4>Students &amp; families</h4>
              <ul>
                <li><Link href="/login">Log in</Link></li>
                <li><Link href="/request-access">Request access</Link></li>
                <li><Link href="/math">Pioneer Math Lab</Link></li>
                <li><TrackedLink href="/classic" event="home_classic_click" eventProps={{ source: "footer" }}>Classic homepage</TrackedLink></li>
              </ul>
            </div>
            <div>
              <h4>Follow</h4>
              <ul>
                <li><a href="https://www.instagram.com/academy_rad1" target="_blank" rel="noopener">Instagram</a></li>
                <li><a href="https://www.facebook.com/radacademy1" target="_blank" rel="noopener">Facebook</a></li>
                <li><a href="https://www.linkedin.com/company/rad-academy-digital" target="_blank" rel="noopener">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className={s.legal}><span>&copy; 2026 RAD Academy. Menlyn, Pretoria.</span><span>info@radacademy.co.za</span></div>
        </div>
      </footer>

      <FloatingDock waHref={WA_GENERAL} />
    </div>
  );
}
