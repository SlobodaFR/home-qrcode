import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './presentation/pages/NotFoundPage';
import { PublicQrPage } from './presentation/pages/PublicQrPage';

export function AppRoutes() {
  return (
    <Routes>
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
