import { defineBackend } from '@aws-amplify/backend';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { preSignUp } from './auth/pre-signup/resource';
import { data } from './data/resource';
import { myFunction } from './backend/myFunction/resource';
import { storageProfileData, storageOrgResources } from './storage/resource';
import { profileAccess } from './functions/fileAccess/profiles/resource';
import { resourceAccess } from './functions/fileAccess/resources/resource';
import { postConfirmation } from './auth/post-confirmation/resource';
import { completeOnboarding } from './data/complete-onboarding/resource';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  myFunction,
  preSignUp,
  storageProfileData,
  storageOrgResources,
  profileAccess,
  resourceAccess,
  postConfirmation,
  completeOnboarding,
});

// Give the Lambdas readable names in the console instead of the generated
// amplify-<appId>-<branch>-<hash>-<name>lambda<hash>-<suffix>. Names are
// unique per account/region, so include the branch (or sandbox name).
const envName = backend.stack.node.tryGetContext('amplify-backend-name') as string;
const functions = {
  'my-function': backend.myFunction,
  'pre-signup': backend.preSignUp,
  'post-confirmation': backend.postConfirmation,
  'complete-onboarding': backend.completeOnboarding,
  'profile-access': backend.profileAccess,
  'resource-access': backend.resourceAccess,
};
for (const [name, fn] of Object.entries(functions)) {
  const cfnFunction = fn.resources.lambda.node.defaultChild as CfnFunction;
  // Lambda names are capped at 64 characters.
  cfnFunction.functionName = `amplify-template-${envName}-${name}`.slice(0, 64);
}

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
