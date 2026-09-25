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

// Screenshot slot. Until a lab's real image exists (`src` blank), renders a
// labelled placeholder from the alt text, so the page never shows a broken
// image and authors can see exactly what's still needed.
export function Shot({ shot, label, sizes = '(max-width: 768px) 100vw, 720px' }: { shot: Screenshot; label: string; sizes?: string }) {
  const src = shot.src?.trim();
  const valid = !!src && /^https:\/\//.test(src);
  return (
    <div className={`${s.shot} ${shot.ratio === '4/3' ? s.shot43 : ''}`}>
      {valid ? (
        <Image src={src} alt={shot.alt} fill sizes={sizes} unoptimized={!optimisable(src)} />
      ) : (
        <div className={s.shotPlaceholder} role="img" aria-label={shot.alt}>
          <span className={s.shotLabel}>{label}</span>
          <p className={s.shotDesc}>{shot.alt}</p>
        </div>
      )}
    </div>
  );
}
