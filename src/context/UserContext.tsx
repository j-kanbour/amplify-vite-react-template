import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
type UserRecord = Schema['User']['type'];
type OrgRecord = Schema['Organisation']['type'];

type Ctx = {
  groups: string[];
  user: UserRecord | null;
  org: OrgRecord | null;
  subscription: string;
  loading: boolean;
  has: (...g: string[]) => boolean;
};

const UserContext = createContext<Ctx>({ groups: [], user: null, org: null, subscription: 'free', loading: true, has: () => false });

export function UserProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<string[]>([]);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [org, setOrg] = useState<OrgRecord | null>(null);
  const [subscription, setSubscription] = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await fetchAuthSession();
      setGroups((s.tokens?.accessToken.payload['cognito:groups'] as string[]) ?? []);
      const { data } = await client.models.User.list();
      setUser(data[0] ?? null); // owner auth → only their own record comes back
      const { data: orgData } = await client.models.Organisation.list();
      setOrg(orgData[0] ?? null);
      setSubscription(orgData[0]?.subscription ?? 'free');
      setLoading(false);
    })();
  }, []);

  const has = (...g: string[]) => g.some((x) => groups.includes(x));

  return <UserContext.Provider value={{ groups, user, org, subscription, loading, has }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);