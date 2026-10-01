import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@aws-amplify/ui-react';
import { LuCalendarPlus, LuChartLine, LuGraduationCap, LuNotebookPen, LuUserPlus, LuUsers } from 'react-icons/lu';
import { useUser } from '../context/UserContext';
import Show from '../components/Show';
import DirectoryList from '../components/directory/DirectoryList';
import { Avatar, EmptyState, Facts, Panel } from '../components/directory/parts';
import { useOrgUsers } from '../data/useOrgUsers';
import { useStudents, type StudentRow } from '../data/useStudents';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** Whole years since a YYYY-MM-DD date of birth. */
function age(dob: string) {
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  return now.getFullYear() - y - (hadBirthday ? 0 : 1);
}

// Admins only: tutors already see just their own students
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unassigned', label: 'No tutor' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

function StudentDetail({ student, tutorNames }: { student: StudentRow; tutorNames: Map<string, string> }) {
  return (
    <div className="ts-directory__detail">
      <section className="ts-directory__panel">
        <div className="ts-directory__hero">
          <Avatar id={student.id} name={student.name} size="lg" />
          <div className="ts-directory__hero-text">
            <h2 className="ts-directory__hero-name">{student.name}</h2>
            <p className="ts-directory__hero-sub">Age {age(student.dob)}</p>
          </div>
          {/* TODO: booking flow */}
          <Button size="small">
            <LuCalendarPlus aria-hidden /> Book lesson
          </Button>
        </div>
      </section>

      <div className="ts-directory__grid">
        <Panel title="Details">
          <Facts
            rows={[
              ['Full name', student.name],
              ['Born', formatDate(student.dob)],
              ['Enrolled', formatDate(student.enrolledAt)],
            ]}
          />
        </Panel>

        <Show permission="students.viewAll">
          {/* TODO: assign and unassign tutors (and keep Student.viewers in step) */}
          <Panel title="Tutors">
            {student.tutorIds.length ? (
              <ul className="ts-directory__people">
                {student.tutorIds.map((id) => (
                  <li key={id}>
                    <Avatar id={id} name={tutorNames.get(id) ?? '?'} />
                    {tutorNames.get(id) ?? 'Unknown tutor'}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<LuUsers />}>No tutor assigned yet.</EmptyState>
            )}
          </Panel>
        </Show>

        {/* TODO: session notes from Lesson records */}
        <Panel title="Session notes">
          <EmptyState icon={<LuNotebookPen />}>No session notes yet.</EmptyState>
        </Panel>

        {/* TODO: assessments */}
        <Panel title="Latest assessment">
          <EmptyState icon={<LuChartLine />}>No assessments yet.</EmptyState>
        </Panel>
      </div>
    </div>
  );
}

/**
 * Student management. Admins see every student enrolled in the org; tutors see
 * only the students assigned to them (enforced by the Student auth rules too).
 */
export default function Students() {
  const { org, user: me, can } = useUser();
  const viewAll = can('students.viewAll');
  const { students, error } = useStudents(org?.id, viewAll ? undefined : me?.id);
  // Tutor names for the Tutors panel; only admins can read other users
  const { users } = useOrgUsers(viewAll ? org?.id : undefined);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  // Selection lives in the URL so a particular student can be linked to
  const [params, setParams] = useSearchParams();

  const tutorNames = new Map((users ?? []).map((u) => [u.id, u.name]));
  const all = [...(students ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const shown = all.filter(
    (s) => (filter === 'all' || s.tutorIds.length === 0) && (!q || s.name.toLowerCase().includes(q)),
  );
  const selected = all.find((s) => s.id === params.get('id')) ?? shown[0] ?? all[0];

  const tutorsOf = (s: StudentRow) => {
    if (!viewAll) return `Age ${age(s.dob)}`;
    const names = s.tutorIds.map((id) => tutorNames.get(id)).filter(Boolean);
    return names.length ? names.join(', ') : 'No tutor';
  };

  return (
    <main className="ts-directory">
      <DirectoryList
        noun="student"
        items={students && shown.map((s) => ({ id: s.id, name: s.name, sub: tutorsOf(s) }))}
        hasAny={all.length > 0}
        selectedId={selected?.id}
        onSelect={(id) => setParams({ id }, { replace: true })}
        query={query}
        onQueryChange={setQuery}
        filters={viewAll ? FILTERS : undefined}
        filter={filter}
        onFilterChange={(key) => setFilter(key as FilterKey)}
        error={error}
        actions={
          <Show permission="students.add">
            {/* TODO: add-student flow */}
            <Button variation="primary" size="small">
              <LuUserPlus aria-hidden /> Add student
            </Button>
          </Show>
        }
      />

      {selected ? (
        <StudentDetail student={selected} tutorNames={tutorNames} />
      ) : (
        students !== null && (
          <section className="ts-directory__panel">
            <EmptyState icon={<LuGraduationCap />}>
              {viewAll ? 'Add your first student to see their details here.' : 'No students have been assigned to you yet.'}
            </EmptyState>
          </section>
        )
      )}
    </main>
  );
}
