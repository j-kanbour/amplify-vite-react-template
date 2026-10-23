import type { ReactNode } from 'react';
import logo from '../assets/Tutor-Studio-logo.png';

/** Brand frame for the invite pages, matching the sign-in and onboarding screens. */
export default function InviteShell({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="ts-onboarding">
      <div className="ts-legal__container ts-onboarding__container">
        <header className="ts-auth-header">
          <img className="ts-auth-header__logo" src={logo} alt="Tutor Studio" />
          <p className="ts-auth-header__tagline">Personalised lessons, weekly feedback.</p>
        </header>

        <div className="ts-legal__card">
          <div className="ts-auth-heading">
            <h1 className="ts-auth-heading__title">{title}</h1>
            {sub && <p className="ts-auth-heading__sub">{sub}</p>}
          </div>
          <div className="ts-onboarding__form">{children}</div>
        </div>

        <footer className="ts-auth-footer">© {new Date().getFullYear()} Tutor Studio</footer>
      </div>
    </div>
  );
}
