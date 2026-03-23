"use client";

import { MissionProvider } from "@/context/MissionContext";

export default function DashboardClientWrapper({ 
  children, 
  initialStats 
}: { 
  children: React.ReactNode; 
  initialStats: any 
}) {
  return (
    <MissionProvider initialStats={initialStats}>
      {children}
    </MissionProvider>
  );
}