import { redirect } from "next/navigation";
import { getCurrentStudent, getCompletedStepIds } from "@/lib/code-the-block/session";
import { MODULES, QUICK_REFERENCE, REMEMBER } from "@/lib/code-the-block/content/code-the-block";
import { WorkbookApp } from "@/components/code-the-block/WorkbookApp";

export default async function WorkbookPage() {
  const student = await getCurrentStudent();
  if (!student) {
    redirect("/code-the-block");
  }

  const completed = await getCompletedStepIds(student.id);

  return (
    <div className="bg-slate-950">
      <WorkbookApp
        modules={MODULES}
        studentName={`${student.firstName} ${student.lastInitial}.`}
        initialCompleted={Array.from(completed)}
        initialNeedsHelp={student.needsHelp}
      />

      <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6 lg:pl-24">
        <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            📋 Quick Reference — Coding Concepts
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4">Concept</th>
                  <th className="py-2 pr-4">What it means</th>
                  <th className="py-2">Example</th>
                </tr>
              </thead>
              <tbody>
                {QUICK_REFERENCE.map((row) => (
                  <tr key={row.concept} className="border-b border-slate-800/60 text-slate-300">
                    <td className="py-2 pr-4 font-semibold text-white">{row.concept}</td>
                    <td className="py-2 pr-4">{row.meaning}</td>
                    <td className="py-2 font-mono text-xs text-rad-teal">{row.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-400">{REMEMBER}</p>
        </details>
      </div>
    </div>
  );
}
