import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

vi.mock('./presentation/pages/PublicQrPage', () => ({
  PublicQrPage: () => <div>PublicQrPage</div>,
}));
vi.mock('./presentation/pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>NotFoundPage</div>,
}));

const replaceMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { replace: replaceMock },
  writable: true,
});

describe('AppRoutes', () => {
  it('should call window.location.replace for / path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(replaceMock).toHaveBeenCalledWith('/api/auth/login');
  });

  // Test 24 — TPP: constant
  it('should render PublicQrPage for /q/:id path', () => {
    render(
      <MemoryRouter initialEntries={['/q/abc-123']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText('PublicQrPage')).toBeTruthy();
  });

  // Test 25 — TPP: conditional
  it('should render NotFoundPage for unknown path', () => {
    render(
      <MemoryRouter initialEntries={['/unknown/path']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText('NotFoundPage')).toBeTruthy();
  });
});
