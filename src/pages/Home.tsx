import { Link } from 'react-router-dom';
import Show from '../components/Show';
import { useUser } from '../context/UserContext';

export default function Home() {
  const { user, groups, loading } = useUser();
  if (loading) return <p>Loading…</p>;

  return (
    <main>
      <h1>Home</h1>
      <p>Signed in as {user?.name} ({user?.email})</p>
      <p>Group: {groups.join(', ') || 'none yet'}</p>

      <Show groups={['Admin']}>
        <p>You have admin access.</p>
      </Show>
      <Show groups={['Tutor']}>
        <p>Your students are waiting.</p>
      </Show>
      <Show groups={['Parent']}>
        <p>Check in on your child's progress.</p>
      </Show>

      <Link to="/dashboard">Go to dashboard</Link>
    </main>
  );
}