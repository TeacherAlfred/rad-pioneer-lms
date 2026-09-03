import Link from "next/link";

// Orientation cue for the 4 Personal Fitness sub-pages (Overview/Log/Gear/
// Settings) - switching between them lives in the left sidebar's hover
// flyout (ProjectsNavSidebar), same as Irene Fitness's IreneFitnessBreadcrumb.
export function FitnessBreadcrumb({ current }: { current: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-400 mb-2">
      <Link href="/admin/dashboard-v2/projects/fitness" className="hover:text-stone-900 transition-colors">
        Personal Fitness
      </Link>
      <span>/</span>
      <span className="text-stone-600">{current}</span>
    </div>
  );
}
