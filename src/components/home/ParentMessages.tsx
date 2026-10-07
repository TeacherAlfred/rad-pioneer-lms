"use client";

import { useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import s from "./home.module.css";

// Real parent WhatsApp messages (public/testimonials/), quoted as sent with
// children's names left out. Swipeable on phones, a 3-up grid from tablet.
type Message = { body: ReactNode; who: string; time: string };

const MESSAGES: Message[] = [
  {
    body: (
      <>
        <p>They are excited and although it was just one session they are both better confident with themselves and it&rsquo;s igniting curiosity in them to know more.</p>
        <p><mark>One lesson has made a huge difference.</mark></p>
      </>
    ),
    who: "Parent of two, after a first session",
    time: "14:35",
  },
  {
    body: (
      <>
        <p>My son had a benchmark test on Thursday. When the teacher asked if they are ready, he responded, &ldquo;I am not worried. I have high-Q.&rdquo;</p>
        <p><mark>My son is participating in class and he was always shy.</mark></p>
      </>
    ),
    who: "A parent, on WhatsApp",
    time: "17:10",
  },
  {
    body: (
      <p>They truly enjoyed the lesson. He <mark>couldn&rsquo;t wait to get home to continue writing a code for a game</mark> he wants to build, as for his sister, super excited she built a traffic light.</p>
    ),
    who: "Parent of two, after a lesson",
    time: "14:40",
  },
];

const GAP = 14;

export default function ParentMessages() {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  function onScroll() {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const atEnd = el.scrollLeft > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setIndex(atEnd ? MESSAGES.length - 1 : Math.round(el.scrollLeft / (first.offsetWidth + GAP)));
  }

  function go(i: number) {
    const el = ref.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 22, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <>
      <div className={s.carousel} ref={ref} onScroll={onScroll} aria-label="More messages from parents">
        {MESSAGES.map((m) => (
          <figure className={s.msg} key={m.time}>
            <div>{m.body}</div>
            <figcaption><span>{m.who}</span><time>{m.time}</time></figcaption>
          </figure>
        ))}
      </div>
      <div className={s.pager} role="group" aria-label="Choose message">
        {MESSAGES.map((m, i) => (
          <button
            key={m.time}
            type="button"
            className={`${s.pagerDot} ${i === index ? s.pagerOn : ""}`}
            aria-label={`Message ${i + 1}`}
            aria-current={i === index}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </>
  );
}
