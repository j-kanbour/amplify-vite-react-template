import { createHash } from "node:crypto";

/** How long an invite link works for. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const INVITE_ROLES = ["Admin", "Tutor"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
export const isInviteRole = (value: unknown): value is InviteRole =>
  INVITE_ROLES.includes(value as InviteRole);

/** Membership.role uses lowercase values. */
export const toMembershipRole = (role: InviteRole) => role.toLowerCase() as "admin" | "tutor";

/** Invites store only this, so reading the table never yields a working link. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const normaliseEmail = (email: string) => email.trim().toLowerCase();
