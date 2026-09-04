'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, MessageCircle, ChevronDown } from 'lucide-react';
import { BottomSheetModal } from './BottomSheetModal';

type Panel = 'none' | 'faq' | 'contact' | 'optout';
type FaqItem = {
  id: string;
  question: string;
  answer: string;
  link_url: string | null;
  link_label: string | null;
};

// Lets a sibling component (community/page.tsx's "New here?" tour prompt,
// which lives in a different file/route entirely - HeaderActions is
// rendered by the shared layout, not the page) open the FAQ to a specific
// question without prop-drilling through the layout or introducing a
// context provider for one cross-component call.
export const OPEN_FAQ_EVENT = 'irene-fitness:open-faq';
export function openIreneFitnessFaq(question?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_FAQ_EVENT, { detail: { question } }));
}

// Same idea again: the feed's micro-ad cards (community/page.tsx) need to
// open the "Ask us" contact form pre-filled with ad-specific interest text -
// no separate webinar page or modal, just the existing Contact flow. title/
// intro let a specific entry point (e.g. "Register for the Free Webinar")
// replace the generic "Ask us" framing so the popup actually talks to what
// was tapped, instead of every entry point reading like a stray question.
export const OPEN_CONTACT_EVENT = 'irene-fitness:open-contact';
export function openIreneFitnessContact(prefillMessage?: string, options?: { title?: string; intro?: string }) {
  window.dispatchEvent(
    new CustomEvent(OPEN_CONTACT_EVENT, {
      detail: { prefillMessage, title: options?.title, intro: options?.intro },
    })
  );
}

// Same idea, the other direction: the FAQ's "Replay the guide" link needs to
// start the tour that lives in community/page.tsx. Not a real URL - a
// sentinel link_url value (see REPLAY_TOUR_LINK below) tells FaqAccordion to
// dispatch this instead of rendering a plain <a>, so replaying happens
// in-page (closes the FAQ, starts the tour immediately) instead of a full
// navigation that used to open in a new tab and leave the FAQ modal open
// behind it.
export const START_TOUR_EVENT = 'irene-fitness:start-tour';
export const REPLAY_TOUR_LINK = 'irene-fitness://replay-tour';
function startIreneFitnessTour() {
  window.dispatchEvent(new CustomEvent(START_TOUR_EVENT));
}

const ICON_BTN_CLS =
  'w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0';
const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40';
const LABEL_CLS = 'block text-xs font-bold text-slate-700 mb-1';
const PRIMARY_BTN_CLS =
  'w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-[#0066cc] text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors';

// Admin-editable question/answer content, fetched from /api/irene-fitness/faq
// (source: irene_fitness_faq_items). "Opt out" below is deliberately NOT one
// of these items - it's a fixed line in the modal shell itself, so it can
// never be edited or archived away by mistake.
function FaqAccordion({
  items,
  initialOpenQuestion,
  onOpenPanel,
}: {
  items: FaqItem[];
  initialOpenQuestion?: string;
  onOpenPanel: (p: Panel) => void;
}) {
  // Lazy initializer, not an effect: this component fully remounts each time
  // the FAQ modal opens (it's conditionally rendered in HeaderActions), so
  // items/initialOpenQuestion are already current at that moment - no need
  // to sync after the fact.
  const [openIndex, setOpenIndex] = useState<number | null>(() => {
    if (!initialOpenQuestion) return null;
    const i = items.findIndex((it) => it.question === initialOpenQuestion);
    return i >= 0 ? i : null;
  });

  return (
    <div>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.id} className="border-b border-black/5 last:border-0">
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full flex items-center justify-between gap-3 py-4 text-left"
            >
              <span className="text-sm font-bold text-slate-800">{item.question}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && (
              <div className="pb-4 -mt-1">
                <p className="text-sm text-slate-600 leading-relaxed">{item.answer}</p>
                {item.link_url === REPLAY_TOUR_LINK ? (
                  <button
                    onClick={() => {
                      startIreneFitnessTour();
                      onOpenPanel('none');
                    }}
                    className="mt-2 text-xs font-bold text-[#0066cc] hover:underline"
                  >
                    {item.link_label || 'Replay the guide'}
                  </button>
                ) : (
                  item.link_url && (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-bold text-[#0066cc] hover:underline"
                    >
                      {item.link_label || item.link_url}
                    </a>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-5 mt-2 border-t border-black/5 text-center">
        <p className="text-xs text-slate-500 mb-2">
          Want your family&apos;s entry off the public feed?{' '}
          <button onClick={() => onOpenPanel('optout')} className="font-bold text-[#0066cc] hover:underline">
            Opt out
          </button>
        </p>
        <p className="text-xs text-slate-400 mt-4 mb-2">Still stuck?</p>
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

const DEFAULT_CONTACT_INTRO = "Not a live chat — drop your question here and we'll reply within 24 hours.";

function ContactForm({ prefillMessage, intro }: { prefillMessage?: string; intro?: string }) {
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
      <p className="text-sm text-slate-500 mb-4">{intro || DEFAULT_CONTACT_INTRO}</p>
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
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [contactPrefill, setContactPrefill] = useState<string | undefined>(undefined);
  const [contactTitle, setContactTitle] = useState<string>('Ask us');
  const [contactIntro, setContactIntro] = useState<string | undefined>(undefined);
  const [faqQuestion, setFaqQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch('/api/irene-fitness/faq')
      .then((r) => r.json())
      .then((d) => setFaqItems(d.items || []))
      .catch(() => {});
  }, []);

  function openContact(prefill?: string, title?: string, intro?: string) {
    setContactPrefill(prefill);
    setContactTitle(title || 'Ask us');
    setContactIntro(intro);
    setPanel('contact');
  }

  useEffect(() => {
    function onOpenFaq(e: Event) {
      setFaqQuestion((e as CustomEvent<{ question?: string }>).detail?.question);
      setPanel('faq');
    }
    window.addEventListener(OPEN_FAQ_EVENT, onOpenFaq);
    return () => window.removeEventListener(OPEN_FAQ_EVENT, onOpenFaq);
  }, []);

  useEffect(() => {
    function onOpenContact(e: Event) {
      const detail = (e as CustomEvent<{ prefillMessage?: string; title?: string; intro?: string }>).detail;
      openContact(detail?.prefillMessage, detail?.title, detail?.intro);
    }
    window.addEventListener(OPEN_CONTACT_EVENT, onOpenContact);
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, onOpenContact);
  }, []);

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
          <FaqAccordion
            items={faqItems}
            initialOpenQuestion={faqQuestion}
            onOpenPanel={(p) => (p === 'contact' ? openContact(undefined) : setPanel(p))}
          />
        </BottomSheetModal>
      )}

      {panel === 'contact' && (
        <BottomSheetModal title={contactTitle} onClose={() => setPanel('none')}>
          <ContactForm prefillMessage={contactPrefill} intro={contactIntro} />
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
