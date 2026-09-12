// DEV ONLY. Lets the RoleSwitcher pretend the signed-in user is in a different
// Cognito group so you can preview each role's UI without re-signing-in.
//
// Only the frontend is affected: `can()` and `has()` use the override, but every
// query still runs with the real token, so the backend keeps scoping data by the
// real group. Never active in a production build (import.meta.env.DEV is false).
//
// To remove: delete src/dev/, and the two lines that reference it in
// src/context/UserContext.tsx and src/App.tsx.

const KEY = 'dev:groupOverride';

export function readGroupOverride(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeGroupOverride(group: string | null) {
  try {
    if (group) sessionStorage.setItem(KEY, group);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
