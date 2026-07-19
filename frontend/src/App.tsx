import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './presentation/pages/DashboardPage';
import { NotFoundPage } from './presentation/pages/NotFoundPage';
import { PublicQrPage } from './presentation/pages/PublicQrPage';

function AuthGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then((res) => {
      if (!res.ok) window.location.replace('/api/auth/login');
    }).catch(() => {
      window.location.replace('/api/auth/login');
    });
  }, []);
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthGate><DashboardPage /></AuthGate>} />
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
