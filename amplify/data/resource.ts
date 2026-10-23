import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { postConfirmation } from '../auth/post-confirmation/resource';
import { preTokenGeneration } from '../auth/pre-token-generation/resource';
import { completeOnboarding } from './complete-onboarding/resource';
import { sendEmployeeInviteEmail } from '../functions/employees/invite/resource';
import { employeeMembership } from '../functions/employees/membership/resource';
import { profileAccess } from '../functions/fileAccess/profiles/resource';
import { resourceAccess } from '../functions/fileAccess/resources/resource';
import { ORG_SIZES } from './org-sizes';

/**
 * Org scoping. The pre-token-generation trigger puts the id of the org a user
 * is an Admin of (their active one) in their token's groups, so a
 * `groupDefinedIn('orgId')` rule gives admins that org's records and no
 * other's. Lambdas call the API with IAM, which these rules don't limit.
 *
 * An update is checked against the record as stored, not the new values, so
 * every orgId is set once on create and then locked: otherwise an admin could
 * move a record into another org.
 */
const orgId = () =>
  a
    .id()
    .required()
    .authorization((allow) => [
      allow.groupDefinedIn('orgId').to(['create', 'read']),
      allow.authenticated().to(['read']),
    ]);

const schema = a
  .schema({
    //Organisations
    Organisation: a
      .model({
        name: a.string().required(),
        subscription: a.enum(['free','premium','corporate']),
        users: a.hasMany('User', 'orgId'),
        initialSize: a.enum(ORG_SIZES),
        // contact details shown on the org profile, edited by admins
        contactEmail: a.email(),
        phone: a.string(),
        website: a.string(),
        address: a.string(),
        businessNumber: a.string(),
        memberships: a.hasMany('Membership', 'orgId'),
        enrollments: a.hasMany('Enrollment', 'orgId'),
        resources: a.hasMany('Resource', 'orgId'),
        lessons: a.hasMany('Lesson', 'orgId'),
      })
      // Created by the sign-up Lambdas; its own id is the org's group. An
      // update can only clear a field (set it to null) with delete as well.
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.groupDefinedIn('id').to(['read', 'update', 'delete']),
      ]),
    UserRole: a.enum(['Admin', 'Tutor', 'Parent']),
    //Users: including admins, tutors and parents
    User: a
      .model({
        name: a.string().required(),
        email: a.string().required(),
        phone: a.string(),
        termsVersion: a.string(),
        privacyVersion: a.string(),
        // Lambdas own the fields below. Trusting a user's own edits to them
        // would let anyone make themselves an admin of any org.
        role: a.ref('UserRole').authorization((allow) => [
          allow.ownerDefinedIn('profileOwner').to(['read']),
          allow.groupsDefinedIn('orgIds').to(['read']),
        ]),
        profileOwner: a.string().authorization((allow) => [
          allow.ownerDefinedIn('profileOwner').to(['read']),
          allow.groupsDefinedIn('orgIds').to(['read']),
        ]),
        // the active org: the one the app shows
        orgId: a.id().authorization((allow) => [
          allow.ownerDefinedIn('profileOwner').to(['read']),
          allow.groupsDefinedIn('orgIds').to(['read']),
        ]),
        // every org the user belongs to (their Memberships'), so those orgs'
        // admins can read the record
        orgIds: a.id().array().authorization((allow) => [
          allow.ownerDefinedIn('profileOwner').to(['read']),
          allow.groupsDefinedIn('orgIds').to(['read']),
        ]),
        org: a.belongsTo('Organisation', 'orgId'),
        memberships: a.hasMany('Membership', 'userId'),
        tutorAssignments: a.hasMany('TutorAssignment', 'tutorId'),
        guardianships: a.hasMany('Guardian', 'userId'),
        lessons: a.hasMany('LessonTutor', 'tutorId'),
      })
      // profileOwner: a user (and the onboarding Lambda) looks up their own record
      // email: the invite Lambda checks whether the invitee is already a member
      .secondaryIndexes((index) => [index('profileOwner'), index('email')])
      // Created by the sign-up and invite Lambdas. Delete is what lets an
      // update clear a field (set it to null).
      .authorization((allow) => [
        allow.ownerDefinedIn('profileOwner').to(['read', 'update', 'delete']),
        allow.groupsDefinedIn('orgIds').to(['read']),
      ]),
    //Membership: records the roles that Users have within Orgs
    // Written only by Lambdas: the token's groups are worked out from these
    Membership: a
      .model({
        userId: a.id().required(),
        orgId: a.id().required(),
        role: a.enum(['admin', 'tutor', 'parent']),
        user: a.belongsTo('User', 'userId'),
        org: a.belongsTo('Organisation', 'orgId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
      ]),
    //Students
    Student: a
      .model({
        name: a.string().required(),
        dob: a.date().required(),
        guardians: a.hasMany('Guardian', 'studentId'),
        enrollments: a.hasMany('Enrollment', 'studentId'),
        resources: a.hasMany('Resource', 'studentId'),
        lessons: a.hasMany('LessonStudent', 'studentId'),
        // profileOwner values of the student's assigned tutors (and later its
        // guardians). Whatever creates or removes a TutorAssignment must keep
        // this in step: it's what lets a tutor read only their own students.
        viewers: a.string().array(),
        // the orgs the student is enrolled in (their Enrollments'). Whatever
        // creates or removes an Enrollment must keep this in step. Locked, as
        // admins could otherwise add any org to it.
        orgIds: a.id().array().authorization((allow) => [
          allow.groupsDefinedIn('orgIds').to(['read']),
          allow.ownersDefinedIn('viewers').to(['read']),
        ]),
      })
      // Shared by every org the student is enrolled in, so no single org's
      // admins can create or delete one: a Lambda will
      .authorization((allow) => [
        allow.ownersDefinedIn('viewers').to(['read']),
        allow.groupsDefinedIn('orgIds').to(['read', 'update']),
      ]),
    //Enrollment: records the Orgs that Students belong to
    Enrollment: a
      .model({
        studentId: a.id().required(),
        orgId: orgId(),
        bundle: a.id(),
        student: a.belongsTo('Student', 'studentId'),
        org: a.belongsTo('Organisation', 'orgId'),
        tutorAssignments: a.hasMany('TutorAssignment', 'enrollmentId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.groupDefinedIn('orgId'),
      ]),
    //Bundles: the payment bundles that students are enroled under
    Bundle: a
      .model({
        orgId: orgId(),
        name: a.string(),
        description: a.string(),
        price: a.string(),
        discount: a.string(),
        discountTime: a.string()
      }).authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.groupDefinedIn('orgId'),
      ]),
    //Tutor Assignment: records the Student/Enrolement that turors belong to
    TutorAssignment: a
      .model({
        enrollmentId: a.id().required(),
        tutorId: a.id().required(),
        // the enrollment's org
        orgId: orgId(),
        enrollment: a.belongsTo('Enrollment', 'enrollmentId'),
        tutor: a.belongsTo('User', 'tutorId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.groupDefinedIn('orgId'),
      ]),
    //Guardian: defins the student -> parent relation
    // global: the family link holds regardless of which orgs the student joins,
    // so no single org's admins own it. Written by Lambdas.
    Guardian: a
      .model({
        studentId: a.id().required(),
        userId: a.id().required(),
        student: a.belongsTo('Student', 'studentId'),
        user: a.belongsTo('User', 'userId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
      ]),
    //Resources: links to S3 storage, showing ownership and permission
    Resource: a
      .model({
        // values match the S3 folder names; path is derived, never stored
        type: a.enum(['admin', 'organisation', 'student', 'lesson']),
        orgId: orgId(),
        studentId: a.id(), // required when type is 'student' — enforced in app/Lambda
        lessonId: a.id(),  // required when type is 'lesson'  — enforced in app/Lambda
        name: a.string(),
        uploadedBy: a.id(),
        org: a.belongsTo('Organisation', 'orgId'),
        student: a.belongsTo('Student', 'studentId'),
        lesson: a.belongsTo('Lesson', 'lessonId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.groupDefinedIn('orgId'),
      ]),
    //Lessons: records all student lessons
    Lesson: a
      .model({
        orgId: orgId(),
        org: a.belongsTo('Organisation', 'orgId'),
        startTime: a.datetime().required(),
        endTime: a.datetime().required(),
        // derived by backend: 'confirmed' once all tutors + ≥1 student have confirmed
        status: a.enum(['scheduled', 'confirmed', 'cancelled', 'completed']),
        notes: a.string(),
        students: a.hasMany('LessonStudent', 'lessonId'),
        tutors: a.hasMany('LessonTutor', 'lessonId'),
        resources: a.hasMany('Resource', 'lessonId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.groupDefinedIn('orgId'),
      ]),
    //LessonStudent: shows the lessons held by students, includes confirmation and attendance
    LessonStudent: a
      .model({
        lessonId: a.id().required(),
        studentId: a.id().required(),
        // the lesson's org
        orgId: orgId(),
        lesson: a.belongsTo('Lesson', 'lessonId'),
        student: a.belongsTo('Student', 'studentId'),
        // profileOwner values of the student's guardians + the lesson's tutors,
        // populated at creation so they can update this row
        owners: a.string().array(),
        confirmation: a.enum(['pending', 'confirmed', 'declined']),
        confirmedBy: a.id(),
        confirmedAt: a.datetime(),
        attendance: a.enum(['unmarked', 'present', 'absent', 'late', 'excused']),
        attendanceMarkedBy: a.id(),
        attendanceMarkedAt: a.datetime(),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.ownersDefinedIn('owners').to(['read', 'update']),
        allow.groupDefinedIn('orgId'),
      ]),
    //LessonTutor: shows the lessons held by tutors, includes confirmation and attendance
    LessonTutor: a
      .model({
        lessonId: a.id().required(),
        tutorId: a.id().required(),
        // the lesson's org
        orgId: orgId(),
        lesson: a.belongsTo('Lesson', 'lessonId'),
        tutor: a.belongsTo('User', 'tutorId'),
        // the tutor's own profileOwner
        owner: a.string(),
        confirmation: a.enum(['pending', 'confirmed', 'declined']),
        confirmedAt: a.datetime(),
        attendance: a.enum(['unmarked', 'present', 'absent', 'late']),
        attendanceMarkedBy: a.id(),
        attendanceMarkedAt: a.datetime(),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.ownerDefinedIn('owner').to(['read', 'update']),
        allow.groupDefinedIn('orgId'),
      ]),
    //EmployeeInvite: an invite into an org, matched by the token in the emailed link
    // Written by the invite Lambdas
    EmployeeInvite: a
      .model({
        email: a.string().required(), // lowercased
        name: a.string(),
        phone: a.string(),
        role: a.enum(['Admin', 'Tutor']),
        startDate: a.date(),
        orgId: a.id(),
        orgName: a.string().required(),
        // sha256 of the token in the link; the token itself is never stored
        inviteTokenHash: a.string(),
        status: a.enum(['pending', 'accepted', 'revoked', 'failed']),
        invitedBy: a.id(),
        expiresAt: a.datetime(),
        messageId: a.string(),
        acceptedAt: a.datetime(),
        acceptedBy: a.id(),
      })
      .secondaryIndexes((index) => [index('inviteTokenHash'), index('email')])
      .authorization((allow) => [
        allow.groupDefinedIn('orgId').to(['read']),
      ]),
    //Onboarding: finishes sign-up for Google users (creates their org + User)
    OnboardingResult: a.customType({
      userId: a.id().required(),
      orgId: a.id().required(),
    }),
    completeOnboarding: a
      .mutation()
      .arguments({
        name: a.string().required(),
        orgName: a.string().required(),
        orgSize: a.string().required(),
        acceptedTerms: a.boolean().required(),
      })
      .returns(a.ref('OnboardingResult'))
      .handler(a.handler.function(completeOnboarding))
      .authorization((allow) => [allow.authenticated()]),
    //File access: S3 files are only reachable through these, which check
    // permissions and return a presigned URL (get/put) or the keys (list)
    FileAction: a.enum(['get', 'put', 'delete', 'list']),
    FileAccessResult: a.customType({
      url: a.string(),
      keys: a.string().array(),
    }),
    profileFile: a
      .mutation()
      .arguments({ path: a.string().required(), action: a.ref('FileAction').required() })
      .returns(a.ref('FileAccessResult'))
      .handler(a.handler.function(profileAccess))
      .authorization((allow) => [allow.authenticated()]),
    orgResourceFile: a
      .mutation()
      .arguments({ path: a.string().required(), action: a.ref('FileAction').required() })
      .returns(a.ref('FileAccessResult'))
      .handler(a.handler.function(resourceAccess))
      .authorization((allow) => [allow.authenticated()]),
    //Employee invites. The org comes from the caller's own record, never the
    // arguments, and the Lambda checks they're an Admin of it.
    sendEmployeeInviteEmail: a
      .mutation()
      .arguments({
        email: a.string().required(),
        name: a.string().required(),
        role: a.string().required(), // 'Admin' | 'Tutor'
        phone: a.string(),
        startDate: a.date(),
        message: a.string(),
        // public URL of the org's logo, shown at the top of the email
        logoUrl: a.string(),
      })
      .returns(a.customType({ inviteId: a.id(), messageId: a.string() }))
      .handler(a.handler.function(sendEmployeeInviteEmail))
      .authorization((allow) => [allow.authenticated()]),
    // What the invite link's landing page may show. Callable before sign-in, so
    // it returns only this, never the invite record.
    EmployeeInvitePreview: a.customType({
      // 'valid' | 'expired' | 'accepted' | 'revoked' | 'invalid'
      status: a.string().required(),
      orgName: a.string(),
      role: a.string(),
      email: a.string(),
      name: a.string(),
    }),
    previewEmployeeInvite: a
      .query()
      .arguments({ token: a.string().required() })
      .returns(a.ref('EmployeeInvitePreview'))
      .handler(a.handler.function(employeeMembership))
      .authorization((allow) => [allow.guest(), allow.authenticated()]),
    // Joins the signed-in user to the invite's org; their email must match it
    acceptEmployeeInvite: a
      .mutation()
      .arguments({
        token: a.string().required(),
        // required when the user has no User record yet
        acceptedTerms: a.boolean(),
      })
      .returns(a.customType({ orgId: a.id().required() }))
      .handler(a.handler.function(employeeMembership))
      .authorization((allow) => [allow.authenticated()]),
    // Sets which of the caller's orgs the app shows (User.orgId)
    switchOrg: a
      .mutation()
      .arguments({ orgId: a.id().required() })
      .returns(a.customType({ orgId: a.id().required() }))
      .handler(a.handler.function(employeeMembership))
      .authorization((allow) => [allow.authenticated()]),
    // Makes an employee of the caller's active org an Admin or Tutor of it.
    // The Lambda checks the caller is that org's Admin.
    changeEmployeeRole: a
      .mutation()
      .arguments({
        userId: a.id().required(),
        role: a.string().required(), // 'Admin' | 'Tutor'
      })
      .returns(a.customType({ userId: a.id().required(), role: a.string().required() }))
      .handler(a.handler.function(employeeMembership))
      .authorization((allow) => [allow.authenticated()])
  })
  .authorization((allow) => [
    allow.resource(postConfirmation),
    allow.resource(preTokenGeneration).to(['query']),
    allow.resource(completeOnboarding),
    allow.resource(sendEmployeeInviteEmail).to(['query', 'mutate']),
    allow.resource(employeeMembership).to(['query', 'mutate']),
    allow.resource(profileAccess).to(['query']),
    allow.resource(resourceAccess).to(['query']),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});