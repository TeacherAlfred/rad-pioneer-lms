import { Instrument_Serif, Archivo, Fragment_Mono } from "next/font/google";
import { Toaster } from "sonner";

// Meridian's type system: a display serif for titles and thesis moments, a
// precision grotesque for UI, a mono face for small data (page numbers,
// specs) - loaded here rather than the root layout so it's only fetched for
// this route tree, not app-wide.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const fragmentMono = Fragment_Mono({
  variable: "--font-fragment-mono",
  weight: "400",
  subsets: ["latin"],
});

export default function ReaderV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${instrumentSerif.variable} ${archivo.variable} ${fragmentMono.variable} font-precision`}>
      {children}
      <Toaster
        position="bottom-center"
        theme="light"
        toastOptions={{
          classNames: {
            toast: "!rounded-2xl !shadow-2xl !border-0 !px-5 !py-3 !text-sm !font-bold",
            success: "!bg-emerald-600 !text-white",
            error: "!bg-rose-600 !text-white",
            default: "!bg-slate-900 !text-white",
          },
        }}
      />
    </div>
  );
}
