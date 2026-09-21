import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import type { Permission } from '../access';

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

type NavItem = { to: string; label: string; icon: ReactNode; permission?: Permission };

const ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: icon(
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v12h14V9" />
      </>,
    ),
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: icon(
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>,
    ),
  },
  {
    to: '/invites',
    label: 'Invites',
    permission: 'users.invite',
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>,
    ),
  },
];

/** Icon rail on the left; expands over the page on hover/focus to show labels. */
export default function SideNav() {
  const { can } = useUser();
  return (
    <nav className="bj-sidenav" aria-label="Main">
      {ITEMS.filter((i) => !i.permission || can(i.permission)).map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.to === '/'}
          className={({ isActive }) => `bj-sidenav__link${isActive ? ' bj-sidenav__link--active' : ''}`}
        >
          <span className="bj-sidenav__icon">{i.icon}</span>
          <span className="bj-sidenav__label">{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
