import { defineFunction } from '@aws-amplify/backend';

export const employeeMembership = defineFunction({
  name: 'employee-membership',
  // Lives in the auth stack for the same reason as complete-onboarding: it
  // has a defineAuth `access` grant (see amplify/data/complete-onboarding/resource.ts).
  resourceGroupName: 'auth',
});
