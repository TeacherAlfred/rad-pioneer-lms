// Lightweight, no-login identity for topic voting (spec-adjacent to the
// Tutorial Hub's own "identification only when needed, never a gate"
// principle). voterId is a random id, not a real identity - just enough
// to make a vote togglable and stop the same browser voting for the same
// topic twice. The optional notify-me phone is asked once per browser,
// the first time someone votes, then reused for every vote after.

const VOTER_ID_KEY = "rad_tutorial_topic_voter_id";
const VOTER_PHONE_KEY = "rad_tutorial_topic_voter_phone";
const VOTER_PHONE_PROMPTED_KEY = "rad_tutorial_topic_voter_phone_prompted";

export function getOrCreateVoterId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(VOTER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(VOTER_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function getStoredVoterPhone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOTER_PHONE_KEY);
  } catch {
    return null;
  }
}

export function setStoredVoterPhone(phone: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOTER_PHONE_KEY, phone);
  } catch {
    // best-effort, same as the rest of this file
  }
}

export function hasBeenPromptedForPhone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(VOTER_PHONE_PROMPTED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markPromptedForPhone() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOTER_PHONE_PROMPTED_KEY, "1");
  } catch {
    // best-effort
  }
}
