"use client";

interface FormatBadgeProps {
  fileType: string | null;
  className?: string;
}

const FORMAT_INFO: Record<string, { label: string; tooltip: string }> = {
  pdf: {
    label: "PDF",
    tooltip:
      "PDF — fixed page layout, full-text search, zoom always fits your screen. A highlight shows as an approximate marker when you revisit a page, not an exact restore of the original selection. No font-size or theme control - the page's own styling is fixed.",
  },
  epub: {
    label: "EPUB",
    tooltip:
      "EPUB — text reflows to any screen size, adjustable font size and light/sepia/dark theme, full-text search. A highlight is painted exactly where you made it and stays that way when you revisit.",
  },
};

/**
 * Surfaces which engine a book uses, and what that means for highlighting/
 * search/theming, right where you're choosing or reading a book - so the
 * capability difference between formats is visible, not a surprise you hit
 * mid-read.
 */
export default function FormatBadge({ fileType, className = "" }: FormatBadgeProps) {
  const info = fileType ? FORMAT_INFO[fileType] : null;
  if (!info) return null;

  return (
    <span
      title={info.tooltip}
      className={`inline-flex items-center font-data text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 ${
        fileType === "pdf"
          ? "bg-slate-50 text-slate-500 border-slate-200"
          : "bg-brass-50 text-brass-700 border-brass-100"
      } ${className}`}
    >
      {info.label}
    </span>
  );
}
