/**
 * Public privacy policy page. Not behind the Authenticator so the URL can be
 * given to Cognito managed login as the privacy policy link.
 */
export default function Privacy() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem', textAlign: 'left' }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: 14 September 2026</p>

      <h2>1. Information we collect</h2>
      <p>
        When you create an account we collect the information you provide, such as your
        name, email address and role. We also collect usage data that helps us run and
        improve the service.
      </p>

      <h2>2. How we use your information</h2>
      <p>
        We use your information to provide and maintain the service, to communicate with
        you about your account, and to keep the service secure. We do not sell your
        personal information.
      </p>

      <h2>3. How we share your information</h2>
      <p>
        We share information only with service providers that help us operate the
        service, such as hosting and authentication providers, or where required by law.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We keep your information for as long as your account is active or as needed to
        provide the service. You can ask us to delete your account and associated data
        at any time.
      </p>

      <h2>5. Security</h2>
      <p>
        We take reasonable steps to protect your information from loss, misuse and
        unauthorised access.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can request access to, correction of, or deletion of your personal
        information by contacting us.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Changes will be posted on this page
        with an updated date.
      </p>

      <h2>8. Contact</h2>
      <p>If you have questions about this policy, please contact us.</p>
    </main>
  );
}
