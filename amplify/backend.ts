import { defineBackend } from '@aws-amplify/backend';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { preSignUp } from './auth/pre-signup/resource';
import { data } from './data/resource';
import { myFunction } from './backend/myFunction/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  myFunction,
  preSignUp,
});

// The pre-signup trigger links Google sign-ins to email accounts, which
// Amplify's auth `access` grants don't cover. A standalone Policy rather than
// addToRolePolicy: the function would depend on its default policy, the
// policy on the user pool, and the pool on the function (its trigger).
const { userPool } = backend.auth.resources;
new Policy(userPool.stack, 'PreSignUpLinkProviderPolicy', {
  statements: [
    new PolicyStatement({
      actions: ['cognito-idp:AdminLinkProviderForUser'],
      resources: [userPool.userPoolArn],
    }),
  ],
}).attachToRole(backend.preSignUp.resources.lambda.role!);
