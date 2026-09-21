import { useEffect, useState } from 'react';
import { Alert, Authenticator, Button, SelectField, CheckboxField, useAuthenticator } from '@aws-amplify/ui-react';
import { signInWithRedirect, signUp, type SignUpInput } from 'aws-amplify/auth';
import type { OrgSize } from '../../amplify/data/org-sizes';
import logo from '../assets/Tutor-Studio-logo.png';

/** Business size choices, one per Organisation.initialSize value. */
export const ORG_SIZE_OPTIONS = [
  { value: 'Solo', label: 'Just me' },
  { value: 'Small', label: '2-5' },
  { value: 'Medium', label: '6-10' },
  { value: 'Large', label: '11-20' },
  { value: 'XLarge', label: '21+' },
] as const satisfies readonly { value: OrgSize; label: string }[];

/** Field order/labels for the Amplify sign-up screen. */
export const signUpFormFields = {
  signIn: {
    username: { label: 'Email', placeholder: 'you@example.com' },
    password: { label: 'Password', placeholder: 'Enter your password' },
  },
  signUp: {
    name: { label: 'Full name', placeholder: 'e.g. Mia Tran', order: 1 },
    email: { label: 'Email', placeholder: 'you@example.com', order: 2 },
    password: { label: 'Password', placeholder: 'Create a password', order: 3 },
    confirm_password: { label: 'Confirm password', placeholder: 'Re-enter your password', order: 4 },
    'custom:orgName': { label: 'Business name', placeholder: 'e.g. Tutor Studio', order: 5 },
  },
};

/** Brand header rendered above the Authenticator card. */
function AuthHeader() {
  return (
    <header className="bj-auth-header">
      <img className="bj-auth-header__logo" src={logo} alt="Tutor Studio" />
      <p className="bj-auth-header__tagline">Personalised lessons, weekly feedback.</p>
    </header>
  );
}

function AuthFooter() {
  return <footer className="bj-auth-footer">© {new Date().getFullYear()} Tutor Studio</footer>;
}

/** Cognito prefixes errors thrown by triggers with "PreSignUp failed with error ". */
function cleanTriggerError(message: string) {
  return message.replace(/^\w+ failed with error /, '').trim();
}

/**
 * A rejected Google sign-in (e.g. the pre-signup trigger found the email
 * already in use) comes back as ?error_description=... on the redirect URL.
 * Amplify only reports it on the Hub, so the Authenticator never shows it.
 */
function readOAuthError() {
  const message = new URLSearchParams(window.location.search).get('error_description');
  return message ? cleanTriggerError(message) : null;
}

/**
 * Sent by the pre-signup trigger after it links a first Google sign-in to an
 * email account. That sign-in had to be aborted; signing in with Google again
 * lands on the linked account.
 */
const ACCOUNT_LINKED = 'ACCOUNT_LINKED';
const LINK_RETRY_KEY = 'oauthLinkRetryAt';

/** Allows one automatic retry a minute, so a repeat failure can't loop. */
function claimLinkRetry() {
  try {
    const last = Number(sessionStorage.getItem(LINK_RETRY_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(LINK_RETRY_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function SignInHeader() {
  const [oauthError] = useState(readOAuthError);
  const linked = oauthError?.includes(ACCOUNT_LINKED) ?? false;
  const [retrying] = useState(() => linked && claimLinkRetry());

  useEffect(() => {
    if (!oauthError) return;
    // Drop the error from the URL so it doesn't reappear after a later sign-out.
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState(window.history.state, '', url);

    if (retrying) signInWithRedirect({ provider: 'Google' });
  }, [oauthError, retrying]);

  return (
    <div className="bj-auth-heading">
      <h2 className="bj-auth-heading__title">Welcome back</h2>
      <p className="bj-auth-heading__sub">Sign in to see this week&apos;s sessions.</p>
      {retrying && (
        <Alert variation="info" marginTop="16px">
          Finishing Google sign-in…
        </Alert>
      )}
      {linked && !retrying && (
        <Alert variation="info" marginTop="16px">
          Your Google account is now connected. Sign in with Google again to continue.
        </Alert>
      )}
      {oauthError && !linked && (
        <Alert variation="error" marginTop="16px">
          {oauthError}
        </Alert>
      )}
    </div>
  );
}

function SignUpHeader() {
  return (
    <div className="bj-auth-heading">
      <h2 className="bj-auth-heading__title">Create your account</h2>
      <p className="bj-auth-heading__sub">Set up your business and start inviting parents and tutors.</p>
    </div>
  );
}

function SignUpFormFields() {
  return ( 
    <>  
      <Authenticator.SignUp.FormFields />
      <SelectField
        name="custom:orgSize"
        label="Business Size"
        defaultValue="Solo"
        isRequired
      >
        {ORG_SIZE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectField>
      <CheckboxField
        name="acknowledgement"
        value="yes"
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
    </>
  )
}

/** The reset-code step has no way back by default, unlike the email step. */
function ConfirmResetPasswordFooter() {
  const { toSignIn } = useAuthenticator();
  return (
    <Button type="button" variation="link" size="small" fontWeight="normal" width="100%" onClick={toSignIn}>
      Back to Sign In
    </Button>
  );
}

/** Service overrides passed to <Authenticator services={...}>. */
export const authServices = {
  async handleSignUp(input: SignUpInput) {
    // Store emails lowercase so the pre-signup trigger's duplicate check
    // matches however the address was typed.
    const email = input.username.trim().toLowerCase();
    try {
      return await signUp({
        ...input,
        username: email,
        options: {
          ...input.options,
          userAttributes: { ...input.options?.userAttributes, email },
        },
      });
    } catch (err) {
      if (err instanceof Error) err.message = cleanTriggerError(err.message);
      throw err;
    }
  },
};

/** Component overrides passed to <Authenticator components={...}>. */
export const signUpComponents = {
  Header: AuthHeader,
  Footer: AuthFooter,
  SignIn: {
    Header: SignInHeader,
  },
  SignUp: {
    Header: SignUpHeader,
    FormFields: SignUpFormFields,
  },
  ConfirmResetPassword: {
    Footer: ConfirmResetPasswordFooter,
  },
};
