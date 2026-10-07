"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WhatsAppIcon from "./WhatsAppIcon";
import { TrackedAnchor } from "./Tracked";
import s from "./home.module.css";

// Phone-only capsule in the thumb zone. Shows once the hero's own buttons
// have scrolled away, and steps aside when the fit finder (which has its
// own WhatsApp button) is on screen. Hidden on desktop by CSS.
export default function FloatingDock({ waHref }: { waHref: string }) {
  const [heroVisible, setHeroVisible] = useState(true);
  const [finderVisible, setFinderVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const finder = document.getElementById("fit");
    if (!hero || !finder) return;
    const a = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting));
    const b = new IntersectionObserver(([e]) => setFinderVisible(e.isIntersecting), { threshold: 0.05 });
    a.observe(hero);
    b.observe(finder);
    return () => { a.disconnect(); b.disconnect(); };
  }, []);

  return (
    <AnimatePresence>
      {!heroVisible && !finderVisible && (
        <motion.div
          className={s.dock}
          initial={{ y: 120 }}
          animate={{ y: 0 }}
          exit={{ y: 120 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
        >
          <div className={s.dockIn}>
            <a className={`${s.btn} ${s.btnInk} ${s.dockFit}`} href="#fit">Find your fit</a>
            <TrackedAnchor
              className={`${s.btn} ${s.btnWa} ${s.dockWa}`}
              href={waHref}
              target="_blank"
              rel="noopener"
              aria-label="Chat on WhatsApp"
              event="home_whatsapp_click"
              eventProps={{ source: "dock" }}
            >
              <WhatsAppIcon />
            </TrackedAnchor>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
