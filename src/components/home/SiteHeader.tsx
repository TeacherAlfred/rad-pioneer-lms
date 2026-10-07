"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import WhatsAppIcon from "./WhatsAppIcon";
import { TrackedAnchor, TrackedLink } from "./Tracked";
import s from "./home.module.css";

const SECTIONS = [
  { href: "#ages", label: "Who it's for", short: "Who it's for" },
  { href: "#what", label: "What they learn", short: "What they learn" },
  { href: "#parents", label: "What parents say", short: "Parents" },
  { href: "#join", label: "Ways to join", short: "Ways to join" },
  { href: "#faq", label: "Questions", short: "Questions" },
];

// Sticky glass bar. On phones the burger opens a full-screen menu that sits
// directly under the bar (wherever the bar is, since the classic-homepage
// notice can sit above it at the top of the page).
export default function SiteHeader({ waHref }: { waHref: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuTop, setMenuTop] = useState(56);
  const headerRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("homeMenuOpen", open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onResize = () => { if (window.innerWidth >= 980) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.documentElement.classList.remove("homeMenuOpen");
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function toggle() {
    if (!open && headerRef.current) setMenuTop(Math.max(0, headerRef.current.getBoundingClientRect().bottom));
    setOpen(!open);
  }

  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : -8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <>
      <header ref={headerRef} className={`${s.header} ${scrolled ? s.scrolled : ""} ${open ? s.headerOpen : ""}`}>
        <div className={`${s.wrap} ${s.bar}`}>
          <Link className={s.logo} href="/" aria-label="RAD Academy home">
            <Image src="/logo/rad-logo.png" alt="RAD Academy" width={85} height={28} priority unoptimized />
          </Link>
          <nav className={s.barNav} aria-label="Sections">
            {SECTIONS.map((x) => <a key={x.href} href={x.href}>{x.short}</a>)}
          </nav>
          <div className={s.barRight}>
            <Link className={s.login} href="/login">Log in</Link>
            <a className={`${s.btn} ${s.btnInk} ${s.barBtn}`} href="#fit">Find your fit</a>
            <button
              className={`${s.burger} ${open ? s.burgerOpen : ""}`}
              type="button"
              onClick={toggle}
              aria-label={open ? "Close menu" : "Menu"}
              aria-expanded={open}
              aria-controls="home-menu"
            >
              <span />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="home-menu"
            className={s.menu}
            style={{ top: menuTop }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className={s.wrap}
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.035 } } }}
            >
              <nav className={s.menuNav} aria-label="Menu">
                {SECTIONS.map((x) => (
                  <motion.a key={x.href} href={x.href} variants={item} onClick={() => setOpen(false)}>{x.label}</motion.a>
                ))}
              </nav>
              <motion.div variants={item}>
                <p className={s.menuSub}>Already with us?</p>
                <div className={s.menuPortal}>
                  <Link href="/login">Log in</Link>
                  <Link href="/request-access">Request access</Link>
                  <TrackedLink href="/classic" event="home_classic_click" eventProps={{ source: "menu" }}>Classic homepage</TrackedLink>
                </div>
                <p className={s.menuSub}>Talk to us</p>
                <TrackedAnchor
                  className={`${s.btn} ${s.btnWa} ${s.menuWa}`}
                  href={waHref}
                  target="_blank"
                  rel="noopener"
                  event="home_whatsapp_click"
                  eventProps={{ source: "menu" }}
                >
                  <WhatsAppIcon className={s.icon} />Chat on WhatsApp
                </TrackedAnchor>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
