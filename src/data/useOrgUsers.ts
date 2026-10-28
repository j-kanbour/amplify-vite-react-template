import { useCallback, useEffect, useState } from 'react';
import { client, type Schema } from './client';
import type { User } from './useUsers';
import { listUploadedDocuments } from './employeeDocuments';

// Spelled out: inferring it from list() is too deep for the compiler
type MembershipPage = {
  data: Schema['Membership']['type'][];
  nextToken?: string | null;
  errors?: { message: string }[];
};

const ROLES = { admin: 'Admin', tutor: 'Tutor', parent: 'Parent' } as const;

/**
 * A User, plus the documents this org asked them to upload and those of them
 * not uploaded yet (keys from employee-documents.ts).
 */
export type OrgUser = User & { requiredDocuments: string[]; missingDocuments: string[] };

/**
 * Every User in an organisation, with `role` set to their role in this org
 * and `requiredDocuments` / `missingDocuments` to the documents it asked them
 * for. Only people asked for documents cost a look in their storage.
 * Only Admins can read other people's records, so for anyone else this is
 * just themselves. `users` is null while loading.
 *
 * Membership rows say who belongs where. Users from before Memberships
 * existed only have User.orgId, so those are merged in too. `reload` fetches
 * them again, keeping the current list on screen until it's done.
 */
export function useOrgUsers(orgId?: string) {
  const [users, setUsers] = useState<OrgUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      // A filtered list scans the table, so pages can come back short: keep going until there's no token
      const byId = new Map<string, OrgUser>();
      let nextToken: string | null | undefined;
      do {
        const page = await client.models.User.list({ filter: { orgId: { eq: orgId } }, nextToken });
        if (page.errors?.length) throw new Error(page.errors[0].message);
        for (const u of page.data) byId.set(u.id, { ...u, requiredDocuments: [], missingDocuments: [] });
        nextToken = page.nextToken;
      } while (nextToken);

      nextToken = undefined;
      do {
        const page: MembershipPage = await client.models.Membership.list({ filter: { orgId: { eq: orgId } }, nextToken });
        if (page.errors?.length) throw new Error(page.errors[0].message);
        const members = await Promise.all(page.data.map(async (m) => ({ m, user: (await m.user()).data })));
        for (const { m, user } of members) {
          if (user && m.role) {
            const requiredDocuments = (m.requiredDocuments ?? []).filter((d): d is string => !!d);
            byId.set(user.id, { ...user, role: ROLES[m.role], requiredDocuments, missingDocuments: requiredDocuments });
          }
        }
        nextToken = page.nextToken;
      } while (nextToken);

      // If a lookup fails they show as still onboarding, rather than wrongly as done
      await Promise.all(
        [...byId.values()]
          .filter((u) => u.requiredDocuments.length)
          .map(async (u) => {
            const uploaded = await listUploadedDocuments(u.id).catch((): string[] => []);
            u.missingDocuments = u.requiredDocuments.filter((d) => !uploaded.includes(d));
          }),
      );

      if (!cancelled) setUsers([...byId.values()]);
    })().catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'Could not load people.');
      setUsers([]);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { users, error, reload };
}
