"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { mergeServerProgress, setStoredProgressToken } from "@/lib/tutorialLocalProgress";

// Resolves a phone-linked progress token on a (possibly new) device -
// mirrors the /consent/[token] and /kiosk/[token] shape. Merges the
// server's saved positions into this device's localStorage (never
// clobbering more recent local progress, see mergeServerProgress) and
// adopts the token here going forward, then drops the visitor at the Hub.
export default function ResumeTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolve() {
      try {
        const res = await fetch(`/api/tutorials/progress?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "This link is invalid or has expired.");
        setStoredProgressToken(token);
        mergeServerProgress(data.progress || []);
        router.replace("/tutorials");
      } catch (err: any) {
        setError(err.message);
      }
    }
    resolve();
  }, [token, router]);

  if (error) {
    return (
      <div className="max-w-sm mx-auto px-5 py-24 text-center flex flex-col items-center gap-3">
        <AlertTriangle className="text-rad-red" size={32} />
        <p className="text-sm font-bold text-slate-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="animate-spin text-rad-blue" size={40} />
    </div>
  );
}
