import { useCallback, useEffect, useState } from 'react';
import { client, type Schema } from './client';

export type Bundle = Schema['Bundle']['type'];

/** What the form edits; everything else on a Bundle is set by the backend. */
export type BundleDraft = {
  name: string;
  description: string | null;
  price: string | null;
  priceUnit: string | null;
  sessions: number | null;
  features: string[];
  discount: string | null;
  discountTime: string | null;
  featured: boolean;
};

export const PRICE_UNITS = ['per session', 'per hour', 'per week', 'per term', 'per month', 'one-off'] as const;

/** "$45", "$45.50", or the text as typed when it isn't a plain number. */
export function formatPrice(price?: string | null) {
  const text = (price ?? '').trim();
  if (!text) return null;
  const n = Number(text.replace(/^\$/, '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return text;
  return `$${Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The lines of a bundle's feature list, with the gaps the API can return taken out. */
export const bundleFeatures = (b: Bundle) => (b.features ?? []).filter((f): f is string => !!f);

/** Featured first, then cheapest first (unpriced last), then by name. */
export function byShowcaseOrder(a: Bundle, b: Bundle) {
  if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
  const pa = Number((a.price ?? '').replace(/[$,]/g, '')) || Infinity;
  const pb = Number((b.price ?? '').replace(/[$,]/g, '')) || Infinity;
  if (pa !== pb) return pa - pb;
  return (a.name ?? '').localeCompare(b.name ?? '');
}

const fail = (errors?: { message: string }[]) => {
  if (errors?.length) throw new Error(errors[0].message);
};

/**
 * The org's pricing bundles. Anyone signed in can read them; only the org's
 * admins can add, change or remove them (the model's auth rules). `bundles`
 * is null while loading.
 */
export function useBundles(orgId?: string | null) {
  const [loaded, setLoaded] = useState<{ orgId: string; bundles?: Bundle[]; error?: string }>();

  useEffect(() => {
    if (!orgId) return;
    let current = true;
    (async () => {
      const bundles: Bundle[] = [];
      let nextToken: string | null | undefined;
      do {
        const page = await client.models.Bundle.listBundlesByOrg({ orgId }, { nextToken });
        fail(page.errors);
        bundles.push(...page.data);
        nextToken = page.nextToken;
      } while (nextToken);
      if (current) setLoaded({ orgId, bundles });
    })().catch((err) => {
      if (current) setLoaded({ orgId, error: err instanceof Error ? err.message : 'Could not load bundles.' });
    });
    return () => {
      current = false;
    };
  }, [orgId]);

  // Keyed by org so one org's bundles never show for the next
  const mine = orgId && loaded?.orgId === orgId ? loaded : undefined;

  const setBundles = useCallback(
    (change: (bundles: Bundle[]) => Bundle[]) =>
      setLoaded((l) => (l?.orgId === orgId && l.bundles ? { ...l, bundles: change(l.bundles) } : l)),
    [orgId],
  );

  const add = useCallback(
    async (draft: BundleDraft) => {
      if (!orgId) throw new Error('No organisation to add the bundle to.');
      const { data, errors } = await client.models.Bundle.create({ orgId, ...draft });
      fail(errors);
      if (data) setBundles((bs) => [...bs, data]);
    },
    [orgId, setBundles],
  );

  const update = useCallback(
    async (id: string, draft: BundleDraft) => {
      const { data, errors } = await client.models.Bundle.update({ id, ...draft });
      fail(errors);
      if (data) setBundles((bs) => bs.map((b) => (b.id === id ? data : b)));
    },
    [setBundles],
  );

  const remove = useCallback(
    async (id: string) => {
      const { errors } = await client.models.Bundle.delete({ id });
      fail(errors);
      setBundles((bs) => bs.filter((b) => b.id !== id));
    },
    [setBundles],
  );

  return { bundles: mine?.bundles ?? null, error: mine?.error ?? null, add, update, remove };
}
