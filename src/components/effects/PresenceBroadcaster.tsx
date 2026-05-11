"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PresenceBroadcaster() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // We trust the local storage session since Students don't use Supabase Auth
    const sessionData = localStorage.getItem("pioneer_session");
    if (!sessionData) {
      console.log("📡 [Broadcaster] No active session found in local storage.");
      return;
    }

    try {
      const user = JSON.parse(sessionData);
      
      const profileId = user.id;
      // Fallback to student_identifier if display_name is missing
      const displayName = user.display_name || user.student_identifier || user.name || 'Unknown Pioneer';
      const role = user.role || 'student';

      console.log(`📡 [Broadcaster] Connecting as: ${displayName} (${role})`);

      const channel = supabase.channel('rad_global_presence', {
        config: { presence: { key: profileId } }
      });

      channel.subscribe(async (status) => {
        console.log(`📡 [Broadcaster] Channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              id: profileId,
              name: displayName,
              role: role,
              page: pathname,
              online_at: new Date().toISOString()
            });
            console.log(`📡 [Broadcaster] Successfully tracking on ${pathname}`);
          } catch (trackErr) {
            console.warn("📡 [Broadcaster] Track failed. (Network blocked)", trackErr);
          }
        }
      });

      // Cleanup when navigating to a new page
      return () => {
        console.log("📡 [Broadcaster] Leaving page, removing channel.");
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn("📡 [Broadcaster] Silent failure.", err);
    }
  }, [pathname]);

  return null;
}