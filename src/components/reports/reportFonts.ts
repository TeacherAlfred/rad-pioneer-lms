import { Atkinson_Hyperlegible, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';

// Report card typography (spec "Visual design system"): Bricolage Grotesque
// for display, Atkinson Hyperlegible for body (chosen for legibility on
// phones), JetBrains Mono for labels. Loaded once here and exposed as CSS
// variables the ReportCard module reads.
export const reportDisplay = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--rc-display' });
export const reportBody = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--rc-body' });
export const reportMono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--rc-mono' });

export const reportFontVars = `${reportDisplay.variable} ${reportBody.variable} ${reportMono.variable}`;
