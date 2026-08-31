"use client";

import { useEffect, useState } from "react";
import { getAmbientBackground } from "./time-of-day";

/** Recomputes every 5 minutes so a long-open tab drifts with the day instead of freezing at load time. */
export function useAmbientBackground(): string {
  const [color, setColor] = useState(() => getAmbientBackground());

  useEffect(() => {
    const interval = setInterval(() => setColor(getAmbientBackground()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return color;
}
