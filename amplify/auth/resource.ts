import { defineAuth, secret } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

/**
 * OAuth redirect targets, set as environment variables on the Amplify app
 * (App settings -> Environment variables). Each holds a comma-separated list
 * so a branch can register more than one URL.
 */
function urlsFromEnv(name: string): string[] {
  const urls = (process.env[name] ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    throw new Error(
      `${name} is not set. Add it to the Amplify app's environment variables ` +
        `as a comma-separated list of URLs before deploying.`
    );
  }
  return urls;
}

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
          fullname: 'name',
        },
      },
      // Where Cognito sends the browser back to after the Google round trip.
      callbackUrls: urlsFromEnv('OAUTH_CALLBACK_URLS'),
      logoutUrls: urlsFromEnv('OAUTH_LOGOUT_URLS'),
    },
  },
  userAttributes: {
    fullname: {required: true, mutable: true },
    'custom:role': { dataType: 'String', mutable: true },
    'custom:orgName': { dataType: 'String', mutable: true },
    'custom:orgSize': { dataType: 'String', mutable: true },
    'custom:termsVersion': { dataType: 'String', mutable: true, maxLen: 16 },
    'custom:privacyVersion': { dataType: 'String', mutable: true, maxLen: 16 },
  },
  groups: ['Admin', 'Tutor', 'Parent'],
  triggers: { postConfirmation },
  access: (allow) => [allow.resource(postConfirmation).to(['addUserToGroup'])],
});
