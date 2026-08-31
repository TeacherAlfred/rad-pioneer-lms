import { Toaster } from "sonner";
import CommandPalette from "./_components/command-palette";

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CommandPalette />
      <Toaster
        position="bottom-center"
        theme="light"
        toastOptions={{
          classNames: {
            toast:
              "!rounded-2xl !shadow-2xl !border-0 !px-5 !py-3 !text-sm !font-bold",
            success: "!bg-emerald-600 !text-white",
            error: "!bg-rose-600 !text-white",
            default: "!bg-slate-900 !text-white",
          },
        }}
      />
    </>
  );
}
