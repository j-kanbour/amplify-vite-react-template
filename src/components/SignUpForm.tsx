import { Authenticator, SelectField, CheckboxField } from '@aws-amplify/ui-react';
import logo from '../assets/Tutor-Studio-logo.png';

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

function SignInHeader() {
  return (
    <div className="bj-auth-heading">
      <h2 className="bj-auth-heading__title">Welcome back</h2>
      <p className="bj-auth-heading__sub">Sign in to see this week&apos;s sessions.</p>
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
        <option value="Solo">Just Me</option>
        <option value="Small">2-5</option>
        <option value="Medium">6-10</option>
        <option value="Large">21+</option>
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
