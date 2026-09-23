import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, CheckboxField, SelectField, TextField, useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { client } from '../data/client';
import { useUser } from '../context/UserContext';
import { ORG_SIZE_OPTIONS } from '../components/SignUpForm';
import logo from '../assets/Tutor-Studio-logo.png';

/**
 * Second half of sign-up for Google users, who skip the business fields on the
 * sign-up form. OnboardingGate in App.tsx keeps them here until it's done.
 * Submitting creates their Organisation and User records and puts them in the
 * Admin group; refreshing the session then picks up the group and the gate
 * sends them on to the app.
 */
export default function Onboarding() {
  const { signOut } = useAuthenticator();
  const { refresh } = useUser();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSize, setOrgSize] = useState<string>('Solo');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAttributes()
      .then((attrs) => {
        setEmail(attrs.email ?? '');
        // Prefill from Google; the user can change it before continuing
        setName((current) => current || (attrs.name ?? ''));
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { errors } = await client.mutations.completeOnboarding({
        name: name.trim(),
        orgName: orgName.trim(),
        orgSize,
        acceptedTerms,
      });
      if (errors?.length) throw new Error(errors[0].message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="ts-onboarding">
      <div className="ts-legal__container ts-onboarding__container">
        <header className="ts-auth-header">
          <img className="ts-auth-header__logo" src={logo} alt="Tutor Studio" />
          <p className="ts-auth-header__tagline">Personalised lessons, weekly feedback.</p>
        </header>

        <div className="ts-legal__card">
          <div className="ts-auth-heading">
            <h1 className="ts-auth-heading__title">Set up your business</h1>
            <p className="ts-auth-heading__sub">
              One last step before you can start inviting parents and tutors.
            </p>
          </div>

          <form className="ts-onboarding__form" onSubmit={handleSubmit}>
            {email && (
              <p className="ts-onboarding__account">
                Signed in as <strong>{email}</strong>
              </p>
            )}
            <TextField
              label="Full name"
              placeholder="e.g. Mia Tran"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              isRequired
            />
            <TextField
              label="Business name"
              placeholder="e.g. Tutor Studio"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              isRequired
            />
            <SelectField
              label="Business Size"
              value={orgSize}
              onChange={(e) => setOrgSize(e.target.value)}
              isRequired
            >
              {ORG_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
            <CheckboxField
              name="acknowledgement"
              value="yes"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              label={
                <span>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer">
                    Terms &amp; Conditions
                  </a>{' '}
                  and the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                </span>
              }
            />
            {error && <Alert variation="error">{error}</Alert>}
            <Button
              type="submit"
              variation="primary"
              isLoading={submitting}
              loadingText="Setting up…"
              isDisabled={!name.trim() || !orgName.trim() || !acceptedTerms}
            >
              Continue
            </Button>
            <Button type="button" variation="link" onClick={signOut}>
              Sign out
            </Button>
          </form>
        </div>

        <footer className="ts-auth-footer">© {new Date().getFullYear()} Tutor Studio</footer>
      </div>
    </div>
  );
}