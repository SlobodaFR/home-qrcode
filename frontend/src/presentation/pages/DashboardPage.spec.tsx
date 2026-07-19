import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import * as hooks from '../../application/hooks/useDashboard';
import type { CreateQrPayload } from '../../infrastructure/api/qr-auth.client';

const mockCreate = vi.fn();
const mockRemove = vi.fn();

beforeEach(() => {
  vi.spyOn(hooks, 'useDashboard').mockReturnValue({
    state: 'ready',
    items: [],
    total: 0,
    create: mockCreate,
    remove: mockRemove,
  });
});

afterEach(() => vi.restoreAllMocks());

describe('CreateForm', () => {
  // Test 47 — TPP: constant
  it('should render Wi-Fi, Email, vCard type buttons in the form', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /wi-fi/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /email/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /vcard/i })).toBeTruthy();
  });

  // Test 48 — TPP: conditional
  it('should render ssid, security select, and password inputs when Wi-Fi is selected', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /wi-fi/i }));
    expect(screen.getByPlaceholderText(/ssid/i)).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy();
  });

  // Test 49 — TPP: conditional
  it('should hide password input when security select is set to nopass', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /wi-fi/i }));
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'nopass' } });
    expect(screen.queryByPlaceholderText(/password/i)).toBeNull();
  });

  // Test 50 — TPP: conditional
  it('should render to, subject, body inputs when Email is selected', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /email/i }));
    expect(screen.getByPlaceholderText(/destinataire|to|recipient/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/sujet|subject/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/message|body/i)).toBeTruthy();
  });

  // Test 51 — TPP: conditional
  it('should render name, phone, email, org inputs when vCard is selected', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /vcard/i }));
    expect(screen.getByPlaceholderText(/nom|name/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/t[ée]l[ée]phone|phone/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/organisation|org/i)).toBeTruthy();
  });

  it('should send vcardEmail (not email) in vcard payload to match backend DTO field name', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /vcard/i }));
    fireEvent.change(screen.getByPlaceholderText(/nom|name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/^email$/i), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /g[ée]n[ée]rer/i }));
    await waitFor(() => {
      const call = mockCreate.mock.calls[0][0] as CreateQrPayload;
      expect(call).toMatchObject({ contentType: 'vcard', name: 'Jane Doe', vcardEmail: 'jane@example.com' });
      expect(call).not.toHaveProperty('email');
    });
  });

  // Test 52 — TPP: conditional
  it('should call onCreate with wifi CreateQrPayload on form submit', async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /wi-fi/i }));
    fireEvent.change(screen.getByPlaceholderText(/ssid/i), { target: { value: 'HomeNet' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /g[ée]n[ée]rer/i }));
    await waitFor(() => {
      const call = mockCreate.mock.calls[0][0] as CreateQrPayload;
      expect(call).toMatchObject({ contentType: 'wifi', ssid: 'HomeNet', security: 'WPA', password: 'secret' });
    });
  });
});
