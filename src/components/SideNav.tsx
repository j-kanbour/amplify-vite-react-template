import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useUser } from '../context/UserContext';
import type { Permission } from '../access';
import { useProfilePhoto } from '../data/useProfilePhoto';
import { initials } from '../utils/initials';
import { LuHouse, LuGraduationCap, LuUsers, LuBuilding2, LuUser, LuSettings, LuLogOut, LuChevronsUpDown, LuCheck } from 'react-icons/lu';

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

/** Closes a popup menu on an outside click or Escape. */
function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, close]);
}

/** Full-height sidebar: organisation at the top, the modules the user can reach, and the account menu at the bottom. */
export default function SideNav() {
  const { signOut } = useAuthenticator();
  const { can, user, org, groups, subscription, memberships, switchOrg } = useUser();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  // Only people in more than one org get the switcher
  const canSwitchOrg = memberships.length > 1;
  const logo = useProfilePhoto(org ? `orgs/${org.id}/logo` : undefined);
  const avatar = useProfilePhoto(user ? `users/${user.id}/avatar` : undefined);

  useDismiss(menuRef, menuOpen, () => setMenuOpen(false));
  useDismiss(orgMenuRef, orgMenuOpen, () => setOrgMenuOpen(false));

  async function handleSwitchOrg(orgId: string) {
    setOrgMenuOpen(false);
    if (orgId === org?.id) return;
    setSwitching(true);
    try {
      await switchOrg(orgId);
      // The current page may not exist for the role in the new org
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setSwitching(false);
    }
  }

  const orgCard = (
    <>
      <span className="ts-sidenav__org-logo">
        {logo.src ? <img className="ts-sidenav__img" src={logo.src} alt="" onError={logo.onError} /> : initials(org?.name)}
      </span>
      <span className="ts-sidenav__org-text">
        <span className="ts-sidenav__org-name">{org?.name ?? ''}</span>
        <span className="ts-sidenav__org-sub">{PLAN_LABELS[subscription] ?? subscription}</span>
      </span>
    </>
  );

  return (
    <nav className="ts-sidenav" aria-label="Main">
      {canSwitchOrg ? (
        <div className="ts-sidenav__org-switch" ref={orgMenuRef}>
          <button
            type="button"
            className="ts-sidenav__org ts-sidenav__org--button"
            aria-label="Switch organisation"
            aria-haspopup="menu"
            aria-expanded={orgMenuOpen}
            disabled={switching}
            onClick={() => setOrgMenuOpen((o) => !o)}
          >
            {orgCard}
            <LuChevronsUpDown className="ts-sidenav__org-chevron" aria-hidden />
          </button>
          {orgMenuOpen && (
            <div className="ts-sidenav__menu ts-sidenav__menu--down" role="menu">
              {memberships.map((m) => (
                <button
                  key={m.orgId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={m.orgId === org?.id}
                  className="ts-sidenav__menu-item"
                  onClick={() => handleSwitchOrg(m.orgId)}
                >
                  <span className="ts-sidenav__menu-org">
                    <span className="ts-sidenav__menu-name">{m.orgName}</span>
                    <span className="ts-sidenav__menu-email">{m.role}</span>
                  </span>
                  {m.orgId === org?.id && <LuCheck aria-hidden />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="ts-sidenav__org">{orgCard}</div>
      )}

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
