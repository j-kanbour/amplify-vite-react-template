import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import type { Permission } from '../access';
import logo from '../assets/Tutor-Studio-mark.png';
import { FaHome, FaUsers, FaChild } from 'react-icons/fa'

export type NavItem = { to: string; label: string; icon: ReactNode; permission?: Permission };

/** Also the source of the page name the header shows. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: <FaHome/>
  },
  {
    to: '/dashboard',
    label: 'Students',
    icon: <FaChild/>,
  },
  {
    to: '/invites',
    label: 'Employees',
    permission: 'users.invite',
    icon: <FaUsers/>,
  },
];

/** Full-height icon rail on the left; expands over the page on hover/focus to show labels. */
export default function SideNav() {
  const { can } = useUser();
  return (
    <nav className="ts-sidenav" aria-label="Main">
      <div className="ts-sidenav__brand">
        <span className="ts-sidenav__icon">
          <img className="ts-sidenav__logo" src={logo} alt="Tutor Studio" />
        </span>
        <span className="ts-sidenav__label">
          <span className="ts-sidenav__brand-tutor">Tutor</span> <span className="ts-sidenav__brand-studio">Studio</span>
        </span>
      </div>

      {NAV_ITEMS.filter((i) => !i.permission || can(i.permission)).map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.to === '/'}
          className={({ isActive }) => `ts-sidenav__link${isActive ? ' ts-sidenav__link--active' : ''}`}
        >
          <span className="ts-sidenav__icon">{i.icon}</span>
          <span className="ts-sidenav__label">{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
