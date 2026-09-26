"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X, FileText, History } from "lucide-react";
import { parseMessage, KIND_LABEL, STATUS_DISPLAY } from "@/lib/messageParse";

// Read-only conversation history for one lead - context, not a composer.
// Opened from Message Activity when an inbound message (typically a button
// tap like "Save my seat") makes no sense on its own: the main feed only
// holds the newest few thousand messages across every lead, so whatever
// prompted that tap can be missing from the inline expanded thread. This
// fetches the lead's whole history via /admin/api/lead-funnel/messages/thread.

type ThreadMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at?: string | null;
  wamid?: string | null;
  reaction_message_id?: string | null;
  buttons?: { id: string; title: string }[] | null;
  forwarded?: boolean | null;
  media_type?: 'image' | 'sticker' | 'video' | 'audio' | 'document' | null;
  media_caption?: string | null;
  media_filename?: string | null;
  media_url?: string | null;
  status?: string | null;
};

// Only what's needed to expand "[Delivered template: X]" / "[Delivered
// flow: X]" log lines back into the text the lead actually saw - `messages`
// stores just the name for those sends, not the rendered content.
export type HistoryTemplateRef = { name: string; bodyPreview: string; quickReplyButtons: { text: string }[] };
export type HistoryFlowRef = { label: string; message_body: string | null; message_buttons: { id: string; title: string }[] | null };

const REACTION_RE = /^\[Reacted (.+)\]$/;

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' });
}

