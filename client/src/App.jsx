import React, { createContext, useContext, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { Home, Property, Auth, Dashboard } from './pages.jsx';

const AuthCtx = createContext();
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const login = ({ token, user }) => {
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); setUser(user);
  };
  const logout = () => { localStorage.clear(); setUser(null); };
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/property/:id" element={<Property />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </AuthCtx.Provider>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="nav">
      <Link to="/" className="logo">Stayhaus</Link>
      <nav>
        {user ? (<>
          <Link to="/dashboard">Dashboard</Link>
          <button className="link" onClick={() => { logout(); nav('/'); }}>Log out</button>
        </>) : (<>
          <Link to="/login">Log in</Link>
          <Link to="/register" className="btn small">Sign up</Link>
        </>)}
      </nav>
    </header>
  );
}
