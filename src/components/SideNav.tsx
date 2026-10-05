import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useUser } from '../context/UserContext';
import type { Permission } from '../access';
import { useProfilePhoto } from '../data/useProfilePhoto';
import { initials } from '../utils/initials';
import { LuHouse, LuGraduationCap, LuUsers, LuBuilding2, LuUser, LuSettings, LuLogOut, LuChevronsUpDown } from 'react-icons/lu';

export type NavItem = { to: string; label: string; icon: ReactNode; permission?: Permission };

/** Also the source of the page name the header shows. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: <LuHouse />,
  },
  {
    to: '/students',
    label: 'Students',
    permission: 'students.view',
    icon: <LuGraduationCap />,
  },
  {
    to: '/employees',
    label: 'Employees',
    permission: 'users.list',
    icon: <LuUsers />,
  },
  {
    to: '/organisation',
    label: 'Organisation',
    permission: 'org.edit',
    icon: <LuBuilding2 />,
  },
];

export const PLAN_LABELS: Record<string, string> = { free: 'Free plan', premium: 'Premium plan', corporate: 'Corporate plan' };

/** Full-height sidebar: organisation at the top, the modules the user can reach, and the account menu at the bottom. */
export default function SideNav() {
  const { signOut } = useAuthenticator();
  const { can, user, org, groups, subscription } = useUser();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const logo = useProfilePhoto(org ? `orgs/${org.id}/logo` : undefined);
  const avatar = useProfilePhoto(user ? `users/${user.id}/avatar` : undefined);

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
        <span className="ts-sidenav__org-logo">
          {logo.src ? <img className="ts-sidenav__img" src={logo.src} alt="" onError={logo.onError} /> : initials(org?.name)}
        </span>
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
            <button
              type="button"
              role="menuitem"
              className="ts-sidenav__menu-item"
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}
            >
              <LuUser /> Profile
            </button>
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
          <span className="ts-sidenav__avatar">
            {avatar.src ? <img className="ts-sidenav__img" src={avatar.src} alt="" onError={avatar.onError} /> : initials(user?.name)}
          </span>
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
