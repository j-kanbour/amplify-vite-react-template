import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useUser } from '../context/UserContext';
import type { Permission } from '../access';
import { LuHouse, LuGraduationCap, LuUsers, LuSettings, LuLogOut, LuChevronsUpDown } from 'react-icons/lu';

export type NavItem = { to: string; label: string; icon: ReactNode; permission?: Permission };

/** Also the source of the page name the header shows. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: <LuHouse />,
  },
  {
    to: '/dashboard',
    label: 'Students',
    icon: <LuGraduationCap />,
  },
  {
    to: '/invites',
    label: 'Employees',
    permission: 'users.invite',
    icon: <LuUsers />,
  },
];

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

const PLAN_LABELS: Record<string, string> = { free: 'Free plan', premium: 'Premium plan', corporate: 'Corporate plan' };

/** Full-height sidebar: organisation at the top, the modules the user can reach, and the account menu at the bottom. */
export default function SideNav() {
  const { signOut } = useAuthenticator();
  const { can, user, org, groups, subscription } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on an outside click or Escape.
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
    <nav className="ts-sidenav" aria-label="Main">
      {/* TODO: organisation switcher */}
      <div className="ts-sidenav__org">
        <span className="ts-sidenav__org-logo">{initials(org?.name)}</span>
        <span className="ts-sidenav__org-text">
          <span className="ts-sidenav__org-name">{org?.name ?? ''}</span>
          <span className="ts-sidenav__org-sub">{PLAN_LABELS[subscription] ?? subscription}</span>
        </span>
        <LuChevronsUpDown className="ts-sidenav__org-chevron" aria-hidden />
      </div>

      <div className="ts-sidenav__links">
        {NAV_ITEMS.filter((i) => !i.permission || can(i.permission)).map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === '/'}
            title={i.label}
            className={({ isActive }) => `ts-sidenav__link${isActive ? ' ts-sidenav__link--active' : ''}`}
          >
            <span className="ts-sidenav__icon">{i.icon}</span>
            <span className="ts-sidenav__label">{i.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="ts-sidenav__account" ref={menuRef}>
        {menuOpen && (
          <div className="ts-sidenav__menu" role="menu">
            <div className="ts-sidenav__menu-info">
              <div className="ts-sidenav__menu-name">{user?.name}</div>
              <div className="ts-sidenav__menu-email">{user?.email}</div>
            </div>
            {/* TODO: settings page */}
            <button type="button" role="menuitem" className="ts-sidenav__menu-item" onClick={() => setMenuOpen(false)}>
              <LuSettings /> Settings
            </button>
            <button type="button" role="menuitem" className="ts-sidenav__menu-item" onClick={signOut}>
              <LuLogOut /> Sign out
            </button>
          </div>
        )}

        <button
          type="button"
          className="ts-sidenav__user"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="ts-sidenav__avatar">{initials(user?.name)}</span>
          <span className="ts-sidenav__user-text">
            <span className="ts-sidenav__user-name">{user?.name}</span>
            <span className="ts-sidenav__user-role">{user?.role ?? groups[0] ?? ''}</span>
          </span>
          <LuSettings className="ts-sidenav__user-gear" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
