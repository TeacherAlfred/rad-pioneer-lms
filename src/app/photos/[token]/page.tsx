"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, Sparkles } from "lucide-react";

type Photo = { url: string };
type ChildEntry = {
  kid: { id: string; name: string };
  photos: Photo[];
  review: { built_text: string | null; wants_more: string | null } | null;
};

export default function PhotoGalleryPage() {
  const params = useParams();
  const token = params?.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [children, setChildren] = useState<ChildEntry[]>([]);

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        const res = await fetch(`/api/photos/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "This link is invalid or has expired.");
        setSession(data.session);
        setChildren(data.children || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-sm text-slate-400">Loading your photos...</p>
      </div>
    );
  }

  if (error || !children.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6 border border-rose-100">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Nothing to show here</h1>
        <p className="text-slate-500 max-w-sm">{error || "No photos have been shared yet."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-2xl mx-auto px-5 py-10 space-y-12">
        <div className="text-center">
          <p className="text-[13px] font-medium text-blue-600 uppercase tracking-widest mb-1">RAD Academy</p>
          {session?.programs?.name && <h1 className="text-2xl font-semibold text-slate-900">{session.programs.name}</h1>}
        </div>

        {children.map(({ kid, photos, review }) => (
          <section key={kid.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">{kid.name}'s photos</h2>

            {photos.length > 0 ? (
              <div className={`grid gap-3 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p.url} alt={`${kid.name} at the session`} className="w-full rounded-2xl object-cover aspect-square" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">We didn't get a good photo of {kid.name} this session - we'll make a point of it next time.</p>
            )}

            {review?.built_text && (
              <div className="bg-slate-50 rounded-2xl p-4 flex gap-3">
                <Sparkles size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] text-slate-400 mb-1">Asked what they made</p>
                  <p className="text-slate-700 italic">"{review.built_text}"</p>
                </div>
              </div>
            )}

            {review?.wants_more && (
              <p className="text-[13px] text-slate-400">
                Asked whether they'd like to do more of this: <span className="font-medium text-slate-600">{review.wants_more}</span>
              </p>
            )}
          </section>
        ))}

        <p className="text-center text-[13px] text-slate-400">Yours to keep, always.</p>
      </main>
    </div>
  );
}
