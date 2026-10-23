import type { AppSyncIdentity, AppSyncIdentityCognito } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/employee-membership';
import type { Schema } from '../../../data/resource';
import { hashToken, isInviteRole, normaliseEmail, requireAdminOrg, toMembershipRole } from '../shared';

const TERMS_VERSION = '2026-09-01';
const PRIVACY_VERSION = '2026-09-01';

// Built on first invoke, not at import time: see the note in
// amplify/auth/post-confirmation/handler.ts.
let dbPromise: Promise<ReturnType<typeof generateClient<Schema>>> | undefined;

const getDb = () => {
  dbPromise ??= (async () => {
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    return generateClient<Schema>();
  })();
  return dbPromise;
};

type Db = ReturnType<typeof generateClient<Schema>>;
type Invite = Schema['EmployeeInvite']['type'];
type Preview = Schema['EmployeeInvitePreview']['type'];

const cognito = new CognitoIdentityProviderClient();

/** Signed-in callers only; the invite preview is also open to guests (IAM). */
function cognitoIdentity(identity: AppSyncIdentity | null | undefined) {
  const id = identity as AppSyncIdentityCognito | null | undefined;
  if (!id?.sub || !id.username || !('claims' in id)) throw new Error('Unauthorized');
  return { sub: id.sub, username: id.username, profileOwner: `${id.sub}::${id.username}` };
}

async function findInvite(db: Db, token: string): Promise<Invite | undefined> {
  if (!token) return undefined;
  const { data } = await db.models.EmployeeInvite.listEmployeeInviteByInviteTokenHash({
    inviteTokenHash: hashToken(token),
  });
  return data[0];
}

function inviteStatus(invite: Invite | undefined): Preview['status'] {
  if (!invite || invite.status === 'failed') return 'invalid';
  if (invite.status === 'accepted') return 'accepted';
  if (invite.status === 'revoked') return 'revoked';
  if (!invite.expiresAt || new Date(invite.expiresAt).getTime() < Date.now()) return 'expired';
  return 'valid';
}

/** For the invite link's landing page, before and after sign-in. */
async function previewEmployeeInvite(token: string): Promise<Preview> {
  const db = await getDb();
  const invite = await findInvite(db, token);
  const status = inviteStatus(invite);
  if (!invite || status === 'invalid') return { status: 'invalid' };
  return { status, orgName: invite.orgName, role: invite.role, email: invite.email, name: invite.name };
}

/**
 * Joins the caller to the invite's org and makes it their active org. Works
 * for brand-new accounts (no User record yet: one is created) and for people
 * already in other orgs (a Membership is added). Every step is safe to repeat,
 * and the invite is only marked accepted at the end, so a failure part way
 * through can be retried with the same link.
 */
async function acceptEmployeeInvite(
  identity: AppSyncIdentity | null | undefined,
  token: string,
  acceptedTerms: boolean
) {
  const caller = cognitoIdentity(identity);
  const db = await getDb();
  const userPoolId = env.AMPLIFY_AUTH_USERPOOL_ID;

  const invite = await findInvite(db, token);
  const status = inviteStatus(invite);
  if (!invite || status === 'invalid') throw new Error('This invite link is not valid.');
  if (status === 'revoked') throw new Error('This invite has been cancelled. Ask for a new one.');
  if (status === 'expired') throw new Error('This invite has expired. Ask for a new one.');
  if (!invite.orgId || !isInviteRole(invite.role)) throw new Error('This invite link is not valid.');

  // Whoever the link was forwarded to can't use it: the signed-in account
  // must own the invited address
  const { UserAttributes = [] } = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: caller.username })
  );
  const attr = (name: string) => UserAttributes.find((a) => a.Name === name)?.Value;
  const email = normaliseEmail(attr('email') ?? '');
  if (attr('email_verified') !== 'true' || email !== normaliseEmail(invite.email)) {
    throw new Error(`This invite was sent to ${invite.email}. Sign in with that email address to accept it.`);
  }

  const { data: existing } = await db.models.User.listUserByProfileOwner({
    profileOwner: caller.profileOwner,
  });
  let user = existing[0];

  if (status === 'accepted' && invite.acceptedBy !== user?.id) {
    throw new Error('This invite has already been used.');
  }

  if (!user) {
    if (!acceptedTerms) throw new Error('You must accept the Terms and Privacy Policy.');
    const { data: created, errors } = await db.models.User.create({
      name: invite.name || attr('name') || email,
      email,
      phone: invite.phone,
      role: invite.role,
      profileOwner: caller.profileOwner,
      orgId: invite.orgId,
      orgIds: [invite.orgId],
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    });
    if (errors?.length || !created) throw new Error(`Failed to create user: ${JSON.stringify(errors)}`);
    user = created;
  }

  const { data: memberships } = await user.memberships();
  const has = (orgId: string) => memberships.some((m) => m.orgId === orgId);

  // Users from before Memberships existed only have User.orgId and User.role.
  // Record that org first, so switching away from it doesn't lose it.
  if (user.orgId && user.orgId !== invite.orgId && !has(user.orgId) && user.role) {
    await createMembership(db, user.id, user.orgId, user.role.toLowerCase() as 'admin' | 'tutor' | 'parent');
  }
  if (!has(invite.orgId)) {
    await createMembership(db, user.id, invite.orgId, toMembershipRole(invite.role));
  }
  // orgIds lets each of the user's orgs' admins read their record
  const orgIds = [...new Set([...(user.orgIds ?? []), ...memberships.map((m) => m.orgId), user.orgId, invite.orgId])]
    .filter((id): id is string => !!id);
  if (user.orgId !== invite.orgId || orgIds.length !== (user.orgIds ?? []).length) {
    const { errors } = await db.models.User.update({ id: user.id, orgId: invite.orgId, orgIds });
    if (errors?.length) throw new Error(`Failed to update user: ${JSON.stringify(errors)}`);
  }

  // The token's groups come from amplify/auth/pre-token-generation; the
  // Cognito group only matters before the user has a User record
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: caller.username,
      GroupName: invite.role,
    })
  );

  if (status !== 'accepted') {
    const { errors } = await db.models.EmployeeInvite.update({
      id: invite.id,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      acceptedBy: user.id,
    });
    if (errors?.length) throw new Error(`Failed to update invite: ${JSON.stringify(errors)}`);
  }

  return { orgId: invite.orgId };
}

