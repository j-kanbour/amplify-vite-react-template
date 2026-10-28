/**
 * Documents an admin can ask an invited employee to upload. The key is stored
 * on the invite and Membership, and names the file in the profile bucket
 * (users/{userId}/documents/{key}), so never rename one: add a new entry.
 */
export const EMPLOYEE_DOCUMENTS = [
  { key: 'wwcc', label: 'Working with Children Check' },
  { key: 'licence', label: 'Licence' },
  { key: 'passport', label: 'Passport' },
] as const;
export type EmployeeDocument = (typeof EMPLOYEE_DOCUMENTS)[number]['key'];

export const isEmployeeDocument = (v: unknown): v is EmployeeDocument =>
  EMPLOYEE_DOCUMENTS.some((d) => d.key === v);

export const documentLabel = (key: string) => EMPLOYEE_DOCUMENTS.find((d) => d.key === key)?.label ?? key;
