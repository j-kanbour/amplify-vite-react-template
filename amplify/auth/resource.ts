import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineAuth, secret } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';
import { preSignUp } from './pre-signup/resource';
import { completeOnboarding } from '../data/complete-onboarding/resource';

// Local sandbox values live in .env.local (gitignored). Variables already set
// in the environment win, so Amplify's console settings still apply in CI,
// where the file doesn't exist. Assigned by hand rather than with
// process.loadEnvFile(): CDK swaps process.env for a copy during synth, and
// loadEnvFile writes to the real environment underneath it.
if (existsSync('.env.local')) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync('.env.local', 'utf8')))) {
    process.env[key] ??= value;
  }
}

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
          // The pre-signup trigger only links Google to an account when Google
          // vouches for the address.
          emailVerified: 'email_verified',
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
  triggers: { preSignUp, postConfirmation },
  access: (allow) => [
    // Linking itself isn't an Amplify action: granted in amplify/backend.ts
    allow.resource(preSignUp).to(['listUsers', 'createUser', 'setUserPassword', 'deleteUser']),
    allow.resource(postConfirmation).to(['addUserToGroup']),
    allow.resource(completeOnboarding).to(['getUser', 'updateUserAttributes', 'addUserToGroup']),
  ],
});
