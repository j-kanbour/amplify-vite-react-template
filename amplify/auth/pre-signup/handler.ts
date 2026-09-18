import type { PreSignUpTriggerEvent, PreSignUpTriggerHandler } from 'aws-lambda';
import { randomBytes } from 'node:crypto';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminLinkProviderForUserCommand,
  AdminSetUserPasswordCommand,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();

/**
 * Thrown after a Google sign-in has been linked to an email account. Cognito
 * can't switch the in-flight sign-in over to the linked account, so it has to
 * be aborted; the frontend (src/components/SignUpForm.tsx) sees this code in
 * the redirect error and signs in with Google again, which then lands on the
 * email account.
 */
const ACCOUNT_LINKED = 'ACCOUNT_LINKED';

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

const attr = (user: UserType, name: string) =>
  user.Attributes?.find((a) => a.Name === name)?.Value;

/** A throwaway password that satisfies the pool's policy; nobody is told it. */
const randomPassword = () => `${randomBytes(24).toString('base64url')}aA1!`;

/**
 * First Google sign-in for an email address. Every account is an email
 * account underneath, with Google linked to it as a second way in, so a user
 * can use either method and there is exactly one Cognito user (and one
 * profileOwner in the DB) per person:
 *
 *  - Email account exists and is confirmed: link Google to it.
 *  - Email account exists but was never confirmed: nobody proved they own the
 *    address, so it's deleted (it can't have any data yet) and replaced.
 *  - No account: create an email account (random password, so it can get a
 *    real one later via "forgot password") and link Google to it.
 */
async function linkGoogleSignIn(event: PreSignUpTriggerEvent, email: string) {
  const { userPoolId, userName } = event;
  const attrs = event.request.userAttributes;

  const [providerPrefix, ...rest] = userName.split('_');
  if (providerPrefix.toLowerCase() !== 'google' || rest.length === 0) {
    throw new Error('Unsupported sign-in provider.');
  }
  if (attrs.email_verified !== 'true') {
    throw new Error('Your Google account email is not verified.');
  }

  let existing: UserType | undefined = (await findUsersByEmail(userPoolId, email))[0];
  if (existing?.UserStatus === 'UNCONFIRMED') {
    await cognito.send(
      new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: existing.Username })
    );
    existing = undefined;
  }
  if (existing && attr(existing, 'email_verified') !== 'true') {
    throw new Error('An account with this email already exists but is not verified.');
  }

  let destinationUsername = existing?.Username;
  if (!destinationUsername) {
    const { User } = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email.toLowerCase(),
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email.toLowerCase() },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: attrs.name || email },
        ],
      })
    );
    destinationUsername = User?.Username;
    if (!destinationUsername) throw new Error('Failed to create account.');

    // Out of FORCE_CHANGE_PASSWORD, so "forgot password" works for it later
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: destinationUsername,
        Password: randomPassword(),
        Permanent: true,
      })
    );
  }

  await cognito.send(
    new AdminLinkProviderForUserCommand({
      UserPoolId: userPoolId,
      DestinationUser: {
        ProviderName: 'Cognito',
        ProviderAttributeValue: destinationUsername,
      },
      SourceUser: {
        ProviderName: 'Google',
        ProviderAttributeName: 'Cognito_Subject',
        ProviderAttributeValue: rest.join('_'),
      },
    })
  );

  throw new Error(ACCOUNT_LINKED);
}

/**
 * One Cognito user per email address, however it was created.
 *
 * Google sign-ins never get their own "google_..." user: they're linked to
 * the email account (see linkGoogleSignIn). Email/password sign-ups and
 * admin-created users are refused if the address is already taken. Cognito
 * already refuses a second email/password sign-up itself, but not one for an
 * address held by a pre-linking "google_..." user.
 *
 * Throwing stops the sign-up; Cognito reports the message as
 * "PreSignUp failed with error <msg>".
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  const email = event.request.userAttributes.email?.trim();
  if (!email) {
    throw new Error('An email address is required to sign up.');
  }

  if (event.triggerSource === 'PreSignUp_ExternalProvider') {
    await linkGoogleSignIn(event, email);
  }

  const [existing] = await findUsersByEmail(event.userPoolId, email);
  if (existing) {
    const how =
      existing.UserStatus === 'EXTERNAL_PROVIDER' || attr(existing, 'identities')
        ? 'Sign in with Google instead.'
        : 'Sign in with your email and password instead.';
    throw new Error(`An account with this email already exists. ${how}`);
  }

  return event;
};
