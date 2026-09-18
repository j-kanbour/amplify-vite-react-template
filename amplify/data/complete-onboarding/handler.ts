import type { AppSyncIdentityCognito } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/complete-onboarding';
import { type Schema } from '../resource';
import { isOrgSize } from '../org-sizes';

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

const cognito = new CognitoIdentityProviderClient();

/**
 * Finishes sign-up for users who came in through Google, who skip the
 * business fields on the sign-up form. Creates the Organisation and User
 * records, then makes the Cognito user an Admin of it.
 *
 * Adding the user to the Admin group is deliberately the last step: the
 * frontend treats "has a group" as "onboarding complete", so a failure part
 * way through leaves the user on the onboarding page to retry. A retry reuses
 * the User record (and its org) from the earlier attempt.
 */
export const handler: Schema['completeOnboarding']['functionHandler'] = async (event) => {
  const identity = event.identity as AppSyncIdentityCognito | null;
  if (!identity?.sub || !identity.username) {
    throw new Error('Unauthorized');
  }

  // Already in a group means already onboarded (or invited into someone
  // else's org). Never let this mutation promote them to Admin.
  if (identity.groups?.length) {
    throw new Error('This account has already been set up.');
  }

  const name = event.arguments.name.trim();
  const orgName = event.arguments.orgName.trim();
  const { orgSize, acceptedTerms } = event.arguments;
  if (!name) throw new Error('Full name is required.');
  if (!orgName) throw new Error('Business name is required.');
  if (!isOrgSize(orgSize)) throw new Error('Invalid business size.');
  if (!acceptedTerms) throw new Error('You must accept the Terms and Privacy Policy.');

  const userPoolId = env.AMPLIFY_AUTH_USERPOOL_ID;
  const username = identity.username;
  const profileOwner = `${identity.sub}::${username}`;
  const db = await getDb();

  const { data: existing, errors: lookupErrors } =
    await db.models.User.listUserByProfileOwner({ profileOwner });
  if (lookupErrors) {
    throw new Error(`Failed to look up user: ${JSON.stringify(lookupErrors)}`);
  }

  let user = existing[0];
  if (!user) {
    const { UserAttributes = [] } = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username })
    );
    const attr = (name: string) => UserAttributes.find((a) => a.Name === name)?.Value;
    const email = attr('email');
    if (!email) throw new Error('Your account has no email address.');

    // 1. Create the org
    const { data: org, errors: orgErrors } = await db.models.Organisation.create({
      name: orgName,
      initialSize: orgSize,
    });
    if (orgErrors || !org) {
      throw new Error(`Failed to create organisation: ${JSON.stringify(orgErrors)}`);
    }

    // 2. Create the user linked to it
    // The name they confirmed on the onboarding page. Only the DB copy is
    // kept: Cognito's `name` is mapped from Google and gets overwritten with
    // Google's value on every Google sign-in.
    const { data: created, errors: userErrors } = await db.models.User.create({
      name,
      email,
      role: 'Admin',
      profileOwner,
      orgId: org.id,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    });
    if (userErrors || !created) {
      throw new Error(`Failed to create user: ${JSON.stringify(userErrors)}`);
    }
    user = created;
  }

  // 3. Mirror the answers onto the Cognito user, as email sign-up does
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [
        { Name: 'custom:role', Value: 'Admin' },
        { Name: 'custom:orgName', Value: orgName },
        { Name: 'custom:orgSize', Value: orgSize },
        { Name: 'custom:termsVersion', Value: TERMS_VERSION },
        { Name: 'custom:privacyVersion', Value: PRIVACY_VERSION },
      ],
    })
  );

  // 4. Last: joining a group is what marks onboarding as complete
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: 'Admin',
    })
  );

  return { userId: user.id, orgId: user.orgId ?? '' };
};
