import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { client, type Schema } from '../data/client';
import { GROUPS, isAllowed, type Permission } from '../access';
import { readGroupOverride } from '../dev/roleOverride'; // DEV ONLY, see src/dev

type UserRecord = Schema['User']['type'];
type OrgRecord = Schema['Organisation']['type'];

type Ctx = {
  /** Groups the UI reasons about (may be a dev override). */
  groups: string[];
  /** Groups actually in the Cognito token. */
  realGroups: string[];
  user: UserRecord | null;
  org: OrgRecord | null;
  subscription: string;
  loading: boolean;
  /**
   * Signed in but not yet in an app group: a Google sign-up that hasn't finished
   * the onboarding page. Email sign-ups get their group in post-confirmation.
   */
  needsOnboarding: boolean;
  /** Re-fetch tokens (picking up new groups) and the user's records. */
  refresh: () => Promise<void>;
  /** Raw group check. Prefer `can` in components. */
  has: (...g: string[]) => boolean;
  /** Named permission check backed by src/access.ts. */
  can: (permission: Permission) => boolean;
};

const UserContext = createContext<Ctx>({
  groups: [],
  realGroups: [],
  user: null,
  org: null,
  subscription: 'free',
  loading: true,
  needsOnboarding: false,
  refresh: async () => {},
  has: () => false,
  can: () => false,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [realGroups, setRealGroups] = useState<string[]>([]);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [org, setOrg] = useState<OrgRecord | null>(null);
  const [subscription, setSubscription] = useState('free');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (forceRefresh = false) => {
    const s = await fetchAuthSession({ forceRefresh });
    const payload = s.tokens?.accessToken.payload;
    setRealGroups((payload?.['cognito:groups'] as string[]) ?? []);

    // Admins can read every User and every Organisation, so look up our own
    // records explicitly rather than taking the first row of a list.
    const profileOwner = `${payload?.sub}::${payload?.username}`;
    const { data } = await client.models.User.listUserByProfileOwner({ profileOwner });
    const me = data[0] ?? null;
    setUser(me);
    const { data: orgData } = me?.orgId
      ? await client.models.Organisation.get({ id: me.orgId })
      : { data: null };
    setOrg(orgData ?? null);
    setSubscription(orgData?.subscription ?? 'free');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const override = readGroupOverride(); // DEV ONLY: null in production
  const groups = override ? [override] : realGroups;

  const has = (...g: string[]) => g.some((x) => groups.includes(x));
  const can = (permission: Permission) => isAllowed(permission, groups);
  // Only the app's groups count: Cognito also puts every Google user in an
  // automatic "<poolId>_Google" group.
  const needsOnboarding = !realGroups.some((g) => (GROUPS as readonly string[]).includes(g));

  return (
    <UserContext.Provider value={{ groups, realGroups, user, org, subscription, loading, needsOnboarding, refresh, has, can }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
