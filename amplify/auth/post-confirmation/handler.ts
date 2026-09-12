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

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const db = generateClient<Schema>();

const cognito = new CognitoIdentityProviderClient();
const ALLOWED = ['Admin','Tutor', 'Parent'];

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const attrs = event.request.userAttributes;
  const group = ALLOWED.includes(attrs['custom:role']) ? attrs['custom:role'] : 'Parent';

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      GroupName: group,
    })
  );

  // 1. Create the org
  const { data: org, errors: orgErrors } = await db.models.Organisation.create({
    name: attrs['custom:orgName'],
  });
  if (orgErrors || !org) {
    throw new Error(`Failed to create organisation: ${JSON.stringify(orgErrors)}`);
  }


  // 2. Create the user linked to it
  const { errors: userErrors } = await db.models.User.create({
    name: attrs.name,
    email: attrs.email,
    role: group,
    profileOwner: `${attrs.sub}::${event.userName}`,
    orgId: org.id,
  });
  if (userErrors) {
    throw new Error(`Failed to create user: ${JSON.stringify(userErrors)}`);
  }

  return event;
};