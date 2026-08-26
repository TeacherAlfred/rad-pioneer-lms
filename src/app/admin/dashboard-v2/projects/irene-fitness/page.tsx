"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MessageCircle, Mail, ArrowLeft } from "lucide-react";
import { DashboardV2Nav } from "../../_components/DashboardV2Nav";

type ChildRow = { grade: string; class: string | null };
type ResponseRow = {
  family_id: string;
  display_name: string;
  whatsapp: string | null;
  email: string | null;
  consent_public_display: boolean;
  consent_updates: boolean;
  consent_marketing: boolean;
  created_at: string;
  children: ChildRow[];
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All Responses" },
  { key: "public_display", label: "Public Display Consent" },
  { key: "updates", label: "Community Updates" },
  { key: "marketing", label: "Marketing Guide" },
  { key: "whatsapp", label: "Has WhatsApp" },
  { key: "email", label: "Has Email" },
];

function matchesFilter(row: ResponseRow, filter: string) {
  switch (filter) {
    case "public_display":
      return row.consent_public_display;
    case "updates":
      return row.consent_updates;
    case "marketing":
      return row.consent_marketing;
    case "whatsapp":
      return !!row.whatsapp;
    case "email":
      return !!row.email;
    default:
      return true;
  }
}

// wa.me / mailto can't attach a file, so these just open the chat or email
// pre-filled with the guide copy - the admin still attaches the actual PDF
// by hand in WhatsApp Business (desktop) or their mail client before sending.
// Gated on consent_marketing: that's the specific opt-in this guide was
// promised under, so it's the only group these actions show up for.
function guideWhatsappMessage(firstName: string) {
  return `Hi ${firstName}! 👋 Thanks for joining the Irene Primary Fitness Community and asking for RAD Academy's free guide on turning screen time into a coding skill. Here it is — let us know if you have any questions! 🚀`;
}
function guideEmailBody(firstName: string) {
  return `Hi ${firstName},\n\nThanks for joining the Irene Primary Fitness Community! As promised, please find attached RAD Academy's free guide on turning screen time into a coding skill.\n\nLet us know if you have any questions.\n\nBest regards,\nThe RAD Academy Team`;
}

function IreneFitnessDetailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = searchParams.get("filter") || "all";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ResponseRow[]>([]);

  useEffect(() => {
    fetch("/admin/api/dashboard-v2/projects")
      .then((r) => r.json())
      .then((data) => setRows(data.irene_fitness?.rows || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => rows.filter((r) => matchesFilter(r, filter)), [rows, filter]);

  function setFilter(key: string) {
    router.push(`/admin/dashboard-v2/projects/irene-fitness?filter=${key}`);
  }

  function sendGuideWhatsapp(row: ResponseRow) {
    const firstName = row.display_name.split(" ")[0];
    const digits = (row.whatsapp || "").replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(guideWhatsappMessage(firstName))}`, "_blank");
  }

  function sendGuideEmail(row: ResponseRow) {
    const firstName = row.display_name.split(" ")[0];
    const subject = "Your RAD Academy Coding & Robotics Guide";
    window.open(`mailto:${row.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(guideEmailBody(firstName))}`, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <DashboardV2Nav />

        <div>
          <Link
            href="/admin/dashboard-v2/projects"
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 mb-3"
          >
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Irene Primary Fitness Community</h1>
          <p className="text-stone-500 text-sm mt-1">
            {filtered.length} of {rows.length} responses shown.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                filter === f.key
                  ? "bg-stone-900 text-white shadow-sm"
                  : "bg-white border border-stone-200 text-stone-500 hover:text-stone-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Family</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Children</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Consent</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Submitted</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Guide</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.family_id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-6 py-4">
                    <p className="font-bold text-stone-800">{row.display_name}</p>
                    <p className="text-[11px] text-stone-400">{row.whatsapp || row.email || "No contact on file"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {row.children.length === 0 && <span className="text-stone-300 text-xs">—</span>}
                      {row.children.map((c, i) => (
                        <span key={i} className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
                          Grade {c.grade}
                          {c.class ? ` ${c.class}` : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {row.consent_public_display && (
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Public</span>
                      )}
                      {row.consent_updates && (
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700">Updates</span>
                      )}
                      {row.consent_marketing && (
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-rose-100 text-rose-700">Marketing</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-500">
                    {new Date(row.created_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    {row.consent_marketing ? (
                      <div className="flex items-center gap-2">
                        {row.whatsapp && (
                          <button
                            onClick={() => sendGuideWhatsapp(row)}
                            title="Send guide via WhatsApp"
                            className="p-2 rounded-xl bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                        {row.email && (
                          <button
                            onClick={() => sendGuideEmail(row)}
                            title="Send guide via email"
                            className="p-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Mail size={16} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-300 text-xs">Not opted in</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400 text-sm">
                    No responses match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function IreneFitnessDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
          <Loader2 className="animate-spin text-stone-300" size={32} />
        </div>
      }
    >
      <IreneFitnessDetailInner />
    </Suspense>
  );
}
