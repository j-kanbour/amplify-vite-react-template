import { useLocation } from 'react-router-dom';
import { LuBell, LuSearch } from 'react-icons/lu';
import { NAV_ITEMS } from './SideNav';

// Named pages that aren't in the sidebar
const OTHER_PAGES = [
  { to: '/profile', label: 'My profile' },
  { to: '/dashboard', label: 'Dashboard' },
];

/** Top bar beside the sidebar: page name on the left, universal search, notifications on the right. */
export default function Header() {
  const { pathname } = useLocation();
  // The nav items are most of the named pages, so they double as the page-name lookup.
  const pageName =
    [...NAV_ITEMS, ...OTHER_PAGES].find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))?.label ?? '';

  return (
    <header className="ts-header">
      <h1 className="ts-header__page">{pageName}</h1>

      {/* TODO: wire up universal search */}
      <label className="ts-header__search">
        <LuSearch className="ts-header__search-icon" aria-hidden />
        <input type="search" placeholder="Search students, sessions…" aria-label="Search" disabled />
      </label>

      {/* TODO: wire up to real notifications */}
      <button type="button" className="ts-header__icon-btn" aria-label="Notifications">
        <LuBell />
      </button>
    </header>
  );
}
