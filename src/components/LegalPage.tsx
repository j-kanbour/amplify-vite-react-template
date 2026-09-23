import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/Tutor-Studio-logo.png';

type Props = {
  title: string;
  updated: string;
  children: ReactNode;
};

/**
 * Public page shell for legal documents (Privacy, Terms). Mirrors the
 * login/sign-up screen: same background, brand header, white card and footer.
 */
export default function LegalPage({ title, updated, children }: Props) {
  return (
    <div className="ts-legal">
      <div className="ts-legal__container">
        <header className="ts-auth-header">
          <img className="ts-auth-header__logo" src={logo} alt="Tutor Studio" />
          <p className="ts-auth-header__tagline">Personalised lessons, weekly feedback.</p>
        </header>

        <article className="ts-legal__card">
          <div className="ts-auth-heading">
            <h1 className="ts-auth-heading__title">{title}</h1>
            <p className="ts-auth-heading__sub">Last updated: {updated}</p>
          </div>
          <div className="ts-legal__body">{children}</div>
          <div className="ts-legal__actions">
            <Link to="/" className="ts-legal__back">
              Back to sign in
            </Link>
          </div>
        </article>

        <footer className="ts-auth-footer">© {new Date().getFullYear()} Tutor Studio</footer>
      </div>
    </div>
  );
}
