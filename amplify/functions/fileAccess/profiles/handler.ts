import { env } from '$amplify/env/profile-access';
import { type Schema } from '../../../data/resource';
import { getDb, getCaller, parsePath, runAction, isRead } from '../shared';

/**
 * Gatekeeper for the TS_ProfileData bucket, which clients can't reach
 * directly:
 *   users/{userId}/...  the user themselves, or an admin of an org they're in
 *   orgs/{orgId}/...    members read, org admins write and delete
 */
export const handler: Schema['profileFile']['functionHandler'] = async (event) => {
  const { path, action } = event.arguments;
  const [root, id, ...rest] = parsePath(path, action);
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
  return runAction(env.TS_PROFILE_DATA_BUCKET_NAME, path, action);
};
