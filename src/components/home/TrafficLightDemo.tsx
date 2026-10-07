"use client";

import { Fragment, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import s from "./home.module.css";

// A real first-session build: a traffic light from Cubroid blocks, coded
// with block code. The lamp and the code blocks that drive it light up
// together. The block wording illustrates the idea; it is not a copy of
// the Cubroid app.
const STEPS = [
  { lamp: s.lampRed, colour: "var(--red)", wait: 3, hold: 1800 },
  { lamp: s.lampAmber, colour: "var(--amber)", wait: 1, hold: 700 },
  { lamp: s.lampGreen, colour: "var(--green)", wait: 3, hold: 1800 },
];

export default function TrafficLightDemo() {
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setStep((step + 1) % STEPS.length), STEPS[step].hold);
    return () => clearTimeout(t);
  }, [step, reduce]);

  return (
    <div className={`${s.demo} ${s.rise} ${s.d4}`} aria-label="Example first-session project: a traffic light built with Cubroid blocks">
      <div className={s.demoHead}>
        <b>A first-session build</b>
        <span>Cubroid blocks · block coding</span>
      </div>
      <div className={s.demoBody}>
        <div className={s.light} aria-hidden="true">
          {STEPS.map((x, i) => <div key={i} className={`${s.lamp} ${i === step ? x.lamp : ""}`} />)}
        </div>
        <div
          className={s.script}
          role="img"
          aria-label="Block code: when started, repeat forever: LED red, wait 3 seconds, LED amber, wait 1 second, LED green, wait 3 seconds"
        >
          <span className={`${s.blk} ${s.blkEvent}`}>when started</span>
          <div className={s.loop}>
            <span>repeat forever</span>
            <div className={s.loopInner}>
              {STEPS.map((x, i) => (
                <Fragment key={i}>
                  <span className={`${s.blk} ${s.blkLed} ${i === step ? s.blkHi : ""}`}>
                    LED colour <span className={s.dot} style={{ background: x.colour }} />
                  </span>
                  <span className={`${s.blk} ${s.blkWait} ${i === step ? s.blkHi : ""}`}>
                    wait <span className={s.val}>{x.wait}</span> sec
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className={s.demoFoot}>
        Snap the Cubroid blocks together, drag the code into order. A parent afterwards: <q>super excited she built a traffic light.</q>
      </p>
    </div>
  );
}
