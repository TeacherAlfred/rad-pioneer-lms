"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import WhatsAppIcon from "./WhatsAppIcon";
import { TrackedAnchor } from "./Tracked";
import s from "./home.module.css";

// Two taps (age, location) -> a suggested starting point and a pre-written
// WhatsApp message, so the lead arrives already sorted by age and area.
// 8-16 is the core range, not a limit: under-8 and over-16 are offered too.
const AGES = [
  { id: "u8", label: "Under 8", phrase: "under 8" },
  { id: "8", label: "8–10", phrase: "aged 8–10" },
  { id: "11", label: "11–13", phrase: "aged 11–13" },
  { id: "14", label: "14–16", phrase: "aged 14–16" },
  { id: "o16", label: "Over 16", phrase: "over 16" },
] as const;

const PLACES = {
  pta: {
    label: "Pretoria area",
    title: "Weekend lessons in Menlyn",
    ask: "weekend lessons in Menlyn",
    where: "in the Pretoria area",
    body: (
      <>Small groups on Saturdays 10:00–11:00 or Sundays 14:00–15:00. Or browse <Link href="/term-program">this term&rsquo;s workshops</Link>.</>
    ),
  },
  else: {
    label: "Somewhere else",
    title: "Online 1-on-1 lessons",
    ask: "online 1-on-1 lessons",
    where: "outside Pretoria",
    body: (
      <>A personal mentor, Monday to Friday between 15:00 and 18:00, from anywhere. Want a taste first? Try a <Link href="/labs">free coding lab</Link>.</>
    ),
  },
} as const;

type AgeId = (typeof AGES)[number]["id"];
type PlaceId = keyof typeof PLACES;

function formatNumber(n: string) {
  // 27769065959 -> +27 76 906 5959
  return `+${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
}

export default function FitFinder({ waNumber }: { waNumber: string }) {
  const [age, setAge] = useState<AgeId | null>(null);
  const [place, setPlace] = useState<PlaceId | null>(null);
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  const a = AGES.find((x) => x.id === age);
  const p = place ? PLACES[place] : null;

  let message = "Hi RAD Academy, I’d like to know more about coding and robotics for my child.";
  if (a && p) message = `Hi RAD Academy, my child is ${a.phrase} and we’re ${p.where}. I’m interested in ${p.ask}. Could you tell me more?`;
  else if (a) message = `Hi RAD Academy, my child is ${a.phrase}. I’d like to know more about coding and robotics for them.`;
  else if (p) message = `Hi RAD Academy, I’m interested in ${p.ask} for my child. Could you tell me more?`;

  const edge =
    age === "u8" ? "Starting younger? We tailor a starting point for younger children, so just mention it." :
    age === "o16" ? "For older teens we tailor the path to what they want to build, so just mention it." : "";

  const display = formatNumber(waNumber);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`+${waNumber}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.getElementById("home-wa-number");
      const sel = window.getSelection();
      if (el && sel) { const r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); }
    }
  }

  return (
    <div className={`${s.finder} ${s.reveal}`}>
      <fieldset className={s.q}>
        <legend>How old is your child?</legend>
        <div className={s.chips}>
          {AGES.map((x) => (
            <label className={s.chip} key={x.id}>
              <input type="radio" name="age" id={`age-${x.id}`} checked={age === x.id} onChange={() => setAge(x.id)} />
              <span>{x.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={s.q}>
        <legend>Where are you?</legend>
        <div className={s.chips}>
          {(Object.keys(PLACES) as PlaceId[]).map((k) => (
            <label className={s.chip} key={k}>
              <input type="radio" name="where" id={`where-${k}`} checked={place === k} onChange={() => setPlace(k)} />
              <span>{PLACES[k].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <motion.div
        key={`${age}-${place}`}
        className={s.result}
        aria-live="polite"
        initial={age || place ? { scale: reduce ? 1 : 0.97, opacity: 0.5 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <span className={s.resultLbl}>Our suggestion</span>
        <h3 className={s.hMd}>{p ? p.title : a ? "Now, where are you?" : "Choose an age and a place"}</h3>
        <p>{p ? p.body : a ? "Pick Pretoria area or somewhere else." : "We’ll point you to the best place to start."}</p>
        {edge && <p className={s.extra}>{edge}</p>}
      </motion.div>

      <div className={s.send}>
        <div className={s.preview} aria-live="polite"><small>Your message</small>{message}</div>
        <TrackedAnchor
          className={`${s.btn} ${s.btnWa}`}
          href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener"
          event="home_whatsapp_click"
          eventProps={{ source: "finder", age: a ? a.label : null, area: p ? p.label : null }}
        >
          <WhatsAppIcon className={s.icon} />Open in WhatsApp
        </TrackedAnchor>
        <div className={s.alt2}>
          <span>Prefer to save our number?</span>
          <span className={s.num} id="home-wa-number">{display}</span>
          <button className={s.copy} type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
      </div>
    </div>
  );
}
