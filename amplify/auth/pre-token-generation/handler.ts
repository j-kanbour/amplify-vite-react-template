import type { PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/pre-token-generation';
import { type Schema } from '../../data/resource';

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

const ROLE_GROUPS = { admin: 'Admin', tutor: 'Tutor', parent: 'Parent' } as const;
type OrgRole = keyof typeof ROLE_GROUPS;

/**
 * Sets the token's groups to the user's role in their active org, plus that
 * org's id if they're its Admin. The data rules match the id against a
 * record's orgId (see amplify/data/resource.ts), so an admin reaches only the
 * org they have open. Runs on sign-in and on every token refresh, so role
 * changes and org switches show up there.
 *
 * Cognito's own groups are app-wide (an Admin of one org and a Tutor of
 * another is in both), which is why they're replaced rather than used.
 */
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const db = await getDb();
  const profileOwner = `${event.request.userAttributes.sub}::${event.userName}`;
  const { data, errors } = await db.models.User.listUserByProfileOwner(
    { profileOwner },
    { selectionSet: ['orgId', 'role', 'memberships.orgId', 'memberships.role'] }
  );
  if (errors?.length) throw new Error(`Failed to look up user: ${JSON.stringify(errors)}`);

  // No record yet (a Google sign-up before onboarding, or an invitee before
  // accepting): keep the Cognito groups, which hold no org.
  const user = data[0];
  if (!user?.orgId) return event;

  // Users from before Memberships existed only have User.role
  const membership = user.memberships.find((m) => m.orgId === user.orgId);
  const role = (membership?.role ?? user.role?.toLowerCase()) as OrgRole | undefined;
  if (!role || !(role in ROLE_GROUPS)) return event;

  event.response.claimsOverrideDetails = {
    groupOverrideDetails: {
      groupsToOverride: role === 'admin' ? [ROLE_GROUPS[role], user.orgId] : [ROLE_GROUPS[role]],
    },
  };
  return event;
};
