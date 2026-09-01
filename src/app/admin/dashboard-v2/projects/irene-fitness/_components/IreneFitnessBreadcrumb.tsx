import Link from "next/link";

// Orientation cue for the 4 Irene Fitness sub-pages (Overview/Votes/
// Responses/Settings) - switching between them lives in the left sidebar's
// hover flyout (ProjectsNavSidebar), which is easy to miss since it's a
// small always-collapsed icon. This makes "which page am I on, and how do I
// get back to the index" visible without hovering anything.
export function IreneFitnessBreadcrumb({ current }: { current: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-400 mb-2">
      <Link href="/admin/dashboard-v2/projects/irene-fitness" className="hover:text-stone-900 transition-colors">
        Irene Fitness
      </Link>
      <span>/</span>
      <span className="text-stone-600">{current}</span>
    </div>
  );
}
