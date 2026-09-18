import { useEffect, useState } from 'react';
import { Alert, Authenticator, SelectField, CheckboxField } from '@aws-amplify/ui-react';
import { signUp, type SignUpInput } from 'aws-amplify/auth';
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

function SignInHeader() {
  const [oauthError] = useState(readOAuthError);

  // Drop the error from the URL so it doesn't reappear after a later sign-out.
  useEffect(() => {
    if (!oauthError) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState(window.history.state, '', url);
  }, [oauthError]);

  return (
    <div className="bj-auth-heading">
      <h2 className="bj-auth-heading__title">Welcome back</h2>
      <p className="bj-auth-heading__sub">Sign in to see this week&apos;s sessions.</p>
      {oauthError && (
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
};
