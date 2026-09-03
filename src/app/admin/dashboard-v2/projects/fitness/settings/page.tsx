"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RefreshCw, Unplug } from "lucide-react";
import { DashboardV2Nav } from "../../../_components/DashboardV2Nav";
import { FitnessBreadcrumb } from "../_components/FitnessBreadcrumb";

type Status = { connected: boolean; athlete_id: string | null; connected_at: string | null; last_synced_at: string | null };
type SyncResult = {
  ok?: boolean;
  error?: string;
  warning?: string;
  activities_synced?: number;
  gear_refreshed?: number;
  details_fetched?: number;
  signals_parsed?: number;
  best_efforts_synced?: number;
  backfilled?: number;
  backfill_remaining?: number;
};

function FitnessSettingsInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  function load() {
    setLoading(true);
    fetch("/admin/api/dashboard-v2/projects/fitness/strava")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/admin/api/dashboard-v2/projects/fitness/strava/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      load();
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Strava? You'll need to reconnect to sync again.")) return;
    await fetch("/admin/api/dashboard-v2/projects/fitness/strava", { method: "DELETE" });
    load();
  }

  const connectError = searchParams.get("error");
  const justConnected = searchParams.get("connected") === "1";

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-2xl mx-auto space-y-10">
        <DashboardV2Nav />

        <div>
          <Link href="/admin/dashboard-v2/projects" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3">
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <FitnessBreadcrumb current="Settings" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Settings</h1>
        </div>

        {connectError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-sm text-rose-800">{connectError}</div>
        )}
        {justConnected && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-sm text-emerald-800">
            Strava connected. Hit Sync Now below to pull in your activities.
          </div>
        )}

        {loading || !status ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-stone-300" size={24} />
          </div>
        ) : (
          <section className="bg-white border border-stone-200 rounded-[24px] p-6 space-y-5">
            {status.connected ? (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Strava Athlete</p>
                    <p className="font-bold text-stone-800 mt-0.5">{status.athlete_id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Connected</p>
                    <p className="font-bold text-stone-800 mt-0.5">{status.connected_at ? new Date(status.connected_at).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Last Synced</p>
                    <p className="font-bold text-stone-800 mt-0.5">{status.last_synced_at ? new Date(status.last_synced_at).toLocaleString() : "Never"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={syncNow}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Syncing…" : "Sync Now"}
                  </button>
                  <button onClick={disconnect} className="inline-flex items-center gap-2 text-sm font-bold text-stone-400 hover:text-rose-600 transition-colors">
                    <Unplug size={14} />
                    Disconnect
                  </button>
                </div>

                {syncResult && (
                  <div className={`rounded-2xl px-5 py-4 text-sm ${syncResult.error ? "bg-rose-50 text-rose-800" : "bg-stone-50 text-stone-700"}`}>
                    {syncResult.error ? (
                      syncResult.error
                    ) : (
                      <>
                        Synced {syncResult.activities_synced} activities · refreshed {syncResult.gear_refreshed} gear ·{" "}
                        parsed {syncResult.signals_parsed} training-load signals · found {syncResult.best_efforts_synced} best efforts.
                        {(syncResult.backfilled ?? 0) > 0 && (
                          <p className="mt-1">
                            Backfilled race data on {syncResult.backfilled} older activities
                            {(syncResult.backfill_remaining ?? 0) > 0 ? ` — ${syncResult.backfill_remaining} still to go, click Sync Now again.` : " — all caught up."}
                          </p>
                        )}
                        {syncResult.warning && <p className="mt-1 text-amber-700">{syncResult.warning}</p>}
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-stone-500 text-sm mb-5">Connect your Strava account to start syncing activities, gear, and training-load data.</p>
                <a
                  href="/admin/api/dashboard-v2/projects/fitness/strava/authorize"
                  className="inline-flex items-center gap-2 bg-[#FC4C02] text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-[#e34500] transition-colors"
                >
                  Connect Strava
                </a>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default function FitnessSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
          <Loader2 className="animate-spin text-stone-300" size={32} />
        </div>
      }
    >
      <FitnessSettingsInner />
    </Suspense>
  );
}
