import { Shield, Video, MapPin } from "lucide-react";

export default function NextMissionWidget({ nextLiveSession, teacher }: any) {
  if (!nextLiveSession) return null;

  return (
    <div className="flex flex-col xl:flex-row gap-4 mb-8">
      {/* LEFT: NEXT LESSON CARD (High-Contrast Amber/Gold) */}
      <div className="flex-1 relative overflow-hidden bg-amber-950/40 border border-amber-500/50 hover:border-amber-400 transition-all rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 group shadow-[0_0_40px_rgba(245,158,11,0.25)]">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 via-orange-500/10 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative flex h-4 w-4 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,1)]"></span>
          </div>
          
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 mb-1 drop-shadow-md">Your Next Lesson</p>
            <p className="text-lg md:text-2xl font-black text-white tracking-tight">
            {new Date(nextLiveSession.date).toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'short' 
            })} 
            <span className="text-amber-500/50 mx-2">-</span> 
            <span className="text-amber-100">
                {new Date(nextLiveSession.date).toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
                })}
            </span>
            </p>
          </div>
        </div>

        <div className="relative z-10 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          {nextLiveSession.type === 'in-person' ? (
            <div className="flex w-full sm:w-auto items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-6 py-3 md:py-4 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <MapPin size={16} className="shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest">{nextLiveSession.location}</span>
            </div>
          ) : nextLiveSession.link ? (
            <a href={nextLiveSession.link} target="_blank" rel="noopener noreferrer" className="flex w-full sm:w-auto items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-8 py-3 md:py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 border border-amber-300">
              <Video size={18} className="shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest">Join Lesson</span>
            </a>
          ) : (
            <div className="flex w-full sm:w-auto items-center justify-center gap-2 bg-black/40 border border-amber-500/30 text-amber-500/70 px-6 py-3 md:py-4 rounded-xl cursor-not-allowed">
              <Video size={16} className="shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest">Link Pending</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: TEACHER CARD (Simplified for the top row) */}
      {teacher && (
        <div className="xl:w-1/4 shrink-0 bg-purple-500/10 border border-purple-500/20 rounded-2xl md:rounded-3xl p-5 flex flex-col justify-center gap-2 relative overflow-hidden">
          <Shield size={64} className="absolute -right-4 -bottom-4 text-purple-500/10 -rotate-12" />
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 mb-1 flex items-center gap-1.5">
              <Shield size={12}/> Your Teacher
            </p>
            <p className="text-lg font-bold text-white truncate">{teacher.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}