import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// Fetched once per server process and cached - not per request. If the
// fetch fails (offline, font CDN down) we fall back to the default sans
// font rather than breaking the favicon.
let cachedFont: ArrayBuffer | null | undefined;

async function loadFont(): Promise<ArrayBuffer | null> {
  if (cachedFont !== undefined) return cachedFont;
  try {
    const res = await fetch(
      "https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NShXUdSs.ttf"
    );
    cachedFont = res.ok ? await res.arrayBuffer() : null;
  } catch {
    cachedFont = null;
  }
  return cachedFont;
}

// Dev-only favicon - a distinct, deliberately premium-looking mark so a
// local tab is unmistakable at a glance next to the live site's tab.
// Wired in via next.config.ts's beforeFiles rewrite (dev env only), never
// touches the production icon.png.
export async function GET() {
  const font = await loadFont();

  // Rendered flat and high-contrast on purpose: a favicon is mostly seen
  // at 16-32px in a browser tab, where gradients, glows and soft inset
  // shadows just turn to mush. Solid fill + one crisp border reads clean
  // at every size. Rendered at 128px so downscaling stays sharp.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#141414",
          borderRadius: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 96,
            lineHeight: 1,
            fontFamily: font ? "PJS" : "sans-serif",
            fontWeight: 800,
            color: "#ff3b3b",
            transform: "translateY(-3px)",
          }}
        >
          R
        </div>
      </div>
    ),
    {
      width: 128,
      height: 128,
      fonts: font ? [{ name: "PJS", data: font, weight: 800, style: "normal" }] : undefined,
    }
  );
}