export function LeadHistoryModal({ leadId, leadName, leadPhone, templates, flows, onClose }: {
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  templates: HistoryTemplateRef[];
  flows: HistoryFlowRef[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ThreadMessage[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/admin/api/lead-funnel/messages/thread?leadId=${encodeURIComponent(leadId)}`)
      .then(async res => {
        // A 404/redirect comes back as an HTML page - say so plainly rather
        // than surfacing a JSON parse error.
        if (!(res.headers.get('content-type') || '').includes('application/json')) {
          const landedOn = res.redirected ? new URL(res.url).pathname : null;
          throw new Error(landedOn
            ? `History request was redirected to ${landedOn} (session check failed or timed out) - try again, or re-login.`
            : `History endpoint unavailable (HTTP ${res.status}) - the server may need restarting/redeploying.`);
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load history');
        if (cancelled) return;
        setRows(data.rows || []);
        setTruncated(!!data.truncated);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Most recent context is what matters - open scrolled to the bottom.
  useEffect(() => {
    if (!loading && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [loading, rows]);

  // A reaction arrives as its own inbound row ("[Reacted 👍]", or bare
  // "[Reaction]" when the lead removes one) pointing at the reacted-to
  // message's wamid. Folded onto that message as a badge - latest reaction
  // wins, a removal clears it - rather than shown as a stray bubble. One
  // whose target isn't in this thread (no wamid logged for that send) stays
  // inline so it isn't silently lost.
  const { reactionsByWamid, attachedIds } = useMemo(() => {
    const wamids = new Set(rows.map(r => r.wamid).filter(Boolean) as string[]);
    const byWamid = new Map<string, { emoji: string | null; at: string | null }>();
    const attached = new Set<string>();
    for (const r of rows) {
      if (!r.reaction_message_id || !wamids.has(r.reaction_message_id)) continue;
      const match = (r.body || '').match(REACTION_RE);
      byWamid.set(r.reaction_message_id, { emoji: match ? match[1] : null, at: r.created_at || null });
      attached.add(r.id);
    }
    return { reactionsByWamid: byWamid, attachedIds: attached };
  }, [rows]);

  const visible = rows.filter(r => !attachedIds.has(r.id));
  const templatesByName = useMemo(() => new Map(templates.map(t => [t.name, t])), [templates]);
  const flowsByLabel = useMemo(() => new Map(flows.map(f => [f.label, f])), [flows]);

  return (
    <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0 border-b border-slate-100">
          <div>
            <h3 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
              <History size={16} className="text-slate-400" /> Conversation with {leadName || 'this lead'}
            </h3>
            <p className="text-[13px] text-slate-400 mt-0.5">
              +{leadPhone} · {loading ? 'Loading…' : `${rows.length} message${rows.length === 1 ? '' : 's'}`} · read-only
            </p>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={13} /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/60 px-6 py-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2" size={16} /> Loading history...</div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-4">{error}</div>
          ) : visible.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">No messages logged for this lead.</div>
          ) : (
            <div className="space-y-2">
              {truncated && (
                <p className="text-center text-[11px] text-amber-600 bg-amber-50 rounded-lg py-1.5">Showing the first {rows.length} messages only.</p>
              )}
              {visible.map((m, i) => {
                const prev = visible[i - 1];
                const day = m.created_at ? formatDay(m.created_at) : null;
                const showDay = day && (!prev?.created_at || formatDay(prev.created_at) !== day);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 rounded-full px-3 py-1">{day}</span>
                      </div>
                    )}
                    <HistoryBubble
                      m={m}
                      reaction={m.wamid ? reactionsByWamid.get(m.wamid) : undefined}
                      templatesByName={templatesByName}
                      flowsByLabel={flowsByLabel}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">Template and bot-flow text is shown as currently configured - it may have been edited since it was sent.</p>
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 shrink-0">Close</button>
        </div>
      </div>
    </div>
  );
}

function HistoryBubble({ m, reaction, templatesByName, flowsByLabel }: {
  m: ThreadMessage;
  reaction?: { emoji: string | null; at: string | null };
  templatesByName: Map<string, HistoryTemplateRef>;
  flowsByLabel: Map<string, HistoryFlowRef>;
}) {
  const isOut = m.direction === 'outbound';
  const parsed = parseMessage(m);
  const failed = 'status' in parsed && parsed.status === 'failed';

  // Unattached reaction (its target isn't in this thread) - a small inline
  // note rather than a full bubble.
  if (!isOut && m.reaction_message_id) {
    const match = (m.body || '').match(REACTION_RE);
    return (
      <div className="flex justify-start">
        <span className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">
          {match ? <>Reacted <span className="text-sm">{match[1]}</span></> : 'Removed a reaction'} to an earlier message
          {m.created_at && <span className="text-slate-300"> · {formatTime(m.created_at)}</span>}
        </span>
      </div>
    );
  }

  // Expand the logged name back into the content the lead actually saw.
  let expandedBody: string | null = null;
  let expandedButtons: string[] = [];
  if (parsed.kind === 'template') {
    const t = templatesByName.get(parsed.label);
    if (t) { expandedBody = t.bodyPreview; expandedButtons = t.quickReplyButtons.map(b => b.text); }
  } else if (parsed.kind === 'bot_flow') {
    const f = flowsByLabel.get(parsed.label);
    if (f) { expandedBody = f.message_body; expandedButtons = (f.message_buttons || []).map(b => b.title); }
  }
  // Buttons actually attached to this specific send win over the configured ones.
  if (m.buttons && m.buttons.length > 0) expandedButtons = m.buttons.map(b => b.title);

  const bubbleClass = isOut
    ? (failed ? 'bg-rose-100 text-rose-700' : 'bg-slate-900 text-white')
    : parsed.kind === 'button_tap'
      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
      : 'bg-white border border-slate-200 text-slate-800';
  const subtle = isOut && !failed ? 'text-slate-300' : 'text-slate-400';

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} ${reaction?.emoji ? 'mb-3' : ''}`}>
      <div className="max-w-[80%] relative">
        <div className={`rounded-2xl px-3.5 py-2 text-[13px] ${bubbleClass}`}>
          {m.forwarded && <div className={`text-[10px] italic mb-0.5 ${subtle}`}>Forwarded</div>}
          {m.media_url ? (
            <div>
              {(m.media_type === 'image' || m.media_type === 'sticker') && (
                <a href={m.media_url} target="_blank" rel="noopener noreferrer">
                  <img src={m.media_url} alt={m.media_type} className="max-w-[220px] max-h-[220px] rounded-lg object-contain bg-slate-100" />
                </a>
              )}
              {m.media_type === 'video' && <video src={m.media_url} controls className="max-w-[240px] rounded-lg" />}
              {m.media_type === 'audio' && <audio src={m.media_url} controls className="max-w-[220px]" />}
              {m.media_type === 'document' && (
                <a href={m.media_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 underline ${isOut ? 'text-white' : 'text-slate-700'}`}>
                  <FileText size={13} /> {m.media_filename || 'Document'}
                </a>
              )}
              {m.media_caption && <p className="whitespace-pre-wrap mt-1">{m.media_caption}</p>}
            </div>
          ) : (
            <>
              {parsed.kind !== 'text' && (
                <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${parsed.kind === 'button_tap' ? 'text-indigo-400' : subtle}`}>
                  {KIND_LABEL[parsed.kind] || parsed.kind}
                  {expandedBody && <span className="normal-case tracking-normal font-bold"> · {parsed.label}</span>}
                </div>
              )}
              <p className="whitespace-pre-wrap">{expandedBody || parsed.label}</p>
              {'detail' in parsed && parsed.detail && (
                <p className={`text-[11px] mt-0.5 ${subtle}`}>{parsed.detail}</p>
              )}
            </>
          )}
          {expandedButtons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {expandedButtons.map((b, i) => (
                <span key={i} className={`text-[11px] font-medium px-2 py-1 rounded-lg ${isOut && !failed ? 'bg-white/10 text-sky-200' : 'bg-slate-100 text-slate-600'}`}>{b}</span>
              ))}
            </div>
          )}
          <div className={`flex items-center justify-end gap-1.5 text-[10px] mt-1 ${subtle}`}>
            <span>{m.created_at ? formatTime(m.created_at) : ''}</span>
            {m.status && STATUS_DISPLAY[m.status] && (
              <span className={STATUS_DISPLAY[m.status].className}>{STATUS_DISPLAY[m.status].icon}</span>
            )}
          </div>
        </div>
        {reaction?.emoji && (
          <span
            title={reaction.at ? `Reacted ${formatTime(reaction.at)}` : 'Reaction'}
            className={`absolute -bottom-2.5 ${isOut ? 'left-2' : 'right-2'} bg-white border border-slate-200 rounded-full px-1.5 text-sm shadow-sm`}
          >
            {reaction.emoji}
          </span>
        )}
      </div>
    </div>
  );
}
