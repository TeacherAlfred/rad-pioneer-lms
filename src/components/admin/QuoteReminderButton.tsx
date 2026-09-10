"use client";

import { useState } from "react";
import { Loader2, MessageCircle, X, ChevronLeft } from "lucide-react";

// Two-step version of DesktopSendButton (src/components/admin/DesktopSendButton.tsx)
// for the Quote Pipeline's "remind them their quote is open" action: pick a
// message template first (today there's only one, but this is built as a
// list so a second one is just another array entry), fill in the one token
// that can't auto-resolve from the quote itself ([event] - a quote's linked
// program name is a reasonable default, not always the right wording), then
// preview/edit the resolved text before it's logged and handed to wa.me.
// Same "log before open" reasoning as DesktopSendButton: a message sent by
// hand through WhatsApp Desktop has no API delivery confirmation, so the
// honest record is "the admin clicked send with this text."

type QuoteTemplate = { id: string; label: string; body: string };

const QUOTE_TEMPLATES: QuoteTemplate[] = [
  {
    id: "open_quote_reminder",
    label: "Open Quote Reminder",
    body: "Hi {{name}}\nJust a reminder - your quote for [event] is still open: [quote_link]\n\nSpots are limited, and only confirmed once payment's received. This is to allow us time to plan and ensure a quality event for all attending.\n\nRegards,\nRAD Academy Team",
  },
];

function resolveTemplate(body: string, vars: { name: string; event: string; quoteLink: string }) {
  return body
    .replace(/\{\{\s*name\s*\}\}/g, vars.name)
    .replace(/\[event\]/g, vars.event.trim() || "[event]")
    .replace(/\[quote_link\]/g, vars.quoteLink);
}

export function QuoteReminderButton({
  leadId,
  phone,
  name,
  defaultEvent,
  quoteLink,
  className,
}: {
  leadId: string;
  phone: string | null | undefined;
  name: string;
  defaultEvent: string;
  quoteLink: string;
  className?: string;
}) {
  const [step, setStep] = useState<"pick" | "preview" | null>(null);
  const [templateId, setTemplateId] = useState(QUOTE_TEMPLATES[0].id);
  const [event, setEvent] = useState(defaultEvent);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // {{name}} reads first name only, matching resolveVariable's convention
  // in src/lib/metaTemplate.ts ("Hi Jane" not "Hi Jane van der Merwe").
  const firstName = (name || "").trim().split(/\s+/)[0] || name || "there";

  function openPicker() {
    setTemplateId(QUOTE_TEMPLATES[0].id);
    setEvent(defaultEvent);
    setError(null);
    setStep("pick");
  }

  function goToPreview() {
    const tmpl = QUOTE_TEMPLATES.find((t) => t.id === templateId) || QUOTE_TEMPLATES[0];
    setText(resolveTemplate(tmpl.body, { name: firstName, event, quoteLink }));
    setStep("preview");
  }

  async function confirmSend() {
    if (!phone) {
      setError("This lead has no phone number on file.");
      return;
    }
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/lead-funnel/sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, phone, body: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log the send");
      const digits = phone.replace(/\D/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`, "_blank", "noopener,noreferrer");
      setStep(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={openPicker}
        title="Send a quote reminder via WhatsApp Desktop"
        className={
          className ||
          "p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all"
        }
      >
        <MessageCircle size={14} />
      </button>

      {step && (
        <div
          className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setStep(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {step === "pick" ? (
              <>
                <div className="flex items-start justify-between px-6 pt-6 pb-1">
                  <div>
                    <h3 className="text-[16px] font-semibold text-slate-900">Send Quote Reminder</h3>
                    <p className="text-[13px] text-slate-400 mt-0.5">
                      To {name}
                      {phone ? ` · +${phone}` : " · no phone on file"}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(null)}
                    className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="px-6 pt-4 pb-5 space-y-3">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                      Message Template
                    </label>
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="w-full mt-1.5 bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400"
                    >
                      {QUOTE_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Event</label>
                    <input
                      value={event}
                      onChange={(e) => setEvent(e.target.value)}
                      placeholder="e.g. the Robotics Day"
                      className="w-full mt-1.5 bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400"
                    />
                  </div>
                  {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
                </div>
                <div className="shrink-0 border-t border-slate-100 px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(null)}
                      className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={goToPreview}
                      disabled={!event.trim()}
                      className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between px-6 pt-6 pb-1">
                  <div>
                    <h3 className="text-[16px] font-semibold text-slate-900">Confirm & Send</h3>
                    <p className="text-[13px] text-slate-400 mt-0.5">
                      +{phone} · opens WhatsApp Desktop, no delivery confirmation possible
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(null)}
                    className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="px-6 pt-4 pb-5 space-y-3">
                  <textarea
                    autoFocus
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 resize-none"
                  />
                  {error && <div className="bg-rose-50 text-rose-600 text-[13px] rounded-xl px-4 py-2.5">{error}</div>}
                </div>
                <div className="shrink-0 border-t border-slate-100 px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep("pick")}
                      className="px-4 py-2.5 rounded-xl text-[14px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150 flex items-center gap-1"
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                    <button
                      onClick={confirmSend}
                      disabled={sending || !text.trim() || !phone}
                      className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-1.5"
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : "Confirm & Open WhatsApp"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
