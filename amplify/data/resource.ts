import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { postConfirmation } from '../auth/post-confirmation/resource';

const schema = a
  .schema({
    Organisation: a
      .model({
        name: a.string().required(),
        subscription: a.string().default('free'),
        users: a.hasMany('User', 'orgId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),   // members can see their org's status
        allow.group('Admin'),                 // only admins can create/update/delete
      ]),

    User: a
      .model({
        name: a.string().required(),
        email: a.string().required(),
        role: a.string(),
        profileOwner: a.string(),
        orgId: a.id(),
        org: a.belongsTo('Organisation', 'orgId'),
      })
      .authorization((allow) => [
        allow.ownerDefinedIn('profileOwner'),
        allow.group('Admin'),
      ]),
  })
  .authorization((allow) => [allow.resource(postConfirmation)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});