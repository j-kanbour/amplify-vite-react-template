import { useCallback, useEffect, useState } from 'react';
import { client, type Schema } from './client';

export type Parent = Schema['Parent']['type'];

/** What the form sends; matches the addParent / updateParent arguments. */
export type ParentValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  bundleId?: string;
  notes?: string;
  onboardingMessage?: string;
  secondFirstName?: string;
  secondLastName?: string;
  secondEmail?: string;
  secondPhone?: string;
  secondAddress?: string;
};

export const parentName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();

/**
 * The org's parents. Admins and tutors both see all of them. `parents` is
 * null while loading; `reload` fetches again, keeping the list on screen.
 */
export function useParents(orgId?: string | null) {
  const [loaded, setLoaded] = useState<{ orgId: string; parents?: Parent[]; error?: string }>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    let current = true;
    (async () => {
      const parents: Parent[] = [];
      let nextToken: string | null | undefined;
      do {
        const page = await client.models.Parent.listParentsByOrg({ orgId }, { nextToken });
        if (page.errors?.length) throw new Error(page.errors[0].message);
        parents.push(...page.data);
        nextToken = page.nextToken;
      } while (nextToken);
      if (current) setLoaded({ orgId, parents });
    })().catch((err) => {
      if (current) setLoaded({ orgId, error: err instanceof Error ? err.message : 'Could not load parents.' });
    });
    return () => {
      current = false;
    };
  }, [orgId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Keyed by org so one org's parents never show for the next
  const mine = orgId && loaded?.orgId === orgId ? loaded : undefined;
  return { parents: mine?.parents ?? null, error: mine?.error ?? null, reload };
}

/** Records the parent and sends their welcome email. Resolves with whether the email went. */
export async function addParent(values: ParentValues) {
  const { data, errors } = await client.mutations.addParent(values);
  if (errors?.length) throw new Error(errors[0].message);
  if (!data) throw new Error('Could not add the parent.');
  return data;
}

/** Replaces the parent's details. Leaving the second parent's fields out removes them. */
export async function updateParent(parentId: string, values: ParentValues) {
  const { data, errors } = await client.mutations.updateParent({ parentId, ...values });
  if (errors?.length) throw new Error(errors[0].message);
  if (!data) throw new Error('Could not save the changes.');
  return data;
}

export async function deleteParent(parentId: string) {
  const { errors } = await client.mutations.deleteParent({ parentId });
  if (errors?.length) throw new Error(errors[0].message);
}
