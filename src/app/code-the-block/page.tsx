import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/code-the-block/session";
import { WORKSHOP_TAGLINE, HOW_IT_WORKS } from "@/lib/code-the-block/content/code-the-block";
import { LoginForm } from "@/components/code-the-block/LoginForm";

export default async function CodeTheBlockLoginPage() {
  const student = await getCurrentStudent();
  if (student) {
    redirect("/code-the-block/workbook");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-white">⛏️ Code the Block</h1>
          <p className="mt-2 text-sm text-slate-400">{WORKSHOP_TAGLINE}</p>
        </div>

        <div className="mb-6 rounded-xl border border-rad-yellow/30 bg-rad-yellow/10 p-4 text-sm text-slate-300">
          {HOW_IT_WORKS}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
