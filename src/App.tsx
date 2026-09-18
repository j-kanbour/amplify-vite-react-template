import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useMatch } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { UserProvider, useUser } from './context/UserContext';
import RequirePermission from './components/RequirePermission';
import { signUpFormFields, signUpComponents, authServices } from './components/SignUpForm';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Invites from './pages/Invites';
import Onboarding from './pages/Onboarding';
import Privacy from './pages/Privacy';
import TermsAndConditions from './pages/TermsAndConditions';

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

/**
 * Keeps signed-in users who haven't finished onboarding on /onboarding (and
 * everyone else off it). Group membership lives on the Cognito user, so this
 * holds across sign-outs and devices until onboarding completes.
 */
function OnboardingGate() {
  const { loading, needsOnboarding } = useUser();
  // Match the route rather than comparing strings: Amplify Hosting redirects
  // /onboarding to /onboarding/, which the route still renders.
  const onOnboarding = useMatch('/onboarding') !== null;
  if (loading) return <p>Loading…</p>;
  if (needsOnboarding && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (!needsOnboarding && onOnboarding) return <Navigate to="/" replace />;
  return <Outlet />;
}

function AppLayout() {
  return (
    <>
      <Nav />
      <Outlet />
    </>
  );
}

/** Everything that requires a signed-in user. */
function AuthedApp() {
  return (
    <Authenticator
      socialProviders={['google']}
      formFields={signUpFormFields}
      components={signUpComponents}
      services={authServices}
    >
      <UserProvider>
        <Routes>
          <Route element={<OnboardingGate />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route element={<RequirePermission permission="users.invite" />}>
                <Route path="/invites" element={<Invites />} />
              </Route>
              <Route path="*" element={<h1>404</h1>} />
            </Route>
          </Route>
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
        <Route path="/terms" element={<TermsAndConditions />} />
        {/* Everything else goes through the Authenticator */}
        <Route path="*" element={<AuthedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
