// "The room reads the light," grounded: no browser reliably exposes real
// ambient light, so this is time-of-day based instead - smoothly
// interpolated between anchor colors rather than hard-switching at a clock
// boundary, so there's no jarring flip at (say) exactly 6:00pm. Deliberately
// stays within the light palette at every hour - night is a deep warm tone,
// never actually dark - since going dark automatically would silently
// reverse the earlier decision to keep this reader light-themed.

type RGB = [number, number, number];

const ANCHORS: [hour: number, color: RGB][] = [
  [0, [238, 224, 196]], // midnight - deep warm
  [6, [247, 244, 238]], // dawn - cool paper
  [12, [250, 247, 241]], // midday - bright neutral (the original static bg)
  [18, [245, 235, 214]], // dusk - warm
  [24, [238, 224, 196]], // wraps back to midnight's tone
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getAmbientBackground(date: Date = new Date()): string {
  const hourFloat = date.getHours() + date.getMinutes() / 60;

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [h1, c1] = ANCHORS[i];
    const [h2, c2] = ANCHORS[i + 1];
    if (hourFloat >= h1 && hourFloat <= h2) {
      const t = (hourFloat - h1) / (h2 - h1);
      const r = Math.round(lerp(c1[0], c2[0], t));
      const g = Math.round(lerp(c1[1], c2[1], t));
      const b = Math.round(lerp(c1[2], c2[2], t));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return `rgb(${ANCHORS[0][1].join(", ")})`;
}

/** Never auto-selects Dark - that stays an explicit choice via the reader's own theme cycle button. */
export function getAmbientEpubTheme(date: Date = new Date()): "light" | "sepia" {
  const hour = date.getHours();
  return hour >= 7 && hour < 18 ? "light" : "sepia";
}
