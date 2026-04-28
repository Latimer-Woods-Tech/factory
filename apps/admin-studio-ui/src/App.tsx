import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './stores/session.js';
import { EnvironmentBanner } from './components/EnvironmentBanner.js';
import { LoginPage } from './pages/LoginPage.js';
import { Dashboard } from './pages/Dashboard.js';

export default function App() {
  const { hydrate, isAuthed } = useSession();

  useEffect(() => { hydrate(); }, [hydrate]);

  if (!isAuthed()) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <EnvironmentBanner />
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/*" element={<Dashboard />} />
      </Routes>
    </>
  );
}
