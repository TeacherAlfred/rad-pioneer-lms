"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Upload, X, Star, Trash2, Eye, EyeOff, Send,
  AlertTriangle, Copy, Check, ShieldCheck, Camera, ClipboardList,
} from "lucide-react";
import { PHOTO_TIER_ORDER, type PhotoTierKey } from "@/lib/photoClearance";

type Kid = { id: string; name: string };
type Guardian = { id: string; name: string | null; phone: string | null };
type Review = { built_text: string | null; wants_more: string | null } | null;
type PhotoConsent = Record<string, boolean> | null | undefined; // undefined = pending, per-kid

type RosterKid = Kid & { guardians: Guardian[]; review: Review; photoConsent: PhotoConsent };

type Clearance = { tier: number; tierKey: PhotoTierKey | null; pendingSubjectKidIds: string[]; declinedSubjectKidIds: string[] };
type Subject = { id: string; kid_id: string; identifiable: boolean; selected_for_parent: boolean; kids: Kid };
type FaceBox = { x: number; y: number; width: number; height: number };
type Face = { id: string; bbox: FaceBox; kid_id: string | null };
type Photo = {
  id: string; r2_key: string; url: string; taken_at: string | null;
  quality: number | null; content_tags: string[]; background_checked: boolean;
  identifiable: boolean; faces_detected_at: string | null;
  session_photo_subjects: Subject[]; session_photo_faces: Face[]; clearance: Clearance | null;
};

const CONTENT_TAGS = ['face', 'hands', 'hardware', 'screen', 'group', 'finished-build', 'reaction'];
const DESTINATIONS = [
  { key: 'parent_progress_view', label: "Parent's progress view" },
  { key: 'parents_whatsapp_group', label: 'Parents WhatsApp group' },
  { key: 'website', label: 'Website' },
  { key: 'organic_social', label: 'Organic social' },
  { key: 'paid_advertising', label: 'Paid advertising' },
];
const TIER_LABELS: Record<PhotoTierKey, string> = {
  tier1: "Their own progress record",
  tier2: 'Parents group for this session',
  tier3: 'Website and social media',
  tier4: 'Paid advertising',
  tier5Video: 'Video',
};

