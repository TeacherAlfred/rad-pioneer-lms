import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MissionProvider } from "@/context/MissionContext";
import LevelUpCelebration from "@/components/effects/LevelUpCelebration";
import { PHProvider } from './providers'; // <-- 1. IMPORT POSTHOG PROVIDER
import AnalyticsTracker from "@/components/AnalyticsTracker"; // <-- IMPORT TRACKER
import AdminReturnBanner from "@/components/admin/AdminReturnBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAD Academy LMS",
  description: "Redefining African Dreams: A cutting-edge LMS for tech education, empowering the next generation of African innovators with immersive learning, real-world projects, and a vibrant community.",
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
      {/* 2. WRAP THE BODY WITH POSTHOG */}
      <PHProvider> 
        <body
          className={`${geistSans.variable} ${geistMono.variable} min-h-full bg-slate-950 text-slate-50 antialiased`}
          suppressHydrationWarning
        >
          <AdminReturnBanner />
          <AnalyticsTracker /> {/* 3. ADD THE ANALYTICS TRACKER */}
          <MissionProvider initialStats={mockInitialStats}>
            {children}
            <LevelUpCelebration />
          </MissionProvider>
        </body>
      </PHProvider>
    </html>
  );
}