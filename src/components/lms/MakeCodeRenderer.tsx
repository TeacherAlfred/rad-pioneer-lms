"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// Explicitly define the props for the Renderer
interface MakeCodeRendererProps {
  code: string;
}

export default function MakeCodeRenderer({ code }: MakeCodeRendererProps) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (ev: MessageEvent) => {
      if (ev.data.type === "renderblocks") {
        setLoading(false);
      }
    };
    window.addEventListener("message", handleMessage);
    
    // Inject code into the MakeCode Render Engine
    if (iframeRef.current && code) {
      const msg = {
        type: "renderblocks",
        id: "mission-logic",
        code: code
      };
      iframeRef.current.contentWindow?.postMessage(msg, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [code]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#020617] rounded-[32px] overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020617] gap-3">
          <Loader2 className="animate-spin text-blue-500" />
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rendering_Hardware_Logic...</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="https://makecode.microbit.org/--docs?render=1&lang=en"
        className="w-full h-full border-none pointer-events-none"
        title="MakeCode Block Renderer"
      />
    </div>
  );
}