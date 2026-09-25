'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { Screenshot } from '@/content/labs/types';
import s from '@/app/labs/[slug]/rad-lab.module.css';

// Hosts next.config.ts already allows for image optimisation. Anything else
// (e.g. an R2 bucket on a custom domain pasted in the admin) is still shown,
// just served as-is instead of through the optimiser.
function optimisable(src: string): boolean {
  try {
    const host = new URL(src).hostname;
    return host.endsWith('.r2.dev') || host === 'vzyraeuyyoytditmfvcc.supabase.co';
  } catch {
    return false;
  }
}

// A slot's link can be an image or a video (both hosted on R2). Decided by
// file extension, ignoring any ?query or #fragment.
const VIDEO_EXT = /\.(mp4|webm|m4v)$/i;
export function isVideoSrc(src: string): boolean {
  try {
    return VIDEO_EXT.test(new URL(src).pathname);
  } catch {
    return false;
  }
}

// `#t=0.1` makes browsers (notably iOS Safari) paint the first frame as the
// poster instead of a blank box before playback starts.
const withPosterFrame = (src: string) => (src.includes('#') ? src : `${src}#t=0.1`);

// Shared "view only" props: no download button, no picture-in-picture, no
// save-as menu. (A determined visitor can still screen-record; this just
// removes every easy save path.)
const noSave = {
  controlsList: 'nodownload noplaybackrate noremoteplayback',
  disablePictureInPicture: true,
  disableRemotePlayback: true,
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
} as const;

// Screenshot slot. Until a lab's real media exists (`src` blank), renders a
// labelled placeholder from the alt text. With media, the slot is a button
// that opens it full-size in a lightbox. Videos play inline muted + looped
// (like a GIF - ideal for short screen recordings) only while on screen,
// and never autoplay for visitors who've asked for reduced motion.
export function Shot({ shot, label, sizes = '(max-width: 768px) 100vw, 720px' }: { shot: Screenshot; label: string; sizes?: string }) {
  const [open, setOpen] = useState(false);
  const src = shot.src?.trim();
  const valid = !!src && /^https:\/\//.test(src);
  const video = valid && isVideoSrc(src);
  const ratioCls = `${s.shot} ${shot.ratio === '4/3' ? s.shot43 : ''}`;

  if (!valid) {
    return (
      <div className={ratioCls}>
        <div className={s.shotPlaceholder} role="img" aria-label={shot.alt}>
          <span className={s.shotLabel}>{label}</span>
          <p className={s.shotDesc}>{shot.alt}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${ratioCls} ${s.shotButton}`}
        onClick={() => setOpen(true)}
        aria-label={`${video ? 'Play video larger' : 'View larger'}: ${shot.alt}`}
      >
        {video ? (
          <InlineVideo src={src} hold={open} />
        ) : (
          <Image
            src={src}
            alt={shot.alt}
            fill
            sizes={sizes}
            unoptimized={!optimisable(src)}
            draggable={false}
            onContextMenu={e => e.preventDefault()}
          />
        )}
        <span className={s.shotZoomHint} aria-hidden="true">
          {video ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1.8v8.4L10 6 3 1.8Z" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
          {video ? 'Watch larger' : 'View larger'}
        </span>
      </button>
      {open && <Lightbox src={src} alt={shot.alt} video={video} optimise={optimisable(src)} onClose={() => setOpen(false)} />}
    </>
  );
}

// Muted, looping, inline preview. Plays only while actually visible - the
// observer also sees slider panels that are translated out of view (their
// overflow-hidden viewport clips them), so off-screen steps don't burn data.
// `hold` pauses it while the same clip is open in the lightbox.
function InlineVideo({ src, hold }: { src: string; hold: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const holdRef = useRef(hold);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting && entry.intersectionRatio > 0.35;
      if (visible.current && !holdRef.current) v.play().catch(() => { /* autoplay refused - poster frame stays */ });
      else v.pause();
    }, { threshold: [0, 0.35, 0.7] });
    io.observe(v);
    return () => { io.disconnect(); v.pause(); };
  }, [src]);

  useEffect(() => {
    holdRef.current = hold;
    const v = ref.current;
    if (!v) return;
    if (hold) v.pause();
    else if (visible.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {});
  }, [hold]);

  return (
    <video
      ref={ref}
      className={s.shotMedia}
      src={withPosterFrame(src)}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      {...noSave}
    />
  );
}

function Lightbox({ src, alt, video, optimise, onClose }: { src: string; alt: string; video: boolean; optimise: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      // Keep focus inside: the close button, plus the video's controls.
      const stops = [closeRef.current, videoRef.current].filter(Boolean) as HTMLElement[];
      const i = stops.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      stops[(i + (e.shiftKey ? stops.length - 1 : 1)) % stops.length]?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  // Portal to the lab page root: the slider track and hovered cards use
  // CSS transforms, which would otherwise trap a position:fixed overlay
  // inside them. The page root (not body) keeps the lab's design tokens.
  const host = document.getElementById('radlab') ?? document.body;

  return createPortal(
    <div className={s.lightbox} role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button ref={closeRef} type="button" className={s.lightboxClose} onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      <figure className={s.lightboxFigure} onClick={e => e.stopPropagation()}>
        {video ? (
          // Opened by a click, so playback with sound is allowed to start.
          <video
            ref={videoRef}
            className={s.lightboxVideo}
            src={src}
            controls
            autoPlay
            playsInline
            preload="auto"
            aria-label={alt}
            {...noSave}
          />
        ) : (
          <div className={s.lightboxFrame}>
            <Image
              src={src}
              alt={alt}
              fill
              sizes="92vw"
              unoptimized={!optimise}
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              className={s.lightboxImg}
            />
          </div>
        )}
        <figcaption className={s.lightboxCaption}>{alt}</figcaption>
      </figure>
    </div>,
    host,
  );
}
