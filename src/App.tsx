import { BrowserRouter, Routes, Route, Navigate, Outlet, useMatch, useSearchParams } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { UserProvider, useUser } from './context/UserContext';
import RequirePermission from './components/RequirePermission';
import Header from './components/Headder';
import SideNav from './components/SideNav';
import { signUpFormFields, inviteSignUpFormFields, signUpComponents, authServices } from './components/SignUpForm';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Students from './pages/Students';
import Onboarding from './pages/Onboarding';
import Privacy from './pages/Privacy';
import TermsAndConditions from './pages/TermsAndConditions';
import UserProfile from './pages/UserProfile';
import OrgProfile from './pages/OrgProfile';
import JoinInvite from './pages/JoinInvite';
import AcceptInvite from './pages/AcceptInvite';
import OnboardingDocuments from './pages/OnboardingDocuments';
import NoOrganisation from './pages/NoOrganisation';
import { readPendingInvite } from './utils/pendingInvite';

/**
 * Keeps signed-in users who haven't finished onboarding on /onboarding (and
 * everyone else off it). Group membership lives on the Cognito user, so this
 * holds across sign-outs and devices until onboarding completes.
 *
 * A pending invite comes first: someone who signed up from an invite link
 * finishes on the accept page instead of setting up a business of their own.
 * Then, if the org they're in asked for documents, they upload those.
 *
 * Someone with a User record but no org was offboarded from every org they
 * were in: they're told so, and can go on to set up an org of their own.
 */
function OnboardingGate() {
  const { loading, needsOnboarding, missingDocuments, user } = useUser();
  // Match the route rather than comparing strings: Amplify Hosting redirects
  // /onboarding to /onboarding/, which the route still renders.
  const onOnboarding = useMatch('/onboarding') !== null;
  const onAcceptInvite = useMatch('/join/accept') !== null;
  const onDocuments = useMatch('/onboarding/documents') !== null;
  const onNoOrg = useMatch('/no-organisation') !== null;
  const noOrg = !!user && !user.orgId;
  if (loading) return <p>Loading…</p>;
  if (onAcceptInvite) return <Outlet />;
  if (readPendingInvite()) return <Navigate to="/join/accept" replace />;
  if (noOrg) {
    // /onboarding only once their token has dropped the role they had
    if (onNoOrg || (onOnboarding && needsOnboarding)) return <Outlet />;
    return <Navigate to="/no-organisation" replace />;
  }
  if (onNoOrg) return <Navigate to="/" replace />;
  if (needsOnboarding && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (!needsOnboarding && onOnboarding) return <Navigate to="/" replace />;
  if (missingDocuments.length && !onDocuments) return <Navigate to="/onboarding/documents" replace />;
  if (!missingDocuments.length && onDocuments) return <Navigate to="/" replace />;
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
  // Set by the invite landing page's "Create an account" / "I already have an account"
  const [params] = useSearchParams();
  const fromInvite = readPendingInvite() !== null;

  return (
    <Authenticator
      initialState={params.get('mode') === 'signUp' ? 'signUp' : 'signIn'}
      socialProviders={['google']}
      formFields={fromInvite ? inviteSignUpFormFields : signUpFormFields}
      components={signUpComponents}
      services={authServices}
    >
      <UserProvider>
        <Routes>
          <Route element={<OnboardingGate />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/join/accept" element={<AcceptInvite />} />
            <Route path="/onboarding/documents" element={<OnboardingDocuments />} />
            <Route path="/no-organisation" element={<NoOrganisation />} />
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
        <Route path="/join" element={<JoinInvite />} />
        {/* Everything else goes through the Authenticator */}
        <Route path="*" element={<AuthedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
