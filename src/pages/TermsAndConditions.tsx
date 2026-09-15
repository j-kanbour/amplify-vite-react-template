import LegalPage from '../components/LegalPage';

/**
 * Public terms and conditions page. Not behind the Authenticator so the URL
 * can be given to Cognito managed login as the terms of use link.
 */
export default function TermsAndConditions() {
  return (
    <LegalPage title="Terms & Conditions" updated="14 September 2026">
      <h2>1. Acceptance of terms</h2>
      <p>
        By creating an account or using Tutor Studio you agree to these terms. If you do
        not agree, please do not use the service.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for keeping your login details secure and for all activity
        under your account. You must provide accurate information and keep it up to date.
      </p>

      <h2>3. Acceptable use</h2>
      <p>
        You agree not to misuse the service, interfere with its operation, or access it
        using a method other than the interface we provide. You must not upload content
        that is unlawful, harmful or infringes the rights of others.
      </p>

      <h2>4. Invitations and roles</h2>
      <p>
        Business administrators may invite parents and tutors to their organisation.
        Invited users can only see information their role permits. Administrators are
        responsible for the people they invite.
      </p>

      <h2>5. Content</h2>
      <p>
        You keep ownership of the content you add to the service. You grant us a licence
        to store and display it as needed to provide the service to you and your
        organisation.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        We aim to keep the service available but do not guarantee uninterrupted access.
        We may change or discontinue features at any time.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may close your account at any time. We may suspend or end access if these
        terms are breached.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the extent permitted by law, we are not liable for any indirect or
        consequential loss arising from your use of the service.
      </p>

      <h2>9. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Changes will be posted on this page
        with an updated date.
      </p>

      <h2>10. Contact</h2>
      <p>If you have questions about these terms, please contact us.</p>
    </LegalPage>
  );
}
