import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './presentation/pages/NotFoundPage';
import { PublicQrPage } from './presentation/pages/PublicQrPage';

function LoginRedirect() {
  useEffect(() => {
    window.location.replace('/api/auth/login');
  }, []);
  return null;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginRedirect />} />
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
