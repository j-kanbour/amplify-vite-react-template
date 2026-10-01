import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@aws-amplify/ui-react';
import {
  LuCalendar,
  LuChevronRight,
  LuGraduationCap,
  LuListTodo,
  LuReceipt,
  LuSearch,
  LuUserPlus,
} from 'react-icons/lu';
import { useUser } from '../context/UserContext';
import { useOrgUsers } from '../data/useOrgUsers';
import type { User } from '../data/useUsers';
import { avatarColor, initials } from '../utils/initials';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** What a new employee has to do before they count as onboarded. Derived from their User record until invites track it. */
function onboardingSteps(u: User) {
  return [
    { label: 'Account created', done: true },
    { label: 'Accepted terms of service', done: !!u.termsVersion },
    { label: 'Accepted privacy policy', done: !!u.privacyVersion },
    { label: 'Added a phone number', done: !!u.phone },
  ];
}

function Avatar({ user, size }: { user: User; size?: 'lg' }) {
  return (
    <span
      className={`ts-directory__avatar${size ? ` ts-directory__avatar--${size}` : ''}`}
      style={{ background: avatarColor(user.id) }}
      aria-hidden
    >
      {initials(user.name)}
    </span>
  );
}

function Panel({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="ts-directory__panel">
      <div className="ts-directory__panel-head">
        <h3 className="ts-directory__panel-title">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="ts-directory__empty">
      <span className="ts-directory__empty-icon" aria-hidden>
        {icon}
      </span>
      {children}
    </div>
  );
}

function EmployeeDetail({ employee }: { employee: User }) {
  const complete = onboardingSteps(employee).every((s) => s.done);

  return (
    <div className="ts-directory__detail">
      <section className="ts-directory__panel">
        <div className="ts-directory__hero">
          <Avatar user={employee} size="lg" />
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
      </section>

      <div className="ts-directory__grid">
        <Panel title="Bio information">
          <dl className="ts-directory__facts">
            <div>
              <dt>Full name</dt>
              <dd>{employee.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${employee.email}`}>{employee.email}</a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{employee.phone ? <a href={`tel:${employee.phone}`}>{employee.phone}</a> : <span className="ts-directory__muted">Not set</span>}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{employee.role ?? '—'}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{formatDate(employee.createdAt) ?? '—'}</dd>
            </div>
          </dl>
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
  const { org } = useUser();
  const { users, error } = useOrgUsers(org?.id);
  const [query, setQuery] = useState('');
  // Selection lives in the URL so a particular employee can be linked to
  const [params, setParams] = useSearchParams();

  const employees = (users ?? [])
    .filter((u) => u.role !== 'Parent')
    .sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const shown = q
    ? employees.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : employees;
  const selected = employees.find((u) => u.id === params.get('id')) ?? employees[0];

  return (
    <main className="ts-directory">
      <aside className="ts-directory__list">
        <label className="ts-directory__search">
          <LuSearch aria-hidden />
          <input
            type="search"
            placeholder="Find an employee…"
            aria-label="Find an employee"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {/* TODO: invite flow */}
        <Button variation="primary" size="small" className="ts-directory__invite">
          <LuUserPlus aria-hidden /> Invite employee
        </Button>

        {error && <Alert variation="error">{error}</Alert>}
        {users === null ? (
          <p className="ts-directory__muted">Loading employees…</p>
        ) : shown.length === 0 ? (
          <p className="ts-directory__muted">{q ? 'No one matches that search.' : 'No employees yet.'}</p>
        ) : (
          <div className="ts-directory__items">
            {shown.map((u) => {
              const active = u.id === selected?.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`ts-directory__item${active ? ' ts-directory__item--active' : ''}`}
                  aria-current={active || undefined}
                  onClick={() => setParams({ id: u.id }, { replace: true })}
                >
                  <Avatar user={u} />
                  <span className="ts-directory__item-text">
                    <span className="ts-directory__item-name">{u.name}</span>
                    <span className="ts-directory__item-sub">{u.role ?? 'No role'}</span>
                  </span>
                  {active && <LuChevronRight className="ts-directory__item-chevron" aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {selected ? (
        <EmployeeDetail employee={selected} />
      ) : (
        users !== null && (
          <section className="ts-directory__panel">
            <EmptyState icon={<LuUserPlus />}>Invite your first employee to see their details here.</EmptyState>
          </section>
        )
      )}
    </main>
  );
}
