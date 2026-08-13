"use client";

import { useActionState } from "react";
import { adminLogin } from "@/app/code-the-block/actions";

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(adminLogin, undefined);

  return (
    <form action={formAction} className="mx-auto mt-24 max-w-xs space-y-4 px-4">
      <h1 className="text-center text-lg font-bold text-white">Code the Block — Admin</h1>
      <input
        type="password"
        name="password"
        required
        placeholder="Admin password"
        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-600 focus:border-rad-teal focus:outline-none"
      />
      {state?.error && <p className="text-sm text-rad-red">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-rad-purple px-4 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Checking..." : "Enter"}
      </button>
    </form>
  );
}
