import Show from '../components/Show';
import { useUser } from '../context/UserContext';
import AdminPanel from '../sections/AdminPanel';
import TutorPanel from '../sections/TutorPanel';
import ParentPanel from '../sections/ParentPanel';

export default function Dashboard() {
  const { user, loading } = useUser();
  if (loading) return <p>Loading…</p>;

  return (
    <main>
      <h1>Welcome, {user?.name}</h1>

      <Show groups={['Admin']}><AdminPanel /></Show>
      <Show groups={['Tutor']}><TutorPanel /></Show>
      <Show groups={['Parent']}><ParentPanel /></Show>

      {/* later: other values from the User record */}
      <Show when={user?.role === 'Tutor'}>
        <p>Tutor-only note</p>
      </Show>
    </main>
  );
}