async function createMembership(db: Db, userId: string, orgId: string, role: 'admin' | 'tutor' | 'parent') {
  const { errors } = await db.models.Membership.create({ userId, orgId, role });
  if (errors?.length) throw new Error(`Failed to add membership: ${JSON.stringify(errors)}`);
}

/** Changes the caller's active org to another org they belong to. */
async function switchOrg(identity: AppSyncIdentity | null | undefined, orgId: string) {
  const caller = cognitoIdentity(identity);
  const db = await getDb();
  const { data: users } = await db.models.User.listUserByProfileOwner({ profileOwner: caller.profileOwner });
  const user = users[0];
  if (!user) throw new Error('Unauthorized');

  const { data: memberships } = await user.memberships();
  if (!memberships.some((m) => m.orgId === orgId)) {
    throw new Error("You're not a member of that organisation.");
  }
  const { errors } = await db.models.User.update({ id: user.id, orgId });
  if (errors?.length) throw new Error(`Failed to switch organisation: ${JSON.stringify(errors)}`);
  return { orgId };
}

type OrgRole = 'admin' | 'tutor' | 'parent';

/**
 * Makes an employee of the caller's active org an Admin or a Tutor of it.
 * Admins can't change their own role, so an org always keeps at least one.
 * Their next token picks up the change (see
 * amplify/auth/pre-token-generation/handler.ts).
 */
async function changeEmployeeRole(identity: AppSyncIdentity | null | undefined, userId: string, role: string) {
  const caller = cognitoIdentity(identity);
  const db = await getDb();
  const { me, org } = await requireAdminOrg(db, caller.profileOwner, 'Only admins can change roles.');
  if (!isInviteRole(role)) throw new Error('Role must be Admin or Tutor.');
  if (userId === me.id) throw new Error("You can't change your own role. Ask another admin to.");

  const { data: target } = await db.models.User.get({ id: userId });
  if (!target) throw new Error('Employee not found.');
  const { data: memberships } = await target.memberships();
  const membership = memberships.find((m) => m.orgId === org.id);
  // Users from before Memberships existed only have User.orgId and User.role
  const current = membership?.role ?? (target.orgId === org.id ? (target.role?.toLowerCase() as OrgRole | undefined) : undefined);
  if (!current) throw new Error(`${target.name} isn't a member of ${org.name}.`);
  if (current === 'parent') throw new Error("A parent's role can't be changed here.");

  const next = toMembershipRole(role);
  if (current !== next || !membership) {
    const { errors } = membership
      ? await db.models.Membership.update({ id: membership.id, role: next })
      : await db.models.Membership.create({ userId: target.id, orgId: org.id, role: next });
    if (errors?.length) throw new Error(`Failed to update membership: ${JSON.stringify(errors)}`);
  }
  // User.role is what the nav and profile show for the user's active org
  if (target.orgId === org.id && target.role !== role) {
    const { errors } = await db.models.User.update({ id: target.id, role });
    if (errors?.length) throw new Error(`Failed to update user: ${JSON.stringify(errors)}`);
  }
  if (!target.orgIds?.includes(org.id)) {
    const { errors } = await db.models.User.update({ id: target.id, orgIds: [...(target.orgIds ?? []), org.id] });
    if (errors?.length) throw new Error(`Failed to update user: ${JSON.stringify(errors)}`);
  }

  return { userId: target.id, role };
}

/**
 * Amplify invokes custom-operation handlers with its own payload, which has
 * fieldName at the top level. The AppSyncResolverEvent type (and
 * Schema[...]['functionHandler']) put it under `info`, which isn't sent.
 */
type Event = {
  fieldName?: string;
  info?: { fieldName?: string };
  arguments: Record<string, unknown>;
  identity?: AppSyncIdentity | null;
};

/** One function serves all four operations; the payload says which. */
export const handler = async (event: Event) => {
  const args = event.arguments ?? {};
  const str = (key: string) => (typeof args[key] === 'string' ? (args[key] as string) : '');
  const fieldName = event.fieldName ?? event.info?.fieldName;

  switch (fieldName) {
    case 'previewEmployeeInvite':
      return previewEmployeeInvite(str('token'));
    case 'acceptEmployeeInvite':
      return acceptEmployeeInvite(event.identity, str('token'), args.acceptedTerms === true);
    case 'switchOrg':
      return switchOrg(event.identity, str('orgId'));
    case 'changeEmployeeRole':
      return changeEmployeeRole(event.identity, str('userId'), str('role'));
    default:
      throw new Error(`Unknown field ${fieldName}`);
  }
};
