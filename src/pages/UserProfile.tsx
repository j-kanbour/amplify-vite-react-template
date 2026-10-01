import { useEffect, useState } from 'react';
import { Alert, Button } from '@aws-amplify/ui-react';
import { fetchUserAttributes, signOut, updateUserAttributes } from 'aws-amplify/auth';
import { LuLogOut } from 'react-icons/lu';
import { client } from '../data/client';
import { useUser } from '../context/UserContext';
import AvatarUpload from '../components/profile/AvatarUpload';
import EditableDetails, { type DetailField } from '../components/profile/EditableDetails';
import PasswordCard from '../components/profile/PasswordCard';
import { validatePhone } from '../utils/validation';

const FIELDS: DetailField[] = [
  { name: 'name', label: 'Full name', required: true, placeholder: 'e.g. Mia Tran' },
  { name: 'phone', label: 'Phone number', type: 'tel', placeholder: '+61 400 000 000', validate: validatePhone },
  // The sign-in address: changing it means re-verifying it and re-linking Google
  { name: 'email', label: 'Email', readOnly: true },
  { name: 'org', label: 'Organisation', readOnly: true },
  { name: 'role', label: 'Role', readOnly: true },
];

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** The signed-in user's own profile. Reached from the account menu in the sidebar. */
export default function UserProfile() {
  const { user, org, groups, refresh, loading } = useUser();
  const [providers, setProviders] = useState<string[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  // Which outside providers (Google) are linked to this account
  useEffect(() => {
    fetchUserAttributes()
      .then((attrs) => {
        const identities: { providerName?: string }[] = attrs.identities ? JSON.parse(attrs.identities) : [];
        setProviders(identities.map((i) => i.providerName ?? '').filter(Boolean));
      })
      .catch(() => {});
  }, []);

  if (loading) return <p>Loading…</p>;
  if (!user) {
    return <Alert variation="error">We couldn’t find your profile. Try signing out and back in.</Alert>;
  }

  async function save(values: Record<string, string | null>) {
    const name = values.name ?? user!.name;
    const { errors } = await client.models.User.update({ id: user!.id, name, phone: values.phone });
    if (errors?.length) throw new Error(errors[0].message);
    // Keep Cognito's copy in step: it's what new sign-ins and emails use
    if (name !== user!.name) await updateUserAttributes({ userAttributes: { name } });
    await refresh();
  }

  async function signOutEverywhere() {
    setSigningOut(true);
    // The Authenticator hears the sign-out and shows the sign-in screen
    await signOut({ global: true }).catch(() => setSigningOut(false));
  }

  const role = user.role ?? groups[0];

  return (
    <main className="ts-profile">
      <section className="ts-profile__card">
        <AvatarUpload name={user.name} buttonLabel="Upload photo">
          <h2 className="ts-profile__name">{user.name}</h2>
          <p className="ts-profile__meta">
            {user.email}
            {role && <span className="ts-profile__pill">{role}</span>}
          </p>
          {user.createdAt && <p className="ts-profile__meta">Member since {formatDate(user.createdAt)}</p>}
        </AvatarUpload>
      </section>

      <EditableDetails
        title="Personal details"
        description="How you appear to your organisation."
        fields={FIELDS}
        values={{ name: user.name, phone: user.phone, email: user.email, org: org?.name, role }}
        onSave={save}
      />

      <PasswordCard email={user.email} />

      <section className="ts-profile__card">
        <div className="ts-profile__card-head">
          <div>
            <h2 className="ts-profile__card-title">Sign-in &amp; security</h2>
            <p className="ts-profile__card-sub">Ways you can sign in, and your active sessions.</p>
          </div>
        </div>
        <dl className="ts-profile__details">
          <div className="ts-profile__detail">
            <dt>Sign-in methods</dt>
            <dd>{['Email & password', ...providers].join(', ')}</dd>
          </div>
        </dl>
        <div className="ts-profile__actions">
          <Button onClick={signOutEverywhere} isLoading={signingOut} loadingText="Signing out…">
            <LuLogOut aria-hidden /> Sign out of all devices
          </Button>
        </div>
      </section>
    </main>
  );
}
