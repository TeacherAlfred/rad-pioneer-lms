"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Loader2, CheckCircle2, Smartphone } from "lucide-react";
import { getAllLocalProgress, setStoredProgressToken } from "@/lib/tutorialLocalProgress";

type Stage = "idle" | "entering_phone" | "waiting" | "verified" | "expired";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

// The optional "save my progress across devices" affordance (spec S5/S9 -
// never a gate, offered at a pause point). Verification is proof-of-
// possession via WhatsApp click-to-chat rather than a password or SMS OTP
// - see src/lib/tutorialProgress.ts for why. `variant` controls whether
// this renders as the Hub's quiet link or the stronger series-completion
// prompt; the flow underneath is identical either way.
export default function SaveProgressPrompt({ variant = "quiet" }: { variant?: "quiet" | "prominent" }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [phone, setPhone] = useState("");
  const [waLink, setWaLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function startLink() {
    setError(null);
    try {
      const res = await fetch("/api/tutorials/link-phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setWaLink(data.waLink);
      setStage("waiting");
      pollStatus();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function pollStatus() {
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStage("expired");
        return;
      }
      const res = await fetch(`/api/tutorials/link-phone/status?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.verified && data.token) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStoredProgressToken(data.token);
        await pushLocalProgress(data.token);
        setStage("verified");
      }
    }, POLL_INTERVAL_MS);
  }

  async function pushLocalProgress(token: string) {
    const map = getAllLocalProgress();
    await Promise.all(Object.entries(map).map(([tutorialId, p]) =>
      fetch("/api/tutorials/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          tutorialId,
          currentStepOrderIndex: p.currentStepOrderIndex,
          completed: !!p.completedAt,
        }),
      }).catch(() => {})
    ));
  }

  const wrapperClass = variant === "prominent"
    ? "rounded-3xl border border-slate-200 bg-white p-6"
    : "rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4";

  if (stage === "verified") {
    return (
      <div className={`${wrapperClass} flex items-center gap-3`}>
        <CheckCircle2 className="text-rad-green shrink-0" size={20} />
        <p className="text-sm font-bold text-slate-700">Progress saved! Open this page on any device and link the same number to pick up where you left off.</p>
      </div>
    );
  }

  if (stage === "idle") {
    return (
      <button
        onClick={() => setStage("entering_phone")}
        className={`${wrapperClass} w-full flex items-center gap-3 text-left hover:border-slate-400 transition-colors`}
      >
        <Smartphone className="text-slate-400 shrink-0" size={20} />
        <span className="text-sm font-bold text-slate-600">Save my progress across devices</span>
      </button>
    );
  }

  return (
    <div className={wrapperClass}>
      <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
        <Smartphone size={18} className="text-slate-400" /> Save progress across devices
      </p>

      {stage === "entering_phone" && (
        <div className="flex flex-col gap-3">
          <input
            type="tel"
            inputMode="tel"
            placeholder="e.g. 082 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-rad-blue outline-none"
          />
          {error && <p className="text-xs font-bold text-rad-red">{error}</p>}
          <button
            onClick={startLink}
            disabled={phone.trim().length < 9}
            className="w-full bg-rad-blue text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-40"
          >
            Continue on WhatsApp
          </button>
        </div>
      )}

      {stage === "waiting" && waLink && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">Tap below, then hit send from your own WhatsApp. We'll pick it up automatically.</p>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs"
          >
            <MessageCircle size={16} /> Open WhatsApp
          </a>
          <div className="flex items-center gap-2 justify-center text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Waiting for your message...
          </div>
        </div>
      )}

      {stage === "expired" && (
        <p className="text-xs font-bold text-rad-red">That took a while - tap below to try again.</p>
      )}
      {stage === "expired" && (
        <button onClick={() => setStage("entering_phone")} className="mt-2 text-xs font-black uppercase tracking-widest text-rad-blue underline">
          Try again
        </button>
      )}
    </div>
  );
}
