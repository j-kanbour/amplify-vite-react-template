import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@aws-amplify/ui-react';
import { LuCalendar, LuCheck, LuEye, LuFileText, LuGraduationCap, LuListTodo, LuMail, LuPhone, LuReceipt, LuUserCog, LuUserMinus, LuUserPlus } from 'react-icons/lu';
import { useUser } from '../context/UserContext';
import Show from '../components/Show';
import DirectoryList from '../components/directory/DirectoryList';
import InviteEmployeeDialog from '../components/directory/InviteEmployeeDialog';
import ChangeRoleDialog from '../components/directory/ChangeRoleDialog';
import OffboardDialog from '../components/directory/OffboardDialog';
import { Avatar, EmptyState, Facts, Panel } from '../components/directory/parts';
import { useOrgUsers, type OrgUser } from '../data/useOrgUsers';
import type { User } from '../data/useUsers';
import { useUploadedDocuments } from '../data/employeeDocuments';
import DocumentPreviewDialog from '../components/directory/DocumentPreviewDialog';
import { documentLabel } from '../../amplify/data/employee-documents';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** Accepted the legal terms and uploaded every document the org asked for: what accepting an invite asks of them. */
const isOnboarded = (u: OrgUser) => !!u.termsVersion && !!u.privacyVersion && !u.missingDocuments.length;

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'admin', label: 'Admins', test: (u: User) => u.role === 'Admin' },
  { key: 'tutor', label: 'Tutors', test: (u: User) => u.role === 'Tutor' },
  { key: 'onboarding', label: 'Onboarding', test: (u: OrgUser) => !isOnboarded(u) },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

/** Where UserProfile's "Upload photo" puts their picture. */
const photoPath = (u: User) => `users/${u.id}/avatar`;

/** The documents the org asked this employee for, and which they've uploaded. */
function DocumentsPanel({ employee }: { employee: OrgUser }) {
  const required = employee.requiredDocuments;
  const { uploaded, error } = useUploadedDocuments(required.length ? employee.id : undefined);
  const [viewing, setViewing] = useState<{ userId: string; userName: string; key: string } | null>(null);
  const count = uploaded ? required.filter((d) => uploaded.includes(d)).length : 0;

  const view = (key: string) => setViewing({ userId: employee.id, userName: employee.name, key });

  return (
    <Panel
      title="Documents"
      badge={
        required.length > 0 &&
        uploaded && (
          <span className={`ts-directory__pill ts-directory__pill--${count === required.length ? 'done' : 'pending'}`}>
            {count}/{required.length} uploaded
          </span>
        )
      }
    >
      {required.length === 0 ? (
        <EmptyState icon={<LuFileText />}>No documents requested.</EmptyState>
      ) : (
        <>
          {error && <Alert variation="error">{error}</Alert>}
          <ul className="ts-docs">
            {required.map((d) => {
              const isIn = !!uploaded?.includes(d);
              return (
                <li key={d} className="ts-docs__item">
                  <span className={`ts-docs__icon${isIn ? ' ts-docs__icon--done' : ''}`} aria-hidden>
                    {isIn ? <LuCheck /> : <LuFileText />}
                  </span>
                  <span className="ts-docs__text">
                    <span className="ts-docs__name">{documentLabel(d)}</span>
                    <span className="ts-docs__status">
                      {uploaded === null ? 'Checking…' : isIn ? 'Uploaded' : 'Not uploaded yet'}
                    </span>
                  </span>
                  {isIn && (
                    <button type="button" className="ts-directory__action" onClick={() => view(d)}>
                      <LuEye aria-hidden /> View
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <DocumentPreviewDialog doc={viewing} onClose={() => setViewing(null)} />
    </Panel>
  );
}

/** onChangeRole and onOffboard are left out when the viewer can't do them to this employee. */
function EmployeeDetail({
  employee,
  onChangeRole,
  onOffboard,
}: {
  employee: OrgUser;
  onChangeRole?: () => void;
  onOffboard?: () => void;
}) {
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
          {onChangeRole && (
            <button type="button" className="ts-directory__action" onClick={onChangeRole}>
              <LuUserCog aria-hidden /> Change role
            </button>
          )}
          {onOffboard && (
            <button type="button" className="ts-directory__action ts-directory__action--danger" onClick={onOffboard}>
              <LuUserMinus aria-hidden /> Offboard
            </button>
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

        <DocumentsPanel employee={employee} />

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
  const { org, user: me, can } = useUser();
  const { users, error, reload } = useOrgUsers(org?.id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [inviting, setInviting] = useState(false);
  const [changingRole, setChangingRole] = useState<User | null>(null);
  const [offboarding, setOffboarding] = useState<User | null>(null);
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
        <EmployeeDetail
          employee={selected}
          // The backend refuses changes to your own role, so an org always keeps an admin
          onChangeRole={
            can('users.changeRole') && selected.id !== me?.id ? () => setChangingRole(selected) : undefined
          }
          // Likewise you can't offboard yourself
          onOffboard={can('users.offboard') && selected.id !== me?.id ? () => setOffboarding(selected) : undefined}
        />
      ) : (
        users !== null && (
          <section className="ts-directory__panel">
            <EmptyState icon={<LuUserPlus />}>Invite your first employee to see their details here.</EmptyState>
          </section>
        )
      )}

      <InviteEmployeeDialog open={inviting} onClose={() => setInviting(false)} />
      <ChangeRoleDialog employee={changingRole} onClose={() => setChangingRole(null)} onChanged={reload} />
      <OffboardDialog
        employee={offboarding}
        orgName={org?.name}
        onClose={() => setOffboarding(null)}
        onOffboarded={() => {
          setParams({}, { replace: true });
          reload();
        }}
      />
    </main>
  );
}