function toWaPhone(phone: string) {
  let p = (phone || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '27' + p.substring(1);
  return p;
}

function firstName(name: string | null | undefined) {
  return (name || 'there').split(' ')[0];
}

function buildGiftMessage(kidName: string, guardianName: string | null, galleryUrl: string, review: Review) {
  const lines = [`Hi ${firstName(guardianName)} 👋`, ''];
  lines.push(`${kidName} had a great session today. Here are a few from it - yours to keep:`);
  lines.push(galleryUrl, '');
  if (review?.built_text) lines.push(`Asked what they made: "${review.built_text}"`, '');
  if (review?.wants_more) lines.push(`Asked whether they'd like to do more of this: ${review.wants_more}`);
  return lines.join('\n').trim();
}

function buildConfirmMessage(kidName: string, guardianName: string | null, photo: Record<string, boolean>, changeUrl: string) {
  const lines = [`Quick note on the photo permissions on file for ${kidName} 📷`, ''];
  for (const tier of PHOTO_TIER_ORDER) {
    lines.push(`${photo[tier] ? '✅' : '❌'} ${TIER_LABELS[tier]}`);
  }
  lines.push('', "That's exactly what we'll stick to. Change it any time here:", changeUrl);
  return lines.join('\n').trim();
}

function buildAskMessage(kidName: string, guardianName: string | null, changeUrl: string) {
  const lines = [
    'One thing before I let you go 📷', '',
    `We'd love to use photos like these of ${kidName} to show other parents what actually happens in our sessions - but only with your say-so, and only as far as you're comfortable.`, '',
    'You can pick as much or as little as you like here:', changeUrl, '',
    'Saying no to all of it changes nothing. You keep the photos either way.',
  ];
  return lines.join('\n').trim();
}

function clearanceBadge(clearance: Clearance | null) {
  if (!clearance) return { label: '...', cls: 'bg-slate-100 text-slate-400' };
  if (clearance.pendingSubjectKidIds.length > 0) {
    return { label: `${clearance.pendingSubjectKidIds.length} pending consent`, cls: 'bg-amber-50 text-amber-600 border border-amber-200' };
  }
  if (clearance.tier === 0) return { label: 'Not cleared', cls: 'bg-rose-50 text-rose-600 border border-rose-200' };
  const label = TIER_LABELS[PHOTO_TIER_ORDER[clearance.tier - 1]];
  return { label: `Cleared: ${label}`, cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
}

export default function SessionPhotosPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'catalogue' | 'select' | 'usage'>('catalogue');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [roster, setRoster] = useState<RosterKid[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  // isInitial gates the full-page spinner - background refreshes (after
  // tagging, patching, or a face-detection pass finishing) must never
  // blank the whole page, or every action looks like a reload.
  async function loadData(isInitial = false) {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(`/admin/api/session-photos?sessionId=${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.session);
      setRoster(data.roster || []);
      setPhotos(data.photos || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }

  useEffect(() => { if (sessionId) loadData(true); }, [sessionId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `session-photos/${sessionId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const presignRes = await fetch('/api/upload/r2', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath, fileType: file.type }),
        });
        const { signedUrl } = await presignRes.json();
        if (!signedUrl) throw new Error('Failed to generate upload URL');
        const uploadRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!uploadRes.ok) throw new Error('Failed to upload to R2');
        await fetch('/admin/api/session-photos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, r2Key: filePath, takenAt: new Date(file.lastModified).toISOString() }),
        });
      }
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function patchPhoto(id: string, patch: Record<string, any>) {
    await fetch('/admin/api/session-photos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    await loadData();
  }

  async function deletePhoto(id: string) {
    if (!confirm('Remove this photo from the catalogue? This cannot be undone.')) return;
    await fetch('/admin/api/session-photos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await loadData();
  }

  async function tagSubjects(photoId: string, kidIds: string[]) {
    await Promise.all(kidIds.map(kidId =>
      fetch('/admin/api/session-photos/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId, kidId }) })
    ));
    await loadData();
  }

  async function patchSubject(id: string, patch: Record<string, any>) {
    const res = await fetch('/admin/api/session-photos/subjects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    await loadData();
  }

  async function untagSubject(id: string) {
    await fetch('/admin/api/session-photos/subjects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await loadData();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-100 px-6 py-4">
        <Link href="/admin/sessions" className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 mb-2 w-fit">
          <ArrowLeft size={13} /> Back to sessions
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">{session?.programs?.name || 'Session'} photos</h1>
        {error && <p className="text-[12px] text-rose-500 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
        <div className="flex gap-2 mt-4">
          {(['catalogue', 'select', 'usage'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {t === 'catalogue' ? 'Catalogue' : t === 'select' ? 'Select & Send' : 'Usage Log'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === 'catalogue' && (
          <CatalogueTab
            roster={roster} photos={photos} uploading={uploading} fileInputRef={fileInputRef}
            onUpload={handleFiles} onPatchPhoto={patchPhoto} onDeletePhoto={deletePhoto}
            onTagSubjects={tagSubjects} onPatchSubject={patchSubject} onUntagSubject={untagSubject}
            onRefresh={loadData}
          />
        )}
        {tab === 'select' && <SelectSendTab roster={roster} photos={photos} sessionId={sessionId} onPatchSubject={patchSubject} />}
        {tab === 'usage' && <UsageTab photos={photos} sessionId={sessionId} />}
      </main>
    </div>
  );
}

type SuggestedMatch = { id: string; photoId: string; bbox: FaceBox; distance: number };
type Suggestion = { kidId: string; kidName: string; matches: SuggestedMatch[] };

function CatalogueTab({
  roster, photos, uploading, fileInputRef, onUpload, onPatchPhoto, onDeletePhoto, onTagSubjects, onPatchSubject, onUntagSubject, onRefresh,
}: {
  roster: RosterKid[]; photos: Photo[]; uploading: boolean; fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (f: FileList | null) => void; onPatchPhoto: (id: string, p: Record<string, any>) => void;
  onDeletePhoto: (id: string) => void; onTagSubjects: (photoId: string, kidIds: string[]) => void;
  onPatchSubject: (id: string, p: Record<string, any>) => void; onUntagSubject: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detectingId, setDetectingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const processing = useRef<Set<string>>(new Set());
  const modelsLoaded = modelStatus === 'ready';

  const pendingCount = photos.filter(p => !p.faces_detected_at).length;
  const zeroFaceCount = photos.filter(p => p.faces_detected_at && (p.session_photo_faces || []).length === 0).length;

  // face-api.js models are self-hosted (public/models) - free, runs
  // entirely in this browser tab, nothing sent to a third party. SSD
  // Mobilenet (not the faster Tiny Face Detector) because it holds up
  // much better on candid session photos where faces are small, angled,
  // or partly turned away - a ~6MB one-time download, cached after.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const faceapi = await import('face-api.js');
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        if (!cancelled) setModelStatus('ready');
      } catch {
        if (!cancelled) setModelStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Processes one not-yet-detected photo at a time, so a big upload
  // batch doesn't lock up the tab. Runs through the image proxy (see
  // src/app/admin/api/session-photos/image-proxy/route.ts) since the R2
  // token here can't grant bucket CORS, which canvas pixel reads need.
  // onRefresh() is a silent background refresh (see loadData in the
  // parent) - it must never blank the whole page, or every completed
  // photo looks like a reload.
  useEffect(() => {
    if (!modelsLoaded) return;
    const next = photos.find(p => !p.faces_detected_at && !processing.current.has(p.id));
    if (!next) return;
    processing.current.add(next.id);
    setDetectingId(next.id);

    (async () => {
      try {
        const faceapi = await import('face-api.js');
        const img = new Image();
        const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
        img.src = `/admin/api/session-photos/image-proxy?url=${encodeURIComponent(next.url)}`;
        await loaded;

        const detections = await faceapi
          .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        const faces = detections.map(d => ({
          bbox: {
            x: d.detection.box.x / img.naturalWidth,
            y: d.detection.box.y / img.naturalHeight,
            width: d.detection.box.width / img.naturalWidth,
            height: d.detection.box.height / img.naturalHeight,
          },
          descriptor: Array.from(d.descriptor),
        }));

        await fetch('/admin/api/session-photos/faces', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoId: next.id, faces }),
        });
      } catch {
        // Detection is a convenience layer - the manual checklist
        // tagger below always works even if this fails for a photo.
      } finally {
        processing.current.delete(next.id);
        setDetectingId(null);
        await onRefresh();
      }
    })();
  }, [modelsLoaded, photos, onRefresh]);

  async function rescanPhoto(photoId: string) {
    await onPatchPhoto(photoId, { reset_face_detection: true });
  }

  async function rescanAllZeroFace() {
    const targets = photos.filter(p => p.faces_detected_at && (p.session_photo_faces || []).length === 0);
    await Promise.all(targets.map(p => fetch('/admin/api/session-photos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, reset_face_detection: true }),
    })));
    await onRefresh();
  }

  async function assignFace(faceId: string, kidId: string, kidName: string) {
    const res = await fetch('/admin/api/session-photos/faces', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: faceId, kidId }),
    });
    const data = await res.json();
    await onRefresh();
    if (data.suggestedMatches?.length > 0) {
      setSuggestions(prev => [...prev, { kidId, kidName, matches: data.suggestedMatches }]);
    }
  }

  // Tags only the matches the admin left checked (see FaceMatchReviewModal)
  // - anything unchecked is simply left unassigned, not tagged.
  async function confirmSuggestion(s: Suggestion, includeIds: string[]) {
    if (includeIds.length > 0) {
      await fetch('/admin/api/session-photos/faces', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: includeIds, kidId: s.kidId }),
      });
    }
    setSuggestions(prev => prev.filter(x => x !== s));
    await onRefresh();
  }

  return (
    <div className="space-y-6">
      <div
        className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-white hover:border-blue-300 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onUpload(e.dataTransfer.files); }}
      >
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files)} />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-500"><Loader2 className="animate-spin" size={18} /> Uploading...</div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Upload size={22} />
            <p className="text-sm">Drag photos here, or click to select</p>
          </div>
        )}
      </div>

      {modelStatus === 'loading' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 size={14} className="animate-spin shrink-0" />
          Loading face detection (one-time ~6MB download, cached after this) - face tagging will start once it's ready.
        </div>
      )}
      {modelStatus === 'error' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[13px] text-amber-700">
          Face detection couldn't load - you can still tag children manually below.
        </div>
      )}
      {modelStatus === 'ready' && pendingCount > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 size={14} className="animate-spin shrink-0" />
          Detecting faces - {photos.length - pendingCount} of {photos.length} photos done.
        </div>
      )}
      {modelStatus === 'ready' && pendingCount === 0 && zeroFaceCount > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-[13px] text-slate-500">
          <span>{zeroFaceCount} photo{zeroFaceCount === 1 ? '' : 's'} had no faces detected - tag them manually below, or re-scan.</span>
          <button onClick={rescanAllZeroFace} className="text-[12px] font-semibold text-blue-500 hover:text-blue-700 shrink-0">Re-scan all</button>
        </div>
      )}

      {suggestions.length > 0 && (
        <FaceMatchReviewModal
          suggestion={suggestions[0]}
          photos={photos}
          queueLength={suggestions.length}
          onConfirm={(includeIds) => confirmSuggestion(suggestions[0], includeIds)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {photos.map(photo => (
          <PhotoCard
            key={photo.id} photo={photo} roster={roster} detecting={detectingId === photo.id}
            onPatchPhoto={onPatchPhoto} onDelete={onDeletePhoto}
            onTagSubjects={onTagSubjects} onPatchSubject={onPatchSubject} onUntagSubject={onUntagSubject}
            onAssignFace={assignFace} onRescan={rescanPhoto}
          />
        ))}
      </div>
      {photos.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No photos catalogued yet.</p>}
    </div>
  );
}

// The place to click, made unmissable: a modal (not a banner easy to
// scroll past) showing every candidate photo so the admin can confirm
// or reject each one individually before anything gets tagged.
const REVIEW_PAGE_SIZE = 12;
const THUMB_MIN = 80;
const THUMB_MAX = 260;

function FaceMatchReviewModal({ suggestion, photos, queueLength, onConfirm }: {
  suggestion: Suggestion; photos: Photo[]; queueLength: number; onConfirm: (includeIds: string[]) => void;
}) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [thumbSize, setThumbSize] = useState(140);

  // A fresh suggestion (new kid, or the next one in the queue) starts
  // its own review from page 1 - excluded stays per-suggestion too, so
  // switching pages never loses earlier include/exclude choices.
  useEffect(() => { setExcluded(new Set()); setPage(0); }, [suggestion]);

  function toggle(matchId: string) {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId); else next.add(matchId);
      return next;
    });
  }

  const includeIds = suggestion.matches.filter(m => !excluded.has(m.id)).map(m => m.id);
  const totalPages = Math.max(1, Math.ceil(suggestion.matches.length / REVIEW_PAGE_SIZE));
  const pageMatches = suggestion.matches.slice(page * REVIEW_PAGE_SIZE, (page + 1) * REVIEW_PAGE_SIZE);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-100 space-y-3">
          <div>
            <h3 className="font-semibold text-slate-900">Is this {suggestion.kidName} too?</h3>
            <p className="text-[12px] text-slate-400 mt-1">
              Found in {suggestion.matches.length} other photo{suggestion.matches.length === 1 ? '' : 's'} from this session - tap any that aren't them to leave them out.
              {queueLength > 1 && ` (${queueLength - 1} more to review after this.)`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 shrink-0">Size</span>
            <input
              type="range" min={THUMB_MIN} max={THUMB_MAX} step={10} value={thumbSize}
              onChange={(e) => setThumbSize(Number(e.target.value))}
              className="w-28 accent-blue-600"
            />
            {totalPages > 1 && (
              <div className="flex items-center gap-2 ml-auto text-[12px] text-slate-500">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded-lg bg-slate-100 disabled:opacity-30">Prev</button>
                Page {page + 1} of {totalPages}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-2 py-1 rounded-lg bg-slate-100 disabled:opacity-30">Next</button>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-wrap gap-3">
            {pageMatches.map(m => {
              const photo = photos.find(p => p.id === m.photoId);
              const isExcluded = excluded.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className="relative rounded-xl overflow-hidden border-2 shrink-0"
                  style={{ borderColor: isExcluded ? '#e2e8f0' : '#10b981', width: thumbSize }}
                >
                  {photo ? (
                    // Natural aspect ratio (not object-cover) so the bbox
                    // percentages below - fractions of the ORIGINAL image -
                    // line up exactly with the visible thumbnail, same
                    // reasoning as the overlay in PhotoCard.
                    <div className="relative w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className={`w-full h-auto block ${isExcluded ? 'opacity-40 grayscale' : ''}`} />
                      {/* Highlights which face in the frame matched - useful in a group shot where it isn't obvious */}
                      <div
                        className="absolute border-2 border-amber-400 rounded"
                        style={{ left: `${m.bbox.x * 100}%`, top: `${m.bbox.y * 100}%`, width: `${m.bbox.width * 100}%`, height: `${m.bbox.height * 100}%` }}
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-slate-100" />
                  )}
                  <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${isExcluded ? 'bg-white/90 text-slate-400' : 'bg-emerald-500 text-white'}`}>
                    {isExcluded ? <X size={12} /> : <Check size={12} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => onConfirm(includeIds)}
            disabled={includeIds.length === 0}
            className="flex-1 text-[13px] font-semibold text-white bg-blue-600 rounded-xl py-2.5 disabled:opacity-40"
          >
            {includeIds.length > 0 ? `Tag ${includeIds.length} as ${suggestion.kidName}` : 'Nothing selected'}
          </button>
          <button onClick={() => onConfirm([])} className="text-[13px] text-slate-400 px-4">None of these</button>
        </div>
      </div>
    </div>
  );
}

function PhotoCard({ photo, roster, detecting, onPatchPhoto, onDelete, onTagSubjects, onPatchSubject, onUntagSubject, onAssignFace, onRescan }: {
  photo: Photo; roster: RosterKid[]; detecting: boolean; onPatchPhoto: (id: string, p: Record<string, any>) => void; onDelete: (id: string) => void;
  onTagSubjects: (photoId: string, kidIds: string[]) => void; onPatchSubject: (id: string, p: Record<string, any>) => void; onUntagSubject: (id: string) => void;
  onAssignFace: (faceId: string, kidId: string, kidName: string) => void; onRescan: (photoId: string) => void;
}) {
  const badge = clearanceBadge(photo.clearance);
  const untaggedRoster = roster.filter(k => !photo.session_photo_subjects.some(s => s.kid_id === k.id));
  const [picking, setPicking] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [activeFaceId, setActiveFaceId] = useState<string | null>(null);

  function toggleChecked(kidId: string) {
    setChecked(prev => prev.includes(kidId) ? prev.filter(id => id !== kidId) : [...prev, kidId]);
  }

  function confirmTag() {
    if (checked.length > 0) onTagSubjects(photo.id, checked);
    setChecked([]);
    setPicking(false);
  }

  const kidNameById = new Map(roster.map(k => [k.id, k.name]));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      {/* Face-box overlays and the assign popover live in this outer,
          non-clipping wrapper - only the <img> itself is clipped to
          rounded corners, so a face near an edge (and its name label or
          tag-picker popover) is never cut off by the card boundary. */}
      <div className="relative w-full">
        <div className="overflow-hidden rounded-t-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" className="w-full h-auto block" />
        </div>
        {detecting && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] rounded-full px-2 py-1 flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> Detecting faces...
          </div>
        )}
        {(photo.session_photo_faces || []).map(face => (
          <div
            key={face.id}
            className="absolute"
            style={{ left: `${face.bbox.x * 100}%`, top: `${face.bbox.y * 100}%`, width: `${face.bbox.width * 100}%`, height: `${face.bbox.height * 100}%` }}
          >
            <button
              onClick={() => setActiveFaceId(activeFaceId === face.id ? null : face.id)}
              className={`w-full h-full rounded border-2 ${face.kid_id ? 'border-emerald-400' : 'border-amber-400 border-dashed'}`}
              title={face.kid_id ? kidNameById.get(face.kid_id) || 'Tagged' : 'Click to tag this face'}
            />
            {face.kid_id && (
              <span className="absolute bottom-1 left-1 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {kidNameById.get(face.kid_id) || 'Tagged'}
              </span>
            )}
            {activeFaceId === face.id && !face.kid_id && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 z-10 w-40 max-h-40 overflow-y-auto">
                {roster.map(k => (
                  <button
                    key={k.id}
                    onClick={() => { onAssignFace(face.id, k.id, k.name); setActiveFaceId(null); }}
                    className="block w-full text-left text-[12px] text-slate-600 px-2 py-1 rounded hover:bg-slate-50"
                  >
                    {k.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
          <button onClick={() => onDelete(photo.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
        </div>

        {photo.faces_detected_at && !detecting && (photo.session_photo_faces || []).length === 0 && (
          <button onClick={() => onRescan(photo.id)} className="text-[11px] text-blue-500 hover:text-blue-700 w-fit">No faces found - re-scan</button>
        )}

        <div className="flex flex-wrap gap-1.5">
          {photo.session_photo_subjects.map(s => (
            <span key={s.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] rounded-full pl-2 pr-1 py-1">
              {s.kids?.name}
              <button onClick={() => onPatchSubject(s.id, { identifiable: !s.identifiable })} title={s.identifiable ? 'Identifiable - click to mark not identifiable' : 'Not identifiable - click to mark identifiable'}>
                {s.identifiable ? <Eye size={11} className="text-slate-400" /> : <EyeOff size={11} className="text-slate-300" />}
              </button>
              <button onClick={() => onUntagSubject(s.id)} className="text-slate-300 hover:text-rose-500"><X size={11} /></button>
            </span>
          ))}
        </div>
        {untaggedRoster.length > 0 && (
          picking ? (
            <div className="border border-slate-200 rounded-lg p-2 space-y-1.5">
              <div className="max-h-32 overflow-y-auto space-y-1">
                {untaggedRoster.map(k => (
                  <label key={k.id} className="flex items-center gap-2 text-[12px] text-slate-600 px-1 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={checked.includes(k.id)} onChange={() => toggleChecked(k.id)} />
                    {k.name}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={confirmTag} disabled={checked.length === 0} className="flex-1 text-[11px] font-semibold text-white bg-slate-900 rounded-lg py-1.5 disabled:opacity-40">
                  Tag {checked.length > 0 ? checked.length : ''}
                </button>
                <button onClick={() => { setPicking(false); setChecked([]); }} className="text-[11px] text-slate-400 px-2">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setPicking(true)} className="w-full text-[12px] border border-dashed border-slate-200 rounded-lg px-2 py-1.5 text-slate-400 hover:border-blue-300 hover:text-blue-500 text-left">
              + Tag children...
            </button>
          )
        )}

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => onPatchPhoto(photo.id, { quality: n })}>
              <Star size={14} className={n <= (photo.quality || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {CONTENT_TAGS.map(tag => {
            const active = photo.content_tags?.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onPatchPhoto(photo.id, { content_tags: active ? photo.content_tags.filter(t => t !== tag) : [...(photo.content_tags || []), tag] })}
                className={`text-[10px] px-2 py-1 rounded-full ${active ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-[12px] text-slate-500">
          <input type="checkbox" checked={photo.background_checked} onChange={(e) => onPatchPhoto(photo.id, { background_checked: e.target.checked })} />
          Background checked
        </label>
      </div>
    </div>
  );
}

function SelectSendTab({ roster, photos, sessionId, onPatchSubject }: { roster: RosterKid[]; photos: Photo[]; sessionId: string; onPatchSubject: (id: string, p: Record<string, any>) => void }) {
  return (
    <div className="space-y-6">
      {roster.map(kid => (
        <ChildPicker key={kid.id} kid={kid} photos={photos} sessionId={sessionId} onPatchSubject={onPatchSubject} />
      ))}
      {roster.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No one on this session's roster.</p>}
    </div>
  );
}

function ChildPicker({ kid, photos, sessionId, onPatchSubject }: { kid: RosterKid; photos: Photo[]; sessionId: string; onPatchSubject: (id: string, p: Record<string, any>) => void }) {
  const [guardianId, setGuardianId] = useState(kid.guardians[0]?.id || '');
  const [generating, setGenerating] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const kidPhotos = photos
    .map(p => ({ photo: p, subject: p.session_photo_subjects.find(s => s.kid_id === kid.id) }))
    .filter((x): x is { photo: Photo; subject: Subject } => !!x.subject)
    .sort((a, b) => (b.photo.quality || 0) - (a.photo.quality || 0));
  const selectedCount = kidPhotos.filter(x => x.subject.selected_for_parent).length;
  const guardian = kid.guardians.find(g => g.id === guardianId) || null;

  async function generateLink() {
    if (!guardianId) return;
    setGenerating(true);
    try {
      const res = await fetch('/admin/api/photo-gallery-tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, guardianLeadId: guardianId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGalleryUrl(data.url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const message1 = galleryUrl ? buildGiftMessage(kid.name, guardian?.name || null, galleryUrl, kid.review) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{kid.name}</h3>
        <span className="text-[12px] text-slate-400">{selectedCount}/3 selected</span>
      </div>

      {kidPhotos.length === 0 ? (
        <p className="text-[13px] text-slate-400">We didn't get a good photo of {kid.name} today - we'll make a point of it next time.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {kidPhotos.map(({ photo, subject }) => (
            <div key={photo.id} className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border-2" style={{ borderColor: subject.selected_for_parent ? '#f59e0b' : 'transparent' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onPatchSubject(subject.id, { selected_for_parent: !subject.selected_for_parent })}
                className="absolute top-1 right-1 bg-white/90 rounded-full p-1"
              >
                <Star size={12} className={subject.selected_for_parent ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} />
              </button>
            </div>
          ))}
        </div>
      )}

      {kid.guardians.length === 0 ? (
        <p className="text-[12px] text-rose-500">No guardian linked to this child - can't generate a delivery link.</p>
      ) : (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          {kid.guardians.length > 1 && (
            <select value={guardianId} onChange={(e) => { setGuardianId(e.target.value); setGalleryUrl(null); }} className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5">
              {kid.guardians.map(g => <option key={g.id} value={g.id}>{g.name || g.phone}</option>)}
            </select>
          )}

          {!galleryUrl ? (
            <button onClick={generateLink} disabled={generating || selectedCount === 0} className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-500 hover:text-blue-700 disabled:opacity-40">
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Generate delivery link
            </button>
          ) : (
            <div className="space-y-3">
              <MessagePreview
                label="Message 1 - the gift"
                text={message1!}
                phone={guardian?.phone || ''}
                onCopy={() => copy(message1!, 'm1')}
                copied={copied === 'm1'}
              />
              <ConsentMessagePreview kid={kid} guardian={guardian} copiedKey={copied} onCopy={copy} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConsentMessagePreview({ kid, guardian, copiedKey, onCopy }: { kid: RosterKid; guardian: Guardian | null; copiedKey: string | null; onCopy: (text: string, key: string) => void }) {
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function getChangeLink() {
    if (!guardian) return;
    setLoading(true);
    try {
      const res = await fetch('/admin/api/consent-tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianLeadId: guardian.id }),
      });
      const data = await res.json();
      if (res.ok) setTokenUrl(data.url);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { getChangeLink(); }, [guardian?.id]);

  if (loading || !tokenUrl) {
    return <div className="text-[12px] text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Preparing consent message...</div>;
  }

  const isPending = kid.photoConsent === undefined;
  const message2 = isPending
    ? buildAskMessage(kid.name, guardian?.name || null, tokenUrl)
    : buildConfirmMessage(kid.name, guardian?.name || null, kid.photoConsent as Record<string, boolean>, tokenUrl);

  return (
    <MessagePreview
      label={isPending ? 'Message 2B - asking for permission' : 'Message 2A - confirming what they agreed to'}
      text={message2}
      phone={guardian?.phone || ''}
      onCopy={() => onCopy(message2, 'm2')}
      copied={copiedKey === 'm2'}
    />
  );
}

function MessagePreview({ label, text, phone, onCopy, copied }: { label: string; text: string; phone: string; onCopy: () => void; copied: boolean }) {
  const waUrl = `https://api.whatsapp.com/send?phone=${toWaPhone(phone)}&text=${encodeURIComponent(text)}`;
  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <pre className="text-[12px] text-slate-600 whitespace-pre-wrap font-sans">{text}</pre>
      <div className="flex gap-2">
        <a href={waUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
          <Send size={11} /> Open in WhatsApp
        </a>
        <button onClick={onCopy} className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
          {copied ? <Check size={11} /> : <Copy size={11} />} Copy
        </button>
      </div>
    </div>
  );
}

function UsageTab({ photos, sessionId }: { photos: Photo[]; sessionId: string }) {
  const [needsRemoval, setNeedsRemoval] = useState<any[]>([]);
  const [loadingRemoval, setLoadingRemoval] = useState(true);
  const photoIds = useMemo(() => new Set(photos.map(p => p.id)), [photos]);

  async function loadNeedsRemoval() {
    setLoadingRemoval(true);
    const res = await fetch('/admin/api/session-photos/usage?needsRemoval=true');
    const data = await res.json();
    setNeedsRemoval((data.rows || []).filter((r: any) => photoIds.has(r.photo_id)));
    setLoadingRemoval(false);
  }

  useEffect(() => { loadNeedsRemoval(); }, [photos.length]);

  async function markRemoved(id: string) {
    await fetch('/admin/api/session-photos/usage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await loadNeedsRemoval();
  }

  return (
    <div className="space-y-8">
      {needsRemoval.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-rose-700 flex items-center gap-1.5"><AlertTriangle size={15} /> Needs removal - consent withdrawn</h3>
          {needsRemoval.map(row => (
            <div key={row.id} className="flex items-center justify-between bg-white rounded-xl p-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <span className="text-[12px] text-slate-600">{row.destination} - published {new Date(row.published_at).toLocaleDateString()}</span>
              </div>
              <button onClick={() => markRemoved(row.id)} className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">Mark removed</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {photos.map(photo => <UsageLogCard key={photo.id} photo={photo} onLogged={loadNeedsRemoval} />)}
      </div>
    </div>
  );
}

function UsageLogCard({ photo, onLogged }: { photo: Photo; onLogged: () => void }) {
  const [destination, setDestination] = useState(DESTINATIONS[0].key);
  const [logging, setLogging] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function log() {
    setLogging(true);
    setWarnings([]);
    try {
      const res = await fetch('/admin/api/session-photos/usage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, destination, publishedBy: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWarnings(data.warnings || []);
      onLogged();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="w-full aspect-square object-cover" />
      <div className="p-3 space-y-2">
        <select value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5">
          {DESTINATIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <button onClick={log} disabled={logging} className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white bg-slate-900 rounded-lg py-2 disabled:opacity-50">
          {logging ? <Loader2 size={12} className="animate-spin" /> : <ClipboardList size={12} />} Log publish
        </button>
        {warnings.map((w, i) => (
          <p key={i} className="text-[11px] text-amber-600 flex items-start gap-1"><AlertTriangle size={11} className="shrink-0 mt-0.5" /> {w}</p>
        ))}
      </div>
    </div>
  );
}
