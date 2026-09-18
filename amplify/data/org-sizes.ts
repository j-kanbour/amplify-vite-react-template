/**
 * Organisation.initialSize values, smallest first. The labels shown to users
 * (e.g. "11-20") live with the form in src/components/SignUpForm.tsx.
 */
export const ORG_SIZES = ['Solo', 'Small', 'Medium', 'Large', 'XLarge'] as const;
export type OrgSize = (typeof ORG_SIZES)[number];

export const isOrgSize = (v: unknown): v is OrgSize =>
  ORG_SIZES.includes(v as OrgSize);
