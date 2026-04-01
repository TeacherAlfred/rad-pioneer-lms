import { ShieldCheck, ScrollText } from "lucide-react";

export default function LegalTerminal({ userType }: { userType: 'parent' | 'student' }) {
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-8 max-h-[400px] overflow-y-auto no-scrollbar font-sans">
      <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
        <ShieldCheck className="text-rad-teal" />
        <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">
          Operational_Directives_{userType.toUpperCase()}
        </h3>
      </div>

      <div className="space-y-6 text-slate-400 text-sm leading-relaxed italic">
        {userType === 'parent' ? (
          <>
            <section>
              <h4 className="text-white font-bold uppercase mb-2">Section_01: Financial_Commitment</h4>
              <p>• Access to the RAD Pioneer LMS is subject to account standing.</p>
              <p className="text-yellow-500/80">• [ALERT] Accounts 14 days in arrears will face limited sector access.</p>
              <p className="text-red-500/80">• [CRITICAL] Accounts 30 days in arrears will be downgraded to "Demo Mode".</p>
            </section>
            <section>
              <h4 className="text-white font-bold uppercase mb-2">Section_02: Progress_Tracking</h4>
              <p>Guardians agree to monitor Pioneer progress via the provided dashboard to ensure curriculum mastery.</p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h4 className="text-white font-bold uppercase mb-2">Directive_01: Training_Frequency</h4>
              <p>• Minimum Requirement: Log in and complete 1 Sector task per week.</p>
              <p className="text-rad-blue">• Optimum Growth: 3 sessions per week is recommended for African Giant status.</p>
            </section>
            <section>
              <h4 className="text-white font-bold uppercase mb-2">Directive_02: Code_of_Conduct</h4>
              <p>Your login name is your Pioneer ID. Use it with honor. No system interference or unauthorized sector hopping.</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}