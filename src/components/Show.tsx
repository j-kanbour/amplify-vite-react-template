import type { ReactNode } from 'react';
import { useUser } from '../context/UserContext';
import type { Permission } from '../access';

type Props = {
  /** Preferred: a named permission from src/access.ts */
  permission?: Permission;
  /** Escape hatch: raw group check */
  groups?: string[];
  subscription?: string;
  when?: boolean;
  children: ReactNode;
};

export default function Show({ permission, groups, subscription, when = true, children }: Props) {
  const { has, can, org } = useUser();
  const permissionOk = !permission || can(permission);
  const groupOk = !groups || has(...groups);
  const subscriptionOk = !subscription || org?.subscription === subscription;
  return permissionOk && groupOk && subscriptionOk && when ? <>{children}</> : null;
}
