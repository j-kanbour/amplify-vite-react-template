import { Link } from 'react-router-dom';
import { Alert } from '@aws-amplify/ui-react';
import { client } from '../data/client';
import { useOrgUsers } from '../data/useOrgUsers';
import { useUser } from '../context/UserContext';
import { PLAN_LABELS } from '../components/SideNav';
import AvatarUpload from '../components/profile/AvatarUpload';
import EditableDetails, { type DetailField } from '../components/profile/EditableDetails';
import { validateEmail, validatePhone, validateWebsite } from '../utils/validation';

const FIELDS: DetailField[] = [
  { name: 'name', label: 'Organisation name', required: true },
  { name: 'contactEmail', label: 'Contact email', type: 'email', placeholder: 'hello@example.com', validate: validateEmail },
  { name: 'phone', label: 'Phone number', type: 'tel', placeholder: '+61 2 0000 0000', validate: validatePhone },
  { name: 'website', label: 'Website', type: 'url', placeholder: 'example.com', validate: validateWebsite },
  { name: 'address', label: 'Address', multiline: true },
  { name: 'businessNumber', label: 'Business number', hint: 'e.g. your ABN, shown on invoices.' },
];

const ROLES = ['Admin', 'Tutor', 'Parent'] as const;

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** How many of the org's users hold each role. */
function useTeamCounts(orgId?: string) {
  const { users } = useOrgUsers(orgId);
  if (!users) return null;
  const tally: Record<string, number> = {};
  for (const u of users) tally[u.role ?? 'Other'] = (tally[u.role ?? 'Other'] ?? 0) + 1;
  return tally;
}

/** The organisation's profile. Admin only: guarded by the org.edit route in App.tsx. */
export default function OrgProfile() {
  const { org, refresh, loading } = useUser();
  const counts = useTeamCounts(org?.id);

  if (loading) return <p>Loading…</p>;
  if (!org) {
    return <Alert variation="error">We couldn’t find your organisation.</Alert>;
  }

  async function save(values: Record<string, string | null>) {
    const { errors } = await client.models.Organisation.update({
      id: org!.id,
      name: values.name ?? org!.name,
      contactEmail: values.contactEmail,
      phone: values.phone,
      website: values.website,
      address: values.address,
      businessNumber: values.businessNumber,
    });
    if (errors?.length) throw new Error(errors[0].message);
    await refresh();
  }

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;

  return (
    <main className="ts-profile">
      <section className="ts-profile__card">
        <AvatarUpload path={`orgs/${org.id}/logo`} name={org.name} shape="square" buttonLabel="Upload logo">
          <h2 className="ts-profile__name">{org.name}</h2>
          <p className="ts-profile__meta">
            <span className="ts-profile__pill">{PLAN_LABELS[org.subscription ?? 'free'] ?? org.subscription}</span>
          </p>
          {org.createdAt && <p className="ts-profile__meta">Created {formatDate(org.createdAt)}</p>}
        </AvatarUpload>
      </section>

      <EditableDetails
        title="Organisation details"
        description="Shown to parents and tutors, and on anything you send them."
        fields={FIELDS}
        values={{
          name: org.name,
          contactEmail: org.contactEmail,
          phone: org.phone,
          website: org.website,
          address: org.address,
          businessNumber: org.businessNumber,
        }}
        onSave={save}
      />

      <section className="ts-profile__card">
        <div className="ts-profile__card-head">
          <div>
            <h2 className="ts-profile__card-title">Team</h2>
            <p className="ts-profile__card-sub">
              {total === null ? 'Counting members…' : `${total} member${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <Link className="ts-profile__link" to="/employees">
            Manage employees
          </Link>
        </div>
        <dl className="ts-profile__stats">
          {ROLES.map((r) => (
            <div key={r} className="ts-profile__stat">
              <dt>{r}s</dt>
              <dd>{counts ? counts[r] ?? 0 : '–'}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
