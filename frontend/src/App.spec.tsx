import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

vi.mock('./presentation/pages/PublicQrPage', () => ({
  PublicQrPage: () => <div>PublicQrPage</div>,
}));
vi.mock('./presentation/pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>NotFoundPage</div>,
}));

describe('AppRoutes', () => {
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
