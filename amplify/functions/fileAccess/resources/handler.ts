import { env } from '$amplify/env/resource-access';
import { type Schema } from '../../../data/resource';
import { getDb, getCaller, parsePath, runAction, isRead } from '../shared';

/**
 * Gatekeeper for the TS_OrgResources bucket, which clients can't reach
 * directly:
 *   orgs/{orgId}/global/...              members read, org admins write and delete
 *   orgs/{orgId}/lessons/{lessonId}/...  org admins and the lesson's tutors do
 *                                        anything; its students' guardians read
 */
export const handler: Schema['orgResourceFile']['functionHandler'] = async (event) => {
  const { path, action } = event.arguments;
  const [root, orgId, area, lessonId, ...rest] = parsePath(path, action);
  if (root !== 'orgs' || !orgId || !area) throw new Error('Invalid path');

  const db = await getDb(env);
  const caller = await getCaller(db, event.identity);
  const role = caller.orgRoles.get(orgId);

  let allowed = false;
  if (role === 'admin') {
    allowed = true;
  } else if (area === 'global') {
    allowed = !!role && isRead(action);
  } else if (area === 'lessons' && lessonId && (action === 'list' || rest.length > 0)) {
    const { data: lesson } = await db.models.Lesson.get(
      { id: lessonId },
      { selectionSet: ['orgId', 'tutors.tutorId', 'students.student.guardians.userId'] }
    );
    if (lesson?.orgId === orgId) {
      const isTutor = lesson.tutors.some((t) => t.tutorId === caller.userId);
      const isGuardian = lesson.students.some((s) =>
        s.student.guardians.some((g) => g.userId === caller.userId)
      );
      allowed = isTutor || (isGuardian && isRead(action));
    }
  }

  if (!allowed) throw new Error('Forbidden');
  return runAction(env.TS_ORG_RESOURCES_BUCKET_NAME, path, action);
};
