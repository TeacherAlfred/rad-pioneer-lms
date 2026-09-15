"use client";

import { useEffect, useState } from "react";
import { Heart, X, Sparkles, ChevronRight, Lightbulb, Check } from "lucide-react";
import {
  getOrCreateVoterId,
  getStoredVoterPhone,
  setStoredVoterPhone,
  hasBeenPromptedForPhone,
  markPromptedForPhone,
} from "@/lib/tutorialTopicVoter";

type Topic = { id: string; title: string; count: number | null; votedByMe: boolean };

const TOP_N = 3;

function VoteButton({ voted, onClick }: { voted: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${voted ? "bg-rad-red/10 text-rad-red" : "bg-slate-100 text-slate-400"}`}
      aria-label={voted ? "Remove vote" : "Vote for this topic"}
    >
      <Heart size={16} className={voted ? "fill-rad-red" : ""} />
    </button>
  );
}

// The "what should we build next" section at the bottom of /tutorials -
// visitors vote (like-button, togglable, multi-select) for one or more
// suggested topics so RAD can see what actually has demand, with an
// optional phone number ("notify me when this launches") attached to
// every vote once given. Only the top 3 show by default, and are votable
// right there - "See all topic suggestions" opens the full list in a
// popup only for the topics that don't fit in the top 3.
export default function TopicVoteSection() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [otherSubmitted, setOtherSubmitted] = useState(false);

  async function load() {
    const voterId = getOrCreateVoterId();
    const res = await fetch(`/api/tutorials/topic-votes?voterId=${encodeURIComponent(voterId)}`);
    const data = await res.json();
    setTopics(data.topics || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleVote(topicId: string) {
    const voterId = getOrCreateVoterId();
    const phone = getStoredVoterPhone() || undefined;
    const res = await fetch("/api/tutorials/topic-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, voterId, phone }),
    });
    const data = await res.json();
    if (!res.ok) return;

    // Re-fetch rather than merge-and-resort locally: with counts possibly
    // masked (null) below either threshold, the server is the only place
    // that still knows the true ranking order.
    await load();

    if (data.voted && !hasBeenPromptedForPhone()) {
      setPhonePrompt(true);
    }
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    const voterId = getOrCreateVoterId();
    setStoredVoterPhone(phoneInput);
    markPromptedForPhone();
    setPhonePrompt(false);
    await fetch("/api/tutorials/topic-votes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId, phone: phoneInput }),
    }).catch(() => {});
  }

  function skipPhone() {
    markPromptedForPhone();
    setPhonePrompt(false);
  }

  // Freeform "Other" ideas are never shown or aggregated as a votable
  // topic (spec: "It does not get displayed") - they land in a separate
  // admin review queue (/admin/tutorials/topics, "Other" suggestions
  // section) where enough similar submissions can be promoted into a real
  // topic by hand.
  async function submitOther(e: React.FormEvent) {
    e.preventDefault();
    if (!otherText.trim()) return;
    const voterId = getOrCreateVoterId();
    const phone = getStoredVoterPhone() || undefined;
    await fetch("/api/tutorials/topic-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: otherText, voterId, phone }),
    }).catch(() => {});
    setOtherText("");
    setOtherSubmitted(true);
    if (!hasBeenPromptedForPhone()) setPhonePrompt(true);
  }

  if (loading || topics.length === 0) return null;

  const top = topics.slice(0, TOP_N);
  const hasMore = topics.length > TOP_N;

  const phonePromptForm = (
    <form onSubmit={submitPhone} className="border-t border-slate-200 pt-4 mt-4 flex flex-col gap-2">
      <p className="text-xs font-bold text-slate-700">Want a text when your pick launches? (optional)</p>
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          value={phoneInput}
          onChange={e => setPhoneInput(e.target.value)}
          placeholder="e.g. 082 123 4567"
          className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-rad-blue"
        />
        <button type="submit" disabled={phoneInput.trim().length < 9} className="bg-rad-blue text-white text-xs font-black uppercase tracking-widest rounded-xl px-4 disabled:opacity-40">
          Notify me
        </button>
      </div>
      <button type="button" onClick={skipPhone} className="text-xs text-slate-400 underline self-start">No thanks</button>
    </form>
  );

  const otherBlock = otherSubmitted ? (
    <div className="flex items-center gap-2 border border-dashed border-slate-200 rounded-xl px-4 py-3 mt-2">
      <Check size={16} className="text-rad-green shrink-0" />
      <span className="text-xs font-bold text-slate-600">Thanks! We'll take a look.</span>
    </div>
  ) : otherOpen ? (
    <form onSubmit={submitOther} className="border border-dashed border-slate-200 rounded-xl p-3 mt-2 flex flex-col gap-2">
      <input
        autoFocus
        value={otherText}
        onChange={e => setOtherText(e.target.value)}
        placeholder="What would you like to see?"
        maxLength={300}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rad-blue"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={!otherText.trim()} className="flex-1 bg-rad-blue text-white text-xs font-black uppercase tracking-widest rounded-lg py-2 disabled:opacity-40">
          Submit idea
        </button>
        <button type="button" onClick={() => setOtherOpen(false)} className="text-xs font-bold text-slate-400 px-3">Cancel</button>
      </div>
    </form>
  ) : (
    <button onClick={() => setOtherOpen(true)} className="w-full flex items-center gap-2 border border-dashed border-slate-200 rounded-xl px-4 py-3 mt-2 text-left hover:border-slate-300">
      <Lightbulb size={16} className="text-slate-400 shrink-0" />
      <span className="text-xs font-bold text-slate-500">Other - suggest your own idea</span>
    </button>
  );

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-rad-purple" />
          <h2 className="text-sm font-black text-slate-900">What Tutorial topic would you want to see next?</h2>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {top.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-rad-purple/10 text-rad-purple text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-sm font-bold text-slate-700 flex-1 truncate">{t.title}</span>
              <span className="text-xs font-bold text-slate-400 shrink-0">{t.count ?? "—"}</span>
              <VoteButton voted={t.votedByMe} onClick={() => toggleVote(t.id)} />
            </div>
          ))}
        </div>

        {!modalOpen && otherBlock}
        {!modalOpen && phonePrompt && phonePromptForm}

        {hasMore && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest text-rad-blue mt-2"
          >
            See all topic suggestions <ChevronRight size={14} />
          </button>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-slate-900">Vote for what's next</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Tap the heart on as many as you like - it helps us decide what to build next.</p>

            <div className="flex flex-col gap-2 mb-4">
              {topics.map(t => (
                <div key={t.id} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-bold text-slate-800 flex-1">{t.title}</span>
                  <span className="text-xs font-bold text-slate-400 shrink-0">{t.count ?? "—"}</span>
                  <VoteButton voted={t.votedByMe} onClick={() => toggleVote(t.id)} />
                </div>
              ))}
            </div>

            {otherBlock}
            {phonePrompt && phonePromptForm}
          </div>
        </div>
      )}
    </>
  );
}
