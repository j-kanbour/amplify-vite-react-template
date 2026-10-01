import { useEffect, useState } from 'react';
import { client } from './client';

export type StudentRow = {
  id: string;
  name: string;
  dob: string;
  /** When they joined this org (the Enrollment's creation). */
  enrolledAt: string;
  /** User ids of their tutors in this org. For a tutor's own view, only that tutor is known. */
  tutorIds: string[];
};

const ADMIN_FIELDS = ['createdAt', 'student.id', 'student.name', 'student.dob', 'tutorAssignments.tutorId'] as const;
const TUTOR_FIELDS = ['tutorId', 'enrollment.orgId', 'enrollment.createdAt', 'enrollment.student.id', 'enrollment.student.name', 'enrollment.student.dob'] as const;

/** Every student enrolled in the org: via its Enrollments. Admin only. */
async function loadOrgStudents(orgId: string) {
  const rows: StudentRow[] = [];
  let nextToken: string | null | undefined;
  do {
    const page = await client.models.Enrollment.list({
      filter: { orgId: { eq: orgId } },
      selectionSet: ADMIN_FIELDS,
      nextToken,
    });
    if (page.errors?.length) throw new Error(page.errors[0].message);
    for (const e of page.data) {
      if (!e.student) continue;
      rows.push({
        ...e.student,
        enrolledAt: e.createdAt,
        tutorIds: e.tutorAssignments.map((t) => t.tutorId),
      });
    }
    nextToken = page.nextToken;
  } while (nextToken);
  return rows;
}

/**
 * The students assigned to one tutor in the org: via their TutorAssignments.
 * The backend only returns a Student whose `viewers` include the tutor, so this
 * can't reach anyone else's students even if called with another tutorId.
 */
async function loadTutorStudents(orgId: string, tutorId: string) {
  const rows: StudentRow[] = [];
  let nextToken: string | null | undefined;
  do {
    const page = await client.models.TutorAssignment.list({
      filter: { tutorId: { eq: tutorId } },
      selectionSet: TUTOR_FIELDS,
      nextToken,
    });
    if (page.errors?.length) throw new Error(page.errors[0].message);
    for (const a of page.data) {
      const { enrollment } = a;
      if (!enrollment?.student || enrollment.orgId !== orgId) continue;
      rows.push({ ...enrollment.student, enrolledAt: enrollment.createdAt, tutorIds: [a.tutorId] });
    }
    nextToken = page.nextToken;
  } while (nextToken);
  return rows;
}

/** One row per student, merging duplicate enrollments or assignments. */
function dedupe(rows: StudentRow[]) {
  const byId = new Map<string, StudentRow>();
  for (const r of rows) {
    const seen = byId.get(r.id);
    if (!seen) byId.set(r.id, r);
    else seen.tutorIds = [...new Set([...seen.tutorIds, ...r.tutorIds])];
  }
  return [...byId.values()];
}

/**
 * Students in an organisation. With a tutorId, only that tutor's students
 * (what tutors see); without, all of them (what admins see).
 * `students` is null while loading.
 */
export function useStudents(orgId?: string, tutorId?: string) {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (tutorId ? loadTutorStudents(orgId, tutorId) : loadOrgStudents(orgId))
      .then((rows) => !cancelled && setStudents(dedupe(rows)))
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load students.');
        setStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, tutorId]);

  return { students, error };
}
