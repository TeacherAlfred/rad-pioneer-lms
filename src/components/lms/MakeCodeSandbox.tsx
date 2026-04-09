"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface MakeCodeSandboxProps {
  missionId: string;
  code?: string;      // Add this
  isVerified?: boolean; // Add this
}

export default function MakeCodeSandbox({ missionId, code, isVerified }: MakeCodeSandboxProps) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // 1. Listen for the "renderblocks" message from MakeCode
    const handleMessage = (ev: MessageEvent) => {
      if (ev.data.type === "renderblocks") {
        setLoading(false);
      }
    };
    window.addEventListener("message", handleMessage);
    
    // 2. If we have code and we are in verified mode, send the render request
    if (iframeRef.current && isVerified && code) {
      // The code needs to be formatted for the Microbit compiler
      // We send a message to the iframe to render the blocks
      const msg = {
        type: "renderblocks",
        id: missionId,
        code: code
      };
      iframeRef.current.contentWindow?.postMessage(msg, "https://makecode.microbit.org/");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [code, isVerified, missionId]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#020617]">
      {loading && isVerified && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020617] gap-3">
          <Loader2 className="animate-spin text-blue-500" />
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Generating_Hardware_Visualization...</p>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        // render=1 tells Microsoft to use the block renderer, not the full editor
        src="https://makecode.microbit.org/--docs?render=1&lang=en"
        className="w-full h-full border-none pointer-events-none"
      />
    </div>
  );
}