import { useEffect, useState } from 'react';
import { client } from './client';
import type { User } from './useUsers';

/**
 * Every User in an organisation. Only Admins can read other people's records,
 * so for anyone else this is just themselves. `users` is null while loading.
 */
export function useOrgUsers(orgId?: string) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      // A filtered list scans the table, so pages can come back short: keep going until there's no token
      const all: User[] = [];
      let nextToken: string | null | undefined;
      do {
        const page = await client.models.User.list({ filter: { orgId: { eq: orgId } }, nextToken });
        if (page.errors?.length) throw new Error(page.errors[0].message);
        all.push(...page.data);
        nextToken = page.nextToken;
      } while (nextToken);
      if (!cancelled) setUsers(all);
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
