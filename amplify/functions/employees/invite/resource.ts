import { defineFunction } from '@aws-amplify/backend';

// Amplify Hosting sets AWS_APP_ID and AWS_BRANCH during the build that deploys
// the backend, so a branch deploy links to its own frontend. A sandbox has
// neither, so it links to the local Vite dev server. Amplify swaps slashes in
// branch names for dashes in the default domain.
const { AWS_APP_ID, AWS_BRANCH } = process.env;
const APP_URL =
  AWS_APP_ID && AWS_BRANCH
    ? `https://${AWS_BRANCH.replace(/\//g, '-')}.${AWS_APP_ID}.amplifyapp.com`
    : 'http://localhost:5173';

export const sendEmployeeInviteEmail = defineFunction({
  name: 'send-employee-invite-email',
  environment: { APP_URL },
});
