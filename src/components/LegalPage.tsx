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
    <div className="bj-legal">
      <div className="bj-legal__container">
        <header className="bj-auth-header">
          <img className="bj-auth-header__logo" src={logo} alt="Tutor Studio" />
          <p className="bj-auth-header__tagline">Personalised lessons, weekly feedback.</p>
        </header>

        <article className="bj-legal__card">
          <div className="bj-auth-heading">
            <h1 className="bj-auth-heading__title">{title}</h1>
            <p className="bj-auth-heading__sub">Last updated: {updated}</p>
          </div>
          <div className="bj-legal__body">{children}</div>
          <div className="bj-legal__actions">
            <Link to="/" className="bj-legal__back">
              Back to sign in
            </Link>
          </div>
        </article>

        <footer className="bj-auth-footer">© {new Date().getFullYear()} Tutor Studio</footer>
      </div>
    </div>
  );
}
