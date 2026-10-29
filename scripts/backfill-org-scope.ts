/**
 * One-off: fills in the org fields that scope admin access to one org (see
 * amplify/data/resource.ts) on records made before they existed. Safe to run
 * again; it only writes what's missing or out of step.
 *
 *   npx tsx scripts/backfill-org-scope.ts --dry-run
 *   npx tsx scripts/backfill-org-scope.ts
 *
 * Run it after deploying the new schema, against the backend in
 * amplify_outputs.json (or the file AMPLIFY_OUTPUTS names, e.g. one from
 * `npx ampx generate outputs --branch main`), with AWS credentials for that account (the ones
 * `ampx sandbox` uses, e.g. AWS_PROFILE). It calls the API with IAM, which
 * the data rules don't limit.
 *
 * - User.orgIds: the orgs of the user's Memberships. Users from before
 *   Memberships existed (only User.orgId and User.role) get one first.
 * - Student.orgIds: the orgs of the student's Enrollments.
 * - TutorAssignment.orgId: its Enrollment's org.
 * - LessonStudent.orgId, LessonTutor.orgId: their Lesson's org.
 */
import { readFileSync } from 'node:fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { Schema } from '../amplify/data/resource';

const dryRun = process.argv.includes('--dry-run');
const outputs = JSON.parse(
  readFileSync(process.env.AMPLIFY_OUTPUTS ?? new URL('../amplify_outputs.json', import.meta.url), 'utf8')
);
const credentials = fromNodeProviderChain();

Amplify.configure(outputs, {
  Auth: {
    credentialsProvider: {
      getCredentialsAndIdentityId: async () => ({ credentials: await credentials() }),
      clearCredentialsAndIdentityId: () => {},
    },
  },
});
const db = generateClient<Schema>({ authMode: 'iam' });

type Page<T> = { data: T[]; nextToken?: string | null; errors?: unknown[] };

async function listAll<T>(list: (nextToken: string | null | undefined) => Promise<Page<T>>) {
  const items: T[] = [];
  let nextToken: string | null | undefined;
  do {
    const page = await list(nextToken);
    if (page.errors?.length) throw new Error(JSON.stringify(page.errors));
    items.push(...page.data.filter(Boolean));
    nextToken = page.nextToken;
  } while (nextToken);
  return items;
}

async function write(label: string, run: () => Promise<{ errors?: unknown[] }>) {
  console.log(`${dryRun ? '[dry run] ' : ''}${label}`);
  if (dryRun) return;
  const { errors } = await run();
  if (errors?.length) throw new Error(`${label}: ${JSON.stringify(errors)}`);
}

const sameSet = (a: readonly (string | null)[], b: readonly (string | null)[]) =>
  new Set(a).size === new Set(b).size && a.every((x) => b.includes(x));

async function backfillUsers() {
  const memberships = await listAll((nextToken) =>
    db.models.Membership.list({ nextToken, selectionSet: ['id', 'userId', 'orgId', 'role'] })
  );
  const users = await listAll((nextToken) =>
    db.models.User.list({ nextToken, selectionSet: ['id', 'name', 'orgId', 'role', 'orgIds'] })
  );

  for (const user of users) {
    const orgs = memberships.filter((m) => m.userId === user.id).map((m) => m.orgId);
    if (user.orgId && user.role && !orgs.includes(user.orgId)) {
      const role = user.role.toLowerCase() as 'admin' | 'tutor' | 'parent';
      await write(`Membership: ${user.name} is ${role} of ${user.orgId}`, () =>
        db.models.Membership.create({ userId: user.id, orgId: user.orgId!, role })
      );
      orgs.push(user.orgId);
    }
    if (!sameSet(user.orgIds ?? [], orgs)) {
      await write(`User.orgIds: ${user.name} -> [${orgs.join(', ')}]`, () =>
        db.models.User.update({ id: user.id, orgIds: orgs })
      );
    }
  }
}

async function backfillStudents() {
  const enrollments = await listAll((nextToken) =>
    db.models.Enrollment.list({ nextToken, selectionSet: ['id', 'studentId', 'orgId'] })
  );
  const students = await listAll((nextToken) =>
    db.models.Student.list({ nextToken, selectionSet: ['id', 'name', 'orgIds'] })
  );
  for (const student of students) {
    const orgs = [...new Set(enrollments.filter((e) => e.studentId === student.id).map((e) => e.orgId))];
    if (!sameSet(student.orgIds ?? [], orgs)) {
      await write(`Student.orgIds: ${student.name} -> [${orgs.join(', ')}]`, () =>
        db.models.Student.update({ id: student.id, orgIds: orgs })
      );
    }
  }

  // orgId is required, so rows without one can't be read with it selected:
  // every row is set, which is harmless for the ones that already match
  const enrollmentOrg = new Map(enrollments.map((e) => [e.id, e.orgId]));
  const assignments = await listAll((nextToken) =>
    db.models.TutorAssignment.list({ nextToken, selectionSet: ['id', 'enrollmentId'] })
  );
  for (const a of assignments) {
    const orgId = enrollmentOrg.get(a.enrollmentId);
    if (!orgId) {
      console.warn(`TutorAssignment ${a.id}: enrollment ${a.enrollmentId} not found, skipped`);
      continue;
    }
    await write(`TutorAssignment.orgId: ${a.id} -> ${orgId}`, () => db.models.TutorAssignment.update({ id: a.id, orgId }));
  }
}

async function backfillLessons() {
  const lessons = await listAll((nextToken) => db.models.Lesson.list({ nextToken, selectionSet: ['id', 'orgId'] }));
  const lessonOrg = new Map(lessons.map((l) => [l.id, l.orgId]));

  const students = await listAll((nextToken) =>
    db.models.LessonStudent.list({ nextToken, selectionSet: ['id', 'lessonId'] })
  );
  for (const row of students) {
    const orgId = lessonOrg.get(row.lessonId);
    if (!orgId) {
      console.warn(`LessonStudent ${row.id}: lesson ${row.lessonId} not found, skipped`);
      continue;
    }
    await write(`LessonStudent.orgId: ${row.id} -> ${orgId}`, () => db.models.LessonStudent.update({ id: row.id, orgId }));
  }

  const tutors = await listAll((nextToken) =>
    db.models.LessonTutor.list({ nextToken, selectionSet: ['id', 'lessonId'] })
  );
  for (const row of tutors) {
    const orgId = lessonOrg.get(row.lessonId);
    if (!orgId) {
      console.warn(`LessonTutor ${row.id}: lesson ${row.lessonId} not found, skipped`);
      continue;
    }
    await write(`LessonTutor.orgId: ${row.id} -> ${orgId}`, () => db.models.LessonTutor.update({ id: row.id, orgId }));
  }
}

await backfillUsers();
await backfillStudents();
await backfillLessons();
console.log(dryRun ? 'Dry run done: nothing was written.' : 'Backfill done.');
