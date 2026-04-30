import { supabase } from "@/lib/supabase";

/**
 * Core function that checks the global event multiplier.
 */
export async function calculateEventXp(baseXp: number): Promise<number> {
    try {
        const { data: config, error } = await supabase
            .from('system_settings')
            .select('xp_multiplier, xp_start_date, xp_end_date')
            .eq('id', 1)
            .single();
        
        if (error || !config) return baseXp;

        const now = new Date();
        const start = config.xp_start_date ? new Date(config.xp_start_date) : null;
        const end = config.xp_end_date ? new Date(config.xp_end_date) : null;

        const isAfterStart = !start || now >= start;
        const isBeforeEnd = !end || now <= end;

        if (isAfterStart && isBeforeEnd) {
            return Math.floor(baseXp * Number(config.xp_multiplier));
        }
        
        return baseXp; 
    } catch (e) {
        console.error("XP Multiplier Error:", e);
        return baseXp; 
    }
}

/**
 * Calculates XP with a 75% reduction per attempt, then applies the global multiplier.
 */
export async function calculateDiminishingXP(baseReward: number, previousAttempts: number): Promise<number> {
  let calculatedXp = baseReward;
  
  if (previousAttempts > 0) {
    const diminishingMultiplier = Math.pow(0.75, previousAttempts);
    calculatedXp = Math.round(baseReward * diminishingMultiplier);
    calculatedXp = Math.max(calculatedXp, 5); 
  }

  // Pass the diminished result through the global multiplier!
  return await calculateEventXp(calculatedXp);
}