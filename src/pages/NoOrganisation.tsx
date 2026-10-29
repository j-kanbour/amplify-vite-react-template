import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, useAuthenticator } from '@aws-amplify/ui-react';
import { useUser } from '../context/UserContext';
import InviteShell from '../components/InviteShell';

/**
 * For someone with an account but no org (/no-organisation): offboarded from
 * every org they were in. OnboardingGate keeps them here until they start an
 * org of their own or accept an invite.
 */
export default function NoOrganisation() {
  const { needsOnboarding, refresh } = useUser();
  const { signOut } = useAuthenticator();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Their token can still carry the role they had until it refreshes, and
  // completeOnboarding refuses anyone who has one, so get a fresh one now
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [refresh]);

  return (
    <InviteShell
      title="You’re not part of a tutoring organisation"
      sub="Your account isn’t linked to any organisation on Tutor Studio right now."
    >
      <p className="ts-onboarding__account">
        If you work for a tutoring business, ask your admin to send you an invite. It’ll arrive by email.
      </p>
      <p className="ts-onboarding__account">Or, if you run your own, you can set up an organisation of your own.</p>
      <Button
        variation="primary"
        onClick={() => navigate('/onboarding')}
        isLoading={checking}
        loadingText="Checking your account…"
        isDisabled={!needsOnboarding}
      >
        Create your own organisation
      </Button>
      {!checking && !needsOnboarding && (
        <p className="ts-onboarding__account">Your account is still being updated. Try again in a few minutes.</p>
      )}
      <Button variation="link" onClick={signOut}>
        Sign out
      </Button>
    </InviteShell>
  );
}
