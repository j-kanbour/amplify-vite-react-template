import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, CheckboxField, useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { client, type Schema } from '../data/client';
import { useUser } from '../context/UserContext';
import InviteShell from '../components/InviteShell';
import { INVITE_PROBLEMS, roleLabel } from '../utils/inviteText';
import { clearPendingInvite, readPendingInvite } from '../utils/pendingInvite';

type Preview = Schema['EmployeeInvitePreview']['type'];

/**
 * Signed-in half of an invite (/join/accept). New accounts arrive here straight
 * after sign-up (OnboardingGate sends anyone with a pending invite here);
 * existing users arrive from the invite link. Accepting joins them to the org
 * and switches the app to it.
 */
export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? readPendingInvite()?.token ?? '';
  const navigate = useNavigate();
  const { signOut } = useAuthenticator();
  const { user, refresh } = useUser();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [{ data, errors }, attrs] = await Promise.all([
        client.queries.previewEmployeeInvite({ token }),
        fetchUserAttributes(),
      ]);
      if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? 'Could not load this invite.');
      if (cancelled) return;
      setEmail(attrs.email ?? '');
      setEmailVerified(attrs.email_verified === 'true');
      setPreview(data);
    })().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this invite.');
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return <Navigate to="/" replace />;

  function leave() {
    clearPendingInvite();
    navigate('/', { replace: true });
  }

  async function accept() {
    setError(null);
    setSubmitting(true);
    try {
      const { errors } = await client.mutations.acceptEmployeeInvite({ token, acceptedTerms });
      if (errors?.length) throw new Error(errors[0].message);
      clearPendingInvite();
      // Picks up the new group and the switched org
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invite. Please try again.');
      setSubmitting(false);
    }
  }

  if (!preview) {
    return (
      <InviteShell title="Opening your invite…">
        {error ? (
          <>
            <Alert variation="error">{error}</Alert>
            <Button onClick={leave}>Continue without the invite</Button>
          </>
        ) : (
          <p className="ts-onboarding__account">Checking the link.</p>
        )}
      </InviteShell>
    );
  }

  if (preview.status !== 'valid') {
    const problem = INVITE_PROBLEMS[preview.status] ?? INVITE_PROBLEMS.invalid;
    return (
      <InviteShell title={problem.title} sub={preview.status === 'accepted' ? undefined : problem.body}>
        <Button variation="primary" onClick={leave}>
          Continue
        </Button>
      </InviteShell>
    );
  }

  const wrongAccount = !!email && !!preview.email && email.toLowerCase() !== preview.email.toLowerCase();
  // Accepting needs a verified address. Google sign-ins pick up the verified
  // flag when they sign in, so an older session can still have it unset.
  const unverified = !wrongAccount && !emailVerified;
  // No User record yet: a new account, so this is where they accept the terms
  const isNewAccount = !user;

  return (
    <InviteShell
      title={`Join ${preview.orgName}`}
      sub={`You’ve been invited to join ${preview.orgName} as ${roleLabel(preview.role)}.`}
    >
      <p className="ts-onboarding__account">
        Signed in as <strong>{email}</strong>
      </p>

      {wrongAccount || unverified ? (
        <>
          <Alert variation="warning">
            {wrongAccount ? (
              <>
                This invite was sent to <strong>{preview.email}</strong>. Sign in with that address to accept it.
              </>
            ) : (
              <>Your email address hasn’t been verified yet. Sign out and sign back in to accept this invite.</>
            )}
          </Alert>
          {/* The pending invite is kept, so it's picked up again after signing back in */}
          <Button variation="primary" onClick={signOut}>
            Sign out
          </Button>
          <Button variation="link" onClick={leave}>
            Continue without joining
          </Button>
        </>
      ) : (
        <>
          {!isNewAccount && (
            <p className="ts-onboarding__account">
              {preview.orgName} will be added to your account. You can switch between your organisations from the
              top bar.
            </p>
          )}
          {isNewAccount && (
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
          )}
          {error && <Alert variation="error">{error}</Alert>}
          <Button
            variation="primary"
            onClick={accept}
            isLoading={submitting}
            loadingText="Joining…"
            isDisabled={isNewAccount && !acceptedTerms}
          >
            Accept invite
          </Button>
          <Button variation="link" onClick={leave}>
            Decline
          </Button>
        </>
      )}
    </InviteShell>
  );
}
