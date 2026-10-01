import { BrowserRouter, Routes, Route, Navigate, Outlet, useMatch } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { UserProvider, useUser } from './context/UserContext';
import RequirePermission from './components/RequirePermission';
import Header from './components/Headder';
import SideNav from './components/SideNav';
import { signUpFormFields, signUpComponents, authServices } from './components/SignUpForm';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Students from './pages/Students';
import Onboarding from './pages/Onboarding';
import Privacy from './pages/Privacy';
import TermsAndConditions from './pages/TermsAndConditions';
import UserProfile from './pages/UserProfile';
import OrgProfile from './pages/OrgProfile';

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
    <div className="ts-app">
      <SideNav />
      <div className="ts-app__main">
        <Header />
        <div className="ts-app__content">
          <Outlet />
        </div>
      </div>
    </div>
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
              <Route path="/profile" element={<UserProfile />} />
              <Route element={<RequirePermission permission="students.view" />}>
                <Route path="/students" element={<Students />} />
              </Route>
              <Route element={<RequirePermission permission="users.list" />}>
                <Route path="/employees" element={<Employees />} />
              </Route>
              <Route element={<RequirePermission permission="org.edit" />}>
                <Route path="/organisation" element={<OrgProfile />} />
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
