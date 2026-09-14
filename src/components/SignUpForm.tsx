import { Authenticator} from '@aws-amplify/ui-react';

/** Field order/labels for the Amplify sign-up screen. */
export const signUpFormFields = {
  signUp: {
    name: { label: 'Full name', placeholder: 'Enter your full name', order: 1 },
    email: { order: 2 },
    'custom:orgName': { label: 'Business name', placeholder: 'Enter your business name', order: 3 },
    password: { order: 4 },
    confirm_password: { order: 5 },
  },
};

function SignUpFormFields() {

  return (
    <>
      <Authenticator.SignUp.FormFields />
    </>
  );
}

/** Component overrides passed to <Authenticator components={...}>. */
export const signUpComponents = {
  SignUp: {
    FormFields: SignUpFormFields,
  },
};
