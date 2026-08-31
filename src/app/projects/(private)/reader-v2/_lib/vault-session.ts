// The vault has no persistent "unlocked" state anywhere - this sessionStorage
// flag is the only signal that a vault visit is in progress, set right
// before navigating to /vault and cleared the instant the main home page
// (re)mounts. That means leaving the vault for the main library, or closing
// any book you were reading, always drops you back to a locked state -
// there's nothing left checking for "was unlocked earlier."
const FLAG_KEY = "meridian:vaultUnlocked";

export function markVaultUnlocked() {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    // sessionStorage unavailable (e.g. private browsing edge cases) - vault route will redirect out.
  }
}

export function isVaultUnlocked(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearVaultUnlocked() {
  try {
    sessionStorage.removeItem(FLAG_KEY);
  } catch {
    // no-op
  }
}
