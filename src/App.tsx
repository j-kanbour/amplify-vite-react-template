import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import { Authenticator, SelectField, useAuthenticator, TextField} from '@aws-amplify/ui-react';
import { UserProvider, useUser } from './context/UserContext';
import RequirePermission from './components/RequirePermission';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Invites from './pages/Invites';
import RoleSwitcher from './dev/RoleSwitcher'; // DEV ONLY, see src/dev

const formFields = {
  signUp: {
    name: { label: 'Full name', placeholder: 'Enter your full name', order: 1 },
    email: { order: 2 },
    password: { order: 3 },
    confirm_password: { order: 4 },
  },
};

const components = {
  SignUp: {
    FormFields() {

      const [role, setRole] = useState('Parent');
      const { validationErrors } = useAuthenticator();

      return (
        <>
          <Authenticator.SignUp.FormFields />
          <SelectField label="I am a" name="custom:role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Admin">Admin</option>
            <option value="Parent">Parent</option>
            <option value="Tutor">Tutor</option>
          </SelectField>
          {role === 'Admin' && (
            <TextField
              label="Organisation name"
              name="custom:orgName"
              placeholder="Enter your organisation"
              errorMessage={validationErrors['custom:orgName'] as string}
              hasError={!!validationErrors['custom:orgName']}
            />
          )}        
        </>
      );
    },
  },
};

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

export default function App() {
  return (
    <Authenticator formFields={formFields} components={components}>
      <UserProvider>
        <BrowserRouter>
          <RoleSwitcher /> {/* DEV ONLY */}
          <Nav />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route element={<RequirePermission permission="users.invite" />}>
              <Route path="/invites" element={<Invites />} />
            </Route>
            <Route path="*" element={<h1>404</h1>} />
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </Authenticator>
  );
}
