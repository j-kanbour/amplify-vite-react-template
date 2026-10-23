import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@aws-amplify/ui-react';
import { getCurrentUser } from 'aws-amplify/auth';
import { client, type Schema } from '../data/client';
import InviteShell from '../components/InviteShell';
import { INVITE_PROBLEMS, roleLabel } from '../utils/inviteText';
import { clearPendingInvite, savePendingInvite } from '../utils/pendingInvite';

type Preview = Schema['EmployeeInvitePreview']['type'];

/**
 * Where the invite email's link lands (/join?t=...). Public: it shows who the
 * invite is from before the visitor signs in or creates an account, and keeps
 * the token so the accept page can finish the job after sign-up.
 */
export default function JoinInvite() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Preview | null>(null);
  // No token in the link at all: nothing to look up
  const preview: Preview | null = token ? loaded : { status: 'invalid' };
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      // Already signed in: the accept page shows the same details
      const signedIn = await getCurrentUser().then(() => true, () => false);
      if (signedIn) {
        savePendingInvite({ token });
        navigate(`/join/accept?${new URLSearchParams({ t: token })}`, { replace: true });
        return;
      }

      const { data, errors } = await client.queries.previewEmployeeInvite({ token }, { authMode: 'identityPool' });
      if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? 'Could not load this invite.');
      if (cancelled) return;
      if (data.status === 'valid') savePendingInvite({ token, orgName: data.orgName, email: data.email });
      else clearPendingInvite();
      setLoaded(data);
    })().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this invite.');
    });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const continueTo = (mode: 'signUp' | 'signIn') =>
    navigate(`/join/accept?${new URLSearchParams({ t: token, mode })}`);

  if (error) {
    return (
      <InviteShell title="Something went wrong">
        <Alert variation="error">{error}</Alert>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </InviteShell>
    );
  }

  if (!preview) {
    return (
      <InviteShell title="Opening your invite…">
        <p className="ts-onboarding__account">Checking the link.</p>
      </InviteShell>
    );
  }

  if (preview.status !== 'valid') {
    const problem = INVITE_PROBLEMS[preview.status] ?? INVITE_PROBLEMS.invalid;
    return (
      <InviteShell title={problem.title} sub={problem.body}>
        <Button variation="primary" onClick={() => navigate('/')}>
          Go to sign in
        </Button>
      </InviteShell>
    );
  }

  return (
    <InviteShell
      title={`Join ${preview.orgName}`}
      sub={`You’ve been invited to join ${preview.orgName} on Tutor Studio as ${roleLabel(preview.role)}.`}
    >
      <p className="ts-onboarding__account">
        Use <strong>{preview.email}</strong>, the address this invite was sent to.
      </p>
      <Button variation="primary" onClick={() => continueTo('signUp')}>
        Create an account
      </Button>
      <Button onClick={() => continueTo('signIn')}>I already have an account</Button>
    </InviteShell>
  );
}
