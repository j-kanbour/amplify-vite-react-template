import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { postConfirmation } from '../auth/post-confirmation/resource';

const schema = a
  .schema({
    Organisation: a
      .model({
        name: a.string().required(),
        subscription: a.string().default('free'),
        users: a.hasMany('User', 'orgId'),
        memberships: a.hasMany('Membership', 'orgId'),
        enrollments: a.hasMany('Enrollment', 'orgId'),
        resources: a.hasMany('Resource', 'orgId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),   // members can see their org's status
        allow.group('Admin'),                 // only admins can create/update/delete
      ]),
    User: a
      .model({
        name: a.string().required(),
        email: a.string().required(),
        role: a.enum(['admin', 'tutor', 'parent']),
        profileOwner: a.string(),
        orgId: a.id(),
        org: a.belongsTo('Organisation', 'orgId'),
        memberships: a.hasMany('Membership', 'userId'),
        tutorAssignments: a.hasMany('TutorAssignment', 'tutorId'),
        guardianships: a.hasMany('Guardian', 'userId'),
      })
      .authorization((allow) => [
        allow.ownerDefinedIn('profileOwner'),
        allow.group('Admin'),
      ]),
    Membership: a
      .model({
        userId: a.id().required(),
        orgId: a.id().required(),
        role: a.enum(['admin', 'tutor', 'parent']),
        user: a.belongsTo('User', 'userId'),
        org: a.belongsTo('Organisation', 'orgId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']), // members can see who else is in their org
        allow.group('Admin'),               // only admins can create/update/delete
      ]),
    Student: a
      .model({
        name: a.string().required(),
        dob: a.date().required(),
        guardians: a.hasMany('Guardian', 'studentId'),
        enrollments: a.hasMany('Enrollment', 'studentId'),
        resources: a.hasMany('Resource', 'studentId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
    Enrollment: a
      .model({
        studentId: a.id().required(),
        orgId: a.id().required(),
        package: a.string().default('free'),
        student: a.belongsTo('Student', 'studentId'),
        org: a.belongsTo('Organisation', 'orgId'),
        tutorAssignments: a.hasMany('TutorAssignment', 'enrollmentId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']), // members can see a student's package per org
        allow.group('Admin'),               // only admins can create/update/delete
      ]),
    // org-scoped: a tutor teaches a student within one org's enrollment
    TutorAssignment: a
      .model({
        enrollmentId: a.id().required(),
        tutorId: a.id().required(),
        enrollment: a.belongsTo('Enrollment', 'enrollmentId'),
        tutor: a.belongsTo('User', 'tutorId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
    // global: the family link holds regardless of which orgs the student joins
    Guardian: a
      .model({
        studentId: a.id().required(),
        userId: a.id().required(),
        student: a.belongsTo('Student', 'studentId'),
        user: a.belongsTo('User', 'userId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
    Resource: a
      .model({
        // values match the S3 folder names; path is derived, never stored
        type: a.enum(['admin', 'organisation', 'student', 'lesson']),
        orgId: a.id().required(),
        studentId: a.id(), // required when type is 'student' — enforced in app/Lambda
        name: a.string(),
        uploadedBy: a.id(),
        org: a.belongsTo('Organisation', 'orgId'),
        student: a.belongsTo('Student', 'studentId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
  })
  .authorization((allow) => [allow.resource(postConfirmation)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});