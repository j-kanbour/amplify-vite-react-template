import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

export default function InviteCard() {
  const { can } = useUser();
  if (!can('users.invite')) return null;

  return (
    <section>
      <h2>Invite people</h2>
      <p>Parents and tutors join by invitation only.</p>
      <Link to="/invites">Manage invites</Link>
    </section>
  );
}
