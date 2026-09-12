import { useUser } from '../../context/UserContext';

export default function StudentsCard() {
  const { can } = useUser();
  if (!can('students.view')) return null;

  return (
    <section>
      <h2>Your students</h2>
      <p>No students assigned yet.</p>
    </section>
  );
}
