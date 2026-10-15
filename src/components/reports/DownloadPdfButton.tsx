"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2, Check } from 'lucide-react';
import s from './ReportCard.module.css';

// Fetches the stored PDF (the first download of a revision may take a few
// seconds while it renders) and saves it with the server's filename.
export default function DownloadPdfButton({ href }: { href: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function download() {
    setState('loading');
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'RAD-Academy-Report.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className={s.actions}>
      <motion.button
        type="button"
        className={s.btn}
        onClick={download}
        disabled={state === 'loading'}
        whileTap={{ scale: 0.97 }}
      >
        {state === 'loading' ? <Loader2 size={18} className="animate-spin" /> : state === 'done' ? <Check size={18} /> : <Download size={18} />}
        {state === 'loading' ? 'Preparing PDF…' : state === 'done' ? 'Downloaded' : 'Download PDF report'}
      </motion.button>
      <p className={s.msg} aria-live="polite">
        {state === 'error' ? "The PDF didn't download. Check your connection and try again." : ''}
      </p>
    </div>
  );
}
