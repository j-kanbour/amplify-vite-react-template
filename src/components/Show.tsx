import type { ReactNode } from 'react';
import { useUser } from '../context/UserContext';

type Props = {
  groups?: string[];
  subscription?: string;
  when?: boolean;
  children: ReactNode;
};

export default function Show({ groups, subscription, when = true, children }: Props) {
  const { has, org } = useUser();
  const groupOk = !groups || has(...groups);
  const subscriptionOk = !subscription || org?.subscription === subscription;
  return groupOk && subscriptionOk && when ? <>{children}</> : null;
}