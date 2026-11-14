// Single source of truth for who can do what.
// Guard components and routes with `can('permission')` rather than `has('Admin')`,
// so changing a policy means editing this file, not hunting through components.

export const GROUPS = ['Admin', 'Tutor', 'Parent'] as const;
export type Group = (typeof GROUPS)[number];

export const permissions = {
  'org.view':       ['Admin', 'Tutor', 'Parent'],
  'org.edit':       ['Admin'],
  'users.list':     ['Admin'],
  'users.invite':   ['Admin'],
  'users.changeRole': ['Admin'],
  'users.offboard': ['Admin'],
  // A task board of their own. Admins also manage every employee's from the
  // Employees page; the backend lets only them and the employee touch a task.
  'tasks.own':      ['Admin', 'Tutor'],
  'students.view':  ['Admin', 'Tutor'],
  // Tutors see only the students assigned to them
  'students.viewAll': ['Admin'],
  'students.add':   ['Admin'],
  // Pricing bundles: tutors present them, admins set them
  'bundles.view':   ['Admin', 'Tutor'],
  'bundles.edit':   ['Admin'],
  'child.view':     ['Parent'],
} as const satisfies Record<string, readonly Group[]>;

export type Permission = keyof typeof permissions;

export function isAllowed(permission: Permission, groups: readonly string[]): boolean {
  const allowed: readonly string[] = permissions[permission];
  return groups.some((g) => allowed.includes(g));
}
