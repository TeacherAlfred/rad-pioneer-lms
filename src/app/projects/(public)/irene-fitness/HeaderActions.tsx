'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, MessageCircle, ChevronDown } from 'lucide-react';
import { BottomSheetModal } from './BottomSheetModal';

type Settings = { results_announcement_date: string | null; submissions_open: boolean };
type Panel = 'none' | 'faq' | 'contact' | 'optout';

const ICON_BTN_CLS =
  'w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0';
const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40';
const LABEL_CLS = 'block text-xs font-bold text-slate-700 mb-1';
const PRIMARY_BTN_CLS =
  'w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors';

type FaqItem = { q: string; a: React.ReactNode; action?: { label: string; panel: Panel } };

function faqItems(settings: Settings | null): FaqItem[] {
  return [
    {
      q: 'Who can vote, and how many times a day?',
      a: "Anyone can — no account or sign-in needed. You can vote once per category, per entry, per day. It resets every night, so you can vote for your favourites again tomorrow.",
    },
    {
      q: 'Is my vote actually anonymous?',
      a: "Yes. We don't ask who's voting — just enough to stop the same device voting twice on the same entry on the same day.",
    },
    {
      q: 'Can I still submit my own story, or has that closed?',
      a:
        settings?.submissions_open === false
          ? 'Submissions have closed for this round.'
          : 'Yes — submissions are still open. Head back to the start of this page to add or update your family\'s entry.',
    },
    {
      q: 'When are winners announced?',
      a: settings?.results_announcement_date
        ? `${settings.results_announcement_date}. We'll also post it here and via WhatsApp.`
        : "We'll confirm a date soon and share it here and via WhatsApp.",
    },
    {
      q: "What happens to my child's information, and can I opt out?",
      a: (
        <>
          We never show your child&apos;s name, grade, or class publicly — we only use grade/class privately to work
          out the class prize. You can opt out any time.
        </>
      ),
      action: { label: 'Remove my family from the public feed', panel: 'optout' as const },
    },
    {
      q: "Who's actually running this — is it the school or RAD Academy?",
      a: 'RAD Academy developed, hosts, and runs this platform on behalf of, and at no cost to, Irene Primary School — our way of giving back to the Irene Primary community.',
    },
    {
      q: "My entry or vote isn't showing — who do I contact?",
      a: "Message us and we'll sort it out, usually within 24 hours.",
      action: { label: 'Ask us', panel: 'contact' as const },
    },
  ];
}

function FaqAccordion({ settings, onOpenPanel }: { settings: Settings | null; onOpenPanel: (p: Panel) => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = faqItems(settings);
  return (
    <div>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i} className="border-b border-black/5 last:border-0">
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full flex items-center justify-between gap-3 py-4 text-left"
            >
              <span className="text-sm font-bold text-slate-800">{item.q}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && (
              <div className="pb-4 -mt-1">
                <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
                {item.action && (
                  <button
                    onClick={() => onOpenPanel(item.action!.panel)}
                    className="mt-2 text-xs font-bold text-[#0066cc] hover:underline"
                  >
                    {item.action.label}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-5 text-center">
        <p className="text-xs text-slate-400 mb-2">Still stuck?</p>
        <button
          onClick={() => onOpenPanel('contact')}
          className="px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-slate-900 text-white"
        >
          Ask us
        </button>
      </div>
    </div>
  );
}

function ContactForm({ prefillMessage }: { prefillMessage?: string }) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState(prefillMessage || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = name.trim().length > 0 && contact.trim().length > 0 && message.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/irene-fitness/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), channel, contact: contact.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center text-2xl mx-auto mb-4">
          ✓
        </div>
        <p className="font-black text-lg mb-2">Thanks, {name.trim()}!</p>
        <p className="text-sm text-slate-600">We&apos;ll reply within 24 hours.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Not a live chat — drop your question here and we&apos;ll reply within 24 hours.
      </p>
      <label className={LABEL_CLS}>Your name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Sarah"
        className={`${INPUT_CLS} mb-3`}
      />
      <label className={LABEL_CLS}>How should we reply?</label>
      <div className="flex gap-2 mb-3">
        {(['whatsapp', 'email'] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setChannel(ch)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
              channel === ch ? 'bg-[#0066cc] text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
          </button>
        ))}
      </div>
      <input
        type={channel === 'email' ? 'email' : 'tel'}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder={channel === 'whatsapp' ? 'e.g. 082 123 4567' : 'you@example.com'}
        className={`${INPUT_CLS} mb-3`}
      />
      <label className={LABEL_CLS}>Your question</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="What's up?"
        className={`${INPUT_CLS} mb-3`}
      />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button disabled={!canSubmit || submitting} onClick={handleSubmit} className={PRIMARY_BTN_CLS}>
        {submitting ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}

function OptOutForm({ onRequestDeletion }: { onRequestDeletion: () => void }) {
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ found: boolean; display_name?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!contact.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/irene-fitness/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contact.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.found) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center text-2xl mx-auto mb-4">
          ✓
        </div>
        <p className="font-black text-lg mb-2">You&apos;re out{result.display_name ? `, ${result.display_name}` : ''}.</p>
        <p className="text-sm text-slate-600">
          Your entry no longer appears on the public feed or in voting. This doesn&apos;t affect any votes you&apos;ve
          cast on other entries.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Enter the WhatsApp number or email you used when you signed up — we&apos;ll stop showing your family&apos;s
        entry publicly right away.
      </p>
      <label className={LABEL_CLS}>WhatsApp number or email</label>
      <input
        type="text"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="e.g. 082 123 4567 or you@example.com"
        className={`${INPUT_CLS} mb-3`}
      />
      {result && !result.found && (
        <p className="text-sm text-amber-600 mb-3">
          We couldn&apos;t find an entry with that contact info — try the one you used when you signed up.
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button disabled={!contact.trim() || submitting} onClick={handleSubmit} className={`${PRIMARY_BTN_CLS} mb-4`}>
        {submitting ? 'Checking…' : 'Remove my family'}
      </button>
      <button onClick={onRequestDeletion} className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600">
        Want it permanently deleted instead? Message us
      </button>
    </div>
  );
}

export function HeaderActions() {
  const [panel, setPanel] = useState<Panel>('none');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [contactPrefill, setContactPrefill] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch('/api/irene-fitness/settings')
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(() => {});
  }, []);

  function openContact(prefill?: string) {
    setContactPrefill(prefill);
    setPanel('contact');
  }

  return (
    <>
      <button onClick={() => setPanel('faq')} aria-label="Frequently asked questions" className={ICON_BTN_CLS}>
        <HelpCircle size={18} />
      </button>
      <button onClick={() => openContact(undefined)} aria-label="Ask us a question" className={ICON_BTN_CLS}>
        <MessageCircle size={18} />
      </button>

      {panel === 'faq' && (
        <BottomSheetModal title="Frequently asked questions" onClose={() => setPanel('none')}>
          <FaqAccordion settings={settings} onOpenPanel={(p) => (p === 'contact' ? openContact(undefined) : setPanel(p))} />
        </BottomSheetModal>
      )}

      {panel === 'contact' && (
        <BottomSheetModal title="Ask us" onClose={() => setPanel('none')}>
          <ContactForm prefillMessage={contactPrefill} />
        </BottomSheetModal>
      )}

      {panel === 'optout' && (
        <BottomSheetModal title="Opt out" onClose={() => setPanel('none')}>
          <OptOutForm
            onRequestDeletion={() =>
              openContact("Please permanently delete our family's data from the Fit Fam platform.")
            }
          />
        </BottomSheetModal>
      )}
    </>
  );
}
