import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './presentation/pages/NotFoundPage';
import { PublicQrPage } from './presentation/pages/PublicQrPage';

function HomePage() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          setAuthed(true);
          setChecked(true);
        } else {
          window.location.replace('/api/auth/login');
        }
      })
      .catch(() => {
        window.location.replace('/api/auth/login');
      });
  }, []);

  if (!checked || !authed) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-gray-500">Dashboard en cours de construction.</p>
      <button
        className="text-sm text-gray-400 hover:underline"
        onClick={() => {
          void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => {
            window.location.replace('/api/auth/login');
          });
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/q/:id" element={<PublicQrPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
