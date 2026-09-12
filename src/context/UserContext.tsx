import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { client, type Schema } from '../data/client';
import { isAllowed, type Permission } from '../access';
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
  has: () => false,
  can: () => false,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [realGroups, setRealGroups] = useState<string[]>([]);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [org, setOrg] = useState<OrgRecord | null>(null);
  const [subscription, setSubscription] = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await fetchAuthSession();
      setRealGroups((s.tokens?.accessToken.payload['cognito:groups'] as string[]) ?? []);
      const { data } = await client.models.User.list();
      setUser(data[0] ?? null); // owner auth → only their own record comes back
      const { data: orgData } = await client.models.Organisation.list();
      setOrg(orgData[0] ?? null);
      setSubscription(orgData[0]?.subscription ?? 'free');
      setLoading(false);
    })();
  }, []);

  const override = readGroupOverride(); // DEV ONLY: null in production
  const groups = override ? [override] : realGroups;

  const has = (...g: string[]) => g.some((x) => groups.includes(x));
  const can = (permission: Permission) => isAllowed(permission, groups);

  return (
    <UserContext.Provider value={{ groups, realGroups, user, org, subscription, loading, has, can }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
