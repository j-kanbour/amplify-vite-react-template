import { defineFunction } from '@aws-amplify/backend';

export const completeOnboarding = defineFunction({
  name: 'complete-onboarding',
  // Lives in the auth stack, like post-confirmation: defineAuth's `access`
  // grant is created in the auth stack, so a function anywhere else makes
  // auth depend on that stack while data already depends on auth (circular).
  resourceGroupName: 'auth',
});
