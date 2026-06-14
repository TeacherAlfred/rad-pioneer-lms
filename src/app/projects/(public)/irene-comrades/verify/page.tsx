'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import Link from 'next/link';

function VerifyHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your magic code...');

  useEffect(() => {
    if (code) {
      processVerification(code);
    } else {
      setStatus('error');
      setMessage('No magic code found in the link.');
    }
  }, [code]);

  const processVerification = async (magicCode: string) => {
    try {
      // 1. Find the voter
      const { data, error } = await supabase
        .from('irene_voters')
        .select('id, is_verified')
        .eq('magic_code', magicCode.toUpperCase())
        .single();

      if (error || !data) throw new Error("Invalid or expired code.");
      
      if (data.is_verified) {
        setStatus('success');
        setMessage("You are already verified! Your votes are locked in.");
        triggerConfetti();
        return;
      }

      // 2. Mark as verified
      const { error: updateErr } = await supabase
        .from('irene_voters')
        .update({ is_verified: true })
        .eq('id', data.id);

      if (updateErr) throw updateErr;

      // 3. Success! Update local storage so the device knows it's verified
      localStorage.setItem('irene_voter_id', data.id);
      setStatus('success');
      setMessage("Verification Complete! Your votes are permanently locked in.");
      triggerConfetti();

    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  const triggerConfetti = () => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#0066cc', '#34d399'] });
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6">
      <div className="bg-white p-10 rounded-[32px] shadow-xl max-w-md w-full text-center border border-slate-100">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center animate-pulse">
            <Loader2 className="animate-spin text-[#0066cc] mb-4" size={48} />
            <h2 className="text-xl font-black text-slate-900">Checking Code...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="text-emerald-500" size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Locked In! 🔒</h2>
            <p className="text-slate-500 text-sm mb-8">{message}</p>
            <Link href="/projects/irene-comrades" className="w-full py-4 bg-[#0066cc] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#0066cc]/20 block">
              Return to Leaderboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
              <XCircle className="text-rose-500" size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Oops!</h2>
            <p className="text-slate-500 text-sm mb-8">{message}</p>
            <Link href="/projects/irene-comrades" className="w-full py-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-widest transition-colors block">
              Return to Leaderboard
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

// Next.js requires SearchParams to be wrapped in a Suspense boundary
export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyHandler />
    </Suspense>
  );
}