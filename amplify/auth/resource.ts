import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: { email: true },
  userAttributes: {
    fullname: {required: true, mutable: true },
    'custom:role': { dataType: 'String', mutable: true },
    'custom:orgName': { dataType: 'String', mutable: true },
    'custom:termsVersion': { dataType: 'String', mutable: true, maxLen: 16 },
    'custom:privacyVersion': { dataType: 'String', mutable: true, maxLen: 16 },
  },
  groups: ['Admin', 'Tutor', 'Parent'],
  triggers: { postConfirmation },
  access: (allow) => [allow.resource(postConfirmation).to(['addUserToGroup'])],
});