import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";

// The /term-program page's typography, shared with the /events detail page
// so both public program pages read as one family. Loaded once here (a
// "font definitions file", per the next/font docs) rather than re-declared
// per page, which would self-host a second copy of each font.
export const headingFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
export const bodyFont = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
