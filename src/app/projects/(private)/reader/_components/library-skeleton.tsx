export default function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="rounded-[20px] overflow-hidden border border-slate-200 aspect-[2/3] bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}
