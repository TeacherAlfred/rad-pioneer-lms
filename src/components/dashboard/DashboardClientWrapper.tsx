"use client";

import { MissionProvider } from "@/context/MissionContext";
import FloatingStudentChat from "@/components/student/FloatingStudentChat";

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
      {/* Drops the global chat into every page wrapped by this component */}
      <FloatingStudentChat />
    </MissionProvider>
  );
}