import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { UserProvider, useUser } from './context/UserContext';
import RequirePermission from './components/RequirePermission';
import { signUpFormFields, signUpComponents } from './components/SignUpForm';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Invites from './pages/Invites';
import Privacy from './pages/Privacy';

function Nav() {
  const { signOut } = useAuthenticator();
  const { can } = useUser();
  return (
    <nav>
      <Link to="/">Home</Link> <Link to="/dashboard">Dashboard</Link>{' '}
      {can('users.invite') && <Link to="/invites">Invites</Link>}{' '}
      <button onClick={signOut}>Sign out</button>
    </nav>
  );
}

/** Everything that requires a signed-in user. */
function AuthedApp() {
  return (
    <Authenticator formFields={signUpFormFields} components={signUpComponents}>
      <UserProvider>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<RequirePermission permission="users.invite" />}>
            <Route path="/invites" element={<Invites />} />
          </Route>
          <Route path="*" element={<h1>404</h1>} />
        </Routes>
      </UserProvider>
    </Authenticator>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes: no sign-in, no nav */}
        <Route path="/privacy" element={<Privacy />} />
        {/* Everything else goes through the Authenticator */}
        <Route path="*" element={<AuthedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
