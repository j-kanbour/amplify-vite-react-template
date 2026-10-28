import { env } from '$amplify/env/profile-access';
import { type Schema } from '../../../data/resource';
import { getDb, getCaller, parsePath, runAction, isRead } from '../shared';
import { uploadProblem, uploadRule } from '../../../data/upload-rules';

/**
 * Gatekeeper for the TS_ProfileData bucket, which clients can't reach
 * directly:
 *   users/{userId}/...  the user themselves, or an admin of an org they're in
 *   orgs/{orgId}/...    members read, org admins write and delete
 *
 * Uploads are limited to the files upload-rules.ts allows (avatar, logo and
 * onboarding documents), of an allowed type and size.
 */
export const handler: Schema['profileFile']['functionHandler'] = async (event) => {
  const { path, action, contentType, size } = event.arguments;
  const segments = parsePath(path, action);
  const [root, id, ...rest] = segments;
  // Whole-folder deletes or reads above an id aren't supported
  if (!id || (action !== 'list' && rest.length === 0)) throw new Error('Invalid path');

  const db = await getDb(env);
  const caller = await getCaller(db, event.identity);

  let allowed = false;
  if (root === 'users') {
    if (id === caller.userId) {
      allowed = true;
    } else {
      const { data: target } = await db.models.User.get(
        { id },
        { selectionSet: ['orgId', 'memberships.orgId'] }
      );
      const targetOrgs = [target?.orgId, ...(target?.memberships ?? []).map((m) => m.orgId)];
      allowed = targetOrgs.some((orgId) => orgId && caller.orgRoles.get(orgId) === 'admin');
    }
  } else if (root === 'orgs') {
    const role = caller.orgRoles.get(id);
    allowed = role === 'admin' || (!!role && isRead(action));
  }

  if (!allowed) throw new Error('Forbidden');

  if (action === 'put') {
    const rule = uploadRule(segments);
    if (!rule) throw new Error("Files can't be uploaded there.");
    const problem = uploadProblem(rule, contentType ?? '', size ?? 0);
    if (problem) throw new Error(problem);
    return runAction(env.TS_PROFILE_DATA_BUCKET_NAME, path, action, {
      upload: { contentType: contentType!, size: size! },
    });
  }
  return runAction(env.TS_PROFILE_DATA_BUCKET_NAME, path, action, { asAttachment: true });
};
