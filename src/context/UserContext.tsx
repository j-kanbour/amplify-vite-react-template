import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { client, type Schema } from '../data/client';
import { GROUPS, isAllowed, type Group, type Permission } from '../access';
import { readGroupOverride } from '../dev/roleOverride'; // DEV ONLY, see src/dev

type UserRecord = Schema['User']['type'];
type OrgRecord = Schema['Organisation']['type'];

/** An org the user belongs to, and their role in it. */
export type OrgMembership = { orgId: string; orgName: string; role: Group };

const ROLE_GROUPS: Record<string, Group> = { admin: 'Admin', tutor: 'Tutor', parent: 'Parent' };

type Ctx = {
  /** Groups the UI reasons about (may be a dev override). */
  groups: string[];
  /** Groups actually in the Cognito token. */
  realGroups: string[];
  user: UserRecord | null;
  org: OrgRecord | null;
  /** Every org the user belongs to; `org` is the active one. */
  memberships: OrgMembership[];
  /** Make another of the user's orgs the active one. */
  switchOrg: (orgId: string) => Promise<void>;
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
  memberships: [],
  switchOrg: async () => {},
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
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
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

    const { data: rows } = me ? await me.memberships() : { data: [] };
    const named = await Promise.all(
      rows.map(async (m) => {
        const { data: o } = m.orgId === orgData?.id ? { data: orgData } : await m.org();
        return { orgId: m.orgId, orgName: o?.name ?? 'Organisation', role: ROLE_GROUPS[m.role ?? ''] };
      })
    );
    setMemberships(named.filter((m) => m.role).sort((a, b) => a.orgName.localeCompare(b.orgName)));
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

  const switchOrg = useCallback(
    async (orgId: string) => {
      const { errors } = await client.mutations.switchOrg({ orgId });
      if (errors?.length) throw new Error(errors[0].message);
      await load();
    },
    [load]
  );

  // Cognito groups are app-wide (an Admin of one org and Tutor of another has
  // both), so the UI uses the role in the active org when there is one.
  // Users from before Memberships existed fall back to their groups.
  const activeRole = memberships.find((m) => m.orgId === user?.orgId)?.role;
  const roleGroups = activeRole && realGroups.includes(activeRole) ? [activeRole] : realGroups;

  const override = readGroupOverride(); // DEV ONLY: null in production
  const groups = override ? [override] : roleGroups;

  const has = (...g: string[]) => g.some((x) => groups.includes(x));
  const can = (permission: Permission) => isAllowed(permission, groups);
  // Only the app's groups count: Cognito also puts every Google user in an
  // automatic "<poolId>_Google" group.
  const needsOnboarding = !realGroups.some((g) => (GROUPS as readonly string[]).includes(g));

  return (
    <UserContext.Provider value={{ groups, realGroups, user, org, memberships, switchOrg, subscription, loading, needsOnboarding, refresh, has, can }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
