import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Sparkles, Rocket, PlayCircle } from "lucide-react";

interface VaultUpsellProps {
  isEnrolled: boolean;
  isTrial: boolean;
  kidsNames: string;
}

export default function VaultUpsell({ isEnrolled, isTrial, kidsNames }: VaultUpsellProps) {
  const router = useRouter();

  return (
    <div className="relative mt-8 max-w-2xl mx-auto w-full">
      {/* Elegant Light Mode Card */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 md:p-12 shadow-[0_20px_40px_rgba(0,0,0,0.04)] text-center relative overflow-hidden">
        
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {isEnrolled || isTrial ? (
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
              <Lock className="text-slate-400" size={24} />
            </div>
          ) : (
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
              <Sparkles className="text-emerald-500" size={24} />
            </div>
          )}

          {isEnrolled ? (
            <div className="space-y-6">
              <h3 className="text-3xl font-light tracking-tight text-slate-900">
                Full Archive <span className="italic font-serif text-slate-500">Locked</span>
              </h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                Log in to your Guardian Dashboard to view all historical photos, download them, and track {kidsNames}'s lesson progress.
              </p>
              <button onClick={() => router.push('/login')} className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 hover:-translate-y-1 mx-auto mt-4">
                Access Your Dashboard <ArrowRight size={14} />
              </button>
            </div>
          ) : isTrial ? (
            <div className="space-y-6">
              <h3 className="text-3xl font-light tracking-tight text-slate-900">
                Unlock Your <span className="italic font-serif text-slate-500">Pipeline</span>
              </h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                Your 14-Day Free Trial is active! Log in to view the rest of {kidsNames}'s digital portfolio and start conquering the premium robotics modules.
              </p>
              <button onClick={() => router.push('/login')} className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 hover:-translate-y-1 mx-auto mt-4">
                Enter Trial Platform <Rocket size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-3xl md:text-4xl font-light tracking-tight text-slate-900">
                Turn Screen Time Into <br/> <span className="italic font-serif text-emerald-600">A Superpower</span>
              </h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                Don't let {kidsNames}'s momentum stop here. Secure their spot in our Premium LMS to build real-world IoT systems, earn XP, and unlock their entire digital portfolio.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-6 justify-center">
                <button onClick={() => router.push('/start')} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 hover:-translate-y-1">
                  Claim 14-Day Free Trial
                </button>
                <button onClick={() => window.open('https://radacademy.co.za', '_blank')} className="px-8 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 hover:-translate-y-1">
                  Learn More <PlayCircle size={14}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}