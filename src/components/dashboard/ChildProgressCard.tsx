import { useUser } from '../../context/UserContext';

export default function ChildProgressCard() {
  const { can } = useUser();
  if (!can('child.view')) return null;

  return (
    <section>
      <h2>Your child's progress</h2>
      <p>Nothing recorded yet.</p>
    </section>
  );
}
