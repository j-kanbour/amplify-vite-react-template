import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { UserProvider } from './context/UserContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';

function Nav() {
  const { signOut } = useAuthenticator();
  return (
    <nav>
      <Link to="/">Home</Link> <Link to="/dashboard">Dashboard</Link>
      <button onClick={signOut}>Sign out</button>
    </nav>
  );
}

export default function App() {
  return (
    <Authenticator>
      <UserProvider>
        <BrowserRouter>
          <Nav />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<h1>404</h1>} />
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </Authenticator>
  );
}