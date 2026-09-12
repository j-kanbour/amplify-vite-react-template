// Single source of truth for who can do what.
// Guard components and routes with `can('permission')` rather than `has('Admin')`,
// so changing a policy means editing this file, not hunting through components.

export const GROUPS = ['Admin', 'Tutor', 'Parent'] as const;
export type Group = (typeof GROUPS)[number];

export const permissions = {
  'org.view':       ['Admin', 'Tutor', 'Parent'],
  'users.list':     ['Admin'],
  'users.invite':   ['Admin'],
  'students.view':  ['Admin', 'Tutor'],
  'child.view':     ['Parent'],
} as const satisfies Record<string, readonly Group[]>;

export type Permission = keyof typeof permissions;

export function isAllowed(permission: Permission, groups: readonly string[]): boolean {
  const allowed: readonly string[] = permissions[permission];
  return groups.some((g) => allowed.includes(g));
}
