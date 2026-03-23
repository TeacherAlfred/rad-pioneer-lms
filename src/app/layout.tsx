import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MissionProvider } from "@/context/MissionContext";
import LevelUpCelebration from "@/components/effects/LevelUpCelebration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAD Pioneer | Mission Control",
  description: "Gaming the future of learning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mockInitialStats = {
    currentXp: 550,
    currentLevel: { name: "Technician", minXp: 500, maxXp: 1000 },
    nextLevelXp: 1000
  };

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full bg-slate-950 text-slate-50 antialiased`}
        suppressHydrationWarning
      >
        <MissionProvider initialStats={mockInitialStats}>
          {children}
          <LevelUpCelebration />
        </MissionProvider>
      </body>
    </html>
  );
}