import { createHash } from "node:crypto";
import type { generateClient } from "aws-amplify/data";
import type { Schema } from "../../data/resource";

type Db = ReturnType<typeof generateClient<Schema>>;

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

/**
 * The caller's active org, provided they're an Admin of it. Users made before
 * Memberships existed have none, so their User.role stands in.
 */
export async function requireAdminOrg(db: Db, profileOwner: string, deniedMessage: string) {
  const { data: users } = await db.models.User.listUserByProfileOwner({ profileOwner });
  const me = users[0];
  if (!me?.orgId) throw new Error("You're not part of an organisation.");

  const { data: memberships } = await me.memberships();
  const membership = memberships.find((m) => m.orgId === me.orgId);
  const isAdmin = membership ? membership.role === "admin" : me.role === "Admin";
  if (!isAdmin) throw new Error(deniedMessage);

  const { data: org } = await db.models.Organisation.get({ id: me.orgId });
  if (!org) throw new Error("Organisation not found.");
  return { me, org };
}
