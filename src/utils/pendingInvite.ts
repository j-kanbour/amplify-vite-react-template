/**
 * The invite a visitor arrived with, kept across sign-up: email verification
 * and the Google redirect both leave the page, and either can finish in
 * another tab, so this lives in localStorage rather than the URL or session.
 */
export type PendingInvite = {
  token: string;
  orgName?: string | null;
  email?: string | null;
  savedAt: number;
};

const KEY = 'pendingInvite';
// Matches the invite's own lifetime (INVITE_TTL_MS in amplify/functions/employees/shared.ts)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function readPendingInvite(): PendingInvite | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const invite = JSON.parse(raw) as PendingInvite;
    if (!invite.token || Date.now() - invite.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return invite;
  } catch {
    return null;
  }
}

export function savePendingInvite(invite: Omit<PendingInvite, 'savedAt'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...invite, savedAt: Date.now() }));
  } catch {
    // Storage blocked: the accept page still has the token in its URL,
    // unless a Google redirect drops it
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
}
