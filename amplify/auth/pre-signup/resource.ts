import { defineFunction } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
  name: 'pre-signup',
  resourceGroupName: 'auth',
  // Linking a first Google sign-in makes several Cognito calls, one of which
  // (creating the email account) invokes this trigger again. Cognito gives
  // up after 5 seconds, so the default 3s timeout and 128MB cold start are
  // too tight.
  timeoutSeconds: 10,
  memoryMB: 512,
});
