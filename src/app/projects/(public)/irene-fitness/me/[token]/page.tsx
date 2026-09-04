'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Pencil, Share2, Loader2 } from 'lucide-react';

type LinkInfo = { found: boolean; display_name: string | null; response_id: string | null };

// The durable "my link" landing page a family gets sent once
// (/projects/irene-fitness/me/{access_token}) - a chooser between editing
// their own response (hands off to the real cookie-authenticated
// submission flow via my-link/[token]/edit's redirect) and grabbing a
// vote-only link to forward to friends & family (deep-links into the real
// community feed, scrolled to their card - see community/page.tsx's
// ?highlight handling).
export default function IreneFitnessMyLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<LinkInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/irene-fitness/my-link/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setInfo(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center text-slate-400">
        <Loader2 className="mx-auto animate-spin" size={28} />
      </div>
    );
  }

  if (!info?.found) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-black tracking-tight mb-3">Link not found</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          This link doesn&apos;t match an entry on file. If you think that&apos;s wrong, use the message icon above to
          get in touch.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-14 sm:py-20">
      <h2 className="text-2xl font-black tracking-tight mb-1">
        Hi{info.display_name ? `, ${info.display_name}` : ''} 👋
      </h2>
      <p className="text-sm text-slate-500 mb-8">This is your personal Fit Fam link. What would you like to do?</p>

      <a
        href={`/api/irene-fitness/my-link/${encodeURIComponent(token)}/edit`}
        className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-black/5 shadow-sm mb-4 hover:border-[#0066cc]/30 transition-colors"
      >
        <span className="shrink-0 w-11 h-11 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
          <Pencil size={18} />
        </span>
        <span>
          <span className="block font-black text-slate-900">Edit our response</span>
          <span className="block text-xs text-slate-500">Update your story, details, or entry</span>
        </span>
      </a>

      {info.response_id ? (
        <a
          href={`/projects/irene-fitness/community?highlight=${encodeURIComponent(info.response_id)}&preview=1`}
          className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-black/5 shadow-sm hover:border-[#0066cc]/30 transition-colors"
        >
          <span className="shrink-0 w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Share2 size={18} />
          </span>
          <span>
            <span className="block font-black text-slate-900">Share our entry for votes</span>
            <span className="block text-xs text-slate-500">Preview it, then send the link to friends & family</span>
          </span>
        </a>
      ) : (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-black/5">
          <span className="shrink-0 w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Share2 size={18} />
          </span>
          <span>
            <span className="block font-black text-slate-400">Share our entry for votes</span>
            <span className="block text-xs text-slate-400">Finish your story first — edit our response above</span>
          </span>
        </div>
      )}
    </div>
  );
}
