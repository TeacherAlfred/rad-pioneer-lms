"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

// Import our new Modular Components
import VaultHero from "@/components/vault/VaultHero";
import VaultGallery from "@/components/vault/VaultGallery";
import VaultUpsell from "@/components/vault/VaultUpsell";

export default function VaultPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vaultData, setVaultData] = useState<any>(null);
  const [guardianProfile, setGuardianProfile] = useState<any>(null);

  useEffect(() => {
    if (!token) return;

    async function fetchVault() {
      try {
        const { data: share, error: shareErr } = await supabase
          .from('media_shares')
          .select('*')
          .eq('token', token)
          .single();

        if (shareErr || !share) throw new Error("Vault not found or link has expired.");
        if (new Date() > new Date(share.expires_at)) throw new Error("For your family's security, this vault link has expired.");

        const { error: rpcError } = await supabase.rpc('increment_view_count', { share_id: share.id });
        if (rpcError) {
          await supabase.from('media_shares').update({ view_count: share.view_count + 1 }).eq('id', share.id);
        }

        setVaultData(share);

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, status, account_tier')
          .eq('id', share.guardian_id)
          .single();

        if (profile) setGuardianProfile(profile);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchVault();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 animate-pulse">Decrypting Vault...</p>
      </div>
    );
  }

  if (error || !vaultData) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-8 border border-rose-500/20 shadow-[0_0_40px_rgba(244,63,94,0.2)]">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-4xl font-black uppercase italic text-white tracking-tighter mb-4">Vault Inaccessible</h1>
        <p className="text-slate-400 max-w-sm leading-relaxed mb-10 font-medium">{error}</p>
        <button onClick={() => router.push('/')} className="px-10 py-5 bg-white text-slate-900 hover:bg-slate-200 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl hover:-translate-y-1">
          Return Home
        </button>
      </div>
    );
  }

  const mediaPayload = vaultData.media_payload || [];
  const kidsNames = Array.from(new Set(mediaPayload.flatMap((m: any) => m.student_name.split(' & ')))).join(' & ');

  const tier = guardianProfile?.account_tier || 'none';
  const isEnrolled = tier === 'full' || tier === 'lms_access' || tier === 'bootcamp';
  const isTrial = tier === 'lms_trial';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-slate-200 overflow-x-hidden flex flex-col">
      
      <main className="max-w-5xl mx-auto px-6 sm:px-12 pt-12 pb-24 relative z-10 flex flex-col items-center w-full space-y-12 md:space-y-16">
        
        <VaultHero kidsNames={kidsNames} />
        
        <VaultGallery media={mediaPayload} />
        
        <div className="w-full">
          <VaultUpsell isEnrolled={isEnrolled} isTrial={isTrial} kidsNames={kidsNames} />
        </div>

      </main>

      {/* Footer Branding */}
      <footer className="w-full pb-8 text-center pointer-events-none z-20 mt-auto">
        <Image 
          src="https://vzyraeuyyoytditmfvcc.supabase.co/storage/v1/object/public/rad-assets/branding/RAD-Logo.png" 
          alt="RAD Academy" 
          width={120} height={40} 
          unoptimized 
          className="mx-auto opacity-20 grayscale filter contrast-200"
        />
      </footer>
    </div>
  );
}