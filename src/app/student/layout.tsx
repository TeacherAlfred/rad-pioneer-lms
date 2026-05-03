"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const sessionData = localStorage.getItem("pioneer_session");
    if (!sessionData) {
      router.push("/login");
      return;
    }

    const user = JSON.parse(sessionData);

    // If a trial user tries to access the main student area, yo-yo them back.
    // Exception: We allow them into /student/lesson/[id] because the trial hub uses the lesson player.
    if (user.active_tier === 'trial' && !pathname.includes('/student/lesson/')) {
      router.replace("/trial/hub");
      return;
    }

    setAuthorized(true);
  }, [router, pathname]);

  // Prevent UI flickering while the bouncer checks the list
  if (!authorized) return <div className="h-screen w-screen bg-[#020617]" />;

  return <>{children}</>;
}