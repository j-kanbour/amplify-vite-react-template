import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/post-confirmation';
import { type Schema } from '../../data/resource';

const TERMS_VERSION = '2026-09-01';
const PRIVACY_VERSION = '2026-09-01';

// The AMPLIFY_DATA_* vars are cross-resource references: at module load they
// still hold the "<value will be resolved during runtime>" placeholder, and
// Amplify only swaps in the real SSM values once an invocation starts. So the
// client has to be built on first invoke, not at import time — otherwise
// Amplify.configure() receives the placeholders and generateClient() throws.
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
const ORG_SIZES = ["Solo","Small","Medium","Large"] as const;
type OrgSize = (typeof ORG_SIZES)[number];

const isOrgSize = (v: unknown): v is OrgSize =>
  ORG_SIZES.includes(v as OrgSize);

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const attrs = event.request.userAttributes;
  const db = await getDb();

  // Federated (Google) users never fill in the business fields, so there is
  // nothing to create here. They are onboarded separately once signed in.
  if (attrs.identities) {
    return event;
  }

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      GroupName: 'Admin',
    })
  );

  // 1. Create the org
  const { data: org, errors: orgErrors } = await db.models.Organisation.create({
    name: attrs['custom:orgName'],
    initialSize: isOrgSize(attrs['custom:orgSize'])
      ? attrs['custom:orgSize']
      : null,
  });
  if (orgErrors || !org) {
    throw new Error(`Failed to create organisation: ${JSON.stringify(orgErrors)}`);
  }

  // 2. Create the user linked to it
  const { errors: userErrors } = await db.models.User.create({
    name: attrs.name,
    email: attrs.email,
    role: 'Admin',
    profileOwner: `${attrs.sub}::${event.userName}`,
    orgId: org.id,
    termsVersion: attrs['custom:termsVersion'] ?? null,
    privacyVersion: attrs['custom:privacyVersion'] ?? null,
  });
  if (userErrors) {
    throw new Error(`Failed to create user: ${JSON.stringify(userErrors)}`);
  }

  return event;
};