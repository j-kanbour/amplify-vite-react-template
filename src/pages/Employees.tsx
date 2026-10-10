import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@aws-amplify/ui-react';
import { LuCalendar, LuGraduationCap, LuListTodo, LuMail, LuPhone, LuReceipt, LuUserPlus } from 'react-icons/lu';
import { useUser } from '../context/UserContext';
import Show from '../components/Show';
import DirectoryList from '../components/directory/DirectoryList';
import InviteEmployeeDialog from '../components/directory/InviteEmployeeDialog';
import { Avatar, EmptyState, Facts, Panel } from '../components/directory/parts';
import { useOrgUsers } from '../data/useOrgUsers';
import type { User } from '../data/useUsers';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** Accepted the legal terms and added a phone number. Derived from the User record until invites track onboarding. */
const isOnboarded = (u: User) => !!u.termsVersion && !!u.privacyVersion && !!u.phone;

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'admin', label: 'Admins', test: (u: User) => u.role === 'Admin' },
  { key: 'tutor', label: 'Tutors', test: (u: User) => u.role === 'Tutor' },
  { key: 'onboarding', label: 'Onboarding', test: (u: User) => !isOnboarded(u) },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

/** Where UserProfile's "Upload photo" puts their picture. */
const photoPath = (u: User) => `users/${u.id}/avatar`;

function EmployeeDetail({ employee }: { employee: User }) {
  const complete = isOnboarded(employee);

  return (
    <div className="ts-directory__detail">
      <section className="ts-directory__panel">
        <div className="ts-directory__hero">
          <Avatar id={employee.id} name={employee.name} size="lg" photo={photoPath(employee)} />
          <div className="ts-directory__hero-text">
            <h2 className="ts-directory__hero-name">{employee.name}</h2>
            <p className="ts-directory__hero-sub">
              {employee.role ?? 'No role'} · {employee.email}
            </p>
          </div>
          <span className={`ts-directory__pill ts-directory__pill--${complete ? 'done' : 'pending'}`}>
            {complete ? 'Onboarded' : 'Onboarding'}
          </span>
        </div>
        <div className="ts-directory__hero-actions">
          <a className="ts-directory__action" href={`mailto:${employee.email}`}>
            <LuMail aria-hidden /> Email
          </a>
          {employee.phone && (
            <a className="ts-directory__action" href={`tel:${employee.phone}`}>
              <LuPhone aria-hidden /> Call
            </a>
          )}
        </div>
      </section>

      <div className="ts-directory__grid">
        <Panel title="Bio information">
          <Facts
            rows={[
              ['Full name', employee.name],
              ['Email', <a href={`mailto:${employee.email}`}>{employee.email}</a>],
              ['Phone', employee.phone && <a href={`tel:${employee.phone}`}>{employee.phone}</a>],
              ['Role', employee.role],
              ['Joined', formatDate(employee.createdAt)],
            ]}
          />
        </Panel>

        {/* TODO: employee tasks */}
        <Panel title="Tasks">
          <EmptyState icon={<LuListTodo />}>No tasks yet.</EmptyState>
        </Panel>

        {/* TODO: list students via TutorAssignment */}
        <Panel title="Students">
          <EmptyState icon={<LuGraduationCap />}>No students assigned yet.</EmptyState>
        </Panel>

        {/* TODO: pay slips */}
        <Panel title="Pay slips">
          <EmptyState icon={<LuReceipt />}>No pay slips yet.</EmptyState>
        </Panel>

        {/* TODO: calendar of the employee's lessons */}
        <div className="ts-directory__wide">
          <Panel title="Calendar">
            <EmptyState icon={<LuCalendar />}>Calendar coming soon.</EmptyState>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Employee management: everyone in the org except parents, with the selected one's details beside the list. */
export default function Employees() {
  const { org, user: me } = useUser();
  const { users, error } = useOrgUsers(org?.id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [inviting, setInviting] = useState(false);
  // Selection lives in the URL so a particular employee can be linked to
  const [params, setParams] = useSearchParams();

  const employees = (users ?? [])
    .filter((u) => u.role !== 'Parent')
    .sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const { test } = FILTERS.find((f) => f.key === filter)!;
  const shown = employees.filter(
    (u) => test(u) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
  );
  const selected = employees.find((u) => u.id === params.get('id')) ?? shown[0] ?? employees[0];

  return (
    <main className="ts-directory">
      <DirectoryList
        noun="employee"
        items={
          users &&
          shown.map((u) => ({
            id: u.id,
            name: u.name,
            sub: u.role ?? 'No role',
            tag: u.id === me?.id ? 'You' : undefined,
            photo: photoPath(u),
          }))
        }
        hasAny={employees.length > 0}
        selectedId={selected?.id}
        onSelect={(id) => setParams({ id }, { replace: true })}
        query={query}
        onQueryChange={setQuery}
        filters={FILTERS}
        filter={filter}
        onFilterChange={(key) => setFilter(key as FilterKey)}
        error={error}
        actions={
          <Show permission="users.invite">
            <Button variation="primary" size="small" onClick={() => setInviting(true)}>
              <LuUserPlus aria-hidden /> Invite employee
            </Button>
          </Show>
        }
      />

      {selected ? (
        <EmployeeDetail employee={selected} />
      ) : (
        users !== null && (
          <section className="ts-directory__panel">
            <EmptyState icon={<LuUserPlus />}>Invite your first employee to see their details here.</EmptyState>
          </section>
        )
      )}

      <InviteEmployeeDialog open={inviting} onClose={() => setInviting(false)} />
    </main>
  );
}
