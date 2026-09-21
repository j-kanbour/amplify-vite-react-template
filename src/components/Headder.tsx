import { useEffect, useRef, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useUser } from '../context/UserContext';

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/** Top bar: business name centred, notifications and the user menu on the right. */
export default function Header() {
  const { signOut } = useAuthenticator();
  const { user, org } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the user menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="bj-header">
      <div className="bj-header__start" />

      <div className="bj-header__title">{org?.name ?? ''}</div>

      <div className="bj-header__end">
        {/* TODO: wire up to real notifications */}
        <button type="button" className="bj-header__icon-btn" aria-label="Notifications">
          <BellIcon />
        </button>

        <div className="bj-header__user" ref={menuRef}>
          <button
            type="button"
            className="bj-header__avatar"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {initials(user?.name)}
          </button>

          {menuOpen && (
            <div className="bj-header__menu" role="menu">
              <div className="bj-header__menu-info">
                <div className="bj-header__menu-name">{user?.name}</div>
                <div className="bj-header__menu-email">{user?.email}</div>
              </div>
              <button type="button" role="menuitem" className="bj-header__menu-item" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
