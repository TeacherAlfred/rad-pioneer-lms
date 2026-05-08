export default function DashboardSkeleton({ isPreLaunchLms }: { isPreLaunchLms?: boolean }) {
  return (
    <main className={`min-h-screen relative overflow-hidden text-left bg-[#020617] ${isPreLaunchLms ? '' : 'lg:mr-80'}`}>
      <div className="max-w-4xl lg:max-w-5xl mx-auto p-4 sm:p-6 md:p-12 space-y-8 md:space-y-12 pb-12 md:pb-20">
        
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6 border-b border-white/5 pb-6 md:pb-8">
          <div className="space-y-4">
            <div className="w-24 h-4 bg-slate-800 rounded animate-pulse" />
            <div className="w-64 h-10 md:h-12 bg-slate-800 rounded animate-pulse" />
            <div className="w-40 h-8 bg-slate-800 rounded-xl animate-pulse mt-2" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-20 bg-slate-800/50 rounded-2xl md:rounded-3xl animate-pulse" />
            <div className="w-32 h-20 bg-slate-800/50 rounded-2xl md:rounded-3xl animate-pulse" />
          </div>
        </div>

        {/* Top Widget Skeleton */}
        <div className="w-full h-24 md:h-32 bg-slate-800/50 rounded-2xl md:rounded-3xl animate-pulse" />

        {/* HUD / XP Bar Skeleton */}
        <div className="w-full h-40 bg-slate-800/30 rounded-[32px] md:rounded-[40px] border border-white/5 animate-pulse" />

        {/* Course Card Skeleton */}
        <div className="space-y-6 pt-6">
          <div className="w-48 h-6 bg-slate-800 rounded animate-pulse" />
          <div className="w-full h-[400px] md:h-[300px] bg-slate-800/30 rounded-[32px] md:rounded-[48px] border border-white/5 animate-pulse" />
        </div>
        
      </div>
    </main>
  );
}