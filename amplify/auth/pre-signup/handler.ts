import type { PreSignUpTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();

/** Every user pool user whose email matches, with or without case changes. */
async function findUsersByEmail(userPoolId: string, email: string) {
  const variants = [...new Set([email, email.toLowerCase()])];
  const users: UserType[] = [];
  for (const variant of variants) {
    const { Users = [] } = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${variant.replace(/(["\\])/g, '\\$1')}"`,
        Limit: 1,
      })
    );
    users.push(...Users);
  }
  return users;
}

/**
 * One account per email address, however it was created. Cognito already
 * rejects a second email/password sign-up for the same address, but not a
 * Google sign-in for an address that has a password account (or the reverse),
 * because the Google user gets its own "google_..." username.
 *
 * Runs for email sign-up (PreSignUp_SignUp), a first Google sign-in
 * (PreSignUp_ExternalProvider) and admin-created users. Throwing stops the
 * sign-up; Cognito reports the message as "PreSignUp failed with error <msg>".
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  const email = event.request.userAttributes.email?.trim();
  if (!email) {
    throw new Error('An email address is required to sign up.');
  }

  const [existing] = await findUsersByEmail(event.userPoolId, email);
  if (existing) {
    const how =
      existing.UserStatus === 'EXTERNAL_PROVIDER'
        ? 'Sign in with Google instead.'
        : 'Sign in with your email and password instead.';
    throw new Error(`An account with this email already exists. ${how}`);
  }

  return event;
};
