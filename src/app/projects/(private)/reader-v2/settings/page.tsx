"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getReaderSettings, updateVaultPin } from "../../reader/_actions/settings";
import { useAmbientBackground } from "../_lib/use-ambient-background";

export default function SettingsPage() {
  const ambientBackground = useAmbientBackground();
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getReaderSettings().then((s) => {
      setCurrentPin(s.vaultPin);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!/^\d{4,10}$/.test(newPin)) {
      toast.error("PIN must be 4-10 digits.");
      return;
    }
    setIsSaving(true);
    try {
      await updateVaultPin(newPin);
      setCurrentPin(newPin);
      setNewPin("");
      toast.success("PIN updated.");
    } catch (error) {
      console.error("Failed to update PIN", error);
      toast.error(error instanceof Error ? error.message : "Failed to update PIN.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-[3000ms]" style={{ backgroundColor: ambientBackground }}>
      <header className="max-w-2xl mx-auto px-8 pt-10 pb-6 flex items-center gap-4">
        <Link href="/projects/reader-v2" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </Link>
        <span className="font-display italic text-2xl text-slate-900 tracking-tight">Settings</span>
      </header>

      <main className="max-w-2xl mx-auto px-8 pb-24">
        <section className="bg-white border border-slate-200 rounded-[20px] shadow-sm p-8">
          <p className="font-data text-[10px] uppercase tracking-[0.2em] text-brass-600 mb-2">Private Collection</p>
          <h2 className="font-display italic text-2xl text-slate-900 mb-2">Vault PIN</h2>
          <p className="font-precision text-sm text-slate-500 mb-8 leading-relaxed">
            The digit sequence you type anywhere on the library home to open your private collection. Shared between
            this reader and the original dashboard — changing it here updates both.
          </p>

          {loading ? (
            <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <div className="space-y-6">
              <div>
                <label className="font-data text-[10px] uppercase tracking-widest text-slate-400 block mb-2">
                  Current PIN
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-precision text-lg text-slate-900 tracking-[0.3em] bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex-1">
                    {revealed ? currentPin : "•".repeat(currentPin.length)}
                  </span>
                  <button
                    onClick={() => setRevealed((v) => !v)}
                    className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title={revealed ? "Hide" : "Reveal"}
                  >
                    {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-data text-[10px] uppercase tracking-widest text-slate-400 block mb-2">
                  New PIN
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="4-10 digits"
                  className="w-full font-precision text-lg tracking-[0.3em] bg-white border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-brass-200 focus:border-brass-400 transition-all"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving || newPin.length < 4}
                className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Save PIN"}
              </button>
            </div>
          )}
        </section>

        <p className="font-precision text-xs text-slate-400 text-center mt-8">
          More settings will land here over time.
        </p>
      </main>
    </div>
  );
}
