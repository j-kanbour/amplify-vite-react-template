import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { postConfirmation } from '../auth/post-confirmation/resource';
import { completeOnboarding } from './complete-onboarding/resource';
import { ORG_SIZES } from './org-sizes';

const schema = a
  .schema({
    //Organisations
    Organisation: a
      .model({
        name: a.string().required(),
        subscription: a.enum(['free','premium','corporate']),
        users: a.hasMany('User', 'orgId'),
        initialSize: a.enum(ORG_SIZES),
        memberships: a.hasMany('Membership', 'orgId'),
        enrollments: a.hasMany('Enrollment', 'orgId'),
        resources: a.hasMany('Resource', 'orgId'),
        lessons: a.hasMany('Lesson', 'orgId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
    //Users: including admins, tutors and parents
    User: a
      .model({
        name: a.string().required(),
        email: a.string().required(),
        termsVersion: a.string(),
        privacyVersion: a.string(),
        role: a.enum(['Admin', 'Tutor', 'Parent']),
        profileOwner: a.string(),
        orgId: a.id(),
        org: a.belongsTo('Organisation', 'orgId'),
        memberships: a.hasMany('Membership', 'userId'),
        tutorAssignments: a.hasMany('TutorAssignment', 'tutorId'),
        guardianships: a.hasMany('Guardian', 'userId'),
        lessons: a.hasMany('LessonTutor', 'tutorId'),
      })
      // lets a user (and the onboarding Lambda) look up their own record
      .secondaryIndexes((index) => [index('profileOwner')])
      .authorization((allow) => [
        allow.ownerDefinedIn('profileOwner'),
        allow.group('Admin'),
      ]),
    //Membership: records the roles that Users have within Orgs
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
        allow.group('Admin'),
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
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
    //Enrollment: records the Orgs that Students belong to
    Enrollment: a
      .model({
        studentId: a.id().required(),
        orgId: a.id().required(),
        bundle: a.id(),
        student: a.belongsTo('Student', 'studentId'),
        org: a.belongsTo('Organisation', 'orgId'),
        tutorAssignments: a.hasMany('TutorAssignment', 'enrollmentId'),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
    //Bundles: the payment bundles that students are enroled under
    Bundle: a
      .model({
        orgId: a.id().required(),
        name: a.string(),
        description: a.string(),
        price: a.string(),
        discount: a.string(),
        discountTime: a.string()
      }).authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('Admin'),
      ]),
    //Tutor Assignment: records the Student/Enrolement that turors belong to
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
    //Guardian: defins the student -> parent relation
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
    //Resources: links to S3 storage, showing ownership and permission
    Resource: a
      .model({
        // values match the S3 folder names; path is derived, never stored
        type: a.enum(['admin', 'organisation', 'student', 'lesson']),
        orgId: a.id().required(),
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
        allow.group('Admin'),
      ]),
    //Lessons: records all student lessons
    Lesson: a
      .model({
        orgId: a.id().required(),
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
        allow.group('Admin'),
      ]),
    //LessonStudent: shows the lessons held by students, includes confirmation and attendance
    LessonStudent: a
      .model({
        lessonId: a.id().required(),
        studentId: a.id().required(),
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
        allow.group('Admin'),
      ]),
    //LessonTutor: shows the lessons held by tutors, includes confirmation and attendance
    LessonTutor: a
      .model({
        lessonId: a.id().required(),
        tutorId: a.id().required(),
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
        allow.group('Admin'),
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
  })
  .authorization((allow) => [
    allow.resource(postConfirmation),
    allow.resource(completeOnboarding),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});