import { defineFunction } from '@aws-amplify/backend';

/** Adds, edits and removes parents in the caller's org; the welcome email goes from here too. */
export const manageParents = defineFunction({
  name: 'manage-parents',
});
