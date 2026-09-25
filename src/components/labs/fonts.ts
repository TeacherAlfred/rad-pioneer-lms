import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

// Lab typography (same pairing as /term-program). Exposed as CSS variables
// consumed by rad-lab.module.css, shared by the public page and the editor.
export const headingFont = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-head' });
export const bodyFont = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-body' });
export const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });
export const labFontVars = `${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`;
