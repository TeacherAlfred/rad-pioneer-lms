export const SANDBOX_ENGINES: Record<string, any> = {
  makecode: {
    id: "makecode",
    name: "MakeCode",
    url: "https://makecode.microbit.org/",
    getProjectUrl: (id: string) => `https://makecode.microbit.org/#pub:${id}`,
    messages: {
      success: "Your logic is sound.\nYou are now cleared to build this in the full MakeCode environment.",
      sos: "Don't worry, Pioneer! Take a screenshot of the MakeCode step where you got stuck and upload it here. Your coach will review your code and help you troubleshoot.",
      captureIntro: "Make sure you have tested your MakeCode logic in the simulator. Once you are ready, submit a screenshot to clear this sector.",
      captureCode: "Open your MakeCode studio, assemble your logic blocks exactly as planned, and submit a screenshot to clear this sector."
    }
  },
  scratch: {
    id: "scratch",
    name: "Scratch",
    url: "https://scratch.mit.edu/projects/editor/",
    getProjectUrl: (id: string) => `https://scratch.mit.edu/projects/${id}/editor/`, 
    messages: {
      success: "Your logic is sound.\nYou are now cleared to build this in the full Scratch environment.",
      sos: "Don't worry, Creator! Take a screenshot of your Scratch script where you got stuck and upload it here. Your guide will review your code and help you.",
      captureIntro: "Make sure you have tested your Scratch logic. Once you are ready, submit a screenshot of your workspace to clear this sector.",
      captureCode: "Open your Scratch studio, assemble your logic blocks exactly as planned, and submit a screenshot to clear this sector."
    }
  }
};

export const COURSE_THEMES: Record<string, any> = {
  rad_default: {
    id: "rad_default",
    name: "RAD Pioneer",
    ui: {
      background: "bg-[#020617]",
      panelBg: "bg-[#0f172a]",
      primaryBtn: "bg-blue-600 text-white hover:scale-105 shadow-blue-500/30 border-blue-400/50",
      primaryText: "text-blue-400",
      primaryBorder: "border-white/10",
      secondaryBtn: "bg-purple-600 text-white hover:scale-105 shadow-purple-500/30 border-purple-500",
      secondaryText: "text-purple-500",
      secondaryBorder: "border-purple-500/30",
      accent: "text-green-400",
      accentBg: "bg-green-500/20 border-green-500/30"
    },
    terminology: {
      student: "Pioneer",
      coach: "Logic Guide",
      briefing: "Mission Briefing",
      capture: "System Capture",
      success: "Mission Accomplished"
    }
  },
  scratch_premium: {
    id: "scratch_premium",
    name: "Scratch Creator",
    ui: {
      background: "bg-slate-50",
      panelBg: "bg-white",
      primaryBtn: "bg-gradient-to-b from-blue-400 to-blue-500 text-white hover:scale-105 shadow-blue-500/30 border-blue-400 shadow-md",
      primaryText: "text-blue-500",
      primaryBorder: "border-slate-200",
      secondaryBtn: "bg-gradient-to-b from-orange-400 to-orange-500 text-white hover:scale-105 shadow-orange-500/30 border-orange-400 shadow-md",
      secondaryText: "text-orange-500",
      secondaryBorder: "border-orange-200",
      accent: "text-emerald-500",
      accentBg: "bg-emerald-50 border-emerald-200"
    },
    terminology: {
      student: "Creator",
      coach: "Scratch Guide",
      briefing: "Studio Briefing",
      capture: "Save & Share",
      success: "Game Saved!"
    }
  }
};

export function getActiveEngine(parsedConfig: any, fallbackSandboxType: string = 'makecode') {
  const str = JSON.stringify(parsedConfig || {}).toLowerCase();
  // Aggressive Scratch Detection
  if (parsedConfig?.target_engine?.toLowerCase() === 'scratch' || str.includes('scratch')) {
    return SANDBOX_ENGINES['scratch'];
  }
  return SANDBOX_ENGINES[fallbackSandboxType] || SANDBOX_ENGINES['makecode'];
}

export function getActiveTheme(parsedConfig: any) {
  const themeId = parsedConfig?.ui_theme || 'rad_default';
  return COURSE_THEMES[themeId] || COURSE_THEMES['rad_default'];
}