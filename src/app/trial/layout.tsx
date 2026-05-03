"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function TrialLayout({ children }: { children: React.ReactNode }) {
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
    const tier = user.role === 'student' ? user.active_tier : user.account_tier;

    // Bounce fully paid users OUT of the trial area into their real dashboards
    if (tier === 'full') {
      if (user.role === 'student') router.replace("/student/dashboard");
      if (user.role === 'guardian') router.replace("/parent/dashboard");
      return;
    }

    // Role Enforcement: Kids stay in the hub, Parents stay in the guardian portal
    if (user.role === 'student' && pathname.includes('/trial/guardian')) {
      router.replace('/trial/hub');
      return;
    }
    if (user.role === 'guardian' && pathname.includes('/trial/hub')) {
      router.replace('/trial/guardian');
      return;
    }

    setAuthorized(true);
  }, [router, pathname]);

  // Prevent UI flickering while the bouncer checks the list
  if (!authorized) return <div className="h-screen w-screen bg-[#020617]" />;

  return <>{children}</>;
}