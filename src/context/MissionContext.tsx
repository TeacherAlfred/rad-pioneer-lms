"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// 1. Data Contract for our Global State
interface MissionState {
  xp: number;
  currentLevel: {
    name: string;
    code: string;
    accentColor: string;
    xpRequired: number;
  };
  nextLevel: {
    name: string;
    xpRequired: number;
  } | null;
  blueprint: Record<string, any>; // Stores active choices for the current mission
}

const MissionContext = createContext<any>(null);

export function MissionProvider({ children, initialStats }: { children: React.ReactNode, initialStats: any }) {
  // 2. Safe Fallback: If no student is logged in, use "Explorer" defaults
  const defaultStats = {
    xp: 0,
    currentLevel: { name: "Explorer", code: "EXPLORER", accentColor: "#94a3b8", xpRequired: 0 },
    nextLevel: { name: "Builder", xpRequired: 100 },
    blueprint: {}
  };

  const [stats, setStats] = useState<MissionState>(initialStats || defaultStats);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [pendingXp, setPendingXp] = useState<{amount: number, id: number} | null>(null);
  
  const prevLevelCode = useRef(initialStats?.currentLevel?.code || "EXPLORER");

  // Sync state if initialStats changes (e.g., after login)
  useEffect(() => {
    if (initialStats) {
      setStats(prev => ({ ...prev, ...initialStats }));
      prevLevelCode.current = initialStats.currentLevel?.code;
    }
  }, [initialStats]);

  // LEVEL UP WATCHER: The "Celebration" Trigger
  useEffect(() => {
    const currentCode = stats.currentLevel.code;
    if (currentCode !== prevLevelCode.current) {
      setShowLevelUp(true);
      prevLevelCode.current = currentCode;
    }
  }, [stats.currentLevel.code]);

  // MISSION ACTIONS
  const awardXP = async (amount: number, actionKey: string, ids: any) => {
    // Optimistic Update
    setPendingXp({ amount, id: Date.now() });
    setStats(prev => ({ ...prev, xp: prev.xp + amount }));

    try {
      const res = await fetch('/api/student/award-xp', {
        method: 'POST',
        body: JSON.stringify({ actionKey, ...ids })
      });
      
      if (res.ok) {
        const freshData = await fetch('/api/student/xp-profile').then(r => r.json());
        setStats(prev => ({ ...prev, ...freshData }));
      }
    } catch (e) {
      console.error("Uplink failed", e);
    }
    setTimeout(() => setPendingXp(null), 3000);
  };

  const updateBlueprint = (key: string, value: any) => {
    // This makes the sidebar update instantly when a student types/selects
    setStats(prev => ({
      ...prev,
      blueprint: { ...prev.blueprint, [key]: value }
    }));
  };

  return (
    <MissionContext.Provider value={{ stats, awardXP, updateBlueprint, pendingXp, showLevelUp, setShowLevelUp }}>
      {children}
    </MissionContext.Provider>
  );
}

export const useMission = () => {
  const context = useContext(MissionContext);
  if (!context) throw new Error("useMission must be used within a MissionProvider");
  return context;
};