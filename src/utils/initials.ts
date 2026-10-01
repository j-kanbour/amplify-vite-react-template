/** "Mia Tran" -> "MT". Used wherever a person or org has no picture. */
export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

const AVATAR_COLORS = ['var(--ts-orange)', 'var(--ts-pink)', 'var(--ts-blue)', 'var(--ts-teal)', 'var(--ts-gold)'];

/** A stable brand colour per person, so their avatar looks the same everywhere. */
export function avatarColor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
