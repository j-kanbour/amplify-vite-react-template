import { useEffect, useState } from 'react';
import { client, type Schema } from './client';
import type { User } from './useUsers';

// Spelled out: inferring it from list() is too deep for the compiler
type MembershipPage = {
  data: Schema['Membership']['type'][];
  nextToken?: string | null;
  errors?: { message: string }[];
};

const ROLES = { admin: 'Admin', tutor: 'Tutor', parent: 'Parent' } as const;

/**
 * Every User in an organisation, with `role` set to their role in this org.
 * Only Admins can read other people's records, so for anyone else this is
 * just themselves. `users` is null while loading.
 *
 * Membership rows say who belongs where. Users from before Memberships
 * existed only have User.orgId, so those are merged in too.
 */
export function useOrgUsers(orgId?: string) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      // A filtered list scans the table, so pages can come back short: keep going until there's no token
      const byId = new Map<string, User>();
      let nextToken: string | null | undefined;
      do {
        const page = await client.models.User.list({ filter: { orgId: { eq: orgId } }, nextToken });
        if (page.errors?.length) throw new Error(page.errors[0].message);
        for (const u of page.data) byId.set(u.id, u);
        nextToken = page.nextToken;
      } while (nextToken);

      nextToken = undefined;
      do {
        const page: MembershipPage = await client.models.Membership.list({ filter: { orgId: { eq: orgId } }, nextToken });
        if (page.errors?.length) throw new Error(page.errors[0].message);
        const members = await Promise.all(page.data.map(async (m) => ({ m, user: (await m.user()).data })));
        for (const { m, user } of members) {
          if (user && m.role) byId.set(user.id, { ...user, role: ROLES[m.role] });
        }
        nextToken = page.nextToken;
      } while (nextToken);

      if (!cancelled) setUsers([...byId.values()]);
    })().catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'Could not load people.');
      setUsers([]);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { users, error };
}
