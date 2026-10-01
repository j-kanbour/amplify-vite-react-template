import { useState, type FormEvent } from 'react';
import { Alert, Button, PasswordField, TextField } from '@aws-amplify/ui-react';
import { confirmResetPassword, resetPassword, updatePassword } from 'aws-amplify/auth';
import { LuKeyRound } from 'react-icons/lu';

// Mirrors the user pool's password policy (amplify_outputs.json).
const POLICY_HINT = 'At least 8 characters, with upper and lower case letters, a number and a symbol.';

type Mode =
  | { step: 'idle' }
  | { step: 'change' }
  | { step: 'reset'; destination?: string };

/**
 * Two ways to set a new password:
 *  - Change: the user knows their current one.
 *  - Reset: a code is emailed to them. This is the only route for people who
 *    signed up with Google, whose email account has a random password nobody
 *    was told (see amplify/auth/pre-signup/handler.ts).
 */
export default function PasswordCard({ email }: { email: string }) {
  const [mode, setMode] = useState<Mode>({ step: 'idle' });
  const [current, setCurrent] = useState('');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);

  function reset(to: Mode) {
    setCurrent('');
    setCode('');
    setNext('');
    setConfirm('');
    setMode(to);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setStatus(null);
    try {
      await action();
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      const { nextStep } = await resetPassword({ username: email });
      reset({ step: 'reset', destination: nextStep.codeDeliveryDetails?.destination });
    });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setStatus({ kind: 'error', message: 'The new passwords don’t match.' });
      return;
    }
    run(async () => {
      if (mode.step === 'change') {
        await updatePassword({ oldPassword: current, newPassword: next });
      } else {
        await confirmResetPassword({ username: email, confirmationCode: code.trim(), newPassword: next });
      }
      reset({ step: 'idle' });
      setStatus({ kind: 'success', message: 'Your password has been updated.' });
    });
  }

  return (
    <section className="ts-profile__card">
      <div className="ts-profile__card-head">
        <div>
          <h2 className="ts-profile__card-title">Password</h2>
          <p className="ts-profile__card-sub">Used to sign in with your email address.</p>
        </div>
      </div>

      {status && (
        <Alert variation={status.kind} isDismissible onDismiss={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      {mode.step === 'idle' ? (
        <div className="ts-profile__actions">
          <Button onClick={() => reset({ step: 'change' })}>
            <LuKeyRound aria-hidden /> Change password
          </Button>
          <Button variation="link" onClick={sendCode} isLoading={busy} loadingText="Sending code…">
            Forgot it, or signed up with Google? Email me a reset code
          </Button>
        </div>
      ) : (
        <form className="ts-profile__form" onSubmit={handleSubmit}>
          {mode.step === 'change' ? (
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              isRequired
            />
          ) : (
            <TextField
              label="Verification code"
              descriptiveText={`We sent a code to ${mode.destination ?? email}.`}
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              isRequired
            />
          )}
          <PasswordField
            label="New password"
            descriptiveText={POLICY_HINT}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            isRequired
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            isRequired
          />
          <div className="ts-profile__actions">
            <Button variation="primary" type="submit" isLoading={busy} loadingText="Updating…">
              Update password
            </Button>
            <Button onClick={() => reset({ step: 'idle' })} isDisabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
