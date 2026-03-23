import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export type StudentXpProfile = {
  totalXp: number;
  currentLevel: {
    code: string;
    name: string;
    orderIndex: number;
    xpRequired: number;
    accentColor: string | null;
    description: string | null;
  } | null;
  nextLevel: {
    code: string;
    name: string;
    orderIndex: number;
    xpRequired: number;
    accentColor: string | null;
    description: string | null;
  } | null;
  xpToNextLevel: number | null;
  progressPercentage: number;
};

type PioneerLevelRow = {
  id: number;
  code: string;
  name: string;
  order_index: number;
  xp_required: number;
  accent_color: string | null;
  description: string | null;
  is_active: boolean;
};

export async function getStudentXpProfile(
  studentId: string
): Promise<StudentXpProfile> {
  const supabase = await createSupabaseServerComponentClient();

  const [{ data: xpRows, error: xpError }, { data: levelRows, error: levelError }] =
    await Promise.all([
      supabase
        .from("student_xp_transactions")
        .select("xp_delta")
        .eq("student_id", studentId),

      supabase
        .from("pioneer_levels")
        .select(
          "id, code, name, order_index, xp_required, accent_color, description, is_active"
        )
        .eq("is_active", true)
        .order("order_index", { ascending: true }),
    ]);

  if (xpError) {
    throw new Error(`Failed to load student XP: ${xpError.message}`);
  }

  if (levelError) {
    throw new Error(`Failed to load pioneer levels: ${levelError.message}`);
  }

  const totalXp = (xpRows ?? []).reduce(
    (sum, row) => sum + Number(row.xp_delta ?? 0),
    0
  );

  const levels = (levelRows ?? []) as PioneerLevelRow[];

  if (levels.length === 0) {
    return {
      totalXp,
      currentLevel: null,
      nextLevel: null,
      xpToNextLevel: null,
      progressPercentage: 0,
    };
  }

  let currentLevel = levels[0];

  for (const level of levels) {
    if (totalXp >= Number(level.xp_required)) {
      currentLevel = level;
    } else {
      break;
    }
  }

  const currentIndex = levels.findIndex((level) => level.code === currentLevel.code);
  const nextLevel =
    currentIndex >= 0 && currentIndex < levels.length - 1
      ? levels[currentIndex + 1]
      : null;

  let xpToNextLevel: number | null = null;
  let progressPercentage = 100;

  if (nextLevel) {
    xpToNextLevel = Math.max(0, Number(nextLevel.xp_required) - totalXp);

    const currentFloor = Number(currentLevel.xp_required);
    const nextCeiling = Number(nextLevel.xp_required);
    const range = Math.max(1, nextCeiling - currentFloor);
    const progressInRange = Math.max(0, totalXp - currentFloor);

    progressPercentage = Math.min(
      100,
      Math.max(0, Math.round((progressInRange / range) * 100))
    );
  }

  return {
    totalXp,
    currentLevel: {
      code: currentLevel.code,
      name: currentLevel.name,
      orderIndex: Number(currentLevel.order_index),
      xpRequired: Number(currentLevel.xp_required),
      accentColor: currentLevel.accent_color ?? null,
      description: currentLevel.description ?? null,
    },
    nextLevel: nextLevel
      ? {
          code: nextLevel.code,
          name: nextLevel.name,
          orderIndex: Number(nextLevel.order_index),
          xpRequired: Number(nextLevel.xp_required),
          accentColor: nextLevel.accent_color ?? null,
          description: nextLevel.description ?? null,
        }
      : null,
    xpToNextLevel,
    progressPercentage,
  };
}