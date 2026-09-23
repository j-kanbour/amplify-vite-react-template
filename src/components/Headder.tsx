import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useUser } from '../context/UserContext';
import { NAV_ITEMS } from './SideNav';
import { FaBell } from "react-icons/fa"

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** Top bar, sitting to the right of the rail: page name on the left, business name centred, notifications and the user menu on the right. */
export default function Header() {
  const { signOut } = useAuthenticator();
  const { user, org } = useUser();
  const { pathname } = useLocation();
  // The nav items are the named pages, so they double as the page-name lookup.
  const pageName =
    NAV_ITEMS.find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))?.label ?? '';
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
    <header className="ts-header">
      <div className="ts-header__start">
        <h1 className="ts-header__page">{pageName}</h1>
      </div>

      <div className="ts-header__title">{org?.name ?? ''}</div>

      <div className="ts-header__end">
        {/* TODO: wire up to real notifications */}
        <button type="button" className="ts-header__icon-btn" aria-label="Notifications">
          <FaBell />
        </button>

        <div className="ts-header__user" ref={menuRef}>
          <button
            type="button"
            className="ts-header__avatar"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {initials(user?.name)}
          </button>

          {menuOpen && (
            <div className="ts-header__menu" role="menu">
              <div className="ts-header__menu-info">
                <div className="ts-header__menu-name">{user?.name}</div>
                <div className="ts-header__menu-email">{user?.email}</div>
              </div>
              <button type="button" role="menuitem" className="ts-header__menu-item" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

