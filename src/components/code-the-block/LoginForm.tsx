"use client";

import { useActionState } from "react";
import { loginStudent } from "@/app/code-the-block/actions";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginStudent, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="firstName">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            autoComplete="off"
            placeholder="Alex"
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-600 focus:border-rad-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="lastInitial">
            Last initial
          </label>
          <input
            id="lastInitial"
            name="lastInitial"
            required
            maxLength={1}
            autoComplete="off"
            placeholder="K"
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-600 focus:border-rad-teal focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="workshopCode">
          Workshop code
        </label>
        <input
          id="workshopCode"
          name="workshopCode"
          required
          autoComplete="off"
          placeholder="Ask your facilitator"
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 uppercase text-white placeholder:normal-case placeholder:text-slate-600 focus:border-rad-teal focus:outline-none"
        />
      </div>

      {state?.error && <p className="text-sm text-rad-red">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-rad-teal px-4 py-2.5 font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "One sec..." : "Start Coding →"}
      </button>
    </form>
  );
}
