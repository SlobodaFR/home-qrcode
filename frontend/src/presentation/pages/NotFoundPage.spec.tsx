import { render, screen } from '@testing-library/react';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  // Test 15 — TPP: constant
  it('should render a 404 message', () => {
    render(<NotFoundPage />);
    expect(screen.getByText(/404/i)).toBeTruthy();
  });
});
