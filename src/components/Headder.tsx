import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LuBell, LuBuilding2, LuSearch } from 'react-icons/lu';
import { NAV_ITEMS } from './SideNav';
import { useUser } from '../context/UserContext';

// Named pages that aren't in the sidebar
const OTHER_PAGES = [
  { to: '/profile', label: 'My profile' },
  { to: '/dashboard', label: 'Dashboard' },
];

/** Shown only to people in more than one org: changes which one the app shows. */
function OrgSwitcher() {
  const { org, memberships, switchOrg } = useUser();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  if (memberships.length < 2) return null;

  async function handleChange(orgId: string) {
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

  return (
    <label className="ts-header__org">
      <LuBuilding2 className="ts-header__search-icon" aria-hidden />
      <select
        aria-label="Organisation"
        value={org?.id ?? ''}
        disabled={switching}
        onChange={(e) => handleChange(e.target.value)}
      >
        {memberships.map((m) => (
          <option key={m.orgId} value={m.orgId}>
            {m.orgName} · {m.role}
          </option>
        ))}
      </select>
    </label>
  );
}

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

      <OrgSwitcher />

      {/* TODO: wire up to real notifications */}
      <button type="button" className="ts-header__icon-btn" aria-label="Notifications">
        <LuBell />
      </button>
    </header>
  );
}
