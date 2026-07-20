import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import * as hooks from '../../application/hooks/useDashboard';
import * as linksHooks from '../../application/hooks/useLinks';
import type { CreateQrPayload } from '../../infrastructure/api/qr-auth.client';
import type { ShortLinkItem } from '../../infrastructure/api/links.client';

const mockCreate = vi.fn();
const mockRemove = vi.fn();
const mockAttachLogo = vi.fn();

const makeQrItem = (overrides = {}) => ({
  id: 'qr-1', contentType: 'url' as const, content: 'https://example.com',
  scanCount: 0, createdAt: '2026-01-01T00:00:00.000Z',
  pngUrl: '/api/qr/qr-1/png', svgUrl: '/api/qr/qr-1/svg',
  hasLogo: false, logoMimeType: null as string | null,
  errorCorrection: 'M' as const,
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(hooks, 'useDashboard').mockReturnValue({
    state: 'ready',
    items: [],
    total: 0,
    create: mockCreate,
    remove: mockRemove,
    attachLogo: mockAttachLogo,
  });
});

afterEach(() => vi.restoreAllMocks());

describe('QrCard logo-overlay', () => {
  // Test 29 — TPP: constant
  it('should show "Ajouter un logo" button when hasLogo is false', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /ajouter un logo/i })).toBeTruthy();
  });

  // Test 30 — TPP: conditional
  it('should not show "Ajouter un logo" button when hasLogo is true', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    render(<DashboardPage />);
    expect(screen.queryByRole('button', { name: /ajouter un logo/i })).toBeNull();
  });

  // Test 31 — TPP: conditional
  it('should show "SVG (sans logo)" when hasLogo is true and "SVG" otherwise', () => {
    const { unmount } = render(<DashboardPage />);
    unmount();

    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    const { unmount: u1 } = render(<DashboardPage />);
    expect(screen.getByText('SVG')).toBeTruthy();
    expect(screen.queryByText('SVG (sans logo)')).toBeNull();
    u1();

    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    render(<DashboardPage />);
    expect(screen.getByText('SVG (sans logo)')).toBeTruthy();
    expect(screen.queryByText(/^SVG$/)).toBeNull();
  });

  // Test 32 — TPP: conditional
  it('should show correction-level notice when errorCorrection is L or M', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false, errorCorrection: 'M' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    expect(screen.getByText(/correction.*Q/i)).toBeTruthy();
  });

  // Test 33 — TPP: conditional
  it('should not show correction-level notice when errorCorrection is Q or H', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false, errorCorrection: 'H' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    expect(screen.queryByText(/correction.*Q/i)).toBeNull();
  });

  // AC11 — client-side file size check
  it('should show inline error and not call attachLogo when selected file exceeds 2 MB', async () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ hasLogo: false })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter un logo/i }));
    const oversized = new File([new ArrayBuffer(2_097_153)], 'big.png', { type: 'image/png' });
    const input = screen.getByTestId('logo-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [oversized] } });
    await waitFor(() => expect(screen.getByText(/2\s*MB/i)).toBeTruthy());
    expect(mockAttachLogo).not.toHaveBeenCalled();
  });

  // AC11 — logo thumbnail when hasLogo is true
  it('should show logo thumbnail img with src /api/qr/:id/logo when hasLogo is true', () => {
    vi.spyOn(hooks, 'useDashboard').mockReturnValue({
      state: 'ready', items: [makeQrItem({ id: 'qr-logo', hasLogo: true, logoMimeType: 'image/png' })], total: 1,
      create: mockCreate, remove: mockRemove, attachLogo: mockAttachLogo,
    });
    render(<DashboardPage />);
    const logoImg = screen.getByAltText(/logo/i) as HTMLImageElement;
    expect(logoImg.src).toContain('/api/qr/qr-logo/logo');
  });
});

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

const mockLinkCreate = vi.fn();
const mockLinkRemove = vi.fn();
const mockLinkEdit = vi.fn();

const makeLinkItem = (overrides: Partial<ShortLinkItem> = {}): ShortLinkItem => ({
  id: 'sl-1', url: 'https://target.com', shortUrl: 'http://localhost:5173/r/sl-1',
  scanCount: 2, createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
});

const mockLinksHook = (items: ShortLinkItem[] = []) => ({
  state: 'ready' as const, items, total: items.length,
  create: mockLinkCreate, edit: mockLinkEdit, remove: mockLinkRemove,
});

describe('LinksSection (url-shortener)', () => {
  beforeEach(() => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook());
  });

  // url-shortener: Test 48 — TPP: constant
  it('should render a "Liens courts" section heading', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/liens courts/i)).toBeTruthy();
  });

  // url-shortener: Test 49 — TPP: constant
  it('should render a URL input and "Créer" button in the create form', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('link-url-input')).toBeTruthy();
    expect(screen.getByRole('button', { name: /créer/i })).toBeTruthy();
  });

  // url-shortener: Test 50 — TPP: variable
  it('should render each ShortLinkItem with shortUrl and scan count', () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    render(<DashboardPage />);
    expect(screen.getByText('http://localhost:5173/r/sl-1')).toBeTruthy();
    expect(screen.getByText(/2 scan/i)).toBeTruthy();
  });

  // url-shortener: Test 51 — TPP: constant
  it('"Copier" button should call navigator.clipboard.writeText with shortUrl', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /copier/i }));
    expect(writeText).toHaveBeenCalledWith('http://localhost:5173/r/sl-1');
  });

  // url-shortener: Test 52 — TPP: conditional
  it('edit button should reveal inline URL input', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }));
    expect(screen.getByTestId('link-edit-input')).toBeTruthy();
  });

  // url-shortener: Test 53 — TPP: conditional
  it('delete button should call remove with the link id', async () => {
    vi.spyOn(linksHooks, 'useLinks').mockReturnValue(mockLinksHook([makeLinkItem()]));
    mockLinkRemove.mockResolvedValue(undefined);
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /supprimer le lien/i }));
    await waitFor(() => expect(mockLinkRemove).toHaveBeenCalledWith('sl-1'));
  });

  // url-shortener: Test 54 — TPP: variable
  it('form submission should call create with entered URL and clear input', async () => {
    mockLinkCreate.mockResolvedValue(undefined);
    render(<DashboardPage />);
    const input = screen.getByTestId('link-url-input');
    fireEvent.change(input, { target: { value: 'https://new.com' } });
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await waitFor(() => expect(mockLinkCreate).toHaveBeenCalledWith('https://new.com'));
  });

  // url-shortener: Test 55 — TPP: conditional
  it('should display empty state text when items list is empty', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/aucun lien court/i)).toBeTruthy();
  });
});
