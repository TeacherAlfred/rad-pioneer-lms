"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface ReaderSettings {
  vaultPin: string;
}

const FALLBACK_SETTINGS: ReaderSettings = { vaultPin: "112358" };

/**
 * Shared between v1 (reader) and v2 (reader-v2) - the vault PIN was
 * previously a hardcoded constant duplicated in both, which let them drift.
 * One row, one source of truth.
 */
export async function getReaderSettings(): Promise<ReaderSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rad_reader_settings")
    .select("vault_pin")
    .eq("id", true)
    .single();

  if (error || !data) return FALLBACK_SETTINGS;
  return { vaultPin: data.vault_pin };
}

export async function updateVaultPin(newPin: string) {
  if (!/^\d{4,10}$/.test(newPin)) {
    throw new Error("PIN must be 4-10 digits.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rad_reader_settings")
    .update({ vault_pin: newPin, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) throw new Error(error.message);

  revalidatePath("/projects/reader");
  revalidatePath("/projects/reader-v2");
}
